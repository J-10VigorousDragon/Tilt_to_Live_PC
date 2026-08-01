# 开发指南（DEVELOPMENT）

> 面向想在这个项目上动手的开发者：如何运行、测试、调参、扩展功能。

## 1. 环境要求

| 用途 | 需要 | 说明 |
|------|------|------|
| 玩/看效果 | 任意现代浏览器 | Chrome / Edge 最佳，双击 `tilt.html` 即可 |
| 跑冒烟测试 | Node.js ≥ 18 | `node test_smoke.js` |
| 本地服务器（可选） | Python 或 Node | 见 §2.2 |

游戏本体**不依赖任何构建工具**，`tilt.html` 就是全部。

## 2. 运行方式

### 2.1 直接打开（推荐）

双击 `tilt.html`，浏览器打开即玩。最高分存 localStorage（本机）。

### 2.2 本地服务器（可选）

如果你想把游戏挂到 localhost（例如为了手机同局域网访问或习惯 http 协议）：

```bash
# Python 方式
python -m http.server 8000
# Node 方式
npx serve .
```

然后访问 `http://localhost:8000`。

## 3. 测试

### 3.1 冒烟测试（逻辑层）

```bash
node test_smoke.js
```

该测试在 Node 中用假 DOM / 假 Canvas 运行游戏脚本，依次验证：
1. 菜单状态运行
2. 开局重置
3. 模拟鼠标移动 + 3 秒游戏（红点生成、绿点维持）
4. 武器解锁链（吃绿点 → 解锁冰爆 → 下一目标护盾）
5. **10 种武器逐一触发**并跑 40 帧（覆盖烈焰冲刺、冲击波蓄力等演出状态）
6. 死亡流程（红闪演出 → 结算面板 → 分数/最高分）
7. 重新开局

通过标准：全程无运行时异常 + 关键状态断言成立。

### 3.2 手动测试清单（每次改代码后）

- [ ] 双击打开无报错（F12 控制台）
- [ ] 开局后箭头能滑向鼠标、停稳不抖动
- [ ] 吃绿点有音效和粒子
- [ ] 每种武器的演出（尤其蓄力类：Wave / Burnicade）
- [ ] 死亡 → 结算 → 重开 循环无残留（旧特效、旧实体清空）
- [ ] 最高分在刷新页面后仍存在
- [ ] M 静音后所有音效消失

## 4. 调参指南（不写代码就能改游戏）

所有参数集中在 `tilt.html` 顶部的 `CFG` 对象，改数字保存后刷新页面即可。

| 参数 | 默认 | 作用 | 调大效果 |
|------|------|------|---------|
| `playerAccel` | 1750 | 箭头加速度 | 更跟手、更"冲" |
| `playerMaxSpeed` | 430 | 速度上限 | 更快，更难精控 |
| `playerDamping` | 0.9 | 滑行阻尼 | 更粘、停得快；调小更飘 |
| `mouseStopDist` | 60 | 刹车区半径 | 停得离鼠标更远/更近 |
| `spawnRateBase` | 0.9 | 初始生成率 | 开局红点更多 |
| `spawnRateRamp` | 0.045 | 难度上升速度 | 更快进入高压期 |
| `spawnRateMax` | 6.5 | 生成率上限 | 后期密度 |
| `dotSpeedBase` | 115 | 红点初始速度 | 开局更难 |
| `comboWindow` | 1.5 | 连击窗口 | 连击更容易/难维持 |
| `greenTarget` | 15 | 场上绿点数 | 绿点更密/更稀 |

武器解锁门槛改 `UNLOCKS` 数组的 `need` 值；武器参数（爆炸半径、持续时间等）
在 `useWeapon()` 对应 case 里改。

## 5. 扩展指南

### 5.1 添加一个新武器（5 步）

以新增"地雷 Mine"为例：

```js
// 1) WEAPONS 表加条目（名字/颜色/符号/奖励分）
mine: { name: "地雷", color: "#c9a86b", sym: "✶", points: 8 },

// 2) UNLOCKS 表加解锁门槛
{ id: "mine", need: 50, name: "地雷 Mine", desc: "埋一颗雷，红点踩上爆炸！" },

// 3) useWeapon() 加 case（决定收集时立即做什么）
case "mine": {
  SFX.mine();   // 音效（可选，见 5.2）
  G.mines.push({ x: P.x, y: P.y, armed: 0.5, life: 20 });
  break;
}

// 4) update() 里加更新逻辑（红点接近 → 爆炸）
for (let i = G.mines.length - 1; i >= 0; i--) { ... }

// 5) draw() 里加绘制
for (const m of G.mines) { ctx.fillStyle = "#c9a86b"; ... }
```

### 5.2 添加音效

```js
// 在 SFX 表里加一个函数（tone = 音调，noise = 噪声）
mine() { tone(220, 0.3, "sine", 0.2, 60); noise(0.15, 0.2, 1500); }
```

### 5.3 添加新模式（如 Code Red 高密度模式）

```js
// 1) 菜单加按钮 + 记录模式选择
// 2) startGame(mode) 接受参数，开局时覆盖 CFG 的难度项
function startGame(mode) {
  ...
  if (mode === "codered") {
    spawnRateBase = 3; spawnRateRamp = 0.1; spawnRateMax = 9;  // 临时覆盖
  }
}
// 3) 状态机已支持（menu → playing → dying → over 循环），无需改动
```

### 5.4 加 BGM

Web Audio 合成循环：用 `setInterval`（建议 500ms）按节拍表触发 `tone()` 和弦，
节拍表放在一个数组里，跟随 `G.time` 决定小节。注意：音频上下文必须由用户交互启动
（现有 `mousedown` 里的 `ac().resume()` 已具备条件）。

## 6. 常见问题

| 现象 | 原因与解决 |
|------|-----------|
| 双击打开后没有音效 | 浏览器要求用户交互后才能播放音频；点击"开始游戏"即可。仍无声则按 M 检查静音状态 |
| 最高分刷新页面后丢失 | 部分浏览器（Firefox/隐私模式）在 file:// 下禁 localStorage；改用本地服务器（§2.2）或换 Chrome |
| 卡顿（帧率低） | 检查是否长时间游戏（红点上限 450）；关掉其他标签页；降 `maxDots` |
| F12 控制台访问不到 `G` 对象 | 顶层 `const` 不挂 window；调试可在脚本末尾临时加 `window.G = G` |
| git push 失败 | 本机需走代理：`git -c http.proxy=http://127.0.0.1:47890 push`（本项目仓库已配置本地代理，无需手动） |

## 7. 目录约定

```
tilt.html          游戏本体（唯一交付物）
README.md          面向玩家：玩法/差异/快速调参
test_smoke.js      冒烟测试（node test_smoke.js）
docs/
  ARCHITECTURE.md  架构：模块、数据流、渲染管线、扩展点
  GAME_DESIGN.md   机制：数值表、难度曲线、与原版对照
  DEVELOPMENT.md   本文件：运行/测试/调参/扩展
```
