import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createAiImageHolderElement, getSceneSelection, normalizeScenePayload } from './lib/scene.js'

const SAVE_DELAY_MS = 350
const STATUS_AUTOSAVE_ON = 'Autosave on'

export default function App() {
  const [scene, setScene] = useState(null)
  const [status, setStatus] = useState('Loading canvas...')
  const apiRef = useRef(null)
  const saveTimerRef = useRef(null)
  const lastRemoteSceneAtRef = useRef(null)
  const lastRevisionRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    fetch('/api/scene')
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return
        const nextScene = normalizeScenePayload(payload.scene)
        lastRemoteSceneAtRef.current = nextScene.updatedAt
        lastRevisionRef.current = nextScene.revision
        setScene(nextScene)
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
          lastRemoteSceneAtRef.current = remoteScene.updatedAt
          lastRevisionRef.current = remoteScene.revision
          apiRef.current?.updateScene({
            elements: remoteScene.elements,
            appState: remoteScene.appState
          })
          apiRef.current?.addFiles?.(remoteScene.files)
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
          lastRemoteSceneAtRef.current = remoteScene.updatedAt
          lastRevisionRef.current = remoteScene.revision
          apiRef.current?.updateScene({
            elements: remoteScene.elements,
            appState: remoteScene.appState
          })
          apiRef.current?.addFiles?.(remoteScene.files)
          setStatus('Reloaded newer canvas state')
          return
        }
        if (!response.ok) throw new Error(await response.text())
        const payload = await response.json()
        await fetch('/api/selection', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ selection: getSceneSelection(nextScene) })
        })
        const savedScene = normalizeScenePayload(payload.scene)
        lastRemoteSceneAtRef.current = savedScene.updatedAt
        lastRevisionRef.current = savedScene.revision
        apiRef.current?.updateScene({
          elements: savedScene.elements,
          appState: savedScene.appState
        })
        apiRef.current?.addFiles?.(savedScene.files)
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
    const holder = createAiImageHolderElement({ x: 80, y: 180 })
    api.updateScene({
      elements: [...elements, holder],
      appState: {
        selectedElementIds: { [holder.id]: true }
      }
    })
    setStatus(STATUS_AUTOSAVE_ON)
  }, [])

  if (!initialData) {
    return (
      <main className="app-shell">
        <div className="loading">{status}</div>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Canvaswright</h1>
          <p>Excalidraw canvas saved in this project</p>
        </div>
        <div className="topbar-actions">
          <span className="status">{status}</span>
          <button type="button" onClick={addAiHolder}>
            AI image holder
          </button>
        </div>
      </header>
      <section className="canvas-frame" aria-label="Canvaswright Excalidraw canvas">
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
