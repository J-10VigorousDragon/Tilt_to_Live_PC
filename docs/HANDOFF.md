# 交接说明：Tilt to Live 鼠标版（给 TTL-1-编码实现 任务的 DF）

> **交接人**：本次 v2 迭代的会话 Agent（审核 + 实现）
> **接收人**：TTL-1-编码实现任务 的 DF（开发者）
> **交接时间**：2026-08-02
> **当前版本**：commit `010bf36`（已推送 main）

---

## 1. 项目一句话

**Tilt to Live 鼠标版** = 单文件 HTML5 致敬游戏（`tilt.html`，Canvas 2D + Web Audio 合成音效，零依赖，双击即玩）。把原版 iOS 2010 的"设备倾斜"映射为"鼠标移动"（箭头带着惯性滑向鼠标），核心循环：躲避红点 + 收集绿点/武器球 + 释放武器清场 + 连击。

## 2. 仓库状态（当前 HEAD = `010bf36`，git 干净，已推送）

```
github.com/J-10VigorousDragon/Tilt_to_Live_PC（私有）
├── tilt.html            ← 游戏本体（约 1180 行，中文注释）
├── README.md            玩家向说明 + 与原版差异
├── test_smoke.js        冒烟测试（node test_smoke.js）
└── docs/
    ├── CHANGELOG.md     ← 新增：v2 更新日志（本轮所有改动）
    ├── GAME_DESIGN.md   ← 机制数值 + 与原版对照（改参数先看这里）
    ├── ARCHITECTURE.md  ← 架构/数据流/渲染管线（改代码先看这里）
    ├── DEVELOPMENT.md   ← 运行/测试/调参/扩展教程
    └── HANDOFF.md       ← 本文件
```

## 3. 本轮 v2 做了什么（相对 v1 commit `e5c9ad1`）

### 3.1 核心功能改动

| 项 | 之前 v1 | 现在 v2 |
|----|---------|---------|
| **Wave（≫ 紫球）** | 蓄力 0.5s 后射一个 34px 圆形攻击球直线飞 | 蓄力 0.5s 后朝面朝方向张开 **63° 扇形冲击波**（半径 0.9s 内 20→240px，扫中红点即灭） |
| orbs 武器球数量 | 会有 setTimeout 延迟补刷 → 数量溢出（可到 4~5 个） | 仅同帧"不足 3 即补"，**数量恒定 3** |
| 撞冰冻红点 | 非无敌时**直接死亡** | 冰雕红点**谁都能撞碎**（+10 分，不重置连击），`frozen` 提为碰撞最优先分支 |
| Burnicade 冲刺 | 设速 950 但被 430 钳回，**实测 430** | 冲刺期放开限速，**实测 950 px/s** |

### 3.2 新增/修改的关键代码位置（tilt.html）

- `fanHit()` — 扇形命中判定函数（半径+张角双重校验）
- `G.fans` 数组 — 扇形冲击波实体（更新 / 绘制 / startGame 重置）
- `useWeapon("wave")` 蓄力结束分支 — 生成扇形而非圆球
- 碰撞判定块（约 `tilt.html:615`）— `frozen` 最优先
- 限速块（约 `tilt.html:485`）— 冲刺期 `sprinting` 跳过 430 钳制

### 3.3 文档

- 新增 `docs/CHANGELOG.md`（v2 更新日志，含各改动与验证记录）
- 同步更新 `GAME_DESIGN.md` / `ARCHITECTURE.md` / `README.md`

## 4. 验证情况（均已实测通过）

- `node test_smoke.js` **全绿**（含 10 种武器触发、死亡流程、重开）
- Wave 扇形：前置红点全灭，侧方/身后不误伤
- orbs 数量恒定 3，连收不溢出
- 非无敌撞冰冻红点存活且 +10；普通红点碰撞仍正常死亡
- Burnicade 冲刺实测 950，结束后恢复 430

## 5. 待办清单（DF 可继续完善，按优先级）

### P0（影响核心体验，建议优先）
1. **手感实测校准**（**最大不确定项**）：CFG 的 `playerAccel=1750 / playerDamping=0.9 / mouseStopDist=60` 是**凭资料+经验定的初值，未经真机实测**。原版是长滑行惯性，`damping=0.9` 偏强（刹太快，丢"滑"的乐趣）。建议首测 **accel 1600–2000 / damping 0.55–0.7 / mouseStopDist 40–50**，录 60s+ 看死亡原因再调。
2. **绿点经济失衡**（模拟结论）：随机游走 60s 只捡 ~1 个绿点，必须主动追才够数；解锁门槛 240/300 单局几乎不可达且**跨局不累计**（`greens` 每局重置）。建议：解锁货币改跨局累计（localStorage）或降低单局门槛。

### P1（体验完善）
3. **BGM 缺失**：原版音乐广受好评，当前只有音效无配乐。
4. **模式单一**：仅 Classic，原版 6 种（Code Red/Gauntlet/Frostbite 等）未实现。
5. **红点队形入场**未实现。
6. **成就系统**：完整成就树 + Pocket Points 货币未实现（当前是死亡结算段子彩蛋）。

### P2（代码健壮性）
7. **红点互碰分离 O(n²)**：n=450 时每帧 ~10 万次两两比较，后期是主要 CPU 消耗。可上"空间网格（spatial hash）"优化，或降 `maxDots` 到 300。
8. **粒子数组 shift() O(n)**：满 700 时 `spawnParticle` 里 `shift()` 每次搬移全部元素，可改为"满员不生成"或清半。

## 6. 环境注意事项（容易踩坑）

1. **git push 代理**：Clash Verge 的代理 `47890` 只监听 **IPv6 `::`**（没绑 IPv4 `127.0.0.1`）。用 `git -c http.proxy="http://[::1]:47890" push origin main` 才能连通。
2. **桌面快捷入口**：已建 `C:\Users\Jason\Desktop\Tilt_to_Live_鼠标版.lnk`，指向 `D:\JasonCoding\tilt_to_live\tilt.html`，默认 Edge 打开。改参数后刷新该页面即可。
3. **测试跑法**：`node test_smoke.js`（Node ≥18），在项目根目录执行。

## 7. 参数修改入口（DF 改细节参数最常看这里）

| 想改 | 位置 |
|------|------|
| 手感（加速度/限速/阻尼/刹车区） | `tilt.html` 顶部 `CFG` 对象 |
| 武器解锁门槛 | `UNLOCKS` 数组的 `need` 值 |
| 武器参数（爆炸半径/时长等） | `useWeapon()` 对应 `case` 分支 |
| 扇形 Wave 参数（`halfA` 张角 / 扩散时长） | `tilt.html` 里 `G.fans.push(...)` 处 |
| 难度曲线 | `CFG` 的 `spawnRate*` / `dotSpeed*` / `fastDotAt` / `bigDotAt` |

> 改完参数 → 刷新浏览器页面（或双击桌面快捷方式）即生效，无需重启服务器。

---

*本交接稿基于 2026-08-02 会话已完成的工作整理。DF 在此基础上继续迭代，重点建议先做 P0 的手感校准与绿点经济。*
