import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { getCanvasEditTasks } from '../src/lib/edit-tasks.js'
import { planImageInsertion } from '../src/lib/image-insertion.js'
import { getSceneSelection, normalizeScenePayload, sanitizeIdPart } from '../src/lib/scene.js'
import { copyAssetToExports, mimeTypeForFile, sanitizeFileName, uniqueAssetPath } from '../src/server/assets.js'
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
    mode: args.mode,
    placement: args.placement,
    margin: args.margin,
    now: args.now,
    idSeed: sanitizeIdPart(fileName)
  })
  await saveScene({ ...args, source: 'mcp' }, result.scene)

  return {
    pageId: paths.pageId,
    assetFile: filePath,
    assetUrl: pageAssetUrl({ pageId: paths.pageId, fileName }),
    fileId: result.fileId,
    imageElementId: result.imageElement.id,
    anchorElementId: result.anchorElementId,
    filledAiImageHolder: result.filledAiImageHolder,
    mode: args.mode === 'replace' ? 'replace' : 'insert',
    bounds: {
      x: result.imageElement.x,
      y: result.imageElement.y,
      width: result.imageElement.width,
      height: result.imageElement.height
    }
  }
}

export async function insertCanvaswrightImages(args = {}) {
  if (!Array.isArray(args.images) || args.images.length === 0) {
    throw new Error('images must be a non-empty array.')
  }

  const results = []
  for (const imageArgs of args.images) {
    results.push(await insertCanvaswrightImage({
      ...args,
      ...imageArgs,
      images: undefined
    }))
  }
  return { results }
}

export async function exportCanvaswrightEditTask(args = {}) {
  const paths = resolveCanvasPaths(args)
  const scene = await loadScene(args)
  const tasks = await getCanvaswrightEditTasks(args)
  const task = selectEditTask(tasks.editTasks, args)
  if (!task) throw new Error('No Canvaswright image edit task was found.')

  const fileId = task.targetElement.fileId
  const file = fileId ? scene.files[fileId] : null
  if (!file) throw new Error(`Target image file was not found for element: ${task.targetElement.id}`)

  const exportId = sanitizeIdPart(args.exportName || `task-${task.targetElement.id}`)
  const exportDir = join(paths.pageDir, 'exports', exportId)
  const sourceImage = await copyAssetToExports({
    ...args,
    pageId: paths.pageId,
    file,
    exportDir,
    fallbackName: task.targetElement.fileName || `${task.targetElement.id}.png`
  })
  const taskFile = join(exportDir, 'task.json')
  const payload = {
    task,
    sourceImage: {
      filePath: sourceImage.filePath,
      fileName: sourceImage.fileName,
      mimeType: sourceImage.mimeType
    },
    exportedAt: new Date().toISOString()
  }
  await writeFile(taskFile, `${JSON.stringify(payload, null, 2)}\n`)

  return {
    exportDir,
    taskFile,
    sourceImageFile: sourceImage.filePath,
    task
  }
}

export async function exportCanvaswrightImage(args = {}) {
  const paths = resolveCanvasPaths(args)
  const scene = await loadScene(args)
  const selection = await readSelection(args)
  const imageElement = selectImageElement(scene, selection, args.elementId)
  if (!imageElement) throw new Error('No Canvaswright image element was found to export.')

  const file = imageElement.fileId ? scene.files[imageElement.fileId] : null
  if (!file) throw new Error(`Image file was not found for element: ${imageElement.id}`)

  const exportDir = join(paths.pageDir, 'exports', 'images')
  const exportedImage = await copyAssetToExports({
    ...args,
    pageId: paths.pageId,
    file,
    exportDir,
    fileName: args.fileName,
    fallbackName: file.customData?.fileName || `${imageElement.id}.png`
  })

  return {
    exportDir,
    imageFile: exportedImage.filePath,
    fileName: exportedImage.fileName,
    mimeType: exportedImage.mimeType,
    imageElementId: imageElement.id
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

function selectEditTask(editTasks, args) {
  if (args.targetElementId) {
    return editTasks.find((task) => task.targetElement.id === String(args.targetElementId)) ?? null
  }
  const taskIndex = Number.isInteger(args.taskIndex) ? args.taskIndex : 0
  return editTasks[taskIndex] ?? null
}

function selectImageElement(scene, selection, elementId) {
  const activeImages = normalizeScenePayload(scene).elements.filter((element) => element?.type === 'image' && element?.isDeleted !== true)
  if (elementId) return activeImages.find((element) => element.id === String(elementId)) ?? null

  const selectedIds = new Set((selection?.selectedElements ?? []).map((element) => element.id))
  const selectedImage = activeImages.find((element) => selectedIds.has(element.id))
  return selectedImage ?? activeImages[0] ?? null
}
