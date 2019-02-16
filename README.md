# OverDark
WebGL multiplayer sandbox game

### Install
In ability to run game server the Python 3 and Python 3 PyPI packages installer is required

### Prerequisites
```
pip3 install -r requirements.txt
```

### Run
Application is based on web server so after running local web server you can connect by web browser (recommended Chrome)
```
python3 game.py [ip, port]

E.g. python3 game.py 127.0.0.1 80 -> http://localhost
```

### Controls
```
Movement = WSAD
Toolbar = Wheel
Equip Item = Alt + Left/Right Mouse
Item primary function = Mouse
Item secondary function = Shift + Mouse
Inventory = E
Chat = T
Function = F
```
### Playable demo

[http://od.marcus.cf](http://od.marcus.cf)

<a href="http://www.youtube.com/watch?feature=player_embedded&v=2zuRVztyG2Q
" target="_blank"><img src="http://img.youtube.com/vi/2zuRVztyG2Q/0.jpg" 
alt="OverDark" width="240" height="180" border="10" /></a>

### Project structure

```
Server side:

game.py - Flask server, socketio hooks
server.py - Server, player classes
generator.py - World generation
actors.py - World actors

recipes - recipes for crafting table

Client side:

static/src/Game.js - Main game class
static/src/GUI.js - GUI, inventory
static/src/Terrain.js - World, chunks and actors spawn
static/src/Worker.js - Threaded chunk geometry builder
static/src/Actors.js - Equipped items functionality

Shared:

static/assets.json - All blocks, actors and items ids, models, materials, attributes.
```
