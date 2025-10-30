const mouseAcceleration = 2.0;
const dragAcceleration = 0.25;
const DEBUG = false;
const keymap = {
  Enter: "enter",
  Backspace: "backspace",
  Escape: "esc",
  ";": "semicolon",
  ":": "colon",
  "'": "apostrophe",
  "\\": "backslash",
  " ": "space",
  "/": "slash",
  "[": "leftbrace",
  "]": "rightbrace",
};

var socket = null;
function connect(fn) {
  if (
    !socket ||
    socket.readyState == WebSocket.CLOSED ||
    socket.readyState == WebSocket.CLOSING
  ) {
    // Create WebSocket connection.
    socket = new WebSocket(`ws://${location.host}/remote`);
    socket.onopen = () => {
      document.querySelector("#keyboard").disabled = false;
      fn();
    };
    socket.onclose = () => {
      document.querySelector("#keyboard").disabled = true;
    };
  } else {
    fn();
  }
}

function sendMessage(payload) {
  // Reconnect if necessary
  connect(() => socket.send(JSON.stringify(payload)));
}

function log(line) {
  if (DEBUG) {
    let debug = document.querySelector("#debug");
    debug.innerHTML += `${line}<br>`;
  }
}

function setupMouseControl() {
  const mouse = document.querySelector("#mouse");
  let startX = null;
  let startY = null;
  let isDragging = false;
  let fingers = null;
  let touchStart = null;

  mouse.addEventListener("touchstart", (e) => {
    e.preventDefault();
    touchStart = true;
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    fingers = e.touches.length;
    isDragging = false;
  });

  mouse.addEventListener("touchmove", (e) => {
    e.preventDefault();
    isDragging = true;
    const touch = e.touches[0];
    let deltaX = touch.clientX - startX;
    let deltaY = touch.clientY - startY;
    startX = touch.clientX;
    startY = touch.clientY;
    switch (fingers) {
      case 1:
        sendMessage({
          MouseMove: {
            x: deltaX * mouseAcceleration,
            y: deltaY * mouseAcceleration,
          },
        });
        break;
      case 2:
        sendMessage({
          Drag: { x: deltaX * dragAcceleration, y: deltaY * dragAcceleration },
        });
        break;
    }
  });
  mouse.addEventListener("touchend", (e) => {
    if (!isDragging && touchStart) {
      switch (fingers) {
        case 1:
          sendMessage("LeftClick");
          break;
        case 2:
          sendMessage("RightClick");
          break;
        case 3:
          sendMessage("MiddleClick");
          break;
      }
    }
    isDragging = false;
    touchStart = false;
  });
}

function setupKeyboardContol() {
  const keyboard = document.querySelector("#keyboard");
  keyboard.addEventListener("keydown", (e) => {
    let value = keymap[e.key] ?? e.key;
    sendMessage({ Key: { value } });
  });
}

function setupAppShortcuts() {
  const openApp = (name) => sendMessage({ Open: { value: name } });

  const apps = ["steam", "firefox", "spotify", "audio"];
  apps.forEach(
    (id) => (document.getElementById(id).onclick = () => openApp(id)),
  );
}

function setupVolumeControl() {
  const volumeIncrease = document.querySelector("#volume-increase");
  const volumeMute = document.querySelector("#volume-mute");
  const volumeDecrease = document.querySelector("#volume-decrease");
  volumeIncrease.addEventListener("click", () => sendMessage("IncreaseVolume"));
  volumeMute.addEventListener("click", () => sendMessage("ToggleMuteVolume"));
  volumeDecrease.addEventListener("click", () => sendMessage("DecreaseVolume"));
}

document.addEventListener("DOMContentLoaded", () => {
  log("Starting");
  connect();

  setupMouseControl();
  setupKeyboardContol();
  setupVolumeControl();
  setupAppShortcuts();
});
