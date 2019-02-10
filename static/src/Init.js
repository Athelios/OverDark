// Global variables
var chunks = {};
var players = {};
var actors = {};
var position = [0,0,0];
var rotation = [0,0,0];
var scene;
var canvas = document.querySelector('canvas');
var x = canvas.clientWidth/2;
var kx = (2*Math.PI)/canvas.clientWidth;
var y = canvas.clientHeight/2;
var ky = (2*Math.PI)/canvas.clientHeight;
var sun, lightSun, shadowGenerator;
var camera;
var bFreeze = false;
var bBlockInput = false;
var handL, handR;
var traceHit;
var bInit = false;
var fps = document.getElementById("fps");
var border;
var itemL, itemR;
var holdL = 0, holdR = 0;
var bHand = false;
var mat, txt;
var shadowList = [];

// Realtime connection with server through sockets
var socket = io.connect('http://' + document.domain + ':' + location.port);

// Basic functions for GUI and HTML layer

function set_health(per) {
    life_progress.style.width = per+"%";
    life_text.innerHTML = life_progress.style.width;
}

function set_energy(per) {
    energy_progress.style.width = per+"%";
    energy_text.innerHTML = energy_progress.style.width;
}

var chatInput = document.getElementById('input');
chatInput.addEventListener("keypress", function(e) {
	clean = 0;
	if (e.keyCode == 13 && !e.shiftKey) {
    	input();
	}
});

function createCookie(name,value,days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + value + expires + "; path=/";
}

function readCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}

if(!readCookie('chunkR'))
    createCookie('chunkR', 7, 1000);

function window_show(id) {
	windows = document.getElementsByClassName('menu_window');
	for (var i in windows) {
		if (windows[i].style) {
			windows[i].style.display = 'none';
		}
	}
	document.getElementById(id+'_window').style.display = 'inline-block';
}

game_settings = {};
game_settings.models_quality = 3;
game_settings.chunk_radius = 7;
game_settings.display_scaling = 1;

borders = {};
borders.chunk_radius = [3,8];
borders.display_scaling = [1,10];

function settings_set(nam, val, typ) {
	if (typ == 'triplebutton') {
		butt = document.getElementsByClassName(nam+'_but');
		for (var i in butt) {
			if (butt[i].style) {
				butt[i].style.backgroundColor = '#0FACF3';
			}
		}
		butt[val-1].style.backgroundColor = '#3fc4ff';
		game_settings[nam] = val;
	}
  if (typ == 'doublebutton') {
		butt = document.getElementsByClassName(nam+'_but');
		for (var i in butt) {
			if (butt[i].style) {
				butt[i].style.backgroundColor = '#0FACF3';
			}
		}
		butt[val].style.backgroundColor = '#3fc4ff';
		game_settings[nam] = val;
	}
	if (typ == 'increase') {
		if (game_settings[nam] < borders[nam][1]) {
			game_settings[nam] ++;
			document.getElementById(nam+'_display').innerHTML = game_settings[nam]+val;
		}
	}
	if (typ == 'decrease') {
		if (game_settings[nam] > borders[nam][0]) {
			game_settings[nam] --;
			document.getElementById(nam+'_display').innerHTML = game_settings[nam]+val;
		}
	}
}

window.onbeforeunload = function(e)
{
    socket.emit('logout');
};

index = -1;
clean = 1;

myhash = '{{myhash}}';

window.setInterval("clearChat()", 1);

function input() {
    text = document.getElementById("input").value;
    document.getElementById("input").value = "";

    chat = document.getElementById("chat");
    chat.scrollTop = chat.scrollHeight;

    clean = 1;

    socket.emit('input', text);
}

function clearChat() {
	if(clean){
		document.getElementById("input").value = "";
		chat.scrollTop = chat.scrollHeight;
	}
}

function popup_hide() {
	popup.style.display = "none";
	freeze(false);
}

socket.on('output', function (text)
{
    var table = document.getElementById("table");
    var row = table.insertRow(index);
    var cell = row.insertCell(index);

    cell.innerHTML = text +"<br>";

    chat = document.getElementById("chat");
    chat.scrollTop = chat.scrollHeight;

});

socket.on('popup', function (data)
{
	popup_nadpis.innerHTML = data.header;
	popup_nadpis.style.color = data.color;
	popup_nadpis.style.borderColor = data.color;
	popup_img.setAttribute('src',data.picture);
	popup_text.innerHTML = data.text;
	popup_button.innerHTML = data.button;
	popup_button.setAttribute('onclick',data.action);

	popup.style.display = "block";
	freeze(true);
});