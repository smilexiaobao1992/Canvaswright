import { getCanvasEditTasks } from './edit-tasks.js'
import { normalizeScenePayload } from './scene.js'

export function getCanvasTaskOverview({ scene, currentSelection = [], lockedTarget = null } = {}) {
  const normalizedScene = normalizeScenePayload(scene)
  const activeImages = normalizedScene.elements.filter((element) => element?.type === 'image' && element.isDeleted !== true)
  if (lockedTarget?.isAiImageHolder) {
    const mode = overviewMode({ imageCount: activeImages.length, selectedCount: 0, lockedTarget })
    return {
      mode: mode.key,
      modeLabel: mode.label,
      hint: mode.hint,
      imageCount: activeImages.length,
      taskCount: 0,
      ambiguousCount: 0,
      warning: '',
      tasks: []
    }
  }
  const targetIds = targetIdsForOverview({ activeImages, currentSelection, lockedTarget })
  const taskScene = sceneWithSelectedTargets(normalizedScene, targetIds)
  const tasksPayload = getCanvasEditTasks(taskScene)
  const mode = overviewMode({ imageCount: activeImages.length, selectedCount: targetIds.length, lockedTarget })
  const tasks = tasksPayload.editTasks.map((task, index) => ({
    targetId: task.targetElement.id,
    targetLabel: imageLabel(index),
    annotationCount: task.annotationElements.length,
    instructionText: task.instructionText,
    assignment: task.assignment
  }))
  const ambiguousCount = tasksPayload.ambiguousAnnotations.length

  return {
    mode: mode.key,
    modeLabel: mode.label,
    hint: mode.hint,
    imageCount: activeImages.length,
    taskCount: tasks.length,
    ambiguousCount,
    warning: ambiguousCount > 0 ? `${ambiguousCount} 条标注不确定，需要移动到对应图片附近` : '',
    tasks
  }
}

function targetIdsForOverview({ activeImages, currentSelection, lockedTarget }) {
  if (lockedTarget?.id && activeImages.some((image) => image.id === lockedTarget.id)) return [lockedTarget.id]
  const imageIds = new Set(activeImages.map((image) => image.id))
  return currentSelection
    .filter((element) => imageIds.has(element.id))
    .map((element) => element.id)
}

function sceneWithSelectedTargets(scene, targetIds) {
  return {
    ...scene,
    appState: {
      ...scene.appState,
      selectedElementIds: Object.fromEntries(targetIds.map((id) => [id, true]))
    }
  }
}

function overviewMode({ imageCount, selectedCount, lockedTarget }) {
  if (lockedTarget?.isAiImageHolder) {
    return {
      key: 'holder-locked',
      label: '占位锁定',
      hint: '生成图会填入占位框；图片修改请选图或取消锁定'
    }
  }
  if (lockedTarget) {
    return {
      key: 'locked-single',
      label: '单图锁定',
      hint: '只分析锁定图片；要批量改多张图，先取消锁定'
    }
  }
  if (selectedCount > 1) {
    return {
      key: 'selected-batch',
      label: '多图选区',
      hint: '只在选中的多张图片里分配标注'
    }
  }
  if (selectedCount === 1) {
    return {
      key: 'selected-single',
      label: '单图选中',
      hint: '当前选中图片优先；多图修改请取消单图选中或框选多图'
    }
  }
  if (imageCount > 1) {
    return {
      key: 'batch',
      label: '多图批量',
      hint: '按标注覆盖和距离自动分配到对应图片'
    }
  }
  if (imageCount === 1) {
    return {
      key: 'single',
      label: '单图模式',
      hint: '标注会分配到当前图片'
    }
  }
  return {
    key: 'empty',
    label: '等待图片',
    hint: '上传或拖入图片后开始标注'
  }
}

function imageLabel(index) {
  return `图片 ${index + 1}`
}
