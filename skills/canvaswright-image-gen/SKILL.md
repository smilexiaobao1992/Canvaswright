---
name: canvaswright-image-gen
description: Generate or insert an image into the selected Canvaswright AI image holder or beside the selected Excalidraw element.
---

# Canvaswright Image Gen

Use this skill when the user asks to create, fill, replace, or place an AI-generated image on the Canvaswright canvas.

## Workflow

1. Ensure the Canvaswright canvas is running for the active project.
2. Read the current selection with the MCP tool `get_canvaswright_selection`.
3. If the user wants to fill a holder, continue only when one selected element has `isAiImageHolder: true`. Otherwise ask the user to select an AI image holder.
4. Generate the bitmap with the built-in image generation tool unless the user provides an existing local image path.
5. Insert the local image with `insert_canvaswright_image`, passing the active project directory and the generated image path.
6. Confirm the inserted element id, asset path, and whether it filled an AI holder.

Use `mode: "insert"` by default. Use `mode: "replace"` only when the user explicitly asks to replace the selected or anchored image in place.

Do not delete the AI holder unless the user explicitly asks for replacement. The holder remains useful as a persistent target for later generations.
