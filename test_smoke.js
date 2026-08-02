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

// 3b) 玩家移动断言（P0 回归防护：v2 曾误删速度积分行导致箭头无法移动）
// 清空红点 + 强制 playing：排除随机死亡（state=dying 时 update 停止）对断言的干扰
run("G.dots = []; G.state = 'playing'; P.x = 100; P.y = 100; P.vx = 0; P.vy = 0");
drive(60, "移动断言");
const px = run("P.x"), py = run("P.y");
if (Math.abs(px - 100) < 30 && Math.abs(py - 100) < 30) {
  throw new Error("玩家箭头未移动（速度积分失效？）P=(" + px + "," + py + ")");
}
console.log("✓ 玩家箭头跟随鼠标移动正常（P 位移", Math.abs(px - 100).toFixed(0) + "px）");

// 4) 强制吃绿点触发武器解锁（跨局货币 greensTotal，走真实保存路径）
for (let i = 0; i < 25; i++) { G().greens++; G().greensTotal++; run("saveGreensTotal(G.greensTotal)"); run("checkUnlock()"); }
console.log("✓ 武器解锁:", [...G().unlocked].join(","), "下一武器:", G().nextWeapon?.name);
if (![...G().unlocked].includes("ice")) throw new Error("20 绿点门槛未解锁 ice");

// 4b) 验证跨局持久化：解锁写入 localStorage，重开后仍持有（货币=保存时的值）
const saved = JSON.parse(sandbox.localStorage._d["ttl_unlocked"] || "[]");
if (!saved.includes("ice")) throw new Error("跨局解锁未写入 localStorage");
const expectedGreens = G().greensTotal;
run("startGame()");
if (![...G().unlocked].includes("ice")) throw new Error("重开后已解锁武器丢失（跨局未恢复）");
if (G().greensTotal !== expectedGreens) throw new Error("重开后武器货币未恢复（期望 " + expectedGreens + " 实际 " + G().greensTotal + "）");
console.log("✓ 跨局解锁持久化正常（重开后仍持有 ice，货币=" + expectedGreens + "）");

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
