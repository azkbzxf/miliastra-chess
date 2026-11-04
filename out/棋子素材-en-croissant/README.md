# en-croissant 棋子素材包（cburnett 全套 12 枚）

从开源国际象棋 GUI 项目 **[en-croissant](https://github.com/franciscoBSalgueiro/en-croissant)** 内置的 `public/pieces` 提取，矢量原样保留。

## 目录结构

```
棋子素材-en-croissant/
├─ svg/                 12 个原始 SVG（45×45 原生，矢量，可无限放大）
├─ png/
│  ├─ 48/  64/  128/  240/  256/  512/    每个尺寸各 12 张透明背景 PNG
├─ cburnett.css         原始 CSS，12 条规则，直接 <link> 即可用
├─ pieces.json          元数据（兵种/颜色/Unicode/FEN 字符/路径映射）
├─ spritesheet_512.png  4×3 精灵图，单格 512px（做图集/图集动画用）
├─ preview_light.png    浅色底预览
└─ preview_dark.png     深色底预览
```

## 命名规则

`兵种字母 + 颜色字母`

| 字母 | 兵种 | | 字母 | 颜色 |
|---|---|---|---|---|
| `K` | 王 King | | `W` | 白 White |
| `Q` | 后 Queen | | `B` | 黑 Black |
| `R` | 车 Rook | | | |
| `B` | 象 Bishop | | | |
| `N` | 马 Knight | | | |
| `P` | 兵 Pawn | | | |

例：`KW` = 白王，`NB` = 黑马，`PB` = 黑兵。

> 注意 `B` 有两种含义：`BB` = 黑象，`BW` = 白象，`RB` = 黑车。

## 三种用法

**1. CSS class（最快，文件已内联 base64）**

```html
<link rel="stylesheet" href="cburnett.css">
<div class="pawn white" style="width:45px;height:45px"></div>
```

class 格式为 `兵种名.颜色`，如 `knight.black`、`king.white`。

**2. SVG（任意缩放，最清晰）**

```html
<img src="svg/KW.svg" width="80" height="80" alt="白王">
```

SVG 原生只有 `width="45" height="45"` 没有 `viewBox`，直接放大浏览器会先按 45px 栅格化再插值 → 会糊。放大前先补 viewBox：

```js
// 把 width/height 换成目标尺寸，并补 viewBox="0 0 45 45"
svg.replace(/<svg/, '<svg viewBox="0 0 45 45" width="256" height="256"')
```

**3. PNG（引擎/游戏用）**

`png/<尺寸>/<名字>.png`，全部 RGBA 透明背景。

## 棋盘摆位参考（FEN 起始局面）

```
第 8 行  RB NB BB QB KB BB NB RB
第 7 行  PB PB PB PB PB PB PB PB
第 2 行  PW PW PW PW PW PW PW PW
第 1 行  RW NW BW QW KW BW NW RW
```

## 许可

cburnett 棋子由 **Colin M.L. Burnett** 创作，原发布于 Wikimedia Commons，以 **CC BY-SA 3.0** 授权；en-croissant 项目将其内嵌于 CSS。

用于个人/开源项目没问题，**商用前请自行复核许可条款**并保留署名与相同方式共享要求。来源与作者信息已写入 `pieces.json`。

## 说明：本项目里的用法

千星奇域（原神 UGC）的图片控件**不能上传自定义 PNG**（只有官方预设白名单），所以这套图在本项目里只用于网页 Demo（`out/交付包/chess_demo.html`）；游戏内棋子改用「图元 + Unicode 棋符」方案。这套素材可以拿走给任何别的引擎/网页用。
