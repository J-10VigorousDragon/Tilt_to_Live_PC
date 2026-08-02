# 架构设计文档（ARCHITECTURE）

> 适用范围：`tilt.html` 单文件游戏。本文描述代码的组织方式、核心数据流与设计决策。
> 面向读者：想理解代码、参与迭代的开发者（含编程初学者）。

## 1. 总体设计

### 1.1 设计原则

| 原则 | 说明 |
|------|------|
| **单文件交付** | HTML + CSS + JS 全部在 `tilt.html` 一个文件里。双击即可在浏览器运行，零依赖零安装。刻意不拆分文件——"打开就能玩"是核心体验 |
| **无外部资源** | 音效用 Web Audio API 实时合成，字体/图标用系统默认 + Unicode 符号，无任何图片/音频文件 |
| **数据驱动** | 手感、难度、武器全部参数化：`CFG`（手感）、`UNLOCKS`（解锁表）、`WEAPONS`（武器表）。改数值 = 调游戏，不碰逻辑 |
| **面向初学者** | 中文注释、模块分节、命名直白（`spawnDot`、`killDot`、`useWeapon`） |

### 1.2 技术栈

- **Canvas 2D**：全部画面绘制（背景、实体、粒子、HUD）
- **requestAnimationFrame**：主循环，浏览器自动适配刷新率
- **Web Audio API**：音效合成（振荡器 + 白噪声）
- **localStorage**：最高分与静音偏好持久化

### 1.3 文件地图

```
tilt.html
├── <style>          页面布局与菜单/结算卡片样式
├── <body>           canvas + 菜单覆盖层 + 结算覆盖层 + 静音按钮
└── <script>         游戏逻辑（自上而下）：
    ├── CFG          手感/难度参数（改数值即调参）
    ├── UNLOCKS      武器解锁表（绿点门槛）
    ├── WEAPONS      武器数据（名称/颜色/符号/奖励分）
    ├── STARTER_ORBS 初始武器集合
    ├── 工具函数      rand / clamp / dist2
    ├── canvas / G / P / M   画布与全局状态
    ├── 音效层        ac() / tone() / noise() / SFX 音效表
    ├── 特效池        spawnParticle / burst / addRing / addFloat
    ├── 实体生成      spawnDot / spawnGreen / spawnOrb / randomOrbId
    ├── 击杀统一入口  killDot（加分、连击、特效）
    ├── 武器逻辑      useWeapon（10 种武器）+ fireBurnicade
    ├── 主更新        update（物理/追踪/碰撞/武器/生成/特效衰减）
    ├── 解锁检查      checkUnlock
    ├── 死亡流程      die / showGameOver
    ├── 开局重置      startGame
    ├── 渲染          draw / drawArrow / drawHUD
    ├── 输入          mousemove / mouseleave / keydown / 按钮
    └── 主循环        loop（dt 计算 → update → draw）
```

## 2. 核心数据流

### 2.1 主循环（每帧执行）

```
浏览器调度
   │  requestAnimationFrame(loop)
   ▼
loop(now)
   ├─ dt = (now - lastT) / 1000，上限 0.033s（防止切窗口后物理大跳）
   ├─ G.state === "playing" → update(dt)   ← 全部游戏逻辑
   └─ draw()                                ← 全部绘制
```

### 2.2 输入流

```
鼠标移动 → M.x / M.y / M.active = true
鼠标移出窗口 → M.active = false → 玩家持续用 G._lastDirX/Y 方向加速（模拟持续倾斜）
键盘/点击 → 状态机切换（startGame / 暂停 / 静音）
```

### 2.3 状态机

```
menu ──startGame()──▶ playing ──P键──▶ paused
                        ▲  │                │
                        │  └──P键──▶playing │
                        │  die()            │
                        └── dying ──900ms──▶ over ──点击/R/回车──▶ playing
```

- `dying`：死亡演出阶段（红闪渐入 + 震屏），期间不更新逻辑
- `showGameOver()` 有 `G.state !== "dying"` 保护，防止重开后旧回调覆盖新局

## 3. 核心数据结构

### 3.1 全局状态 `G`（一局游戏的全部可变状态）

| 字段 | 类型 | 说明 |
|------|------|------|
| `state` | string | menu / playing / paused / dying / over |
| `time` | number | 本局存活秒数（难度曲线的自变量） |
| `score` / `greens` | number | 得分 / 收集绿点数（= 武器解锁货币） |
| `combo` / `comboTimer` / `comboBest` | number | 当前连击 / 窗口剩余时间 / 历史最高连击 |
| `unlocked` | Set | 已解锁武器 id 集合 |
| `nextWeapon` | object | 下一个待解锁的武器（来自 UNLOCKS） |
| `shield` | boolean | 泡泡护盾是否激活 |
| `invincible` / `spikeT` / `lightningT` / `turretT` | number | 无敌/刺球/闪电/炮塔剩余秒数 |
| `burnState` | object|null | 烈焰冲刺状态（瞄准中 / 冲刺中） |
| `waveCharge` | number | 冲击波蓄力计时 |
| `dots` / `greensList` / `orbs` | array | 红点 / 绿点 / 武器球实体 |
| `missiles` / `bullets` | array | 追踪导弹 / 炮塔子弹 |
| `vortexes` / `walls` / `fans` | array | 黑洞 / 火墙实体 / 扇形冲击波 |
| `particles` / `rings` / `floats` | array | 特效（粒子 / 冲击波圆环 / 飘字） |
| `shake` / `flash` / `redFlash` | number | 屏幕震动 / 白闪 / 死亡红闪强度 |
| `spawnAcc` | number | 红点生成累加器（≥1 生成一个） |

### 3.2 玩家 `P` 与鼠标 `M`

```js
P = { x, y, vx, vy }   // 位置 + 速度
M = { x, y, active, dirX, dirY }
```

### 3.3 红点实体

```js
{
  x, y, r,              // 位置与半径
  type: "normal"|"fast"|"big",
  speed,                // 本点的速度（生成时按当前难度定死）
  frozen,               // >0：冰冻剩余秒数（静止）
  shocked,              // >0：被闪电电击的闪烁时间
  wobble,               // 追踪摆动相位（避免红点走直线）
}
```

## 4. 核心机制实现

### 4.1 玩家物理（鼠标 = 倾斜方向）

```
每帧：
  dir = 鼠标方向单位向量（鼠标移出窗口时用 _lastDirX/Y）
  P.vx += dir × CFG.playerAccel × dt
  若 |P - M| < mouseStopDist：施加反向刹车力（防止围着鼠标抖动）
  阻尼：P.vx *= exp(-playerDamping × dt)
  限速：|v| ≤ playerMaxSpeed
  边缘反弹：撞边时位置钳制 + 速度 × 0.6 弹回
```

设计动机：原版是重力感应"持续施力"的手感，鼠标版用"箭头持续加速滑向鼠标"还原，
而不是把鼠标位置直接映射成箭头位置（那是瞬移，丢失惯性乐趣）。

### 4.2 红点追踪

```
dir = 朝玩家方向
wobble = sin(time × 3 + phase) × 0.35   ← 垂直方向的摆动，避免直线逼近
d.x += (dx/dl + wob × (-dy/dl)) × speed × dt
红点互碰：O(n²) 两两检查，重叠时对半分推（早退优化：先算平方距离）
玩家判定：距离 < (d.r + playerRadius)² 时：
  冰雕（frozen）→ 优先撞碎，谁都能碎（+10 分，不重置连击）
  护盾激活 → 消耗护盾 + 爆炸清场
  无敌（invincible > 0）→ 刺球碾碎
  否则 → die()
```

### 4.3 连击系统（原版规则 n × n × 6）

```
击杀红点 → combo++，comboTimer = 1.5s
每帧衰减 comboTimer；归零时结算：score += combo² × 6，combo 归零
连击 ≥ 5 时结算飘字提示；combo ≥ 20/50 时 HUD 变色
```

### 4.4 难度曲线（以存活时间 t 为自变量）

| 参数 | 公式 |
|------|------|
| 红点生成率 | `min(0.9 + t × 0.045, 6.5)` 个/秒 |
| 普通红点速度 | `min(115 + t × 0.45, 180)` px/s |
| 快速小红点 | t > 40s 后 20% 概率生成，210 px/s |
| 慢速大灰点 | t > 80s 后 12% 概率生成，62 px/s |

参考：原版 Code Red 模式资料记载生成率 8.5~9.5 个/秒（极限），本作 Classic 峰值 6.5 是
给鼠标操作留的余量。

### 4.5 武器系统

- 场上同时存在 `CFG.orbCount`(3) 个武器球，收一个后同帧补刷，从"已解锁池"随机刷新一个（保持数量恒定，避免溢出）
- 解锁：累计绿点达到 `UNLOCKS` 门槛 → 加入已解锁池 + 飘字/音效提示
- 释放：`useWeapon(id)` 立即生效（冲击波/烈焰有蓄力演出）
- 详情数值见 [GAME_DESIGN.md](GAME_DESIGN.md)

## 5. 渲染管线（每帧绘制顺序）

```
1. 屏幕震动位移（ctx.translate 随机偏移）
2. 背景：深蓝垂直渐变 + 44px 网格线（极简还原）
3. 绿点（浮动动画）→ 武器球（符号 + 光晕）→ 红点（冰冻/电击变色）
4. 火墙 → 黑洞（倒计时/脉冲）→ 扇形冲击波 → 导弹 → 炮塔子弹
5. 玩家：护盾光圈 / 刺球 / 电弧 / 炮塔形态 / 箭头本体
6. 冲击波圆环 → 粒子 → 飘字（按 alpha 衰减）
7. 蓄力/瞄准指示（冲击波圆环、烈焰箭头）
8. HUD（分数、连击、时间、解锁进度条、武器球计数）
9. 全屏特效：白闪（武器释放）/ 红闪（死亡渐入）
```

性能要点：粒子上限 700（超出丢弃最早粒子）；红点上限 `CFG.maxDots`(450)；
分离检测用平方距离早退；`ctx.shadowBlur` 只在需要的实体上开启（它是昂贵的滤镜）。

## 6. 音效设计

- `ac()`：懒创建 AudioContext；浏览器要求音频上下文需用户交互后才可播放，
  因此首次点击"开始游戏"时调用 `ac().resume()`（`mousedown` 处理器内）
- `tone(freq, dur, type, vol, slideTo)`：振荡器 + 指数衰减包络，支持频率滑动
- `noise(dur, vol, freq)`：白噪声 + 低通滤波（爆炸/冲击用）
- `SFX` 表：每种子系统一个函数，如 `SFX.green()` = 两个短促高音
- 静音：`muted` 标志让 `ac()` 返回 null，所有音效函数自动空转

## 7. 持久化与兼容性

- `localStorage` 存两项：`ttl_best`（最高分）、`ttl_muted`（静音）
- `file://` 协议下部分浏览器会拒绝 localStorage（隐私模式/Firefox），
  所有读写都包了 try/catch，失败时静默降级（最高分仅本局有效）
- 键盘兼容：R 重开 / P 暂停 / M 静音 / 空格与回车开始

## 8. 扩展点（改哪里）

| 想做的事 | 改哪里 |
|---------|--------|
| 调手感/难度 | `CFG` 对象（见 DEVELOPMENT.md 参数表） |
| 加/改武器 | `WEAPONS` 表 + `UNLOCKS` 表 + `useWeapon()` 加一个 case + 绘制处 |
| 加新敌人类型 | `spawnDot()` 分支 + `CFG` 出现时间 + 绘制颜色 |
| 加新游戏模式 | 状态机加状态 + `startGame()` 分支 + 模式参数覆盖 `CFG` |
| 加 BGM | 在音效层加调度器（setInterval 按节拍触发 tone 和弦） |

各扩展点的详细步骤见 [DEVELOPMENT.md](DEVELOPMENT.md)。
