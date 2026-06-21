---
name: canvaswright-open-canvas
description: Open the Canvaswright local Excalidraw canvas for the active project.
---

# Canvaswright Open Canvas

Start the local canvas service with the user's current project directory, not the plugin directory:

```bash
/path/to/canvaswright/scripts/start-canvas.sh /path/to/user/project
```

The default URL is:

```text
http://127.0.0.1:43218/
```

Canvas data is saved under the user's project:

```text
canvas/pages/main/excalidraw-scene.json
canvas/pages/main/assets/
canvas/selection.json
```

If browser control is available, open the URL in the Codex in-app browser. If browser control is unavailable, give the user the URL and keep the service running.
