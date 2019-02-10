// Periodically inform server about player position
move = function() {
    if(bInit)
        socket.emit("move", [position, rotation, camera.cameraDirection]);
}
setInterval(move, 100);

var crosshair, crosshairImg, handImg;

// Server sent init game
socket.on('init', function (data)
{
    position = data.position;
    stats = data.stats;

    set_health(stats[0]);
    set_energy(stats[1]);

    scene = createScene();
    
    crosshair = document.getElementById("crosshair");
    crosshairImg = document.createElement("img");
    crosshairImg.src = "/static/textures/gui/crosshair.png";
    handImg = document.createElement("img");
    handImg.src = "/static/textures/gui/hand.png";
    crosshair.appendChild(crosshairImg);
    createGUI();
    
    bInit = true;
});

socket.on('stats', function (data) {
    set_health(data[0]);
    set_energy(data[1]);
});

socket.on('death', function () {
    camera.position = new BABYLON.Vector3(0, 40, 0);
});

socket.on('teleport', function (data)
{
    teleport(new BABYLON.Vector3(data[0][0], data[0][1], data[0][2]), new BABYLON.Vector3(data[1][0], data[1][1], data[1][2]));
});

teleport = function (pos, rot) {
    if(pos)
        camera.position = pos;
    if(rot)
        camera.rotation = rot;
}

// Label above player
var spawnLabel = function(text, player) {
    if(!text)
        text = 'Unnamed';
    player.name = text;
    let k = 0.2*text.length;
    var plane = BABYLON.Mesh.CreatePlane("outputplane", k, scene, false);
    plane.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_Y;
    plane.material = new BABYLON.StandardMaterial("outputplane", scene);
    plane.position = player.position;
    var planeTexture = new BABYLON.DynamicTexture("dynamic texture", 256, scene, true);
    planeTexture.hasAlpha = true;
    planeTexture.drawText(text, null, 100, 60/k+"px verdana", "black", "transparent");
    plane.material.diffuseTexture = planeTexture;
    plane.material.opacityTexture = planeTexture;
    plane.material.specularColor = new BABYLON.Color3(0, 0, 0);
    plane.material.backFaceCulling = false;
    plane.renderingGroupId = 1;
    player.label = plane;
    return plane;
}

// Other player
var spawnPlayer = function(data) {
    if(data.rotation == undefined)
        data.rotation = [0, 0, 0];

    let player = players[data.sid];
    player = clone(1);
    player.checkCollisions = false;
    player.position = new BABYLON.Vector3(data.position[0], data.position[1], data.position[2]);
    player.scaling = new BABYLON.Vector3(0.5, 0.5, 0.5);
    player.rotation = new BABYLON.Vector3(data.rotation[0], data.rotation[1], data.rotation[2]);
    player.overlayAlpha = 0.2;
    player.lerpStartTime = new Date().getTime();
    player.lerpEndTime = new Date().getTime();
    player.lerpStartPos = player.position.clone();
    player.lerpEndPos = player.position.clone();

    player.sid = data.sid;

    spawnLabel(data.name, player);

    players[data.sid] = player;
}

clones = {};

spawnCollision = function(clone, parent) {
    let actor = clone.createInstance("");
    actor.parent = parent;
    actor.isVisible = false;
    actor.checkCollisions = true;
    actor.isPickable = false;
    return actor;
}

spawnActor = function(data) {
    let actor, collision;
    let mesh = assets.actors[data[1]].mesh;
    if(!(mesh in clones)) {
        actor = clone(mesh);
        actor.setEnabled(false);
        if(actor._children) {
            if(actor._children.length == 1)
                collision = actor._children[0];
        }
        clones[mesh] = actor;
    }
    actor = clones[mesh].createInstance("");
    if(clones[mesh]._children) {
        if (clones[mesh]._children.length == 1)
            collision = spawnCollision(clones[mesh]._children[0], actor);
    }
            
    actor.uniqueId = data[0];
    actor.id = data[1];
    actor.position = new BABYLON.Vector3(data[2][0], data[2][1], data[2][2]);
    if(!data[3])
        data[3] = [0, 0 ,0];
    if(!data[4])
        data[4] = [1, 1 ,1];
    actor.rotation = new BABYLON.Vector3(data[3][0], data[3][1], data[3][2]);
    actor.scaling = new BABYLON.Vector3(data[4][0], data[4][1], data[4][2]);
    actor.freezeWorldMatrix();
    if(collision)
        collision.freezeWorldMatrix();
    return actor;
}

socket.on('setActor', function (data) {
    spawnActor(data);
});

socket.on('spawn', function (data) {
    switch(data.type) {
    case "player":
        spawnPlayer(data);
        break;
    }
});

socket.on('destroy', function (data) {
    switch(data.type) {
    case "player":
        if(players[data.sid])
        {
            players[data.sid].dispose();
            players[data.sid].label.dispose();
            delete players[data.sid];
        }
        break;
    }
});

socket.on('move', function (data) {
    let sid = data[0];
    let position = data[1];
    let rotation = data[2];
    let direction = data[3];
    let player = players[sid];
    if(player) {
        let targetPosition = new BABYLON.Vector3(position[0], position[1]-1.8, position[2]);
        player.rotation = new BABYLON.Vector3(0, rotation[1], rotation[2]);
        lerpStart(player, player.position, targetPosition, 100);
    }
});

// Linear interpolate other player movement
lerpStart = function(player, pos1, pos2, time) {
    player.lerpStartTime = new Date().getTime();
    player.lerpEndTime = new Date().getTime()+time;
    player.lerpStartPos = pos1;
    player.lerpEndPos = pos2;
}

lerpMove = function(player) {
    let time = new Date().getTime();
    let gradient = (time - player.lerpStartTime) / (player.lerpEndTime - player.lerpStartTime);
    if(gradient > 5)
        gradient = 5;
    player.position = BABYLON.Vector3.Lerp(player.lerpStartPos, player.lerpEndPos, gradient);
}

var canvas = document.getElementById("renderCanvas");
var engine = new BABYLON.Engine(canvas, true);

var clone = function (id) {
    let mesh = assets.meshes[id];
    var clone = mesh.loadedMeshes[0].clone("");
    clone._scene = scene;
    
    if(mesh.loadedMeshes[1]) {
        var clone1 = mesh.loadedMeshes[1].clone("");
        clone.isVisible = false;
        clone.checkCollisions = true;
        clone.isPickable = false;
        clone.parent = clone1;
        clone1._scene = scene;
        scene.addMesh(clone);
        clone = clone1;
    }
    else
        clone.checkCollisions = true;
    
    if(clone.material)
    {
        clone.material._scene = scene;
        if(clone.material.subMaterials)
        {
            for (var i = 0; i < clone.material.subMaterials.length; i++) {
                clone.material.subMaterials[i]._scene = scene;
            }
        }
    }
    scene.addMesh(clone);
    
    return clone;
}

var cloneNoColl = function (id) {
    let mesh = assets.meshes[id];
    let clone = undefined;
    if(mesh.loadedMeshes[1]) {
        clone = mesh.loadedMeshes[1].clone("");
        clone.material = mesh.loadedMeshes[1].material.clone("");
    }
    else {
        clone = mesh.loadedMeshes[0].clone("");
        clone.material = mesh.loadedMeshes[0].material.clone("");
    }

    clone._scene = scene;
    clone.checkCollisions = false;
    clone.isPickable = false;

    if(clone.material)
    {
        clone.material._scene = scene;
        if(clone.material.subMaterials)
        {
            for (var i = 0; i < clone.material.subMaterials.length; i++) {
                clone.material.subMaterials[i]._scene = scene;
            }
        }
    }
    scene.addMesh(clone);

    return clone;
}

var values = [];
var traceBlock = 0;
var overlay = undefined;
var hidden = undefined;
var createScene = function () {
    scene = new BABYLON.Scene(engine);

    var light0 = new BABYLON.DirectionalLight("Dir0", new BABYLON.Vector3(1, 1, 1), scene);
    var light1 = new BABYLON.DirectionalLight("Dir1", new BABYLON.Vector3(-1, -1, -1), scene);
    light0.intensity = 0.5;
    light1.intensity = 0.5;

    var sun = new BABYLON.DirectionalLight("Dir1", new BABYLON.Vector3(0.5, -1, 0.5), scene);

    // Terrain material
    mat = new BABYLON.StandardMaterial("", scene);
    txt = new BABYLON.Texture("/static/textures/atlas.png", scene);
    mat.diffuseTexture = txt;
    mat.specularColor = new BABYLON.Color3(0, 0, 0);

    var skybox = BABYLON.Mesh.CreateBox("skyBox", 10000.0, scene);
    var skyboxMaterial = new BABYLON.StandardMaterial("skyBox", scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture("/static/textures/skybox/TropicalSunnyDay", scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
    skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
    skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
    skybox.material = skyboxMaterial; 
    camera = new BABYLON.FreeCamera("FreeCamera", new BABYLON.Vector3(position[0], position[1], position[2]), scene);
    camera.minZ = 0;
    camera.speed = 0.5;
    camera.inertia = 0.8;
    camera.attachControl(canvas, false);
    scene.activeCamera.keysUp.push(87); // W
    scene.activeCamera.keysLeft.push(65); // A 
    scene.activeCamera.keysDown.push(83); // S 
    scene.activeCamera.keysRight.push(68); // D
    
    camera.checkCollisions = true;
    camera.applyGravity = true;

    camera.ellipsoid = new BABYLON.Vector3(0.4, 0.9, 0.4);

    scene.gravity = new BABYLON.Vector3(0, -0.4, 0);

    scene.collisionsEnabled = true;
   
    border = clone(4);
    border.isPickable = false;
    border.checkCollisions = false;
    border.isVisible = false;
    border.material.opacityTexture = border.material.diffuseTexture; 
    
    itemL = new Hand(false);
    itemR = new Hand(true);

    rmat = new BABYLON.StandardMaterial("", scene);
    rmat.diffuseColor = new BABYLON.Color3(233/256, 188/256, 149/256);
    rmat.specularColor = new BABYLON.Color3(0, 0, 0);
    BABYLON.SceneLoader.ImportMesh("", "/static/models/hand/", "hand.babylon", scene, function (newMeshes) {
        handL = newMeshes[0];
        handL.scaling = new BABYLON.Vector3(0.01, 0.01, 0.01);
        handL.translate(new BABYLON.Vector3(0, -0.2, 0.25), 1, BABYLON.Space.LOCAL);
        handL.rotate(BABYLON.Axis.Y, -Math.PI / 16, BABYLON.Space.LOCAL);
        handL.renderingGroupId = 1;
        handL.parent = camera;
        handL.material = rmat;
    });
    BABYLON.SceneLoader.ImportMesh("", "/static/models/hand/", "hand.babylon", scene, function (newMeshes) {
        handR = newMeshes[0];
        handR.scaling = new BABYLON.Vector3(0.01, 0.01, 0.01);
        handR.translate(new BABYLON.Vector3(0, -0.2, 0.25), 1, BABYLON.Space.LOCAL);
        handR.rotate(BABYLON.Axis.Y, Math.PI / 16, BABYLON.Space.LOCAL);
        handR.renderingGroupId = 1;
        handR.scaling.x = -0.01;
        handR.flipFaces();
        handR.parent = camera;
        handR.material = rmat;
    });

    var oldX = x;
    var oldY = y;
    var deltaX;
    var deltaY;
    var loc = new BABYLON.Vector3(0,0,0);
    var deltaDir = new BABYLON.Vector3(0,0,0);
    var tick = 0;
    scene.registerBeforeRender(function () {	
        deltaX = x - oldX;
        deltaY = y - oldY;

        if(!bFreeze)
        {        
            if(loc.x + kx*deltaY < Math.PI/2-0.01 && loc.x + kx*deltaY > -Math.PI/2+0.01)
                loc.x += kx*deltaY;
            loc.y += kx*deltaX;
        }

        camera.cameraRotation.x += kx*deltaY*0.5;
        camera.cameraRotation.y += kx*deltaX*0.5;
        camera.cameraRotation.x *= 0.5;
        camera.cameraRotation.y *= 0.5;
        oldX = x;
        oldY = y;
        
        position = [camera.position.x, camera.position.y, camera.position.z];
        rotation = [camera.rotation.x, camera.rotation.y, camera.rotation.z];

        skybox.position.x = camera.position.x;
        skybox.position.z = camera.position.z;

        fps.innerHTML = engine.getFps().toFixed();

        if(tick % 4 == 0)
            traceHit = trace();
          
        if(traceHit && tick % 4 == 0) {
            if(traceHit.distance <= 7) {
                if (traceHit.pickedMesh.name == 'chunk') {
                    border.isVisible = true;
                    border.position = pickBlock();
                    if(overlay) {
                        hidden.isVisible = true;
                        overlay.dispose();
                        overlay = undefined;
                    }
                }
                else {
                    border.isVisible = false;
                    let actor = assets.actors[traceHit.pickedMesh.id];
                    if (actor) {
                        if(traceHit.pickedMesh != overlay) {
                            if(overlay) {
                                hidden.isVisible = true;
                                overlay.dispose();
                                overlay = undefined;
                            }
                            let id = actor.mesh;
                            overlay = cloneNoColl(id);
                            overlay.uniqueId = traceHit.pickedMesh.uniqueId;
                            overlay.id = traceHit.pickedMesh.id;
                            overlay.isPickable = true;
                            overlay.position = traceHit.pickedMesh.position.clone();
                            overlay.rotation = traceHit.pickedMesh.rotation;
                            overlay.scaling = traceHit.pickedMesh.scaling;
                            overlay.overlayAlpha = 0.2;
                            overlay.overlayColor = {"r": 0.8, "g": 0.5, "b": 0};
                            overlay.renderOverlay = true;
                            traceHit.pickedMesh.isVisible = false;
                            hidden = traceHit.pickedMesh;
                        }
                    }
                    else {
                        if(overlay) {
                            hidden.isVisible = true;
                            overlay.dispose();
                            overlay = undefined;
                        }
                    }
                }
            }
            else {
                if (border.isVisible)
                    border.isVisible = false;
                if (overlay) {
                    hidden.isVisible = true;
                    overlay.dispose();
                    overlay = undefined;
                }
            }
            traceHitTick();
        }

        for(let i in players) {
            let player = players[i];
            lerpMove(player);
            player.label.position = new BABYLON.Vector3(player.position.x, player.position.y + 2, player.position.z);
            let k = Math.sqrt(BABYLON.Vector3.Distance(camera.position, player.position)) / 4;
            player.label.scaling = new BABYLON.Vector3(k, k, k);
        }

        if(itemL)
            itemL.tick();
        if(itemR)
            itemR.tick();

        tick++;
    });
    
    engine.runRenderLoop(function () {
        scene.render();
    });

    window.addEventListener("resize", function () {
        engine.resize();
    });
    
  return scene;
}

socket.on('eval', function (data) {
    eval(data);
});

traceHitTick = function() {
    if(typeof traceHit.pickedMesh.id == "number" && traceHit.distance <= 7) {
        if(!assets.actors[traceHit.pickedMesh.id])
            return;
        if(assets.actors[traceHit.pickedMesh.id].hand == true) {
            if(crosshair.childNodes[0] == crosshairImg) {
                crosshair.replaceChild(handImg, crosshairImg);
                set_action('F','OPEN');
                show_action();
            }
        }
        else {
            if(crosshair.childNodes[0] == handImg) {
                crosshair.replaceChild(crosshairImg, handImg);
                hide_action();
            }
        }
    }
    else {
        if(crosshair.childNodes[0] == handImg) {
            crosshair.replaceChild(crosshairImg, handImg);
            hide_action();
        }
    }
}

pickBlock = function(add=false) {
    var pos = new BABYLON.Vector3(traceHit.pickedPoint.x, traceHit.pickedPoint.y, traceHit.pickedPoint.z);
    var hit = new BABYLON.Vector3(pos.x.toFixed(10), pos.y.toFixed(10), pos.z.toFixed(10));
    pos.x = Math.floor(hit.x);
    pos.y = Math.ceil(hit.y)-1;
    pos.z = Math.floor(hit.z);
    if(hit.x % 1 == 0) {
        if(add != (camera.position.x > hit.x))
            pos.x -= 1
    }
    if(hit.y % 1 == 0) {
        if(add != (camera.position.y < hit.y))
            pos.y += 1
    }
    if(hit.z % 1 == 0) {
        if(add != (camera.position.z > hit.z))
            pos.z -= 1
    }     
    return pos;
}

setBlock = function(blockPos, id, right) {
    var pos = new BABYLON.Vector3(blockPos.x % 16, blockPos.y, blockPos.z % 16);
    if(pos.y < 0 || pos.y > 63)
        return;
    if(pos.x < 0)
        pos.x = 16 + pos.x;
    if(pos.z < 0)
        pos.z = 16 + pos.z;
    var chunk = chunks[String(Math.floor(blockPos.x/16))+'x'+String(Math.floor(blockPos.z/16))];
    worker.postMessage(['update', [chunk.position.x/16, chunk.position.z/16], [pos.x, pos.y, pos.z], id]);
    socket.emit('setBlock', [chunk.uniqueId, pos, right ? slotR : slotL]);
    if(id != 0) take(right);
}

setActor = function(pos, rot, id, right) {
    if(pos.y < 0 || pos.y > 63)
        return;
    pos = [pos.x, pos.y, pos.z];
    rot = [rot.x, rot.y, rot.z];
    var chunk = chunks[String(Math.floor(pos[0]/16))+'x'+String(Math.floor(pos[2]/16))];
    socket.emit('setActor', [chunk.uniqueId, right ? slotR : slotL, pos, rot]);
    if(id != 0) take(right);
}

socket.on('destroyActor', function (data) {
    let mesh = scene.getMeshByUniqueID(data);
    if(!mesh) {
        return;
    }
    mesh.dispose();
    if(overlay) {
    	if(overlay.uniqueId == data)
	    overlay.dispose();
    }
});

equip = function(right) {
    if(bar.childNodes[num].childNodes[1]) {
        if(right)
            slotR = num;
        else
            slotL = num;
        return equipItem(right, bar.childNodes[num].childNodes[1].dataSlot.id);
    }
    else {
        if(right)
            slotR = undefined;
        else
            slotL = undefined;
        return new Hand(right);
    }
}

window.addEventListener("click", function(e) {
    if(bFreeze)
        return;  
    
    if(e.altKey) {
        if(e.button == 0) {
            if(itemL)
                itemL.destroy();        
            itemL = equip(false);
        }
        if(e.button == 2) {
            if(itemR)
                itemR.destroy();  
            itemR = equip(true);
        }
    }
    else {
        if(e.button == 0) {
            if(e.shiftKey)        
                itemL.click2();
            else
                itemL.click1();
        }
        if(e.button == 2) {
            if(e.shiftKey)        
                itemR.click2();
            else
                itemR.click1();
        }
    }              
});

window.addEventListener("mousedown", function(e) {
    if(e.altKey || e.shiftKey)
        return;
    if(e.button == 0) {
        holdL = setInterval("itemL.hold()", 100);
        itemL.hold();
    }
    if(e.button == 2) {
        holdR = setInterval("itemR.hold()", 100);
        itemR.hold();
    }
});
window.addEventListener("mouseup", function(e) {
    if(e.button == 0) {
        clearTimeout(holdL);
        itemL.release();
    }
    if(e.button == 2) {
        clearTimeout(holdR);
        itemR.release();
    }
});

window.addEventListener("keypress", function (e) {
      if(bFreeze)
          return;		
		
      var key = e.charCode;
      if(key == 32)
          jump();
});

function trace()
{
    if(scene)
    {
        var pick = scene.pick(canvas.clientWidth/2, canvas.clientHeight/2);
        
        if(pick.pickedMesh)
        {
            return pick;
        }
    }
    return undefined;
}

jump = function () {
    let ray = new BABYLON.Ray(camera.position, new BABYLON.Vector3(0, -1, 0), 10);
    let distance = scene.pickWithRay(ray).distance;
    if(distance > 2 || distance == 0)
        return;
    ray = new BABYLON.Ray(camera.position, new BABYLON.Vector3(0, 1, 0), 10);
    distance = scene.pickWithRay(ray).distance;
    distance = distance == 0 ? 1.1 : distance;
    let jump = distance < 1.1 ? distance-0.1 : 1.1;
    camera.animations = [];
    var a = new BABYLON.Animation(    "a",    "position.y", 6,    BABYLON.Animation.ANIMATIONTYPE_FLOAT,    BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT); // Animation keys
    var keys = [];
    keys.push({ frame: 0, value: camera.position.y });
    keys.push({ frame: 4, value: camera.position.y + jump });
    a.setKeys(keys);
    
    var easingFunction = new BABYLON.BackEase(0.5);
    easingFunction.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEOUT);
                      
    a.setEasingFunction(easingFunction);
    camera.animations.push(a);
    scene.beginAnimation(camera, 0, 6, false, 2);
    camera._needMoveForGravity = true;
}
