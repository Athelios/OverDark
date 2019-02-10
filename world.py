from flask import request
from flask_socketio import emit
import database as Database
import generator as Generator
import actors as Actors
import random
import threading

def merge(x, y):
    z = x.copy()
    z.update(y)
    return z

# 16 x 16 x 64 chunk of world
class Chunk():
	def __init__(self, world, uid, pos):
		self.uid = uid
		self.world = world
		self.pos = pos
		self.actors = []
		self.loadActors()

	# Ticks all chunk actors
	def tick(self, ticks):
		for i in self.actors:
			i.tick(ticks)

	# Get all actors on chunk
	def getActors(self):
		actors = []
		for i in self.actors:
			actors.append(i.rep())
		return actors

	# Loads chunk actors from DB as objects
	def loadActors(self):
		actors = self.world.database.getActors(self.pos[0], self.pos[1])
		if not actors:
			return
		for i in actors:
			i.insert(0, self)
			actor = Actors.spawn(i)
			self.actors.append(actor)
			self.world.actors[actor.uid] = actor
			self.world.uid += 1

	# Player sets block
	def setBlock(self, e):
		pos = [e[1]['x'], e[1]['y'], e[1]['z']]

		# Decompress chunk blocks data from DB
		data = self.world.database.getChunkDecomp(self.pos[0], self.pos[1])
		# Find block at certain position
		block = data[pos[0]*1024+pos[2]*64+pos[1]]

		# Check player inventory item which players holds when setting block
		content = self.world.server.players[request.sid].getInv(e[2])

		# Player holds nothing or non-block item
		if content == None or not (1 <= content['id'] < 256):
			# Player is setting air -> return
			if block == 0:
				return
			# Else give player drop from broken block
			self.world.server.giveDrop(self.world.server.players[request.sid], e[2], block)
			content = {'id':0}
		# Player holds blocks
		else:
			# Decrease block quantity
			content['qv'] -= 1
			# Write change to inventory and DB
			if content['qv'] > 0:
				self.world.server.players[request.sid].setInv(e[2], content)
				self.world.database.saveInv(self.world.server.players[request.sid])
				emit('inv', {str(e[2]):content})
			elif content['qv'] == 0:
				self.world.server.players[request.sid].setInv(e[2], None)
				self.world.database.saveInv(self.world.server.players[request.sid])
				emit('inv', {str(e[2]):None})
			else:
				return

		# Realtime emit block setting to all other players having loaded this chunk
		for i in self.world.server.players.values():
			if self.pos in i.chunks:
				if i.sid != request.sid:
					emit('setBlock', [self.pos, pos, content['id']], room=i.sid)

		# Save chunk data to DB after change
		data = data.decode("ascii")
		index = pos[0]*1024+pos[2]*64+pos[1]
		data = data[:index] + chr(content['id']) + data[index+1:]
		self.world.database.addChunk(self.pos[0], self.pos[1], data)

	# Set (place) actor on chunk
	def setActor(self, data):
		player = self.world.server.players[request.sid]
		# Item held by player
		item = player.inv.get(str(data[1]))
		if item:
			id = item['id']
			actor_id = self.world.server.items[str(id)].get('actor')
			if actor_id == None:
				return
		else:
			return
		if not player.takeItem(data[1]):
			return

		data[0] = self.world.uid
		data[1] = actor_id

		# Emit actor placement to all other player having loaded this chunk
		for i in self.world.server.players.values():
			if self.pos in i.chunks:
				emit('setActor', data, room=i.sid)

		# Spawn actor
		data[0] = self
		actor = Actors.spawn(data)
		self.actors.append(actor)
		self.world.actors[actor.uid] = actor
		self.world.uid += 1

		# Add actor to DB
		self.world.database.addActor(self.pos[0], self.pos[1], data[1], data[2], data[3])

# World object consisting of chunks
class world:
	def __init__(self, server):
		self.server = server
		# Load database
		self.database = Database.database()
		# Block and actors generator
		self.generator = Generator.generator(self)
		# Block Size
		self.BS = 1
		# Block Count
		self.BC = 16

		self.uid = 1000
		self.actors = {}
		self.chunks = {}

		self.ticks = 0
		self.tick()

	# Ticks all loaded chunks
	def tick(self):
		for i in self.chunks.values():
			i.tick(self.ticks)
		self.ticks += 1

	# Need load chunk at certain position for player
	def createChunk(self, player, pos):
		# Append chunk position to player loaded chunks
		player.chunks.append(pos)
		# Chunk unique index from position
		index = str(pos[0])+'x'+str(pos[1])

		# Try get chunk from DB
		data = self.database.getChunk(pos[0], pos[1])
		# Chunk is not in DB -> generate new chunk at position
		if not data:
			self.generator.generateChunk(pos)
			# Now we cat get chunk from DB
			data = self.database.getChunk(pos[0], pos[1])

		# If chunk object isn't in world loaded chunks add it
		if index not in self.chunks:
			uid = self.uid
			self.uid += 1
			chunk = Chunk(self, uid, pos)
			self.chunks[index] = chunk
			self.actors[uid] = chunk

		# Return chunk from world loaded chunks
		return [self.chunks[index].uid, data]

	# Delete chunk object at position if non players have the chunk loaded
	def destroyChunkServer(self, pos):
		for i in pos:
			delete = True
			for j in self.server.players.values():
				if i in j.chunks:
					delete = False
			if delete:
				index = str(i[0]) + 'x' + str(i[1])
				del self.chunks[index]

	# Destroy chunk from player
	def destroyChunk(self, player, pos):
		for i in pos:
			player.chunks.remove(i)
		self.destroyChunkServer(pos)
		emit('destroyChunk', pos)

	# Get terrain for player from chunk locations and emit data to player
	def createTerrain(self, player, chunks):
		data = []
		actors = []
		for i in chunks:
			metadata = self.createChunk(player, i)
			data.append([i, metadata[1], metadata[0]])
			actors.append([i, self.chunks[str(i[0])+'x'+str(i[1])].getActors()])

		emit('createTerrain', [data, actors])

	# Check chunks in square around player, non-needed chunks unloads, non-loaded but needed chunks loads
	def checkChunks(self, player):
		chunks = []
		for i in range(-player.CHR*self.BC*self.BS+player.chunkPosition[0], player.CHR*self.BC*self.BS+player.chunkPosition[0], self.BS*self.BC):
			for j in range(-player.CHR*self.BC*self.BS+player.chunkPosition[1], player.CHR*self.BC*self.BS+player.chunkPosition[1], self.BS*self.BC):
				chunks.append([i/(self.BS*self.BC),j/(self.BS*self.BC)])

		destroyChunks = []
		for i in player.chunks:
			if i not in chunks:
				destroyChunks.append(i)

		if len(destroyChunks) != 0:
			self.destroyChunk(player, destroyChunks)

		createChunks = []
		for i in chunks:
			if i not in player.chunks:
				createChunks.append(i)

		if len(createChunks) != 0:
			self.createTerrain(player, createChunks)