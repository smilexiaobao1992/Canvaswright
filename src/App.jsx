import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createAiImageHolderElement, getSceneSelection, normalizeScenePayload, rightOfCanvasContentBounds } from './lib/scene.js'
import { getCanvasTaskOverview } from './lib/task-overview.js'

const SAVE_DELAY_MS = 350
const STATUS_AUTOSAVE_ON = 'Autosave on'

export default function App() {
  const [scene, setScene] = useState(null)
  const [status, setStatus] = useState('Loading canvas...')
  const [currentSelection, setCurrentSelection] = useState([])
  const [lockedTarget, setLockedTarget] = useState(null)
  const [isTaskPanelOpen, setIsTaskPanelOpen] = useState(false)
  const apiRef = useRef(null)
  const saveTimerRef = useRef(null)
  const lastRemoteSceneAtRef = useRef(null)
  const lastRevisionRef = useRef(0)
  const lockedTargetRef = useRef(null)

  useEffect(() => {
    lockedTargetRef.current = lockedTarget
  }, [lockedTarget])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/scene').then((response) => response.json()),
      fetch('/api/selection').then((response) => response.json()).catch(() => ({ selection: null }))
    ])
      .then(([scenePayload, selectionPayload]) => {
        if (cancelled) return
        const nextScene = normalizeScenePayload(scenePayload.scene)
        const nextSelection = getSceneSelection(nextScene)
        const nextLockedTarget = resolveTargetFromScene(nextScene, selectionPayload.selection?.lockedTarget?.id)
        lastRemoteSceneAtRef.current = nextScene.updatedAt
        lastRevisionRef.current = nextScene.revision
        lockedTargetRef.current = nextLockedTarget
        setScene(nextScene)
        setCurrentSelection(nextSelection.selectedElements)
        setLockedTarget(nextLockedTarget)
        setStatus(STATUS_AUTOSAVE_ON)
      })
      .catch((error) => {
        if (!cancelled) setStatus(`Load failed: ${error.message}`)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const events = new EventSource('/api/events')
    events.addEventListener('scene-changed', () => {
      fetch('/api/scene')
        .then((response) => response.json())
        .then((payload) => {
          const remoteScene = normalizeScenePayload(payload.scene)
          if (remoteScene.updatedAt === lastRemoteSceneAtRef.current) return
          const remoteSelection = getSceneSelection(remoteScene)
          const remoteLockedTarget = resolveTargetFromScene(remoteScene, lockedTargetRef.current?.id)
          lastRemoteSceneAtRef.current = remoteScene.updatedAt
          lastRevisionRef.current = remoteScene.revision
          lockedTargetRef.current = remoteLockedTarget
          setScene(remoteScene)
          apiRef.current?.updateScene({
            elements: remoteScene.elements,
            appState: remoteScene.appState
          })
          apiRef.current?.addFiles?.(remoteScene.files)
          setCurrentSelection(remoteSelection.selectedElements)
          setLockedTarget(remoteLockedTarget)
          setStatus('Updated from Codex')
        })
        .catch((error) => setStatus(`Sync failed: ${error.message}`))
    })

    return () => events.close()
  }, [])

  const initialData = useMemo(() => {
    if (!scene) return null
    return {
      elements: scene.elements,
      appState: scene.appState,
      files: scene.files
    }
  }, [scene])

  const saveScene = useCallback((elements, appState, files) => {
    window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(async () => {
      const nextScene = normalizeScenePayload({
        elements,
        appState,
        files,
        updatedAt: new Date().toISOString()
      })
      const nextSelection = getSceneSelection(nextScene)
      const activeLockedTarget = resolveTargetFromScene(nextScene, lockedTargetRef.current?.id)
      setScene(nextScene)
      setCurrentSelection(nextSelection.selectedElements)
      if (lockedTargetRef.current && !activeLockedTarget) {
        lockedTargetRef.current = null
        setLockedTarget(null)
      }
      try {
        const response = await fetch('/api/scene', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            scene: nextScene,
            source: 'browser',
            expectedRevision: lastRevisionRef.current
          })
        })
        if (response.status === 409) {
          const payload = await response.json()
          const remoteScene = normalizeScenePayload(payload.scene)
          const remoteSelection = getSceneSelection(remoteScene)
          const remoteLockedTarget = resolveTargetFromScene(remoteScene, activeLockedTarget?.id)
          lastRemoteSceneAtRef.current = remoteScene.updatedAt
          lastRevisionRef.current = remoteScene.revision
          lockedTargetRef.current = remoteLockedTarget
          setScene(remoteScene)
          apiRef.current?.updateScene({
            elements: remoteScene.elements,
            appState: remoteScene.appState
          })
          apiRef.current?.addFiles?.(remoteScene.files)
          setCurrentSelection(remoteSelection.selectedElements)
          setLockedTarget(remoteLockedTarget)
          setStatus('Reloaded newer canvas state')
          return
        }
        if (!response.ok) throw new Error(await response.text())
        const payload = await response.json()
        await fetch('/api/selection', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            selection: {
              ...nextSelection,
              lockedTarget: activeLockedTarget
            }
          })
        })
        const savedScene = normalizeScenePayload(payload.scene)
        const savedLockedTarget = resolveTargetFromScene(savedScene, activeLockedTarget?.id)
        lastRemoteSceneAtRef.current = savedScene.updatedAt
        lastRevisionRef.current = savedScene.revision
        lockedTargetRef.current = savedLockedTarget
        setScene(savedScene)
        apiRef.current?.updateScene({
          elements: savedScene.elements,
          appState: savedScene.appState
        })
        apiRef.current?.addFiles?.(savedScene.files)
        setLockedTarget(savedLockedTarget)
        setStatus(STATUS_AUTOSAVE_ON)
      } catch (error) {
        setStatus(`Save failed: ${error.message}`)
      }
    }, SAVE_DELAY_MS)
  }, [])

  const addAiHolder = useCallback(() => {
    const api = apiRef.current
    if (!api) return
    const elements = api.getSceneElementsIncludingDeleted()
    const holderBounds = rightOfCanvasContentBounds(elements, {
      width: 320,
      height: 220,
      emptyX: 80,
      emptyY: 180
    })
    const holder = createAiImageHolderElement(holderBounds)
    api.updateScene({
      elements: [...elements, holder],
      appState: {
        selectedElementIds: { [holder.id]: true }
      }
    })
    setStatus(STATUS_AUTOSAVE_ON)
  }, [])

  const persistLockedTarget = useCallback(async (target) => {
    lockedTargetRef.current = target
    setLockedTarget(target)
    await fetch('/api/selection', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        selection: {
          selectedElements: currentSelection,
          lockedTarget: target,
          updatedAt: new Date().toISOString()
        }
      })
    })
  }, [currentSelection])

  const lockCurrentTarget = useCallback(() => {
    const target = currentSelection.find((element) => element.type === 'image' || element.isAiImageHolder)
    if (!target) return
    persistLockedTarget(target).then(
      () => setStatus(`Locked target: ${targetKindLabel(target)}`),
      (error) => setStatus(`Lock failed: ${error.message}`)
    )
  }, [currentSelection, persistLockedTarget])

  const clearLockedTarget = useCallback(() => {
    persistLockedTarget(null).then(
      () => setStatus('Target lock cleared'),
      (error) => setStatus(`Unlock failed: ${error.message}`)
    )
  }, [persistLockedTarget])

  if (!initialData) {
    return (
      <main className="app-shell">
        <div className="loading">{status}</div>
      </main>
    )
  }

  const activeTarget = lockedTarget ?? currentSelection[0] ?? null
  const canLockCurrentTarget = currentSelection.some((element) => element.type === 'image' || element.isAiImageHolder)
  const targetStateLabel = lockedTarget ? '已锁定' : activeTarget ? '当前选中' : '未选择'
  const taskOverview = getCanvasTaskOverview({ scene, currentSelection, lockedTarget })

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <h1>Canvaswright</h1>
          <p>项目本地 Excalidraw 画布</p>
        </div>
        <div className="codex-toolbar" aria-label="Codex target tools">
          <div className={`target-pill ${lockedTarget ? 'is-locked' : activeTarget ? 'is-selected' : 'is-empty'}`}>
            <span className="target-dot" aria-hidden="true" />
            <span className="target-state">{targetStateLabel}</span>
            <strong>{activeTarget ? targetKindLabel(activeTarget) : '选择目标'}</strong>
            <small>{activeTarget ? shortElementId(activeTarget.id) : '图片或占位框'}</small>
          </div>
          <div className="icon-actions">
            {lockedTarget ? (
              <button type="button" className="icon-button is-active" onClick={clearLockedTarget} title="取消锁定 Codex 目标" aria-label="取消锁定 Codex 目标">
                <Icon name="unlock" />
                <span className="sr-only">取消锁定</span>
              </button>
            ) : (
              <button type="button" className="icon-button" onClick={lockCurrentTarget} disabled={!canLockCurrentTarget} title="锁定当前选中图片或占位框" aria-label="锁定当前选中图片或占位框">
                <Icon name="lock" />
                <span className="sr-only">锁定目标</span>
              </button>
            )}
            <button
              type="button"
              className="icon-button"
              onClick={addAiHolder}
              title="添加生成占位框。选中它后，Codex 会把生成图填入这个框。"
              aria-label="添加生成占位框"
            >
              <Icon name="placeholder" />
              <span className="sr-only">添加生成占位框</span>
            </button>
          </div>
          <p className="toolbar-hint">
            <Icon name="info" />
            锁定后，画标注不会丢目标
          </p>
        </div>
        <span className="status">{status}</span>
      </header>
      <section className="canvas-frame" aria-label="Canvaswright Excalidraw canvas">
        <TaskOverviewPanel
          overview={taskOverview}
          isOpen={isTaskPanelOpen}
          onToggle={() => setIsTaskPanelOpen((isOpen) => !isOpen)}
        />
        <Excalidraw
          excalidrawAPI={(api) => {
            apiRef.current = api
          }}
          initialData={initialData}
          langCode="zh-CN"
          name="Canvaswright"
          onChange={saveScene}
        />
      </section>
    </main>
  )
}

function TaskOverviewPanel({ overview, isOpen, onToggle }) {
  const shownTasks = overview.tasks.slice(0, 3)
  return (
    <div className={`task-widget ${isOpen ? 'is-open' : ''}`}>
      <button
        type="button"
        className={`task-toggle ${overview.ambiguousCount > 0 ? 'has-warning' : ''}`}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls="canvaswright-task-panel"
        title={isOpen ? '隐藏任务识别面板' : '显示任务识别面板'}
      >
        <span>任务 {overview.taskCount}</span>
        {overview.ambiguousCount > 0 ? <strong>疑问 {overview.ambiguousCount}</strong> : null}
      </button>
      {isOpen ? (
        <aside id="canvaswright-task-panel" className="task-panel" aria-label="Canvaswright task overview">
          <div className="task-panel-header">
            <span>任务识别</span>
            <strong>{overview.modeLabel}</strong>
          </div>
          <div className="task-stats" aria-label="任务统计">
            <span>图片 {overview.imageCount}</span>
            <span>任务 {overview.taskCount}</span>
            <span className={overview.ambiguousCount > 0 ? 'is-warning' : ''}>疑问 {overview.ambiguousCount}</span>
          </div>
          <p className="task-hint">{overview.warning || overview.hint}</p>
          {shownTasks.length > 0 ? (
            <ol className="task-list">
              {shownTasks.map((task) => (
                <li key={task.targetId}>
                  <span>{task.targetLabel}</span>
                  <strong>{task.annotationCount} 标注</strong>
                  {task.instructionText ? <small>{task.instructionText}</small> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="task-empty">{overview.imageCount === 0 ? '先上传图片' : '画圈、箭头或文字后会出现任务'}</p>
          )}
          {overview.tasks.length > shownTasks.length ? (
            <p className="task-more">还有 {overview.tasks.length - shownTasks.length} 个任务</p>
          ) : null}
        </aside>
      ) : null}
    </div>
  )
}

function Icon({ name }) {
  if (name === 'lock') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 10V8a5 5 0 0 1 10 0v2" />
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M12 14v2" />
      </svg>
    )
  }
  if (name === 'unlock') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 10V8a5 5 0 0 1 9-3" />
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M12 14v2" />
      </svg>
    )
  }
  if (name === 'placeholder') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M8 15l3-3 2 2 3-4 2 5" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" />
      <path d="M12 7h.01" />
    </svg>
  )
}

function resolveTargetFromScene(scenePayload, elementId) {
  if (!elementId) return null
  const scene = normalizeScenePayload(scenePayload)
  return getSceneSelection({
    ...scene,
    appState: {
      ...scene.appState,
      selectedElementIds: { [elementId]: true }
    }
  }).selectedElements[0] ?? null
}

function targetKindLabel(target) {
  if (target?.isAiImageHolder) return '生成占位框'
  if (target?.type === 'image') return '图片'
  if (target?.type === 'text') return '文字标注'
  if (target?.type) return `${target.type} 元素`
  return '未知元素'
}

function shortElementId(id) {
  if (!id) return ''
  return id.length > 28 ? `${id.slice(0, 18)}...${id.slice(-6)}` : id
}
