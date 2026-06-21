import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { normalizeScenePayload } from '../lib/scene.js'

const DEFAULT_PAGE_ID = 'main'
const SCENE_FILE_NAME = 'excalidraw-scene.json'
const SELECTION_FILE_NAME = 'selection.json'

export function resolveCanvasPaths({ projectDir, canvasDir, pageId = DEFAULT_PAGE_ID } = {}) {
  const resolvedProjectDir = resolve(projectDir || process.env.CANVASWRIGHT_PROJECT_DIR || process.cwd())
  const resolvedCanvasDir = resolve(canvasDir || process.env.CANVASWRIGHT_CANVAS_DIR || join(resolvedProjectDir, 'canvas'))
  const resolvedPageId = sanitizePageId(pageId)
  const pageDir = join(resolvedCanvasDir, 'pages', resolvedPageId)

  return {
    projectDir: resolvedProjectDir,
    canvasDir: resolvedCanvasDir,
    pageId: resolvedPageId,
    pageDir,
    sceneFile: join(pageDir, SCENE_FILE_NAME),
    selectionFile: join(resolvedCanvasDir, SELECTION_FILE_NAME),
    pageAssetsDir: join(pageDir, 'assets')
  }
}

export async function loadScene(args = {}) {
  const { sceneFile } = resolveCanvasPaths(args)
  try {
    return normalizeScenePayload(JSON.parse(await readFile(sceneFile, 'utf8')))
  } catch (error) {
    if (error?.code === 'ENOENT') return normalizeScenePayload(null)
    throw error
  }
}

export async function saveScene(args = {}, scene) {
  const paths = resolveCanvasPaths(args)
  const normalizedScene = normalizeScenePayload(scene)
  await mkdir(paths.pageDir, { recursive: true })
  await writeFile(paths.sceneFile, `${JSON.stringify(normalizedScene, null, 2)}\n`)
  return { scene: normalizedScene, paths }
}

export async function readSelection(args = {}) {
  const { selectionFile } = resolveCanvasPaths(args)
  try {
    const selection = JSON.parse(await readFile(selectionFile, 'utf8'))
    if (!selection || typeof selection !== 'object' || !Array.isArray(selection.selectedElements)) {
      return emptySelection()
    }
    return selection
  } catch (error) {
    if (error?.code === 'ENOENT') return emptySelection()
    throw error
  }
}

export async function saveSelection(args = {}, selection) {
  const paths = resolveCanvasPaths(args)
  const nextSelection = {
    selectedElements: Array.isArray(selection?.selectedElements) ? selection.selectedElements : [],
    updatedAt: typeof selection?.updatedAt === 'string' ? selection.updatedAt : new Date().toISOString()
  }
  await mkdir(paths.canvasDir, { recursive: true })
  await writeFile(paths.selectionFile, `${JSON.stringify(nextSelection, null, 2)}\n`)
  return { selection: nextSelection, paths }
}

export function pageAssetUrl({ pageId = DEFAULT_PAGE_ID, fileName }) {
  return `/page-assets/${encodeURIComponent(sanitizePageId(pageId))}/${encodeURIComponent(fileName)}`
}

function emptySelection() {
  return {
    selectedElements: [],
    updatedAt: null
  }
}

function sanitizePageId(value) {
  return String(value || DEFAULT_PAGE_ID)
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || DEFAULT_PAGE_ID
}
