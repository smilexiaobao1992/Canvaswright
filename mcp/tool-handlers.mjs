import {
  exportCanvaswrightEditTask,
  exportCanvaswrightImage,
  getCanvaswrightEditTasks,
  getCanvaswrightSelection,
  insertCanvaswrightImage,
  insertCanvaswrightImages
} from './canvas-actions.mjs'
import {
  TOOL_EXPORT_EDIT_TASK,
  TOOL_EXPORT_IMAGE,
  TOOL_GET_EDIT_TASKS,
  TOOL_GET_SELECTION,
  TOOL_INSERT_IMAGE,
  TOOL_INSERT_IMAGES
} from './tool-definitions.mjs'

export async function handleToolCall(params) {
  if (params?.name === TOOL_GET_SELECTION) {
    const selection = await getCanvaswrightSelection(params.arguments ?? {})
    const summary =
      selection.selectedElements.length === 0
        ? 'No Canvaswright elements are currently selected.'
        : selection.selectedElements
            .map((element) => `${element.id} [${element.type ?? 'unknown'}]${element.isAiImageHolder ? ' AI holder' : ''}`)
            .join('\n')
    return {
      content: [{ type: 'text', text: summary }],
      structuredContent: { selection }
    }
  }

  if (params?.name === TOOL_GET_EDIT_TASKS) {
    const result = await getCanvaswrightEditTasks(params.arguments ?? {})
    const summary =
      result.editTasks.length === 0
        ? 'No Canvaswright image edit tasks were detected.'
        : result.editTasks
            .map((task) => {
              const text = task.instructionText ? `: ${task.instructionText}` : ''
              return `${task.targetElement.id} <= ${task.annotationElements.length} annotation(s)${text}`
            })
            .join('\n')
    return {
      content: [{ type: 'text', text: summary }],
      structuredContent: result
    }
  }

  if (params?.name === TOOL_EXPORT_EDIT_TASK) {
    const result = await exportCanvaswrightEditTask(params.arguments ?? {})
    return {
      content: [
        {
          type: 'text',
          text: `Exported edit task for ${result.task.targetElement.id} to ${result.exportDir}.`
        }
      ],
      structuredContent: result
    }
  }

  if (params?.name === TOOL_INSERT_IMAGE) {
    const result = await insertCanvaswrightImage(params.arguments ?? {})
    const action = result.mode === 'replace' ? 'Replaced' : 'Inserted'
    return {
      content: [
        {
          type: 'text',
          text: `${action} ${result.imageElementId} at (${result.bounds.x}, ${result.bounds.y}) using ${result.assetUrl}.`
        }
      ],
      structuredContent: result
    }
  }

  if (params?.name === TOOL_INSERT_IMAGES) {
    const result = await insertCanvaswrightImages(params.arguments ?? {})
    return {
      content: [{ type: 'text', text: `Inserted ${result.results.length} Canvaswright image(s).` }],
      structuredContent: result
    }
  }

  if (params?.name === TOOL_EXPORT_IMAGE) {
    const result = await exportCanvaswrightImage(params.arguments ?? {})
    return {
      content: [{ type: 'text', text: `Exported ${result.imageElementId} to ${result.imageFile}.` }],
      structuredContent: result
    }
  }

  throw new Error(`Unknown tool: ${params?.name ?? ''}`)
}
