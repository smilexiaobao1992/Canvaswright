import { finiteNumber, normalizeScenePayload } from './scene.js'

const MAX_NEAR_DISTANCE = 180

export function getCanvasEditTasks(scenePayload) {
  const scene = normalizeScenePayload(scenePayload)
  const activeElements = scene.elements.filter((element) => element?.isDeleted !== true)
  const imageElements = activeElements.filter((element) => element?.type === 'image')
  const selectedIds = new Set(
    Object.entries(scene.appState?.selectedElementIds ?? {})
      .filter(([, selected]) => selected === true)
      .map(([id]) => id)
  )
  const selectedImages = imageElements.filter((element) => selectedIds.has(element.id))
  const targetImages = selectedImages.length > 0 ? selectedImages : imageElements
  const annotations = activeElements.filter((element) => !targetImages.some((target) => target.id === element.id) && isAnnotationElement(element))
  const tasksByTargetId = new Map()
  const assignmentsByAnnotationId = new Map()
  const ambiguousAnnotations = []

  const nonTextAnnotations = annotations.filter((annotation) => annotation.type !== 'text')
  const textAnnotations = annotations.filter((annotation) => annotation.type === 'text')

  for (const annotation of nonTextAnnotations) {
    assignAnnotation({
      annotation,
      scene,
      targetImages,
      selectedImages,
      tasksByTargetId,
      assignmentsByAnnotationId,
      ambiguousAnnotations
    })
  }

  for (const annotation of textAnnotations) {
    const calloutAssignment = selectedImages.length === 0
      ? assignTextToNearbyAnnotation(annotation, nonTextAnnotations, assignmentsByAnnotationId)
      : null
    assignAnnotation({
      annotation,
      scene,
      targetImages,
      selectedImages,
      tasksByTargetId,
      assignmentsByAnnotationId,
      ambiguousAnnotations,
      preferredAssignment: calloutAssignment
    })
  }

  const editTasks = [...tasksByTargetId.values()]
    .map((task) => ({
      ...task,
      instructionText: task.annotationElements
        .filter((element) => element.type === 'text' && element.text.trim().length > 0)
        .map((element) => element.text.trim())
        .join('\n')
    }))
    .sort((a, b) => a.targetElement.bounds.x - b.targetElement.bounds.x || a.targetElement.bounds.y - b.targetElement.bounds.y)

  return {
    editTasks,
    ambiguousAnnotations,
    targetElements: imageElements.map((element) => targetSummary(element, scene))
  }
}

function assignAnnotation({
  annotation,
  scene,
  targetImages,
  selectedImages,
  tasksByTargetId,
  assignmentsByAnnotationId,
  ambiguousAnnotations,
  preferredAssignment
}) {
  const assignment = preferredAssignment ?? (
    selectedImages.length === 1
      ? { target: selectedImages[0], reason: 'selected-target' }
      : assignAnnotationToTarget(annotation, targetImages)
  )

  if (!assignment?.target) {
    ambiguousAnnotations.push(annotationSummary(annotation, 'ambiguous'))
    return
  }

  const task = getOrCreateTask(tasksByTargetId, assignment.target, scene)
  task.assignment = selectedImages.length > 0 ? 'selected-target' : 'spatial'
  task.annotationElements.push(annotationSummary(annotation, assignment.reason))
  assignmentsByAnnotationId.set(annotation.id, assignment)
}

function getOrCreateTask(tasksByTargetId, target, scene) {
  if (!tasksByTargetId.has(target.id)) {
    tasksByTargetId.set(target.id, {
      targetElement: targetSummary(target, scene),
      annotationElements: [],
      instructionText: '',
      assignment: 'spatial'
    })
  }
  return tasksByTargetId.get(target.id)
}

function assignAnnotationToTarget(annotation, targets) {
  if (targets.length === 0) return null
  const annotationBounds = normalizedBounds(annotation)
  const overlapping = targets
    .map((target) => ({
      target,
      overlap: intersectionArea(annotationBounds, normalizedBounds(target))
    }))
    .filter((candidate) => candidate.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)

  if (overlapping.length > 1) return null
  if (overlapping.length === 1) return { target: overlapping[0].target, reason: 'overlap' }

  const nearest = targets
    .map((target) => ({
      target,
      distance: rectDistance(annotationBounds, normalizedBounds(target))
    }))
    .sort((a, b) => a.distance - b.distance)

  if (nearest[0]?.distance <= MAX_NEAR_DISTANCE) return { target: nearest[0].target, reason: 'nearby' }
  return null
}

function assignTextToNearbyAnnotation(textAnnotation, annotations, assignmentsByAnnotationId) {
  const textBounds = normalizedBounds(textAnnotation)
  const nearest = annotations
    .map((annotation) => ({
      annotation,
      assignment: assignmentsByAnnotationId.get(annotation.id),
      distance: rectDistance(textBounds, normalizedBounds(annotation))
    }))
    .filter((candidate) => candidate.assignment?.target)
    .sort((a, b) => a.distance - b.distance)

  if (nearest[0]?.distance <= MAX_NEAR_DISTANCE) {
    return {
      target: nearest[0].assignment.target,
      reason: 'nearby-callout'
    }
  }
  return null
}

function isAnnotationElement(element) {
  return ['arrow', 'diamond', 'ellipse', 'freedraw', 'line', 'rectangle', 'text'].includes(element?.type)
}

function targetSummary(element, scene) {
  const file = scene.files?.[element.fileId] ?? {}
  return {
    id: element.id,
    type: element.type,
    fileId: element.fileId ?? null,
    assetUrl: file.dataURL ?? null,
    fileName: file.customData?.fileName ?? null,
    bounds: normalizedBounds(element)
  }
}

function annotationSummary(element, assignmentReason) {
  return {
    id: element.id,
    type: element.type,
    text: typeof element.text === 'string' ? element.text : '',
    strokeColor: element.strokeColor ?? null,
    backgroundColor: element.backgroundColor ?? null,
    bounds: normalizedBounds(element),
    assignmentReason
  }
}

function normalizedBounds(element) {
  const x = finiteNumber(element?.x, 0)
  const y = finiteNumber(element?.y, 0)
  const rawWidth = finiteNumber(element?.width, 1)
  const rawHeight = finiteNumber(element?.height, 1)
  const left = Math.min(x, x + rawWidth)
  const top = Math.min(y, y + rawHeight)
  const width = Math.max(1, Math.abs(rawWidth))
  const height = Math.max(1, Math.abs(rawHeight))
  return { x: left, y: top, width, height }
}

function intersectionArea(a, b) {
  const left = Math.max(a.x, b.x)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const top = Math.max(a.y, b.y)
  const bottom = Math.min(a.y + a.height, b.y + b.height)
  return Math.max(0, right - left) * Math.max(0, bottom - top)
}

function rectDistance(a, b) {
  const ax2 = a.x + a.width
  const ay2 = a.y + a.height
  const bx2 = b.x + b.width
  const by2 = b.y + b.height
  const dx = Math.max(b.x - ax2, a.x - bx2, 0)
  const dy = Math.max(b.y - ay2, a.y - by2, 0)
  return Math.hypot(dx, dy)
}
