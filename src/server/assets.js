import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { normalizeScenePayload, sanitizeIdPart } from '../lib/scene.js'
import { pageAssetUrl, resolveCanvasPaths } from './storage.js'

export async function normalizeSceneAssets({ projectDir, canvasDir, pageId, scene }) {
  const paths = resolveCanvasPaths({ projectDir, canvasDir, pageId })
  const currentScene = normalizeScenePayload(scene)
  const nextFiles = { ...currentScene.files }
  const assets = []

  await mkdir(paths.pageAssetsDir, { recursive: true })

  for (const [fileId, file] of Object.entries(currentScene.files)) {
    const dataUrl = typeof file?.dataURL === 'string' ? file.dataURL : ''
    const parsed = parseDataUrl(dataUrl)
    if (!parsed) continue

    const requestedName = file.customData?.fileName || `${sanitizeIdPart(fileId)}.${extensionForMime(parsed.mimeType)}`
    const { fileName, filePath } = await uniqueAssetPath(paths.pageAssetsDir, requestedName)
    await writeFile(filePath, parsed.buffer)
    nextFiles[fileId] = {
      ...file,
      mimeType: file.mimeType || parsed.mimeType,
      dataURL: pageAssetUrl({ pageId: paths.pageId, fileName }),
      customData: {
        ...file.customData,
        fileName
      }
    }
    assets.push({ fileId, fileName, filePath, assetUrl: nextFiles[fileId].dataURL, mimeType: parsed.mimeType })
  }

  return {
    scene: normalizeScenePayload({
      ...currentScene,
      files: nextFiles
    }),
    assets,
    normalizedCount: assets.length
  }
}

export async function resolveSceneFileAsset({ projectDir, canvasDir, pageId, file }) {
  const dataUrl = typeof file?.dataURL === 'string' ? file.dataURL : ''
  const parsed = parseDataUrl(dataUrl)
  if (parsed) {
    return {
      buffer: parsed.buffer,
      mimeType: parsed.mimeType,
      fileName: file.customData?.fileName || `image.${extensionForMime(parsed.mimeType)}`
    }
  }

  if (dataUrl.startsWith('/page-assets/')) {
    const [, , pageIdRaw, fileNameRaw] = dataUrl.split('/')
    const paths = resolveCanvasPaths({ projectDir, canvasDir, pageId: pageIdRaw || pageId })
    const fileName = basename(decodeURIComponent(fileNameRaw || 'image'))
    const filePath = resolve(join(paths.pageAssetsDir, fileName))
    if (!filePath.startsWith(resolve(paths.pageAssetsDir))) throw new Error('Unsafe asset path.')
    const fileStat = await stat(filePath)
    if (!fileStat.isFile()) throw new Error(`Asset is not a file: ${filePath}`)
    return {
      buffer: await readFile(filePath),
      mimeType: file.mimeType || mimeTypeForFile(fileName),
      fileName,
      filePath
    }
  }

  throw new Error('Scene file asset is not a supported local asset or data URL.')
}

export async function copyAssetToExports({ projectDir, canvasDir, pageId, file, exportDir, fileName: exportFileName, fallbackName }) {
  const asset = await resolveSceneFileAsset({ projectDir, canvasDir, pageId, file })
  await mkdir(exportDir, { recursive: true })
  const { fileName, filePath } = await uniqueAssetPath(exportDir, exportFileName || asset.fileName || fallbackName || 'image.png')
  if (asset.filePath) {
    await copyFile(asset.filePath, filePath)
  } else {
    await writeFile(filePath, asset.buffer)
  }
  return { ...asset, fileName, filePath }
}

export async function uniqueAssetPath(dir, requestedFileName) {
  const safeName = sanitizeFileName(requestedFileName)
  const extension = extname(safeName)
  const base = safeName.slice(0, safeName.length - extension.length)
  let fileName = safeName
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

export function sanitizeFileName(value) {
  const raw = basename(String(value || 'image.png'))
  const extension = extname(raw) || '.png'
  const base = raw
    .slice(0, raw.length - extname(raw).length)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${base || 'image'}${extension}`
}

export function mimeTypeForFile(fileName) {
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

function parseDataUrl(value) {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(value)
  if (!match) return null
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64')
  }
}

function extensionForMime(mimeType) {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/gif':
      return 'gif'
    case 'image/svg+xml':
      return 'svg'
    default:
      return 'bin'
  }
}
