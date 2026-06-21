import { copyFile, mkdir, readFile, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { getCanvasEditTasks } from '../src/lib/edit-tasks.js'
import { planImageInsertion } from '../src/lib/image-insertion.js'
import { getSceneSelection, normalizeScenePayload, sanitizeIdPart } from '../src/lib/scene.js'
import { loadScene, pageAssetUrl, readSelection, resolveCanvasPaths, saveScene } from '../src/server/storage.js'

export async function getCanvaswrightSelection(args = {}) {
  const scene = await loadScene(args)
  const browserSelection = await readSelection(args)
  const sceneSelection = getSceneSelection(scene)
  return browserSelection.selectedElements.length > 0 ? browserSelection : sceneSelection
}

export async function getCanvaswrightEditTasks(args = {}) {
  const scene = await loadScene(args)
  const browserSelection = await readSelection(args)
  const selectedElementIds = Object.fromEntries(
    (browserSelection.selectedElements ?? []).map((element) => [element.id, true])
  )
  return getCanvasEditTasks({
    ...scene,
    appState: {
      ...scene.appState,
      selectedElementIds: Object.keys(selectedElementIds).length > 0
        ? selectedElementIds
        : scene.appState.selectedElementIds
    }
  })
}

export async function insertCanvaswrightImage(args = {}) {
  const imagePath = args.imagePath ? String(args.imagePath) : ''
  if (!imagePath) throw new Error('imagePath is required.')

  const sourceStat = await stat(imagePath)
  if (!sourceStat.isFile()) throw new Error(`imagePath is not a file: ${imagePath}`)

  const paths = resolveCanvasPaths(args)
  await mkdir(paths.pageAssetsDir, { recursive: true })
  const requestedFileName = sanitizeFileName(args.fileName || basename(imagePath))
  const { fileName, filePath } = await uniqueAssetPath(paths.pageAssetsDir, requestedFileName)
  await copyFile(imagePath, filePath)

  const imageSize = await getImageDimensions(imagePath)
  const scene = await loadScene(args)
  const selection = await readSelection(args)
  const sceneWithSelection = applySelectionToScene(scene, selection, args.anchorElementId)
  const result = planImageInsertion({
    scene: sceneWithSelection,
    assetUrl: pageAssetUrl({ pageId: paths.pageId, fileName }),
    fileName,
    mimeType: mimeTypeForFile(fileName),
    imageSize,
    placement: args.placement,
    margin: args.margin,
    now: args.now,
    idSeed: sanitizeIdPart(fileName)
  })
  await saveScene(args, result.scene)

  return {
    pageId: paths.pageId,
    assetFile: filePath,
    assetUrl: pageAssetUrl({ pageId: paths.pageId, fileName }),
    fileId: result.fileId,
    imageElementId: result.imageElement.id,
    anchorElementId: result.anchorElementId,
    filledAiImageHolder: result.filledAiImageHolder,
    bounds: {
      x: result.imageElement.x,
      y: result.imageElement.y,
      width: result.imageElement.width,
      height: result.imageElement.height
    }
  }
}

function applySelectionToScene(scene, selection, anchorElementId) {
  if (anchorElementId) {
    return normalizeScenePayload({
      ...scene,
      appState: {
        ...scene.appState,
        selectedElementIds: { [String(anchorElementId)]: true }
      }
    })
  }
  if (!selection?.selectedElements?.length) return scene
  return normalizeScenePayload({
    ...scene,
    appState: {
      ...scene.appState,
      selectedElementIds: Object.fromEntries(selection.selectedElements.map((element) => [element.id, true]))
    }
  })
}

async function uniqueAssetPath(dir, requestedFileName) {
  const extension = extname(requestedFileName)
  const base = requestedFileName.slice(0, requestedFileName.length - extension.length)
  let fileName = requestedFileName
  let counter = 2
  while (true) {
    const filePath = join(dir, fileName)
    try {
      await stat(filePath)
      fileName = `${base}-v${counter}${extension}`
      counter += 1
    } catch (error) {
      if (error?.code === 'ENOENT') return { fileName, filePath }
      throw error
    }
  }
}

function sanitizeFileName(value) {
  const raw = basename(String(value || 'image.png'))
  const extension = extname(raw) || '.png'
  const base = raw
    .slice(0, raw.length - extname(raw).length)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${base || 'image'}${extension}`
}

async function getImageDimensions(filePath) {
  const buffer = await readFile(filePath)
  if (buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  }
  if (buffer.length >= 10 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break
      const marker = buffer[offset + 1]
      const size = buffer.readUInt16BE(offset + 2)
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) }
      }
      offset += 2 + size
    }
  }
  throw new Error(`Could not read image dimensions for ${filePath}. Use PNG or JPEG.`)
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
