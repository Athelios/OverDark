class Actor {
    tick() {
    }
    hold() {
    }
    release() {
    }
    click1() {
    }
    click2() {
    }
    click3() {
    }
    destroy() {
    }
}

// Get breaking target hardness
getHardness = function () {
    let def = 10;
    let actor = undefined;
    if(overlay)
        actor = assets.actors[overlay.id];
    if(actor) {
        let hardness = actor.hardness;
        if(hardness)
            return hardness;
        return def;
    }
    let item = assets.items[traceBlock];
    if(item) {
        let hardness = item.hardness;
        if(hardness)
            return hardness;
        return def;
    }
    return def;
}

// Get breaking target effective tool
getTool = function () {
    let def = undefined;
    let actor = undefined;
    if(overlay)
        actor = assets.actors[overlay.id];
    if(actor) {
        let tool = actor.tool;
        if(tool)
            return tool;
        return def;
    }
    let item = assets.items[traceBlock];
    if(item) {
        let tool = item.tool;
        if(tool)
            return tool;
        return def;
    }
    return def;
}

// Hand object
class Hand extends Actor {
    constructor(right) {
        super();
        this.time = 0;
        this.hit = true;
        this.points = 0;
        this.right = right;
        this.animation = undefined;
        this.anim = [81, 112.5];
        this.grip = [112.5, 150];
        this.multiplier = 1;
        this.tool = "hand";
		this.lastHitPos = undefined;
        let hand = right ? handR : handL;
        if(hand)
            scene.beginAnimation(hand.skeleton, this.grip[0], this.grip[1], true, 1);
    }
    click1() {
        if(new Date().getTime() - this.time < 500)
            return;
        else
            this.time = new Date().getTime();
        if(traceHit.pickedMesh.id == '.male' && traceHit.distance <= 4) {
            traceHit.pickedMesh.renderOverlay = true;
            socket.emit('hit', [traceHit.pickedMesh.sid, this.right ? slotR : slotL]);
            var that = traceHit.pickedMesh;
            setTimeout(function () {
                that.renderOverlay = false;
            }, 200);
        }
    }
    hold() {
        if(bFreeze)
            return;
        if(this.hit) {
            let hand = this.right ? handR : handL;
            if (this.animation) {
                if (!this.animation.animationStarted)
                    this.animation = scene.beginAnimation(hand.skeleton, this.anim[0], this.anim[1], false, 2);
            } else {
                this.animation = scene.beginAnimation(hand.skeleton, this.anim[0], this.anim[1], false, 2);
            }
            this.hit = false;
        }
        if(border.isVisible || overlay) {
			if(border.position.toString() != this.lastHitPos)
				this.points = 0;
            worker.postMessage(['get', border.position]);
            let hardness = getHardness();
            if(this.points >= hardness) {
                fill(100);
                hide_circle();
                border.material.diffuseTexture = assets.textures[9].texture;
                border.material.opacityTexture = border.material.diffuseTexture;
                this.points = 0;
                if(traceHit.pickedMesh.name == 'chunk')
                    setBlock(pickBlock(), 0, this.right);
                else
                    socket.emit('destroy', [traceHit.pickedMesh.uniqueId, this.right ? slotR : slotL]);
            }
            else {
                let x = (10 * this.points) / hardness;
                fill(10*x);
                show_circle();
                x = Math.floor(x);
                border.material.diffuseTexture = assets.textures[x].texture;
                border.material.opacityTexture = border.material.diffuseTexture;
            }
            if(getTool() == this.tool && border.position == this.lastHitPos)
                this.points += this.multiplier;
            else
                this.points++;
            this.hit = true;
			this.lastHitPos = border.position.toString();
        }       
    }
    tick() {

    }
    release() {
        this.hit = true;
        this.points = 0;
        fill(0);
        hide_circle();
        border.material.diffuseTexture = assets.textures[0].texture;
        border.material.opacityTexture = border.material.diffuseTexture;
    } 
}

// Block item in hand
class Block extends Actor {
    constructor(right, id, bBuildable) {
        super();
        this.id = id;
        this.right = right;
        this.item = bBuildable ? cloneNoColl(assets.actors[this.id].mesh) : new BABYLON.Mesh.CreateBox("", 0.7, scene);
        this.item.isPickable = false;
        let hand = right ? handR : handL;
        this.item.attachToBone(hand.skeleton.bones[4], hand);
        this.item.rotate(BABYLON.Axis.Y, -Math.PI / 4, BABYLON.Space.LOCAL);
        this.item.rotate(BABYLON.Axis.X, Math.PI / 2, BABYLON.Space.LOCAL);
        this.item.scaling = new BABYLON.Vector3(6, 6, 6);
        this.item.renderingGroupId = 1;
    }
    tick() {
        this.right ? handR.skeleton.bones[4].markAsDirty() : handL.skeleton.bones[4].markAsDirty();
    }
    click1() {
        if(border.isVisible)
            setBlock(pickBlock(true), this.id, this.right);
    }
    destroy() {
        this.item.dispose();
    }
}

// Buildable item in hand
class Buildable extends Block {
    constructor(right, id) {
        super(right, id, true);
        this.model = cloneNoColl(assets.actors[this.id].mesh);
        this.model.backFaceCulling = false;
        this.model.isPickable = false;
    } 
    tick() {
        super.tick();
        if(traceHit) {
            if(traceHit.distance <= 7) {
                this.model.visibility = 0.4;
                this.model.position = pickBlock(true);
            }
            else
                this.model.visibility = false;
        }
    }
    click1() {
        if(this.model.visibility) {
            setActor(this.model.position, this.model.rotation, this.id, this.right);
        } 
    }
    click2() {
        if(this.model.visibility) {
            this.model.rotation.y += Math.PI/2;
            if(this.model.rotation.y >= 2*Math.PI)
                this.model.rotation.y = 0;
        } 
    }
    destroy() {
        super.destroy();
        this.model.dispose();
    }
}

// Tool in hand
class Tool extends Hand {
    constructor(right, id) {
        super(right);
        this.id = id;
        this.model = cloneNoColl(assets.items[this.id].mesh);
        let mat = assets.items[this.id].material;
        if(mat != undefined)
            this.model.material.subMaterials[this.model.material.subMaterials.length-1] = this.model.material.subMaterials[mat];
        this.multiplier = assets.items[this.id].multiplier;
        this.grip = assets.items[this.id].grip ? assets.items[this.id].grip : this.grip;
        this.anim = assets.items[this.id].anim ? assets.items[this.id].anim : this.anim;
        this.tool = assets.items[this.id].tool;
        let hand = right ? handR : handL;
        this.model.attachToBone(hand.skeleton.bones[4], hand);
        this.model.rotate(BABYLON.Axis.X, Math.PI / 2, BABYLON.Space.LOCAL);
        this.model.rotate(BABYLON.Axis.Y, Math.PI / 2, BABYLON.Space.LOCAL);
        this.model.scaling = new BABYLON.Vector3(20, 20, 20);
        this.model.translate(new BABYLON.Vector3(-0.15, 0, 0.1), 1, BABYLON.Space.LOCAL);
        this.model.renderingGroupId = 1;
        scene.beginAnimation(hand.skeleton, this.grip[0], this.grip[1], true, 2);
    }
    tick() {
        super.tick();
        this.right ? handR.skeleton.bones[4].markAsDirty() : handL.skeleton.bones[4].markAsDirty();
    }
	click2() {
        this.model.rotation.y += Math.PI;
        if(this.model.rotation.y >= 2*Math.PI)
            this.model.rotation.y = 0;
    }
    destroy() {
        super.destroy();
        this.model.dispose();
    }
}