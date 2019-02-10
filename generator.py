from opensimplex import OpenSimplex
import random
import math
import uuid

# Terrain hills frequency
freq = 1.0

# Roll actor id
def roll(r):
    id = None
    if r < 0.005:
        if random.random() > 0.3:
            id = 0
        else:
            id = 6
    elif r < 0.008:
        id = 1
    elif r < 0.012:
        id = 2
    return id

class generator:
    def __init__(self, world):
        self.world = world
        # Load generator seed
        seed = self.world.database.db.get('seed')
        if seed == None:
            seed = uuid.uuid1().int >> 64
            self.world.database.db['seed'] = str(seed)
        else:
            seed = int(seed)
        self.simplex = OpenSimplex(seed=seed)

    # Terrain noise
    def noise(self, x, y):
        z = self.simplex.noise2d(x=freq*x, y=freq*y)
        z = 34 + z * 10
        z = int(z)
        return z

    # Roll ore id
    def getOre(self):
        id = 1
        rand = random.random()
        if rand < 0.03:
            id = 4
        if 0.03 <= rand < 0.04:
            id = 7
        if 0.04 <= rand < 0.09:
            id = 8
        if 0.09 <= rand < 0.095:
            id = 9
        return id

    def getBlock(self, k, z):
        id = 0
        if k < z:
            # Dirt
            if (z - k) <= 5:
                id = 2
            else:
                id = self.getOre()
        # Grass
        elif k == z:
            id = 3
        id = chr(id)
        return id

    def generateActor(self, posx, posy, i, j, z):
        r = random.random()
        id = roll(r)
        if id != None:
            x = posx * 16 + i + 0.5
            y = posy * 16 + j + 0.5
            z = z + 1
            rot = 2 * random.random() * math.pi
            scale = 0.7 + random.random() / 2
            self.world.database.addActor(posx, posy, id, [x, z, y], [0, rot, 0], [scale, scale, scale])

    def generateChunk(self, pos):
        data = ''
        for i in range(16):
            for j in range(16):
                x = pos[0]/4.0+i/64.0
                y = pos[1]/4.0+j/64.0
                z = self.noise(x, y)
                for k in range(64):
                    data += self.getBlock(k, z)
                self.generateActor(pos[0], pos[1], i, j, z)
    
        self.world.database.addChunk(pos[0], pos[1], data)