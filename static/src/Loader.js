// Helper scene for loadingt all assets
var loaderScene = new BABYLON.Scene(engine);
var loader = new BABYLON.AssetsManager(loaderScene);
// First load assets JSON file
var assets = loader.addTextFileTask("", "/static/assets.json")
loader.load();
loader.onFinish = function(tasks) {
    assets = JSON.parse(assets.text);
    loader = new BABYLON.AssetsManager(loaderScene);
    load();
};
// Load all textures, meshes needed in game from assets file
load = function() {
    for (var i in assets.textures) {
        assets.textures[i] = loader.addTextureTask("", "/static/"+assets.textures[i]);
    }
    for (var i in assets.meshes) {
        var path = assets.meshes[i].split("/");
        assets.meshes[i] = loader.addMeshTask("", "", "/static/models/"+path[0]+"/", path[1]);
    }
    loader.onFinish = function (tasks) {
        for (var i = 0; i < 10; i++)
            assets.textures[i].texture.hasAlpha = 1;
        socket.emit("login", myhash);
    };
    loader.load();
}

// Optimize for low-end devices
optimize = function() {
	scene.lightsEnabled = false;
	for(let i in scene.materials)
		scene.materials[i].emissiveTexture = scene.materials[i].diffuseTexture;
	for(let i in assets.meshes) {
		let mesh = assets.meshes[i].loadedMeshes[1] ? assets.meshes[i].loadedMeshes[1] : assets.meshes[i].loadedMeshes[0];
		if(mesh.material) {
            		mesh.material.emissiveTexture = mesh.material.diffuseTexture;
            		if(mesh.material.subMaterials) {
				for(let j in mesh.material.subMaterials) {
					mesh.material.subMaterials[j].emissiveTexture = mesh.material.subMaterials[j].diffuseTexture;
				}
			}
		}
	}
	handL.material.emissiveColor = handL.material.diffuseColor;
	handR.material.emissiveColor = handR.material.diffuseColor;
	BABYLON.StandardMaterial.DiffuseTextureEnabled = false;
}

// Return to default graphics settings
deoptimize = function() {
    scene.lightsEnabled = true;
    for(let i in scene.materials)
        scene.materials[i].emissiveTexture = undefined;
    for(let i in assets.meshes) {
        let mesh = assets.meshes[i].loadedMeshes[1] ? assets.meshes[i].loadedMeshes[1] : assets.meshes[i].loadedMeshes[0];
        if(mesh.material) {
            mesh.material.emissiveTexture = undefined;
            if(mesh.material.subMaterials) {
                for(let j in mesh.material.subMaterials) {
                    mesh.material.subMaterials[j].emissiveTexture = undefined;
                }
            }
        }
    }
    handL.material.emissiveColor = new BABYLON.Color3(0, 0, 0);
    handR.material.emissiveColor = new BABYLON.Color3(0, 0, 0);
    BABYLON.StandardMaterial.DiffuseTextureEnabled = true;
}


settings_apply = function(data) {
	for(let i in data) {
		let value = data[i];
        switch (i) {
            case "models_quality":
                switch (value) {
					case 1:
						optimize();
						break;
					case 2:
						break;
					case 3:
						deoptimize();
						break;
                }
                break;
            case "chunk_radius":
                createCookie('chunkR', value, 1000);
                post = ['setCHR', readCookie('chunkR')];
                worker.postMessage(post);
                socket.emit('updateCookies');
                break;
            case "display_scaling":
                engine.setHardwareScalingLevel(value);
                break;
            case "pixelization":
                switch (value) {
                  case 0:
				  	document.getElementById('renderCanvas').style.imageRendering = 'auto';
					break;
                  case 1:
				    document.getElementById('renderCanvas').style.imageRendering = 'pixelated';
					break;                    
                }
        }
    }
}
