import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createAiImageHolderElement,
  getSceneSelection,
  normalizeScenePayload
} from './scene.js'

describe('normalizeScenePayload', () => {
  it('returns a stable empty Excalidraw scene for missing input', () => {
    const scene = normalizeScenePayload(null)

    assert.equal(scene.type, 'canvaswright/excalidraw-scene')
    assert.equal(scene.version, 1)
    assert.deepEqual(scene.elements, [])
    assert.deepEqual(scene.files, {})
    assert.equal(scene.appState.viewBackgroundColor, '#ffffff')
    assert.equal(typeof scene.updatedAt, 'string')
  })

  it('drops deleted elements from the active selection summary', () => {
    const holder = createAiImageHolderElement({ id: 'holder-1', x: 10, y: 20, width: 300, height: 200 })
    const deleted = { ...createAiImageHolderElement({ id: 'deleted-1' }), isDeleted: true }
    const scene = normalizeScenePayload({
      elements: [holder, deleted],
      appState: {
        selectedElementIds: {
          'holder-1': true,
          'deleted-1': true
        }
      },
      files: {}
    })

    assert.deepEqual(getSceneSelection(scene).selectedElements, [
      {
        id: 'holder-1',
        type: 'rectangle',
        isAiImageHolder: true,
        bounds: { x: 10, y: 20, width: 300, height: 200 }
      }
    ])
  })

  it('removes non-serializable Excalidraw runtime appState fields', () => {
    const scene = normalizeScenePayload({
      appState: {
        selectedElementIds: { 'rect-1': true },
        collaborators: {}
      }
    })

    assert.deepEqual(scene.appState.selectedElementIds, { 'rect-1': true })
    assert.equal('collaborators' in scene.appState, false)
  })
})
