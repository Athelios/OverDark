#!/usr/bin/python
# -*- coding: utf8 -*-

import math
import time, threading
from flask import request
from flask_socketio import SocketIO
from flask_socketio import send, emit
import world
import json
import random

# Server object
class server:
    def __init__(self, app, socketio):
        self.app = app
        self.socketio = socketio
        self.max = 50
        self.players = {}
        self.world = world.world(self)
        with open('static/assets.json') as file:
            loaded = json.load(file)
            self.items = loaded['items']
            self.blocks = loaded['blocks']
            self.actors = loaded['actors']

    # Decide what drop give to player
    def getDrop(self, player, slot, id):
        data = []
        if id < 256:
            try:
                actors = self.blocks[str(id)]
            except:
                return data
        if id >= 256:
            try:
                actors = self.actors[str(id-256)]
            except:
                return data
        destroy = actors.get('destroy')
        items = actors.get('items')
        if destroy:
            item = player.inv.get(str(slot))
            if item:
                if item['id'] == destroy[0]:
                    data.append([destroy[2], destroy[1]])
                    return data
        if items:
            for i in items:
                if random.random() < i[0]:
                    data.append([i[2], i[1]])
        return data

    # Give drop to player
    def giveDrop(self, player, slot, id):
        items = []
        for i in self.getDrop(player, slot, id):
            content = player.addInv(i[0], i[1])
            if content != None:
                items.append(content)
                emit('inv', content)
        if items:
            self.world.database.saveInv(player)

    def getAttribut(self, attb, id, bItem=True):
        attribut = None
        if id == None or attb == None:
            return attribut
        if bItem:
            item = self.items.get(str(id))
            if item:
                attribut = item.get(attb)
        return attribut

    def getId(self, player, slot):
        id = None
        item = player.inv.get(str(slot))
        if item:
            id = item['id']
        return id

# Server-side representation of player
class player:
    def __init__(self, server, sid, pos):
        self.server = server
        self.world = server.world
        self.sid = sid
        # Chunk Radius
        self.CHR = 7
        self.chunks = []
        self.pos = pos
        self.rot = [0, 0, 0]
        self.dir = [0, 0, 0]
        self.pairs = []
        # Determine chunk position player standing on
        self.chunkPosition = []
        self.chunkPosition.append(int(math.ceil(self.pos[0]/self.world.BS*self.world.BC)*self.world.BS*self.world.BC))
        self.chunkPosition.append(int(math.ceil(self.pos[2]/self.world.BS*self.world.BC)*self.world.BS*self.world.BC))
        self.inv = {}
        self.drag = None
        self.chest = None
        self.username = None
        self.health = 100.0
        self.energy = 100.0

    # Player login
    def login(self, username, myhash):
        self.username = username
        self.myhash = myhash

        self.inv = self.world.database.getInv(self)

        emit('spawn', {'sid':request.sid,'type':'player','position':self.pos,'name':self.username}, broadcast=True, include_self=False)

        stats = self.world.database.getPlayer(self.username, 'stats')
        if stats:
            self.health, self.energy = stats
        else:
            self.world.database.setPlayer(self.username, 'stats', [self.health, self.energy])

        data = {"position":self.pos, 'stats':[self.health, self.energy]}

        # Init and start game
        emit('init', data)
        # Load inventory
        emit('inv', self.inv)

        # Spawn other players
        for i in self.server.players:
            if i != self.sid:
                emit('spawn', {'sid':i,'type':'player','position':self.server.players[i].pos,'name':self.server.players[i].username})

    def __del__(self):
        self.world.destroyChunkServer(self.chunks)
        emit('destroy', {'sid':request.sid,'type':'player'}, broadcast=True, include_self=False)

    # Player move
    def move(self, data):
        self.pos = data[0]
        self.chunkPosition[0] = int(math.ceil(self.pos[0]/(self.world.BS*self.world.BC))*self.world.BS*self.world.BC)
        self.chunkPosition[1] = int(math.ceil(self.pos[2]/(self.world.BS*self.world.BC))*self.world.BS*self.world.BC)
        self.rot = data[1]
        self.dir = data[2]
        # Check chunks around player
        self.world.checkChunks(self)
        # Emit movement to all other players
        emit('move', [request.sid, self.pos, self.rot, self.dir], broadcast=True, include_self=False)

    # Player has been hit
    def hit(self, player, slot):
        id = self.server.getId(player, slot)
        damage = self.server.getAttribut('damage', id)
        if damage != None:
            self.health -= damage
        else:
            self.health -= 5
        if self.health <= 0:
            self.health = 100
            emit('death', room=self.sid)
        emit('stats', [self.health, self.energy], room=self.sid)

    # Get inventory item in slot
    def getInv(self, slot):
        if slot == None:
            return None
        # Own inventory
        if slot < 60:
            if str(slot) in self.inv:
                return self.inv[str(slot)]
            else:
                return None
        # Current associated chest inventory
        elif slot < 126:
            if self.chest:
                if str(slot) in self.chest.items:
                    return self.chest.items[str(slot)]
                else:
                    return None
        return None

    # Set inventory item in slot
    def setInv(self, slot, data):
        # Own inventory
        if slot < 60:
            if data != None:
                if data['qv'] > 0:
                    self.inv[str(slot)] = data
                else:
                    del self.inv[str(slot)]
            else:
                del self.inv[str(slot)]
        # Current associated chest inventory
        elif slot < 126:
            if self.chest:
                if data != None:
                    if data['qv'] > 0:
                        self.chest.items[str(slot)] = data
                    else:
                        del self.chest.items[str(slot)]
                else:
                    del self.chest.items[str(slot)]
                self.chest.save()
                for i in self.server.players.values():
                    if i.chest == self.chest and i != self:
                        emit('inv', {str(slot):data}, room=i.sid)

    # Add id to the player inventory
    def addInv(self, id, qv = 1):
        if id < 1:
            return None
        for i in sorted(self.inv):
            if self.inv[i]['id'] == id and self.inv[i]['qv']+qv <= 64:
                self.inv[i]['qv'] += qv
                return {i:{'id':id, 'qv':self.inv[i]['qv']}}
        for i in range(60):
            if str(i) not in self.inv:
                self.inv[str(i)] = {'id':id, 'qv':qv}
                return {str(i):{'id':id, 'qv':qv}}
        return None

    # Take item from slot in the player inventory
    def takeItem(self, slot):
        if not (0 <= slot <= 9):
            return False
        if not self.inv[str(slot)]:
            return False
        self.inv[str(slot)]['qv'] -= 1
        if self.inv[str(slot)]['qv'] > 0:
            self.world.database.saveInv(self)
            emit('inv', {str(slot): self.inv[str(slot)]})
        else:
            del self.inv[str(slot)]
            self.world.database.saveInv(self)
            emit('inv', {str(slot): None})
        return True

    # Player has been doing item operation in inventory
    def inventory(self, button, slot):
        if slot < 0:
            return

        item = self.getInv(slot)
        
        if item == None:
            action = 'stopDrag'
        else:
            if self.drag == None:
                action = 'startDrag'
            else:
                action = 'addDrag'
        if button == 1:
            action += 'Right' 
            
        if action == "startDrag":
            self.drag = dict(item)
            item = None
            self.setInv(slot, item)
        if action == "stopDrag":
            item = dict(self.drag)
            self.setInv(slot, item)
            self.drag = None
        if action == "addDrag":
            if item == None:
                item = dict(self.drag)
                self.setInv(slot, item)
                self.drag = None
            else:
                if item['id'] == self.drag['id']:
                    soucet = item['qv'] + self.drag['qv']
                    if soucet > 64:
                        item['qv'] = 64
                        self.setInv(slot, item)
                        self.drag['qv'] = soucet - 64
                    else:
                        item['qv'] = soucet
                        self.setInv(slot, item)
                        self.drag = None
                else:
                    self.setInv(slot, self.drag)
                    meta = dict(self.drag)
                    self.drag = dict(item)
                    item = meta
        if action == 'startDragRight':
            soucet = item['qv']
            self.drag = dict(item)
            item['qv'] = int(item['qv']/2)
            self.drag['qv'] = soucet - item['qv'] 
            if item['qv'] < 1:
                item = None          
            self.setInv(slot, item)
        if action == 'stopDragRight':
            self.drag['qv'] -= 1
            item = dict(self.drag)
            item['qv'] = 1
            self.setInv(slot, item)
            if self.drag['qv'] < 1:
                self.drag = None
        if action == 'addDragRight':
            if item['id'] == self.drag['id']:
                if item['qv'] + 1 <= 64:
                    item['qv'] += 1
                    self.setInv(slot, item)
                    self.drag['qv'] -= 1
                    if self.drag['qv'] < 1:
                        self.drag = None
            else:
                self.setInv(slot, self.drag)
                meta = dict(self.drag)
                self.drag = dict(item)
                item = meta
        self.world.database.saveInv(self)
        emit('correct', [self.drag, {str(slot):item}])
