const mouseAcceleration = 4.0;
const dragAcceleration = 0.25;
const DEBUG = false;
const keymap = {
  Backspace: "Backspace",
  Enter: "Return",
  Escape: "Escape",
};

function debounce(func, delay) {
  let timeoutId; // This will store the timer ID

  return function (...args) {
    // Returns a new function that will be called
    const context = this; // Preserve the 'this' context

    clearTimeout(timeoutId); // Clear any existing timer

    timeoutId = setTimeout(() => {
      // Set a new timer
      func.apply(context, args); // Execute the original function after the delay
    }, delay);
  };
}

let socket = null;

function connect() {
  // Create WebSocket connection.
  return new WebSocket(`ws://${location.host}/remote`);
}

function waitForSocketConnection() {
  return new Promise((resolve) => {
    if (socket.readyState === WebSocket.OPEN) {
      resolve();
    } else {
      if (
        socket.readyState === WebSocket.CLOSED ||
        socket.readyState === WebSocket.CLOSING
      )
        socket = connect();
      socket.onopen = () => {
        resolve();
      };
    }
  });
}

async function sendMessage(message) {
  await waitForSocketConnection(socket);
  socket.send(JSON.stringify(message));
  return new Promise((resolve) => {
    socket.onmessage = (e) => {
      resolve(JSON.parse(e.data));
    };
  });
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
    }
  });
  mouse.addEventListener("touchend", () => {
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

function setupHold(button, delay, action) {
  let timeoutId;
  let repeat = () => {
    action();
    timeoutId = setTimeout(repeat, delay);
  };

  button.addEventListener("touchstart", (e) => {
    e.preventDefault();
    repeat();
  });

  button.addEventListener("touchend", (e) => {
    e.preventDefault();
    clearTimeout(timeoutId);
  });
}

function setupScrollControl() {
  let scrollUp = document.querySelector("#scroll-up");
  let scrollDown = document.querySelector("#scroll-down");
  let scrollLeft = document.querySelector("#scroll-left");
  let scrollRight = document.querySelector("#scroll-right");
  let delay = 25;
  setupHold(scrollUp, delay, () => {
    sendMessage({
      Scroll: { x: 0, y: -1 },
    });
  });
  setupHold(scrollLeft, delay, () => {
    sendMessage({
      Scroll: { x: -1, y: 0 },
    });
  });
  setupHold(scrollDown, delay, () => {
    sendMessage({
      Scroll: { x: 0, y: 1 },
    });
  });
  setupHold(scrollRight, delay, () => {
    sendMessage({
      Scroll: { x: 1, y: 0 },
    });
  });
}

function setupKeyboardContol() {
  const keyboard = document.querySelector("#keyboard");
  keyboard.addEventListener("keydown", (e) => {
    if (e.key in keymap) {
      sendMessage({ KeyCode: { value: keymap[e.key] } });
    } else {
      sendMessage({ Unicode: { value: e.key } });
    }
  });
}

async function setupAppShortcuts() {
  log("Setting up apps");
  const data = await sendMessage("GetCapabilities");
  const capabilites = data["Capabilities"];
  const apps = capabilites.apps;
  const appContainer = document.querySelector("#app-container");
  apps.sort().forEach((app) => {
    let button = document.createElement("button");
    button.innerHTML = app;
    button.onclick = () => {
      sendMessage({ Open: { value: app } });
    };
    appContainer.appendChild(button);
  });
}

function setupVolumeControl() {
  const volumeIncrease = document.querySelector("#volume-increase");
  const volumeMute = document.querySelector("#volume-mute");
  const volumeDecrease = document.querySelector("#volume-decrease");
  volumeIncrease.addEventListener("click", () => sendMessage("IncreaseVolume"));
  volumeMute.addEventListener("click", () => sendMessage("ToggleMuteVolume"));
  volumeDecrease.addEventListener("click", () => sendMessage("DecreaseVolume"));
}

function change(n) {
  let panels = document.querySelectorAll("main > div");
  panels.forEach((p) => p.setAttribute("hidden", ""));
  panels[n - 1].removeAttribute("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  log("Starting");
  socket = connect();

  setupMouseControl();
  setupScrollControl();
  setupKeyboardContol();
  setupVolumeControl();
  setupAppShortcuts();

  document
    .querySelectorAll("nav a")
    .forEach((e) => e.addEventListener("click", (_) => change(e.dataset.id)));
});
