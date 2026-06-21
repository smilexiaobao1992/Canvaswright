export const SCENE_TYPE = 'canvaswright/excalidraw-scene'
export const SCENE_VERSION = 1
export const AI_IMAGE_HOLDER_KIND = 'ai-image-holder'

export function normalizeScenePayload(value) {
  const payload = value && typeof value === 'object' ? value : {}
  return {
    type: SCENE_TYPE,
    version: SCENE_VERSION,
    elements: Array.isArray(payload.elements) ? payload.elements : [],
    appState: normalizeAppState(payload.appState),
    files: safeObject(payload.files),
    updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : new Date().toISOString()
  }
}

export function createAiImageHolderElement({
  id = createElementId('ai-holder'),
  x = 0,
  y = 0,
  width = 320,
  height = 220
} = {}) {
  return {
    id,
    type: 'rectangle',
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: '#1c7ed6',
    backgroundColor: 'transparent',
    fillStyle: 'hachure',
    strokeWidth: 2,
    strokeStyle: 'dashed',
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: { type: 3 },
    seed: 1,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    customData: {
      codexDraw: {
        type: AI_IMAGE_HOLDER_KIND,
        version: 1
      }
    }
  }
}

export function getSceneSelection(scenePayload) {
  const scene = normalizeScenePayload(scenePayload)
  const selectedIds = new Set(
    Object.entries(safeObject(scene.appState.selectedElementIds))
      .filter(([, selected]) => selected === true)
      .map(([id]) => id)
  )
  const selectedElements = scene.elements
    .filter((element) => selectedIds.has(element.id) && element.isDeleted !== true)
    .map((element) => ({
      id: element.id,
      type: element.type,
      isAiImageHolder: isAiImageHolder(element),
      bounds: elementBounds(element)
    }))

  return {
    selectedElements,
    updatedAt: scene.updatedAt
  }
}

export function isAiImageHolder(element) {
  return element?.customData?.codexDraw?.type === AI_IMAGE_HOLDER_KIND
}

export function elementBounds(element) {
  return {
    x: finiteNumber(element?.x, 0),
    y: finiteNumber(element?.y, 0),
    width: Math.max(1, finiteNumber(element?.width, 1)),
    height: Math.max(1, finiteNumber(element?.height, 1))
  }
}

export function createElementId(seed = 'element') {
  return `${sanitizeIdPart(seed)}_${Date.now().toString(36)}`
}

export function sanitizeIdPart(value, fallback = 'item') {
  const clean = String(value || fallback)
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
  return clean || fallback
}

export function finiteNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalizeAppState(value) {
  const appState = {
    viewBackgroundColor: '#ffffff',
    selectedElementIds: {},
    ...safeObject(value)
  }
  delete appState.collaborators
  return appState
}
