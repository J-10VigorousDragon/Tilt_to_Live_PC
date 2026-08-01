// 冒烟测试：在 Node 里用假 DOM 运行 tilt.html 的游戏逻辑
// 验证：加载、开局、跑帧、全部武器、死亡流程均无运行时错误
const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("D:/JasonCoding/tilt_to_live/tilt.html", "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// ---- 假 DOM / Canvas / Audio ----
const anyFn = new Proxy(function () {}, {
  get: (t, k) => {
    if (k === Symbol.toPrimitive) return () => 0;
    if (k === "length") return 0;
    return anyFn;
  },
  apply: () => anyFn,
  set: () => true,
});

function fakeEl() {
  return {
    addEventListener() {},
    textContent: "",
    style: {},
    classList: { add() {}, remove() {}, contains: () => false },
  };
}

const rafQueue = [];
const sandbox = {
  console,
  performance: { now: () => Date.now() },
  setTimeout,
  clearTimeout,
  requestAnimationFrame: (fn) => { rafQueue.push(fn); return rafQueue.length; },
  localStorage: {
    _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); },
  },
  window: {
    innerWidth: 1200, innerHeight: 800,
    addEventListener() {},
    AudioContext: class { constructor() { return new Proxy(this, { get: (t, k) => (k in t ? t[k] : anyFn), set: () => true }); } },
  },
  document: {
    getElementById: () => fakeEl(),
    addEventListener() {},
  },
};
sandbox.window.window = sandbox.window;
sandbox.window.document = sandbox.document;
const canvasEl = {
  width: 0, height: 0,
  getContext: () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : anyFn), set: () => true }),
};
sandbox.document.getElementById = (id) => (id === "game" ? canvasEl : fakeEl());

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

// ---- 通过 runInContext 访问游戏内部（const 声明不挂全局） ----
const G = () => vm.runInContext("G", sandbox);
const run = (expr) => vm.runInContext(expr, sandbox);

(async () => {
let frames = 0;
function drive(n, tag) {
  for (let i = 0; i < n; i++) {
    const fn = rafQueue.shift();
    if (!fn) throw new Error("[" + tag + "] 帧队列为空（游戏循环停了？）");
    fn(performance.now() + frames * 16);
    frames++;
  }
}

// 1) 启动帧（菜单状态）
drive(5, "菜单帧");
console.log("✓ 菜单状态运行正常");

// 2) 开局
run("startGame()");
drive(5, "开局");
console.log("✓ 开局正常，状态 =", G().state);

// 3) 模拟鼠标移动 + 正常游戏 3 秒
run("M.x = 900; M.y = 600; M.active = true");
drive(180, "游戏3秒");
console.log("✓ 正常游戏 3 秒无异常（红点数:", G().dots.length, "绿点:", G().greensList.length, "）");

// 4) 强制吃绿点触发武器解锁
for (let i = 0; i < 25; i++) { G().greens++; run("checkUnlock()"); }
console.log("✓ 武器解锁:", [...G().unlocked].join(","), "下一武器:", G().nextWeapon?.name);

// 5) 逐一触发全部 10 种武器
for (const w of ["nuke", "wave", "missiles", "ice", "bubble", "vortex", "spike", "lightning", "burnicade", "turret"]) {
  run(`useWeapon("${w}")`);
  drive(40, "武器 " + w);
}
console.log("✓ 10 种武器全部触发运行正常");

// 6) 死亡流程
run("G.state = 'playing'; die()");
drive(30, "死亡演出");
if (G().state !== "dying") throw new Error("死亡状态异常");
await new Promise(r => setTimeout(r, 1000));   // 等 showGameOver 回调
if (G().state !== "over") throw new Error("结算面板未弹出");
console.log("✓ 死亡流程正常，最终分数:", G().score, "最高分:", G().best);

// 7) 重开
run("startGame()");
drive(10, "重开");
console.log("✓ 重新开局正常");
console.log("\n🎉 冒烟测试全部通过！");
})().catch(e => { console.error("✗ 测试失败:", e.message); process.exit(1); });
