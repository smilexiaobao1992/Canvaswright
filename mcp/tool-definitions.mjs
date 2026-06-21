export const TOOL_GET_SELECTION = 'get_canvaswright_selection'
export const TOOL_GET_EDIT_TASKS = 'get_canvaswright_edit_tasks'
export const TOOL_EXPORT_EDIT_TASK = 'export_canvaswright_edit_task'
export const TOOL_INSERT_IMAGE = 'insert_canvaswright_image'
export const TOOL_INSERT_IMAGES = 'insert_canvaswright_images'
export const TOOL_EXPORT_IMAGE = 'export_canvaswright_image'

const projectDirProperty = {
  type: 'string',
  description: 'Absolute project directory containing canvas/. Defaults to the current working directory.'
}

const canvasDirProperty = {
  type: 'string',
  description: 'Absolute canvas directory. Overrides projectDir.'
}

export function toolDefinitions() {
  return [
    {
      name: TOOL_GET_SELECTION,
      title: 'Get Canvaswright Selection',
      description: 'Return the selected Excalidraw elements from the project-local Canvaswright canvas.',
      inputSchema: {
        type: 'object',
        properties: {
          projectDir: projectDirProperty,
          canvasDir: canvasDirProperty
        },
        additionalProperties: false
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    {
      name: TOOL_GET_EDIT_TASKS,
      title: 'Get Canvaswright Edit Tasks',
      description:
        'Analyze the canvas and group annotation elements with the image elements they should modify. Selection takes priority; otherwise annotations are assigned by overlap and proximity.',
      inputSchema: {
        type: 'object',
        properties: {
          projectDir: projectDirProperty,
          canvasDir: canvasDirProperty
        },
        additionalProperties: false
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    {
      name: TOOL_EXPORT_EDIT_TASK,
      title: 'Export Canvaswright Edit Task',
      description:
        'Export one detected image edit task plus its source image into canvas/pages/main/exports for image editing workflows.',
      inputSchema: {
        type: 'object',
        properties: {
          projectDir: projectDirProperty,
          canvasDir: canvasDirProperty,
          targetElementId: { type: 'string', description: 'Optional target image element id. Defaults to the first detected task.' },
          taskIndex: { type: 'integer', minimum: 0, description: 'Optional zero-based task index when targetElementId is omitted.' },
          exportName: { type: 'string', description: 'Optional export folder name under canvas/pages/main/exports/.' }
        },
        additionalProperties: false
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    {
      name: TOOL_INSERT_IMAGE,
      title: 'Insert Canvaswright Image',
      description:
        'Copy a local bitmap into canvas/pages/main/assets, add it to the Excalidraw scene, and place it in the selected AI holder or beside the selected element.',
      inputSchema: {
        type: 'object',
        properties: {
          imagePath: { type: 'string', description: 'Absolute local PNG or JPEG path to insert.' },
          projectDir: projectDirProperty,
          canvasDir: canvasDirProperty,
          fileName: { type: 'string', description: 'Optional destination filename under page assets.' },
          anchorElementId: {
            type: 'string',
            description: 'Optional image or holder element id to place beside or fill. Overrides the current browser selection.'
          },
          mode: {
            type: 'string',
            enum: ['insert', 'replace'],
            description: 'insert keeps the original and places the result nearby; replace marks the anchor image deleted and inserts the result in the same bounds.'
          },
          placement: { type: 'string', enum: ['right', 'left', 'below'], description: 'Placement around a non-holder selection.' },
          margin: { type: 'number', description: 'Canvas units between anchor and image. Defaults to 40.' }
        },
        required: ['imagePath'],
        additionalProperties: false
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    {
      name: TOOL_INSERT_IMAGES,
      title: 'Insert Canvaswright Images',
      description: 'Insert several local generated images into the canvas, each with its own anchor element and insertion mode.',
      inputSchema: {
        type: 'object',
        properties: {
          projectDir: projectDirProperty,
          canvasDir: canvasDirProperty,
          placement: { type: 'string', enum: ['right', 'left', 'below'], description: 'Default placement for images without their own placement.' },
          mode: { type: 'string', enum: ['insert', 'replace'], description: 'Default insertion mode for images without their own mode.' },
          images: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              properties: {
                imagePath: { type: 'string', description: 'Absolute local PNG or JPEG path to insert.' },
                fileName: { type: 'string', description: 'Optional destination filename under page assets.' },
                anchorElementId: { type: 'string', description: 'Target image or holder element id.' },
                mode: { type: 'string', enum: ['insert', 'replace'] },
                placement: { type: 'string', enum: ['right', 'left', 'below'] },
                margin: { type: 'number' }
              },
              required: ['imagePath'],
              additionalProperties: false
            }
          }
        },
        required: ['images'],
        additionalProperties: false
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      }
    },
    {
      name: TOOL_EXPORT_IMAGE,
      title: 'Export Canvaswright Image',
      description: 'Export a selected or specified canvas image asset into canvas/pages/main/exports/images.',
      inputSchema: {
        type: 'object',
        properties: {
          projectDir: projectDirProperty,
          canvasDir: canvasDirProperty,
          elementId: { type: 'string', description: 'Optional image element id. Defaults to the selected image, then first image.' },
          fileName: { type: 'string', description: 'Optional exported filename.' }
        },
        additionalProperties: false
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false
      }
    }
  ]
}
