---
name: canvaswright-image-edit
description: Use an annotated Canvaswright canvas screenshot to generate a clean revised image and insert it near the selected source.
---

# Canvaswright Image Edit

Use this skill when the user provides a Canvaswright annotation screenshot and asks for a clean revised image.

## Workflow

1. Interpret the screenshot annotations as edit instructions.
2. Generate a clean image that applies the requested changes and removes annotation marks.
3. Insert the generated bitmap with the MCP tool `insert_canvaswright_image`.
4. Prefer placement beside the selected source element. If nothing is selected, insert at the canvas origin.
5. Keep the original image and annotation intact unless the user explicitly asks to replace or remove them.
