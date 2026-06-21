# Canvaswright

Canvaswright is a local Excalidraw canvas plugin for Codex-assisted image creation.

It keeps canvas data in the active project:

```text
canvas/pages/main/excalidraw-scene.json
canvas/pages/main/assets/
canvas/selection.json
```

## Development

```bash
npm install
npm run dev
npm test
npm run build
```

To run the canvas for another project directory:

```bash
./scripts/start-canvas.sh /path/to/project
```

Default URL:

```text
http://127.0.0.1:43218/
```
