import readline from 'node:readline'
import { handleToolCall } from './tool-handlers.mjs'
import { toolDefinitions } from './tool-definitions.mjs'

const SERVER_NAME = 'Canvaswright MCP'
const SERVER_VERSION = '0.1.0'

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
        'Use get_canvaswright_selection to inspect selected Excalidraw elements, get_canvaswright_edit_tasks and export_canvaswright_edit_task to group annotations with target images, then insert_canvaswright_image or insert_canvaswright_images to place local generated images into the project-local Canvaswright canvas.'
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
      sendResult(id, await handleToolCall(params))
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
