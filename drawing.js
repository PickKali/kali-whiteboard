/* Adapted From: https://dev.to/0shuvo0/lets-create-a-drawing-app-with-js-4ej3, with a LOT of changes.*/

const canvas = document.getElementById("canvas");

canvas.width = window.innerWidth; //- canvas.getBoundingClientRect().x
canvas.width = canvas.getBoundingClientRect().width;
canvas.height = window.innerHeight;

const ctx = canvas.getContext("2d");
const tb = document.querySelector("#toolbar");

let prevX = null;
let prevY = null;
let lineWidth = 4;
let draw = false;

let strokes = [];
let undone = [];
let currentPath = [];
let inactivityTimer = null;
let looping = false;
let loopHandle = null;
let lastFrameTime = 0;

let activePointers = new Set();
let gestureStart = null;
let gestureMoved = false;
let drawIntentTimer = null;

let clrs = document.querySelectorAll(".clr");
clrs = Array.from(clrs);
clrs.forEach((clr) => {
  clr.style.backgroundColor = clr.dataset.clr;

  clr.addEventListener("pointerdown", () => {
    ctx.strokeStyle = clr.dataset.clr;
  });
});

let clearBtn = document.querySelector(".clear");
clearBtn.addEventListener("pointerdown", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#FDFCF9";
  ctx.fill();
  strokes = [];
});

let saveBtn = document.querySelector(".save");
saveBtn.addEventListener("pointerdown", () => {
  let data = canvas.toDataURL("imag/png");
  let a = document.createElement("a");
  a.href = data;
  a.download = "whiteboard.png";
  a.click();
});

let brushes = document.querySelectorAll(".brush");
brushes = Array.from(brushes);
brushes.forEach((brush) => {
  brush.addEventListener("pointerdown", () => {
    lineWidth = brush.dataset.wth;
  });
});

let brushvises = document.querySelectorAll(".brushvis");
brushvises = Array.from(brushvises);
brushvises.forEach((brushvis) => {
  brushvis.style.height = brushvis.dataset.wth+"px";
});

window.addEventListener("pointerdown", (e) => {
  if (e.target !== canvas) return;
  
  activePointers.add(e.pointerId);
  if (activePointers.size >= 2) {
    gestureStart = performance.now();
    gestureMoved = false;
  }

  drawIntentTimer = setTimeout(() => {
    if (activePointers.size === 1) {
      draw = true;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      currentPath = [
        [{ x: e.offsetX, y: e.offsetY }],
        ctx.lineWidth,
        ctx.strokeStyle,
      ];
      stopLoop();
    }
  }, 60);
});

function endStroke() {
  if (draw) {
    draw = false;
    strokes.push(currentPath);
    currentPath = [];
    undone = [];
    if (tb.hidden) {
      startInactivityTimer();
    }
  }
}

window.addEventListener("pointerup", (e) => {
  const fingersAtEnd = activePointers.size;
  activePointers.delete(e.pointerId);
  clearTimeout(drawIntentTimer);

  if (!gestureMoved) {
    if (fingersAtEnd === 2) {
      undo();
    }
    if (fingersAtEnd === 3) {
      redo();
    }
  }
  if (activePointers.size === 0) {
    endStroke()
  }
});

function startInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    if (!draw) startLoop();
  }, 1000);
}

function startLoop() {
  if (looping) return;
  looping = true;
  drawOffset = 0;
  lastFrameTime = performance.now();
  loopHandle = requestAnimationFrame(loopStep);
}

function loopStep(now) {
  if (!looping) return;

  const delta = now - lastFrameTime;
  if (delta >= 1000 / 12) {
    lastFrameTime = now - (delta % 1000) / 12;
    redraw(true);
  }

  loopHandle = requestAnimationFrame(loopStep);
}

function stopLoop() {
  if (!looping) return;
  looping = false;
  cancelAnimationFrame(loopHandle);
  redraw(false);
}

window.addEventListener("resize", (e) => {
  canvas.width = window.innerWidth; //- canvas.getBoundingClientRect().x
  canvas.width = canvas.getBoundingClientRect().width;
  canvas.height = window.innerHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#FDFCF9";
  ctx.fill();
  redraw();
});

ctx.rect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = "#FDFCF9";
ctx.fill();

window.addEventListener("pointermove", (e) => {
  if (activePointers.size >= 2) {
    gestureMoved = true;
    return;
  }
  if ((!draw)||(performance.now() - gestureStart < 200)) {
    return;
  }
  const x = e.offsetX;
  const y = e.offsetY;
  const last = currentPath[0][currentPath[0].length - 1];
  ctx.beginPath();
  ctx.moveTo(last.x, last.y);
  ctx.lineTo(x, y);
  ctx.stroke();

  currentPath[0].push({ x: e.offsetX, y: e.offsetY });
});

let hideBtn = document.querySelector("#hide");
hideBtn.addEventListener("pointerdown", () => {
  tb.hidden = !tb.hidden;
  if (tb.hidden) {
    startInactivityTimer();
    hideBtn.innerHTML = "show";
  } else {
    stopLoop();
    hideBtn.innerHTML = "hide";
  }
});

function redraw(jiggle) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#FDFCF9";
  ctx.fill();
  for (const path of strokes) {
    ctx.lineWidth = path[1];
    ctx.strokeStyle = path[2];
    ctx.beginPath();

    let deeppath = JSON.parse(JSON.stringify(path[0]));
    for (let i = 0; i < deeppath.length; i++) {
      let oldx = jiggle ? Math.floor(Math.random() * 3) : 0;
      let oldy = jiggle ? Math.floor(Math.random() * 3) : 0;
      deeppath[i].x += oldx;
      deeppath[i].y += oldy;
    }
    for (let i = 1; i < deeppath.length; i++) {
      const prev = deeppath[i - 1];
      const curr = deeppath[i];
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
    }
    ctx.stroke();
  }
}

function undo() {
  if (strokes.length === 0) return;
  undone.push(strokes.pop());
  redraw(false);
}

function redo() {
  if (undone.length === 0) return;
  strokes.push(undone.pop());
  redraw(false);
}

document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

  if (e.key.toLowerCase() === "z") undo();
  if (e.key.toLowerCase() === "x") redo();
});

window.addEventListener("pointercancel", (e) => {
  endStroke()
  activePointers.delete(e.pointerId);
});