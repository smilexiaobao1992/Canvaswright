import readline from 'node:readline'
import { getCanvaswrightSelection, insertCanvaswrightImage } from './canvas-actions.mjs'

const SERVER_NAME = 'Canvaswright MCP'
const SERVER_VERSION = '0.1.0'
const TOOL_GET_SELECTION = 'get_canvaswright_selection'
const TOOL_INSERT_IMAGE = 'insert_canvaswright_image'

const JsonRpcError = {
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

function sendResult(id, result) {
  send({ jsonrpc: '2.0', id, result })
}

function sendError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } })
}

function toolDefinitions() {
  return [
    {
      name: TOOL_GET_SELECTION,
      title: 'Get Canvaswright Selection',
      description: 'Return the selected Excalidraw elements from the project-local Canvaswright canvas.',
      inputSchema: {
        type: 'object',
        properties: {
          projectDir: {
            type: 'string',
            description: 'Absolute project directory containing canvas/. Defaults to the current working directory.'
          },
          canvasDir: {
            type: 'string',
            description: 'Absolute canvas directory. Overrides projectDir.'
          }
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
      name: TOOL_INSERT_IMAGE,
      title: 'Insert Canvaswright Image',
      description:
        'Copy a local bitmap into canvas/pages/main/assets, add it to the Excalidraw scene, and place it in the selected AI holder or beside the selected element.',
      inputSchema: {
        type: 'object',
        properties: {
          imagePath: { type: 'string', description: 'Absolute local PNG or JPEG path to insert.' },
          projectDir: { type: 'string', description: 'Absolute project directory containing canvas/.' },
          canvasDir: { type: 'string', description: 'Absolute canvas directory. Overrides projectDir.' },
          fileName: { type: 'string', description: 'Optional destination filename under page assets.' },
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
    }
  ]
}

async function handleToolCall(id, params) {
  if (params?.name === TOOL_GET_SELECTION) {
    const selection = await getCanvaswrightSelection(params.arguments ?? {})
    const summary =
      selection.selectedElements.length === 0
        ? 'No Canvaswright elements are currently selected.'
        : selection.selectedElements
            .map((element) => `${element.id} [${element.type ?? 'unknown'}]${element.isAiImageHolder ? ' AI holder' : ''}`)
            .join('\n')
    sendResult(id, {
      content: [{ type: 'text', text: summary }],
      structuredContent: { selection }
    })
    return
  }

  if (params?.name === TOOL_INSERT_IMAGE) {
    const result = await insertCanvaswrightImage(params.arguments ?? {})
    sendResult(id, {
      content: [
        {
          type: 'text',
          text: `Inserted ${result.imageElementId} at (${result.bounds.x}, ${result.bounds.y}) using ${result.assetUrl}.`
        }
      ],
      structuredContent: result
    })
    return
  }

  sendError(id, JsonRpcError.INVALID_PARAMS, `Unknown tool: ${params?.name ?? ''}`)
}

async function handleRequest(message) {
  const { id, method, params } = message

  if (method === 'initialize') {
    sendResult(id, {
      protocolVersion: params?.protocolVersion ?? '2025-11-25',
      capabilities: { tools: {} },
      serverInfo: {
        name: SERVER_NAME,
        version: SERVER_VERSION
      },
      instructions:
        'Use get_canvaswright_selection to inspect selected Excalidraw elements and insert_canvaswright_image to place local generated images into the project-local Canvaswright canvas.'
    })
    return
  }

  if (method === 'ping') {
    sendResult(id, {})
    return
  }

  if (method === 'tools/list') {
    sendResult(id, { tools: toolDefinitions() })
    return
  }

  if (method === 'tools/call') {
    try {
      await handleToolCall(id, params)
    } catch (error) {
      sendError(id, JsonRpcError.INVALID_PARAMS, error instanceof Error ? error.message : String(error))
    }
    return
  }

  if (id !== undefined) {
    sendError(id, JsonRpcError.METHOD_NOT_FOUND, `Method not found: ${method}`)
  }
}

const lines = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity
})

lines.on('line', (line) => {
  if (line.trim().length === 0) return

  let message
  try {
    message = JSON.parse(line)
  } catch {
    return
  }

  handleRequest(message).catch((error) => {
    if (message.id !== undefined) {
      sendError(message.id, JsonRpcError.INVALID_PARAMS, error instanceof Error ? error.message : String(error))
    }
  })
})
