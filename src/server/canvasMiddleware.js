import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { loadScene, readSelection, resolveCanvasPaths, saveScene, saveSelection } from './storage.js'

const clients = new Set()
let eventVersion = 0

export function canvasMiddleware(options = {}) {
  return async function handleCanvasRequest(req, res, next) {
    try {
      const url = new URL(req.url, 'http://127.0.0.1')

      if (url.pathname === '/api/health') {
        sendJson(res, 200, { ok: true })
        return
      }

      if (url.pathname === '/api/scene' && req.method === 'GET') {
        const scene = await loadScene(options)
        sendJson(res, 200, { scene })
        return
      }

      if (url.pathname === '/api/scene' && req.method === 'PUT') {
        const body = await readJsonBody(req)
        const result = await saveScene(options, body?.scene ?? body)
        broadcast({ type: 'scene-changed', paths: publicPaths(result.paths) })
        sendJson(res, 200, { scene: result.scene, paths: publicPaths(result.paths) })
        return
      }

      if (url.pathname === '/api/selection' && req.method === 'GET') {
        const selection = await readSelection(options)
        sendJson(res, 200, { selection })
        return
      }

      if (url.pathname === '/api/selection' && req.method === 'PUT') {
        const body = await readJsonBody(req)
        const result = await saveSelection(options, body?.selection ?? body)
        sendJson(res, 200, { selection: result.selection, paths: publicPaths(result.paths) })
        return
      }

      if (url.pathname === '/api/events' && req.method === 'GET') {
        openEventStream(res)
        return
      }

      if (url.pathname.startsWith('/page-assets/') && req.method === 'GET') {
        await sendPageAsset(url.pathname, res, options)
        return
      }

      next()
    } catch (error) {
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  }
}

function openEventStream(res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive'
  })
  clients.add(res)
  res.write(`event: ready\nid: ${eventVersion}\ndata: {}\n\n`)
  res.on('close', () => clients.delete(res))
}

function broadcast(payload) {
  const event = {
    ...payload,
    version: ++eventVersion,
    updatedAt: new Date().toISOString()
  }
  for (const client of clients) {
    if (client.destroyed) {
      clients.delete(client)
      continue
    }
    client.write(`event: ${event.type}\nid: ${event.version}\ndata: ${JSON.stringify(event)}\n\n`)
  }
}

async function sendPageAsset(pathname, res, options) {
  const [, , pageIdRaw, fileNameRaw] = pathname.split('/')
  const pageId = decodeURIComponent(pageIdRaw || 'main')
  const fileName = basename(decodeURIComponent(fileNameRaw || ''))
  const paths = resolveCanvasPaths({ ...options, pageId })
  const filePath = resolve(join(paths.pageAssetsDir, fileName))
  if (!filePath.startsWith(resolve(paths.pageAssetsDir))) {
    sendJson(res, 400, { error: 'Unsafe asset path.' })
    return
  }

  const fileStat = await stat(filePath)
  if (!fileStat.isFile()) {
    sendJson(res, 404, { error: 'Asset not found.' })
    return
  }

  res.statusCode = 200
  res.setHeader('content-type', mimeTypeForFile(fileName))
  createReadStream(filePath).pipe(res)
}

function readJsonBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 50 * 1024 * 1024) {
        rejectBody(new Error('Request body is too large.'))
        req.destroy()
      }
    })
    req.on('end', () => resolveBody(body ? JSON.parse(body) : {}))
    req.on('error', rejectBody)
  })
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(payload))
}

function publicPaths(paths) {
  return {
    canvasDir: paths.canvasDir,
    sceneFile: paths.sceneFile,
    selectionFile: paths.selectionFile,
    pageAssetsDir: paths.pageAssetsDir
  }
}

function mimeTypeForFile(fileName) {
  switch (extname(fileName).toLowerCase()) {
    case '.apng':
      return 'image/apng'
    case '.avif':
      return 'image/avif'
    case '.gif':
      return 'image/gif'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.svg':
      return 'image/svg+xml'
    case '.webp':
      return 'image/webp'
    default:
      return 'application/octet-stream'
  }
}
