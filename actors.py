from flask import request
from flask_socketio import send, emit
import json
import sys
import random

actors = None
recipes = []
# Load game actors
with open('static/assets.json') as file:
    actors = json.load(file)['actors']
# Load crafting recipes
with open('recipes') as file:
    recipes = file.readlines()

for i in range(len(recipes)):
    split1 = recipes[i].rstrip()
    split1 = split1.split('=')
    split2 = split1[0].split('x')
    recipes[i] = [int(split2[1]), int(split2[0]), split1[1]]

# Move recipe to left (remove gaps)
def moveY(items):
    its = list(items)
    for i in items:
        if i[0]-4 >= 0:
            move = [i[0]-4, i[1]]
            if move not in its:
                its.remove(i)
                its.append(move)
        else:
            return items
    its.sort()
    return its

# Move recipe to top (remove gaps)
def moveX(items):
    its = list(items)
    for i in items:
        if i[0] % 4 != 0:
            move = [i[0]-1, i[1]]
            if move not in its:
                its.remove(i)
                its.append(move)
        else:
            return items
    its.sort()
    return its

# Return minimal recipe left-top moved
def compileRecipe(items):
    its = []
    for i in items:
        its.append([int(i)-110, items[i]['id']])
    its.sort()
    for i in range(3):
        its = moveY(its)
        its = moveX(its)
    return its

# Get crafted item from recipe
def getCraftedItem(items):
    recipe = compileRecipe(items)
    for i in recipes:
        if i[2] == str(recipe):
            return [i[0], i[1]]
    return None

# Game actors
class actor:
    def __init__(self, data):
        self.chunk = data[0]
        self.uid = self.chunk.world.uid
        self.id = data[1]
        self.pos = data[2]
        try:
            self.rot = data[3]
        except IndexError:
            self.rot = [0,0,0]
        try:
            self.scale = data[4]
        except IndexError:
            self.scale = [1,1,1]

    # Replicate uid, id, position, rotation and scale
    def rep(self):
        return [self.uid, self.id, self.pos, self.rot, self.scale]
        
    def save(self):
        pass

    def tick(self, ticks):
        pass
        
    def use(self):
        pass

    # Delete actor from DB, loaded actors on chunk and emit destroy to players
    def destroy(self, slot):
        self.chunk.world.database.delActor(self.chunk.pos[0], self.chunk.pos[1], self.chunk.actors.index(self))
        self.chunk.actors.remove(self)
        del self.chunk.world.actors[self.uid]
        for i in self.chunk.world.server.players.values():
            if self.chunk.pos in i.chunks: 
                emit('destroyActor', self.uid, room=i.sid)
        del self

# Get drop item from actor
def getDrop(id):
    data = []
    items = actors[str(id)].get('items')
    if items:
        for i in items:
            if random.random() < i[0]:
                data.append([i[2], i[1]])
    return data

# Breakable actor
class breakable(actor):
    def __init__(self, data):
        actor.__init__(self, data)

    def destroy(self, slot):
        player = self.chunk.world.server.players[request.sid]
        if player:
            # Give drop to player
            self.chunk.world.server.giveDrop(player, slot, self.id+256)
        actor.destroy(self, slot)

# Actor with storage
class chest(breakable):
    def __init__(self, data):
        actor.__init__(self, data)
        self.items = {}
        if len(data) > 5:
            self.items = data[5]
        
    def use(self):
        self.chunk.world.server.players[request.sid].chest = self
        emit('inv', self.items)
        data = "freeze(true);chest.style.visibility = 'visible';inv.style.visibility = 'visible';"
        emit('eval', data)
        
    def save(self):
        self.chunk.world.database.saveActor(self.chunk.pos[0], self.chunk.pos[1], self.chunk.actors.index(self), self.items)

# Crafting table
class table(breakable):
    def __init__(self, data):
        actor.__init__(self, data)
        self.items = {}
        if len(data) > 5:
            self.items = data[5]
        self.item = getCraftedItem(self.items)
        
    def use(self):
        self.chunk.world.server.players[request.sid].chest = self
        emit('inv', self.items)
        emit('craft', self.item)
        data = "freeze(true);craft.style.visibility = 'visible';inv.style.visibility = 'visible';"
        emit('eval', data)

    def craft(self):
        self.item = getCraftedItem(self.items)
        emit('craft', self.item)

    def clear(self):
        for i in dict(self.items):
            self.items[i]['qv'] -= 1
            if self.items[i]['qv'] < 1:
                del self.items[i]
        self.craft()
        self.save()

    # Take item from table with button
    def take(self, button):
        player = self.chunk.world.server.players[request.sid]
        if button == 0:
            if player.drag:
                if self.item:
                    if player.drag['id'] == self.item[0]:
                        total = player.drag['qv'] + self.item[1]
                        if total <= 64:
                            player.drag['qv'] = total
                            self.clear()
            else:
                if self.item:
                    player.drag = {'id':self.item[0], 'qv':self.item[1]}
                    self.clear()
        else:
            pass

    def save(self):
        self.chunk.world.database.saveActor(self.chunk.pos[0], self.chunk.pos[1], self.chunk.actors.index(self), self.items)
        self.craft()

def getClass(str):
    return getattr(sys.modules[__name__], str)

def spawn(data):
    type = actors[str(data[1])]['type']
    c = getClass(type)
    a = c(data)
    return a
