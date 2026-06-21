---
name: canvaswright-image-edit
description: Use Canvaswright annotations to identify target image edit tasks, generate clean revised images, and insert them near each source.
---

# Canvaswright Image Edit

Use this skill when the user asks to modify one or more images from Canvaswright annotations.

## Workflow

1. Ensure the Canvaswright canvas is running for the active project.
2. Call `get_canvaswright_edit_tasks` before interpreting the screenshot manually.
3. If it returns one or more edit tasks, treat each task as a target image plus its related annotations.
4. If it returns ambiguous annotations, ask the user to select the intended target image or move the annotation closer to its image.
5. For each task, call `export_canvaswright_edit_task` with `targetElementId: task.targetElement.id` to get a local task bundle and source image file.
6. Generate a clean image for each task that applies the requested changes and removes annotation marks.
7. Insert each generated bitmap with `insert_canvaswright_image`, passing `anchorElementId: task.targetElement.id` so the result appears beside the source image.
8. If there are multiple generated images, use `insert_canvaswright_images` with one item per task.
9. Keep original images and annotations intact unless the user explicitly asks to replace or remove them.

## Replacement mode

Use `mode: "insert"` by default so the original remains visible for comparison.

Use `mode: "replace"` only when the user explicitly asks to replace the original. Replacement marks the source image element deleted and inserts the revised image in the same bounds.

## Multi-image rules

- Selection wins: if the user selected an image, annotations are applied to that image.
- Without selection, annotations are assigned by overlap first, then proximity.
- Do not guess when a single annotation clearly covers multiple images. Ask for a selected target.
- For multiple detected tasks, process them one by one and report which source image each result came from.
