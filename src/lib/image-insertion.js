import {
  elementBounds,
  finiteNumber,
  getSceneSelection,
  isAiImageHolder,
  normalizeScenePayload,
  sanitizeIdPart
} from './scene.js'

const DEFAULT_MAX_IMAGE_WIDTH = 512
const DEFAULT_MARGIN = 40

export function planImageInsertion({
  scene,
  assetUrl,
  fileName = 'image.png',
  mimeType = 'image/png',
  imageSize,
  mode = 'insert',
  placement = 'right',
  margin = DEFAULT_MARGIN,
  now = Date.now(),
  idSeed
}) {
  if (!assetUrl) throw new Error('assetUrl is required')

  const currentScene = normalizeScenePayload(scene)
  const activeElements = currentScene.elements.filter((element) => element?.isDeleted !== true)
  const selected = getSceneSelection(currentScene).selectedElements[0]
  const anchor = selected ? activeElements.find((element) => element.id === selected.id) : null
  const holderSelected = anchor ? isAiImageHolder(anchor) : false
  const targetBounds = chooseTargetBounds({
    anchor,
    holderSelected,
    imageSize,
    mode,
    placement,
    margin
  })
  const seed = sanitizeIdPart(idSeed || fileName || 'image')
  const fileId = uniqueKey(currentScene.files, `file_${seed}`)
  const elementId = uniqueElementId(activeElements, `image_${seed}`)
  const imageElement = createImageElement({
    id: elementId,
    fileId,
    bounds: targetBounds,
    now,
    sourceElementId: anchor?.id ?? null
  })
  const nextElements = mode === 'replace' && anchor
    ? currentScene.elements.map((element) => element.id === anchor.id ? { ...element, isDeleted: true, updated: now } : element)
    : currentScene.elements
  const nextScene = normalizeScenePayload({
    ...currentScene,
    elements: [...nextElements, imageElement],
    files: {
      ...currentScene.files,
      [fileId]: {
        id: fileId,
        mimeType,
        dataURL: assetUrl,
        created: now,
        lastRetrieved: now,
        version: 1,
        customData: {
          fileName
        }
      }
    },
    updatedAt: new Date(now).toISOString()
  })

  return {
    scene: nextScene,
    imageElement,
    fileId,
    anchorElementId: anchor?.id ?? null,
    filledAiImageHolder: holderSelected
  }
}

function chooseTargetBounds({ anchor, holderSelected, imageSize, mode, placement, margin }) {
  if (anchor && (holderSelected || mode === 'replace')) return elementBounds(anchor)

  const width = Math.min(finiteNumber(imageSize?.width, DEFAULT_MAX_IMAGE_WIDTH), DEFAULT_MAX_IMAGE_WIDTH)
  const sourceWidth = Math.max(1, finiteNumber(imageSize?.width, width))
  const sourceHeight = Math.max(1, finiteNumber(imageSize?.height, width))
  const height = Math.round(width * (sourceHeight / sourceWidth))

  if (!anchor) return { x: 0, y: 0, width, height }

  const anchorBounds = elementBounds(anchor)
  if (placement === 'below') {
    return {
      x: anchorBounds.x,
      y: anchorBounds.y + anchorBounds.height + margin,
      width,
      height
    }
  }
  if (placement === 'left') {
    return {
      x: anchorBounds.x - width - margin,
      y: anchorBounds.y,
      width,
      height
    }
  }

  return {
    x: anchorBounds.x + anchorBounds.width + margin,
    y: anchorBounds.y,
    width,
    height
  }
}

function createImageElement({ id, fileId, bounds, now, sourceElementId }) {
  return {
    id,
    type: 'image',
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    angle: 0,
    strokeColor: 'transparent',
    backgroundColor: 'transparent',
    fillStyle: 'hachure',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: 1,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    boundElements: null,
    updated: now,
    link: null,
    locked: false,
    fileId,
    status: 'saved',
    scale: [1, 1],
    crop: null,
    customData: {
      codexDraw: {
        type: 'inserted-image',
        version: 1,
        sourceElementId
      }
    }
  }
}

function uniqueKey(record, base) {
  let candidate = base
  let counter = 2
  while (record[candidate]) {
    candidate = `${base}_${counter}`
    counter += 1
  }
  return candidate
}

function uniqueElementId(elements, base) {
  const existingIds = new Set(elements.map((element) => element.id))
  let candidate = base
  let counter = 2
  while (existingIds.has(candidate)) {
    candidate = `${base}_${counter}`
    counter += 1
  }
  return candidate
}
