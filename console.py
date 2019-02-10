# -*- coding: utf8 -*-
from flask_socketio import send, emit

def chat(nick, text):
    msg = text
    result = ""
    j = 0   

    for i in range(0,len(msg)):
        if msg[i:i+4] == "www.":
            while True:
                result += msg[i+j]
                j += 1
                if msg[i+j] == " ":
                    break
            msg = msg[:i]+'<a href="http://'+result+'" target="_blank">'+result+'</a>'+msg[i+j:]
            break

    if msg == "":
        return
        		
    elif msg[:5] == "/info":
        text = "<font color='silver' style='font-weight:bold;font-family:Arial;'>Console ~ Chat server is running!</font>"
        emit('output', text, include_self=True, broadcast=False)

    elif msg[:5] == "/help":
        text = "<font color='silver' style='font-weight:bold;font-family:Arial;'>Console <br>~ Avaible commands: ~<br>/info (server informations)<br>/help (this list)<br>E key (inventory)<br>SWAD keys (movement)<br>F key (usage)<br>T key (chat)</font>"
        emit('output', text, include_self=True, broadcast=False)

    elif msg[:4] == "/url":
        if (msg[5:12]=="http://")or(msg[5:13]=="https://"):
            msg = '<a href="'+msg[4:]+'" target="_blank">'+msg[4:]+'</a>'
        else:
            msg = '<a href="http://'+msg[5:]+'" target="_blank">'+msg[4:]+'</a>'

    elif (msg[:7] == "http://")or(msg[:8] == "https://"):
        msg = '<a href="'+msg+'" target="_blank">'+msg+'</a>'

    else:
        if(msg[0] == "/"):
            text = "<font color='silver' style='font-weight:bold;font-family:Arial;'>Console ~ Unknown command <br> Use command /help for help.</font>"
            emit('output', text, include_self=True, broadcast=False)

    if (msg[0] != '/') and (msg != " "):
        text = "<font color='red' style='font-weight:bold;font-family:Arial;'>"+nick+":</font> <font style='font-family:Arial;'>" +msg+"</font>"
        emit('output', text, include_self=False, broadcast=True)
        text = "<font color='skyblue' style='font-weight:bold;font-family:Arial;'>"+nick+":</font> <font style='font-family:Arial;'>" +msg+"</font>"
        emit('output', text, include_self=True, broadcast=False)