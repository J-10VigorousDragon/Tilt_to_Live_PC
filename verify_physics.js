// 临时物理验证：确认 v3.2 修复后（1）远距离能追上鼠标（2）高速冲入不振荡
const fs = require("fs"), vm = require("vm");
const html = fs.readFileSync("D:/JasonCoding/tilt_to_live/tilt.html", "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const anyFn = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === "length" ? 0 : anyFn), apply: () => anyFn, set: () => true });
const fakeEl = () => ({ addEventListener() {}, textContent: "", style: {}, classList: { add() {}, remove() {}, contains: () => false } });
const rafQueue = [];
const sandbox = {
  console, performance: { now: () => Date.now() }, setTimeout, clearTimeout,
  requestAnimationFrame: fn => { rafQueue.push(fn); return rafQueue.length; },
  localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); } },
  window: { innerWidth: 1200, innerHeight: 800, addEventListener() {},
    AudioContext: class { constructor() { return new Proxy(this, { get: (t, k) => (k in t ? t[k] : anyFn), set: () => true }); } } },
  document: { getElementById: () => fakeEl(), addEventListener() {} },
};
sandbox.window.window = sandbox.window; sandbox.window.document = sandbox.document;
const canvasEl = { width: 0, height: 0, getContext: () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : anyFn), set: () => true }) };
sandbox.document.getElementById = id => (id === "game" ? canvasEl : fakeEl());
vm.createContext(sandbox); vm.runInContext(code, sandbox);
const G = () => vm.runInContext("G", sandbox);
const run = e => vm.runInContext(e, sandbox);
let frames = 0;
const drive = n => { for (let i = 0; i < n; i++) { const fn = rafQueue.shift(); if (!fn) throw new Error("帧队列空"); fn(Date.now() + frames * 16); frames++; } };

run("startGame()");

// 场景 1：远距离追鼠（鼠标甩到屏幕对角）
run("M.x=1000; M.y=650; M.active=true; P.x=200; P.y=300; P.vx=0; P.vy=0");
let d1 = Infinity;
for (let i = 0; i < 120; i++) { drive(1); d1 = Math.hypot(1000 - run("P.x"), 650 - run("P.y")); }
console.log("场景1 远端追鼠 2s: 距离=" + d1.toFixed(0) + "px（期望 < 60 已停稳）");

// 场景 2：高速冲入鼠标附近（模拟追鼠后停靠），检查 3 秒内是否稳定不振荡
run("M.x=600; M.y=400; P.x=560; P.y=400; P.vx=500; P.vy=0");
let prevD = Infinity, osc = 0;
for (let i = 0; i < 180; i++) {
  drive(1);
  const d = Math.hypot(600 - run("P.x"), 400 - run("P.y"));
  if (Math.abs(d - prevD) > 30) osc++;
  prevD = d;
}
console.log("场景2 高速冲入 3s: 末距离=" + prevD.toFixed(1) + "px, 振荡帧数=" + osc + "（期望 <5）");
console.log(prevD < 80 && osc < 5 ? "✅ 物理修复验证通过" : "❌ 仍不稳定");
