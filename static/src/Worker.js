importScripts('3rd_party/pako.min.js');

var positions = [];
var indices = [];
var uvs = [];
var start = 0;

var chunks = {};

var CHR = 7;
var rad = 2*CHR-1;

var getBlock = function(chunk, x, y, z, ch0, ch1, ch2, ch3) {
    if(x < 0) return ch0[15*1024+y*64+z];
    if(x > 15) return ch1[0*1024+y*64+z];
    if(y < 0) return ch2[x*1024+15*64+z];
    if(y > 15) return ch3[x*1024+0*64+z];
    if(z < 0) return undefined;
    if(z > 63) return 0;
    return chunk[x*1024+y*64+z];
}

var getBlockWorld = function(x, y, z) {
    var index = String(Math.floor(x/16))+'x'+String(Math.floor(z/16));
    var chunk = chunks[index][1][1];
    x = x % 16;
    z = z % 16;
    if(x < 0)
        x += 16;
    if(z < 0)
        z += 16;
    return chunk[x*1024+z*64+y];
}

placeBottom = function(x1, y1, z1, x2, y2, z2, block) {
    positions.push(x1);
    positions.push(y1);
    positions.push(z1);
    positions.push(x2);
    positions.push(y2);
    positions.push(z2);
    z1 += 16;
    z2 -= 16;
    positions.push(x1);
    positions.push(y1);
    positions.push(z1);
    positions.push(x2);
    positions.push(y2);
    positions.push(z2);
    indices.push(start);
    indices.push(start+1);
    indices.push(start+2);
    indices.push(start);
    indices.push(start+3);
    indices.push(start+1);
    uvs.push(0, 0);
    uvs.push(0, 0);
    uvs.push(0, 0);
    uvs.push(0, 0);
    start += 4;
}

placeFace = function(x1, y1, z1, x2, y2, z2, block) {
    positions.push(x1);
    positions.push(y1);
    positions.push(z1);
    positions.push(x2);
    positions.push(y2);
    positions.push(z2);
    if(x1 == x2) {
        z1 += 1;
        z2 -= 1;
    }
    if(y1 == y2) {
        z1 += 1;
        z2 -= 1;
    }
    if(z1 == z2) {
        x1 += 1;
        x2 -= 1;
    }
    positions.push(x1);
    positions.push(y1);
    positions.push(z1);
    positions.push(x2);
    positions.push(y2);
    positions.push(z2);
    indices.push(start);
    indices.push(start+1);
    indices.push(start+2);
    indices.push(start);
    indices.push(start+3);
    indices.push(start+1);
    let d = 1/10;
    let k = (block-1)*d 
    uvs.push(k, 0);
    uvs.push(k+d, 1);
    uvs.push(k, 1);
    uvs.push(k+d, 0);
    start += 4;
}

createChunk = function(pos, chunk) {
    var ch0 = chunks[String(pos[0]-1)+'x'+String(pos[1])][1][1];
    var ch1 = chunks[String(pos[0]+1)+'x'+String(pos[1])][1][1];
    var ch2 = chunks[String(pos[0])+'x'+String(pos[1]-1)][1][1];
    var ch3 = chunks[String(pos[0])+'x'+String(pos[1]+1)][1][1];

    var block;

    for(var i = 0; i < 16; i++) {
        for(var j = 0; j < 16; j++) {
            for(var k = 0; k < 64; k++) {
                block = getBlock(chunk, i, j, k, ch0, ch1, ch2, ch3);
                if(block == 0)
                    continue;
                
                if(getBlock(chunk, i+1, j, k, ch0, ch1, ch2, ch3) == 0)
                    placeFace(i+1, k+1, j, i+1, k, j+1, block);
                if(getBlock(chunk, i-1, j, k, ch0, ch1, ch2, ch3) == 0)
                    placeFace(i, k, j, i, k+1, j+1, block);
                if(getBlock(chunk, i, j+1, k, ch0, ch1, ch2, ch3) == 0)
                    placeFace(i, k, j+1, i+1, k+1, j+1, block);
                if(getBlock(chunk, i, j-1, k, ch0, ch1, ch2, ch3) == 0)
                    placeFace(i, k+1, j, i+1, k, j, block);
                if(getBlock(chunk, i, j, k+1, ch0, ch1, ch2, ch3) == 0)
                    placeFace(i, k+1, j, i+1, k+1, j+1, block);
                if(getBlock(chunk, i, j, k-1, ch0, ch1, ch2, ch3) == 0)
                    placeFace(i+1, k, j, i, k, j+1, block);
            }
        }    
    }

    placeBottom(0, 0, 0, 16, 0, 16, 0);
}

preCreateChunk = function(data) {
    positions = [];
    indices = [];
    uvs = [];
    start = 0;
    var pos = data[0];
    var chunk = data[1];
    createChunk(pos, chunk);
    if(chunks[String(data[0][0])+'x'+String(data[0][1])] != undefined)
        postMessage([pos, new Uint8Array(positions).buffer, new Uint16Array(indices).buffer, new Float32Array(uvs).buffer, data[2]]);
}

sort = function(a, b) {
    a = a.split('x'); a[0] = Number(a[0]); a[1] = Number(a[1]);
    b = b.split('x'); b[0] = Number(b[0]); b[1] = Number(b[1]);
    if(a[0] < b[0])
        return -1;
    else if (a[0] == b[0]) {
        if(a[1] < b[1])
        	return -1;
        else
        	return 1;
    }
    else
    	return 1;
}

onmessage = function(e) {
    let data = e.data;

    if(data[0] == 'create')
    {
        for(var i = 1; i < data.length; i++)
        {
            data[i][1] = pako.inflate(data[i][1]);
            chunks[String(data[i][0][0])+'x'+String(data[i][0][1])] = [false, data[i]];
        }
        
        var keys = Object.keys(chunks);
        keys.sort(sort); 
        for(var i = 1; i < rad; i++) {
            for(var j = 1; j < rad; j++) {
                var key = keys[i*2*CHR+j];
                if(chunks[key][0] == false)
                {
                    chunks[key][0] = true;
                    preCreateChunk(chunks[key][1]);
                }
            }
        }
    }
    if(data[0] == 'destroy')
    {
        for(var i = 1; i < data.length; i++)
            delete chunks[String(data[i][0])+'x'+String(data[i][1])];
    }
    if(data[0] == 'update')
    {
        var index = String(data[1][0])+'x'+String(data[1][1]);
        var chunk = chunks[index][1][1];
        chunk[data[2][0]*1024+data[2][2]*64+data[2][1]] = data[3];
        chunks[index][1][1] = chunk;
        if(!chunks[index][0])
            return;
        if(data[2][0] == 0)
            preCreateChunk(chunks[String(data[1][0]-1)+'x'+String(data[1][1])][1]);
        if(data[2][0] == 15)
            preCreateChunk(chunks[String(data[1][0]+1)+'x'+String(data[1][1])][1]);
        if(data[2][2] == 0)
            preCreateChunk(chunks[String(data[1][0])+'x'+String(data[1][1]-1)][1]);
        if(data[2][2] == 15)
            preCreateChunk(chunks[String(data[1][0])+'x'+String(data[1][1]+1)][1]);
        preCreateChunk(chunks[index][1]); 
    }
    if(data[0] == 'get')
    {
        let block = getBlockWorld(data[1].x, data[1].y, data[1].z);
        postMessage(['get', block]);
    }
    if(data[0] == 'setCHR')
    {
        CHR = data[1];
        rad = 2*CHR-1;
    }
}
