const mouseAcceleration = 2.0;
const dragAcceleration = 0.5;
const DEBUG = false;
const keymap = {
  "Enter": "enter",
  "Backspace": "backspace",
  "Escape": "esc",
  ";": "semicolon",
  ":": "colon",
  "'": "apostrophe",
  "\\": "backslash",
  " ": "space",
  "/": "slash",
  "[": "leftbrace",
  "]": "rightbrace",
}

var socket = null;
function connect() {
  if (!socket || socket.readyState == WebSocket.CLOSED || socket.readyState == WebSocket.CLOSING) {
    // Create WebSocket connection. 
    socket = new WebSocket(`ws://${location.host}/remote`);
    socket.onopen = () => {
      document.querySelector("#keys").disabled = false;
    }
    socket.onclose = () => {
      document.querySelector("#keys").disabled = true;
    }
  }
}

function sendMessage(payload) {
  // Reconnect if necessary
  connect()
  socket.send(JSON.stringify(payload))
}

function log(line) {
  if (DEBUG) {
    let debug = document.querySelector("#debug");
    debug.innerHTML += `${line}<br>`
  }
}

function keyAction(key) {
  let value = keymap[key] ?? key;
  sendMessage({ Key: { value } });
}


function setupMouseControl() {
  const mouseArea = document.querySelector("#mouse-area");
  let startX = null;
  let startY = null;
  let isDragging = false;
  let fingers = null;

  mouseArea.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    fingers = e.touches.length
    isDragging = false;
  });

  mouseArea.addEventListener("touchmove", (e) => {
    e.preventDefault();
    isDragging = true;
    const touch = e.touches[0];
    let deltaX = touch.clientX - startX;
    let deltaY = touch.clientY - startY;
    startX = touch.clientX;
    startY = touch.clientY;
    switch (fingers) {
      case 1: sendMessage({ MouseMove: { x: deltaX * mouseAcceleration, y: deltaY * mouseAcceleration }}); break;
      case 2: sendMessage({ Drag: { amount: deltaY * dragAcceleration }}); break;
    }
  });
  mouseArea.addEventListener("touchend", (e) => {
    if (!isDragging) {
      switch (fingers) {
        case 1: sendMessage("LeftClick"); break;
        case 2: sendMessage("RightClick"); break;
        case 3: sendMessage("MiddleClick"); break;
      }
    }
    isDragging = false;
  });
}

document.addEventListener('DOMContentLoaded', function() {
  log("Starting");
  connect()
  const keys = document.querySelector("#keys");
  setupMouseControl();
  keys.addEventListener("keydown", (e) => keyAction(e.key));
});
