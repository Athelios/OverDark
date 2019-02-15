#!/usr/bin/python3
# -*- coding: utf8 -*-

from flask import Flask, render_template, redirect, session
from flask import request
from flask_socketio import SocketIO
import threading
import os
import sys
from flask_socketio import send, emit
import time
import hashlib
import dbm
import json
import console
import random
import requests
import uuid
from socketIO_client import SocketIO as SocketIO_client
import logging
import atexit

import server as SERVER

log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

# Flask web server
app = Flask(__name__)
# Realtime socket communication
socketio = SocketIO(app)

# Create game server
server = SERVER.server(app, socketio)

app.secret_key = os.urandom(64)


# In-game popup messages
popups = {}

try:
	with open('default/popups.json') as file:
		popups = json.load(file)
except:pass

def restart():
	server.world.database.close()
	os.execv(sys.executable, ['python3'] + sys.argv)

if not os.path.isdir("default"):
	os.makedirs("default")

# Load admins from admins file
if not os.path.isfile('admins'):
	f = open('admins', 'a')
	f.close()
f = open('admins', 'r')
admins = f.readlines()
for i in range(len(admins)):
	admins[i] = admins[i].rstrip()
f.close()

# Chat input
@socketio.on('input')
def chat(text):
	if text == "/stop":
		player = server.players[request.sid]
		if player:
			if player.username in admins:
				stop()
	elif text == "/restart":
		player = server.players[request.sid]
		if player:
			if player.username in admins:
				restart()
	elif text[:6] == "/popup":
		player = server.players[request.sid]
		if player.username in admins:
			for i in server.players.values():
				if i.username == text.split()[1]:
					popup = popups.get('custom')
					popup['text'] = text.split()[2]
					emit('popup', popup, room=i.sid)
	elif text[:5] == "/give":
		player = server.players[request.sid]
		if player:
			if player.username in admins:
				content = player.addInv(int(text[5:].split()[0]), int(text[5:].split()[1]))
				if content != None:
					emit('inv', content)
					server.world.database.saveInv(player)
	elif text[:3] == "/tp":
		if player.username in admins:
			username = text.split()[1]
			for i in server.players.values():
				if i.username == username:
					emit('teleport', [i.pos, i.rot])
	elif text[:5] == "/home":
		player = server.players[request.sid]
		home = server.world.database.getPlayer(player.username, 'home')
		if home:
			emit('teleport', home)
		else:
			emit('teleport', [[0, 40, 0], [0, 0, 0]])
	elif text[:8] == "/sethome":
		player = server.players[request.sid]
		server.world.database.setPlayer(player.username, 'home', [player.pos, player.rot])
	elif text[:6] == "/spawn":
		emit('teleport', [[0, 40, 0], [0, 0, 0]])
	else:
		console.chat(server.players[request.sid].username, text)

@app.route('/', methods=['POST'])
def index_post():
	usr = request.values.get('username')
	if not usr:
		usr = session.get('username')
	for i in server.players.values():
		if i.username == usr:
			return 'User with username ' + usr + ' is already logged in!'
	if len(server.players) >= server.max:
		return 'Server is full!'
	session['username'] = usr
	session['uuid'] = uuid.uuid4()
	return render_template('game.html')

@app.route('/', methods=['GET'])
def index_get():
	return render_template('login.html')

@app.route('/query', methods=['GET'])
def query():
	data = {'online': len(server.players), 'max': server.max}
	return json.dumps(data)

@app.route('/logout', methods=['GET', 'POST'])
def index_logout():
	session.pop('username', None)
	session.pop('uuid', None)
	return redirect(offic)

@socketio.on('connect')
def connect():
	if 'username' in session:
		server.players[request.sid] = SERVER.player(server, request.sid, [0, 45.6, -20])
	else:
		emit('popup', popups.get('restart'))

@socketio.on('login')
def login(uuid):
	updateCookies()
	server.players[request.sid].login(session.get('username'), session.get('uuid'))

@socketio.on('updateCookies')
def updateCookies():
	if request.cookies.get('chunkR'):
		CHR = int(request.cookies.get('chunkR'))
	else:
		CHR = 7
	if 3 <= CHR <= 8:
		server.players[request.sid].CHR = CHR

@socketio.on('logout')
def logout():
	disconnect()

@socketio.on('move')
def move(data):
	if request.sid in server.players:
		server.players[request.sid].move(data)

@socketio.on('inv')
def inv(data):
	server.players[request.sid].inventory(data[0], data[1])

@socketio.on('craft')
def craft(button):
	server.players[request.sid].chest.take(button)

@socketio.on('use')
def use(data):
	if data in server.world.actors:
		server.world.actors[data].use()

@socketio.on('setBlock')
def setBlock(data):
	if data[0] in server.world.actors:
		server.world.actors[data[0]].setBlock(data)

@socketio.on('setActor')
def setActor(data):
	if data[0] in server.world.actors:
		server.world.actors[data[0]].setActor(data)

@socketio.on('hit')
def hit(data):
	if data[0] in server.players and request.sid in server.players:
		server.players[data[0]].hit(server.players[request.sid], data[1])

@socketio.on('destroy')
def destroy(data):
	if data[0] in server.world.actors:
		server.world.actors[data[0]].destroy(data[1])

@socketio.on('disconnect')
def disconnect():
	if request.sid in server.players:
		del server.players[request.sid]

@socketio.on('tick')
def tick():
	server.world.tick()

def stop():
	server.world.database.close()
	import signal
	os.kill(os.getpid(), signal.SIGTERM)

# Ticking web thread
def threaded():
	ticker = SocketIO_client('127.0.0.1', port)
	while True:
		ticker.emit('tick')
		time.sleep(0.05)

def exit():
	server.world.database.close()

if __name__ == '__main__':
	atexit.register(exit)
	try:
		host = sys.argv[1]
	except:
		host = '0.0.0.0'
	try:
		port = int(sys.argv[2])
	except:
		port = 80
	thread = threading.Thread(target=threaded)
	thread.start()
	app.threaded = True
	socketio.run(app, host='0.0.0.0', port=port, debug=False)
