# Canvaswright

Canvaswright 是一个面向 Codex 的本地 Excalidraw 画布工具，用来完成“生成图片 - 在画布标注 - 按标注局部修改 - 回插结果”的视觉创作流程。

它不是单纯的画板，而是给 Codex 提供一个可读写的项目级画布：你可以把一张或多张图片放到画布上，直接圈选、画箭头、写修改说明，然后让 Codex 根据标注生成干净的修改版。

![Canvaswright 标注工作流](docs/images/canvas-workflow.png)

## 能做什么

- 在本地 Vite 应用中打开 Excalidraw 画布。
- 将画布 scene、选区和素材保存到当前项目目录。
- 让 Codex 通过 MCP 读取当前选区和画布标注。
- 自动把多张图上的标注归属到对应目标图，避免误改。
- 让 Codex 把生成后的 PNG/JPG 回插到原图旁边，或按需替换原图。
- 将标注任务导出为本地 task bundle，方便 Codex 精确读取源图和修改说明。
- 上传图片会自动落盘到项目本地资产目录，避免 scene 里长期保存大段 base64。
- 支持“标题更有艺术感”“这两个区域换个颜色”“按我的标注修改”等视觉迭代场景。

## 给 Codex 的安装口令

第一次安装时，可以把下面这段直接发给 Codex：

```text
请帮我安装 Canvaswright。仓库地址：https://github.com/smilexiaobao1992/Canvaswright

请把它克隆到当前工作区下的 Canvaswright 目录，进入项目后运行 npm install，然后启动本地画布。启动成功后告诉我访问地址。
```

如果已经下载过，只需要说：

```text
请进入 Canvaswright 项目，安装依赖并启动本地画布，启动成功后告诉我访问地址。
```

## 快速开始

```bash
npm install
npm run dev
```

打开：

```text
http://127.0.0.1:43218/
```

如果要给另一个项目目录启动画布：

```bash
./scripts/start-canvas.sh /path/to/project
```

画布运行数据会保存在目标项目里：

```text
canvas/pages/main/excalidraw-scene.json
canvas/pages/main/assets/
canvas/selection.json
```

`canvas/` 是运行时数据，默认被 `.gitignore` 忽略。

## 给 Codex 的小白口令

启动 Canvaswright 后，把下面这段直接发给 Codex：

```text
请使用 Canvaswright 打开当前项目画布。我会在画布里上传或拖入图片，并用圈选、箭头、线条、文字写出修改要求。

当我说“请根据我的标注修改”时，你需要先读取画布标注，判断每条标注对应哪张图片；如果有多张图，请按每张图分别生成修改版，并把结果插入到对应原图旁边。不要删除原图和标注，除非我明确要求替换。
```

之后日常使用只需要说：

```text
请根据我的标注修改
```

## 使用示例

下面这个示例从一张电商海报开始，在画布上标注后，让 Codex 生成修改版。

| 画布标注 | 按标注修改后的海报 |
| --- | --- |
| ![画布圈选标注示例](docs/images/example-annotated.png) | ![修改后的电商海报](docs/images/example-revised.jpg) |

画布标注内容：

- 圈住标题，写：`标题要有艺术感`
- 圈住两个功能徽章，写：`这两个换个颜色展示`
- 对 Codex 说：`请根据我的标注修改`

Codex 会读取画布 scene，识别标注意图，生成一张去掉标注痕迹的干净修改图，并插入到原图旁边方便对比。

## 多图标注怎么判断

当画布里有多张图片时，Canvaswright 会把标注解析成明确的 edit tasks。

判断规则：

- 如果你选中了某张图，这张图优先作为修改目标。
- 如果没有选中图，标注会优先归属给它覆盖到的图片。
- 如果标注没有覆盖图片，会归属给距离最近的图片。
- 如果文字说明靠近一条线、箭头或圈选标注，文字会跟随那条标注归属到同一张图。
- 如果一个标注明显同时覆盖多张图，Canvaswright 会标记为 ambiguous，不会强行猜。

推荐操作：

1. 把一张或多张图片放到画布。
2. 单图精修：选中要修改的图，点击顶部的“锁定目标”，再继续画圈、箭头、线条和说明文字。
3. 多图批量修改：先取消锁定目标，不要只选中单张图；分别在每张要改的图上或旁边画标注，Canvaswright 会根据覆盖和距离拆成多个任务。
4. 如果你框选或 Shift 选中多张图片，Canvaswright 会只在这些图片里判断标注归属；如果只选中一张图，所有标注会优先归到这张图。
5. 对 Codex 说：`请根据我的标注修改` 或 `请根据我的标注修改多张图`。

Codex 会先调用 `get_canvaswright_edit_tasks`，拿到结构化任务，再逐个生成修改版。回插图片时会传入目标图 id：

```json
{
  "imagePath": "/path/to/revised.png",
  "anchorElementId": "source-image-element-id",
  "placement": "right"
}
```

这样即使同一画布上有多张图，结果也会插入到对应原图旁边。

如果你明确要求“替换原图”，Codex 会使用：

```json
{
  "imagePath": "/path/to/revised.png",
  "anchorElementId": "source-image-element-id",
  "mode": "replace"
}
```

默认仍然是 `mode: "insert"`，用于保留原图和修改版对比。

## 生成占位框是什么

顶部的“添加生成占位框”会在画布里放一个蓝色虚线框。它默认出现在当前画布内容右侧，不会压到已有图片上。它用来提前规划图片位置：选中这个框后，让 Codex 生成图片，生成结果会填入这个框的尺寸和位置。

如果你已经有图片，只想上传、标注、局部修改，可以不用这个功能。

## Codex 调用结构

```mermaid
flowchart TD
  User["用户"]
  Codex["Codex"]
  Skills["Canvaswright Skills"]
  MCP["Canvaswright MCP Server"]
  App["Vite + React App"]
  Excalidraw["Excalidraw Canvas"]
  Storage["项目本地 canvas 文件"]
  ImageGen["图片生成能力"]

  User -->|"上传图片 / 画标注 / 提修改要求"| Codex
  Codex -->|"打开画布 / 生成图片 / 按标注修改"| Skills
  Skills -->|"读取选区 / 识别 edit tasks / 插入图片"| MCP
  MCP -->|"导出 task.json + 源图"| Storage
  MCP -->|"读写 scene JSON"| Storage
  App --> Excalidraw
  Excalidraw -->|"自动保存 scene + selection"| App
  App --> Storage
  Codex --> ImageGen
  ImageGen -->|"生成 PNG/JPG"| MCP
  MCP -->|"写入资产 + 添加 image element"| Storage
  Storage -->|"刷新 / 事件更新"| App
```

Codex 下次调用时主要用这些能力：

- Skill: `canvaswright-open-canvas` 打开当前项目的本地画布。
- Skill: `canvaswright-image-gen` 生成图片并放到选中的“生成占位框”或指定元素旁边。
- Skill: `canvaswright-image-edit` 根据画布标注生成干净修改版。
- MCP tool: `get_canvaswright_selection` 读取当前 Excalidraw 选区。
- MCP tool: `get_canvaswright_edit_tasks` 将标注归属到目标图片，适合多图修改。
- MCP tool: `export_canvaswright_edit_task` 将某个修改任务和源图导出到 `canvas/pages/main/exports/`。
- MCP tool: `insert_canvaswright_image` 将本地图片复制到 `canvas/pages/main/assets/`，并添加到 Excalidraw scene。传 `anchorElementId` 可以明确插到某张源图旁边；传 `mode: "replace"` 可以原位替换。
- MCP tool: `insert_canvaswright_images` 一次回插多张生成图，适合多图批量修改。
- MCP tool: `export_canvaswright_image` 导出选中或指定图片素材。

## 项目结构

```text
.
├── .codex-plugin/
│   └── plugin.json              # Codex 插件清单
├── .mcp.json                    # MCP server 注册
├── mcp/
│   ├── server.mjs               # MCP JSON-RPC 入口
│   ├── tool-definitions.mjs     # MCP 工具 schema
│   ├── tool-handlers.mjs        # MCP 工具调用分发
│   └── canvas-actions.mjs       # 选区、edit task、图片插入和导出动作
├── scripts/
│   └── start-canvas.sh          # 为指定项目启动画布
├── skills/
│   ├── canvaswright-open-canvas/
│   ├── canvaswright-image-gen/
│   └── canvaswright-image-edit/
├── src/
│   ├── App.jsx                  # Excalidraw UI 外壳
│   ├── lib/                     # scene 归一化、edit task、插入规划
│   └── server/                  # Vite middleware 和画布存储
├── docs/images/                 # README 配图
├── index.html
├── package.json
└── vite.config.js
```

运行时数据结构：

```text
canvas/
├── selection.json
└── pages/main/
    ├── exports/
    ├── excalidraw-scene.json
    └── assets/
```

## 技术栈版本

当前锁定的开发环境：

| 层 | 版本 |
| --- | --- |
| Node.js | 20.19.6 |
| npm | 10.8.2 |
| React | 18.3.1 |
| React DOM | 18.3.1 |
| Vite | 8.0.16 |
| @vitejs/plugin-react | 5.2.0 |
| @excalidraw/excalidraw | 0.18.1 |

`package.json` 保留依赖范围，精确安装版本由 `package-lock.json` 锁定。

## 产品路线

- 多画布与多项目管理：后续计划支持在一个 Canvaswright 实例里新建多个画布，并自由切换不同项目或不同任务的画布，适合同时推进多组产品图、海报图或客户项目。

## 开发与验证

```bash
npm install
npm test
npm run build
```

插件校验：

```bash
python3 ~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py .
```

常用本地检查：

```bash
npm test
npm run build
curl -fsS http://127.0.0.1:43218/api/health
```

## 注意事项

- Canvaswright 面向本地项目工作流，画布数据和素材会保存到当前项目下。
- MCP server 只读写本地 canvas 文件；图片生成由 Codex 当前可用的图片生成能力完成。
- 不要默认提交 `canvas/` 运行时数据，除非你明确想发布一个 demo scene。

---

## English Version

Canvaswright is a local Excalidraw canvas for Codex-assisted image generation, annotation, and visual iteration.

It gives Codex a project-local drawing surface: place one or more images on the canvas, mark exact areas with circles, arrows, and text notes, then ask Codex to generate clean revised images from those annotations.

### Quick Start

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:43218/
```

To run Canvaswright for another project directory:

```bash
./scripts/start-canvas.sh /path/to/project
```

### Multi-image Editing

Canvaswright analyzes a canvas with multiple images and turns annotations into explicit edit tasks.

Rules:

- A selected image takes priority as the edit target.
- Without selection, annotations are assigned by overlap first, then proximity.
- Text notes follow nearby line, arrow, or shape annotations when possible.
- An annotation that clearly touches multiple images is marked ambiguous instead of being guessed.

Codex uses `get_canvaswright_edit_tasks` to get structured tasks, generates revised images, and inserts each result beside its source image with `insert_canvaswright_image` and `anchorElementId`.

### Roadmap

- Multi-canvas and multi-project support: a future version should allow creating multiple canvases in one Canvaswright instance and switching freely between project or task canvases.

### Development

```bash
npm install
npm test
npm run build
```

Plugin validation:

```bash
python3 ~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py .
```

## 致谢 / Acknowledgements

感谢开发者 [zhongerxin/cowart](https://github.com/zhongerxin/cowart) 为本项目提供思路。

Thanks to [zhongerxin/cowart](https://github.com/zhongerxin/cowart) for the inspiration behind this project.
