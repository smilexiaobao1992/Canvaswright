import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  loadScene,
  readSelection,
  resolveCanvasPaths,
  saveScene,
  saveSelection
} from './storage.js'

describe('canvas storage', () => {
  it('resolves project-local scene and page asset paths', () => {
    const paths = resolveCanvasPaths({ projectDir: '/tmp/example-project' })

    assert.equal(paths.canvasDir, '/tmp/example-project/canvas')
    assert.equal(paths.pageId, 'main')
    assert.equal(paths.sceneFile, '/tmp/example-project/canvas/pages/main/excalidraw-scene.json')
    assert.equal(paths.pageAssetsDir, '/tmp/example-project/canvas/pages/main/assets')
  })

  it('saves and loads a normalized Excalidraw scene', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'canvaswright-'))
    try {
      await saveScene({ projectDir }, { elements: [{ id: 'rect-1', type: 'rectangle' }] })

      const scene = await loadScene({ projectDir })
      assert.equal(scene.type, 'canvaswright/excalidraw-scene')
      assert.equal(scene.elements[0].id, 'rect-1')
    } finally {
      await rm(projectDir, { recursive: true, force: true })
    }
  })

  it('persists browser selection separately from the full scene', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'canvaswright-'))
    try {
      await saveSelection({ projectDir }, { selectedElements: [{ id: 'rect-1' }] })

      const selection = await readSelection({ projectDir })
      assert.deepEqual(selection.selectedElements, [{ id: 'rect-1' }])
    } finally {
      await rm(projectDir, { recursive: true, force: true })
    }
  })
})
