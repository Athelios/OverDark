function degToRad(degrees) {
  return Math.PI/180 * degrees;
}

window.addEventListener('load', eventWindowLoaded, false);

function eventWindowLoaded() {
  canvasDraw();
}

function canvasDraw() {
  if(x > canvas.clientWidth) {
    x -= canvas.clientWidth;  
  }

  if(y > canvas.clientHeight) {
    y -= canvas.clientHeight;  
  }  

  if(x < 0) {
    x += canvas.clientWidth;  
  }

  if(y < 0) {
    y += canvas.clientHeight;  
  }
}

// pointer lock object forking for cross browser
canvas.requestPointerLock = canvas.requestPointerLock ||
           canvas.mozRequestPointerLock;

document.exitPointerLock = document.exitPointerLock ||
         document.mozExitPointerLock;

function eventFire(el, etype){
  if (el.fireEvent) {
    el.fireEvent('on' + etype);
  } else {
    var evObj = document.createEvent('Events');
    evObj.initEvent(etype, true, false);
    el.dispatchEvent(evObj);
  }
}

canvas.onclick = function() {
  canvas.requestPointerLock();
}

document.addEventListener("contextmenu", function(e){
    e.preventDefault();
}, false);

canvas.oncontextmenu = function () {
    canvas.requestPointerLock();
    return false;
};

// pointer lock event listeners
// Hook pointer lock state change events for different browsers
document.addEventListener('pointerlockchange', lockChangeAlert, false);
document.addEventListener('mozpointerlockchange', lockChangeAlert, false);

function lockChangeAlert(e) {
  if(document.pointerLockElement === canvas ||
  document.mozPointerLockElement === canvas) {
    document.addEventListener("mousemove", canvasLoop, false);
  } else {
    if(!bNoEsc) {
        show_menu();
        freeze(true);
    }
    document.removeEventListener("mousemove", canvasLoop, false);
  }
}

  var tracker = document.createElement('p');
  var body = document.querySelector('body');
  body.appendChild(tracker);
  tracker.style.position = 'absolute';
  tracker.style.top = '0';
  tracker.style.right = '10px';
  tracker.style.backgroundColor = 'white';

function canvasLoop(e) {
  var movementX = e.movementX ||
      e.mozMovementX          ||
      0;

  var movementY = e.movementY ||
      e.mozMovementY          ||
      0;

  x += movementX;
  y += movementY;
}