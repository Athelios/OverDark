import os
import shelve
import zlib
import json

class database:
    def __init__(self):
        if not os.path.isdir("world"):
            os.makedirs("world") 
        self.db = shelve.open('world/world', 'c')
        self.actors = shelve.open('world/actors', 'c')
        self.players = shelve.open('world/players', 'c')

    def addChunk(self, x, y, data):
        data = zlib.compress(bytes(data, 'UTF-8'))
        self.db[str(x)+'x'+str(y)] = data 
        
    def getChunk(self, x, y):
        data = self.db.get(str(x)+'x'+str(y))
        return data

    # Get chunk decompressed
    def getChunkDecomp(self, x, y):
        data = self.db.get(str(x)+'x'+str(y))
        if data:
            return zlib.decompress(data)
        return None

    # Add actor to DB
    def addActor(self, x, y, id, pos, rot = [0, 0, 0], scale = [1, 1, 1]):
        data = self.actors.get(str(x)+'x'+str(y))
        if not data:
            data = "[]"
            prefix = ""
        else:
            prefix = ", "
        data = data[:-1]
        data += prefix+json.dumps([id, pos, rot, scale])+"]"
        self.actors[str(x)+'x'+str(y)] = data

    # Delete actor from DB
    def delActor(self, x, y, index):
        data = self.getActors(x, y)
        del data[index]
        if data:
            self.actors[str(x)+'x'+str(y)] = json.dumps(data)
        else:
            del self.actors[str(x)+'x'+str(y)]
            
    def getActors(self, x, y):
        data = self.actors.get(str(x)+'x'+str(y))
        if data:
            data = json.loads(data)
            return data
        return None
    
    def saveActor(self, x, y, index, atb):
        data = self.getActors(x, y)
        if len(data[index]) > 4:
            data[index][4] = atb
        else:
            data[index].append(atb)
        self.actors[str(x)+'x'+str(y)] = json.dumps(data)
            
    def saveInv(self, player):
        self.players[player.username] = json.dumps(player.inv)
    
    def getInv(self, player):
        data = self.players.get(player.username)
        if data:
            data = json.loads(data)
            return data
        return {}

    def setPlayer(self, player, atb, value):
        value = json.dumps(value)
        self.players[player+'_'+atb] = value

    def getPlayer(self, player, atb):
        data = self.players.get(player+'_'+atb)
        if data:
            data = json.loads(data)
            return data
        return None

    def close(self):
        self.db.close()
        self.actors.close()
        self.players.close()
