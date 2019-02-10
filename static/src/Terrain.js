// Terrain and chunk management

var toSpawn = {};
var spawned = {};

var sw = 0;
stopwatch = function() {
    var d = new Date();
    sw = d.getTime() - sw;
    console.log(sw/(1000));
}

function setToValue(obj, value, path) {
    path = path.split('.');
    for (i = 0; i < path.length - 1; i++)
        obj = obj[path[i]];

    obj[path[i]] = value;
}

// Chunk geometry builder worker
var worker = new Worker('/static/src/Worker.js');

data = ['setCHR', readCookie('chunkR')];
worker.postMessage(data);

// Add chunk geometry to scene from worker generated data
worker.onmessage = function(e) {
    if(e.data[0] == 'get') {
        traceBlock = e.data[1];
        return;
    }
    var index = String(e.data[0][0])+'x'+String(e.data[0][1]);
    if(!(index in chunks)) {
        var chunk = new BABYLON.GroundMesh("chunk", scene);
        chunk.position = new BABYLON.Vector3(e.data[0][0]*16, 0, e.data[0][1]*16);
        chunk.material = mat;
        chunk.checkCollisions = true;
        chunk.receiveShadows = true;
            
        chunk.uniqueId = e.data[4];
        chunks[index] = chunk;

        let actors = createActors(toSpawn[index]);
        spawned[index] = actors;
        delete toSpawn[index];
    }
    else
        var chunk = chunks[index];
        
    vertexData = new BABYLON.VertexData();
    vertexData.positions = new Uint8Array(e.data[1]);
    vertexData.indices = new Uint16Array(e.data[2]);
    var normals = [];
    BABYLON.VertexData.ComputeNormals(vertexData.positions, vertexData.indices, normals);
    vertexData.normals = normals;
    vertexData.uvs = new Float32Array(e.data[3]);
    vertexData.applyToMesh(chunk, false);
}

socket.on('createTerrain', function (data) {
    for(var i in data[0]) {
        var index = String(data[0][i][0][0])+'x'+String(data[0][i][0][1]);
        toSpawn[index] = data[1][i];
    }
    data[0].unshift('create');
    worker.postMessage(data[0]);
});

// Create actors from server data
createActors = function(data) {
    let actors = [];
    for(var i = 0; i < data[1].length; i++) {
        let actor = spawnActor(data[1][i]);
        actors.push(actor);
    }
    return actors;
}

destroyActors = function(data) {
    for(var i = 0; i < data.length; i++) {
        data[i].dispose();
    }
}

socket.on('destroyChunk', function (data)
{
    data.unshift('destroy');
    worker.postMessage(data);
    for(var i = 0; i < data.length; i++)
    {
        var index = String(data[i][0])+'x'+String(data[i][1]);
        if(chunks[index] != undefined)
        {
            chunks[index].dispose();
            delete chunks[index];

            destroyActors(spawned[index]);
            delete spawned[index];
        }
    }  
});

// Worker rebuild chunk after server block setting
socket.on('setBlock', function (data)
{
    data.unshift('update');
    worker.postMessage(data);
});