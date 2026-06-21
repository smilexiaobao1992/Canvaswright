import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { createAiImageHolderElement } from '../src/lib/scene.js'
import { loadScene, saveScene } from '../src/server/storage.js'
import { getCanvaswrightEditTasks, insertCanvaswrightImage } from './canvas-actions.mjs'

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64'
)

describe('insertCanvaswrightImage', () => {
  it('copies an image asset and inserts it into a selected AI holder', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'canvaswright-mcp-'))
    const imagePath = join(projectDir, 'render.png')
    try {
      await writeFile(imagePath, PNG_1X1)
      const holder = createAiImageHolderElement({ id: 'holder-1', x: 5, y: 10, width: 120, height: 80 })
      await saveScene({ projectDir }, {
        elements: [holder],
        appState: { selectedElementIds: { 'holder-1': true } },
        files: {}
      })

      const result = await insertCanvaswrightImage({ projectDir, imagePath, now: 1000 })
      const scene = await loadScene({ projectDir })

      assert.equal(result.assetUrl, '/page-assets/main/render.png')
      assert.equal((await stat(result.assetFile)).isFile(), true)
      assert.deepEqual(await readFile(result.assetFile), PNG_1X1)
      assert.equal(scene.elements.at(-1).type, 'image')
      assert.equal(scene.elements.at(-1).x, 5)
      assert.equal(scene.elements.at(-1).width, 120)
      assert.equal(scene.files.file_render.dataURL, '/page-assets/main/render.png')
    } finally {
      await rm(projectDir, { recursive: true, force: true })
    }
  })

  it('places an image beside an explicit anchor element', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'canvaswright-mcp-'))
    const imagePath = join(projectDir, 'revision.png')
    try {
      await writeFile(imagePath, PNG_1X1)
      await saveScene({ projectDir }, {
        elements: [
          { id: 'image-1', type: 'image', x: 10, y: 20, width: 200, height: 100, fileId: 'file_image_1' },
          { id: 'image-2', type: 'image', x: 500, y: 20, width: 200, height: 100, fileId: 'file_image_2' }
        ],
        appState: { selectedElementIds: { 'image-2': true } },
        files: {}
      })

      const result = await insertCanvaswrightImage({ projectDir, imagePath, anchorElementId: 'image-1', now: 2000 })

      assert.equal(result.anchorElementId, 'image-1')
      assert.equal(result.bounds.x, 250)
      assert.equal(result.bounds.y, 20)
    } finally {
      await rm(projectDir, { recursive: true, force: true })
    }
  })
})

describe('getCanvaswrightEditTasks', () => {
  it('returns image edit tasks from the saved canvas scene', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'canvaswright-mcp-'))
    try {
      await saveScene({ projectDir }, {
        elements: [
          { id: 'image-1', type: 'image', x: 0, y: 0, width: 300, height: 200, fileId: 'file_image_1' },
          { id: 'title-note', type: 'text', x: 310, y: 20, width: 120, height: 24, text: '标题换成金色' }
        ],
        files: {
          file_image_1: {
            dataURL: '/page-assets/main/image-1.png',
            customData: { fileName: 'image-1.png' }
          }
        }
      })

      const result = await getCanvaswrightEditTasks({ projectDir })

      assert.equal(result.editTasks.length, 1)
      assert.equal(result.editTasks[0].targetElement.id, 'image-1')
      assert.equal(result.editTasks[0].instructionText, '标题换成金色')
      assert.equal(result.editTasks[0].targetElement.assetUrl, '/page-assets/main/image-1.png')
    } finally {
      await rm(projectDir, { recursive: true, force: true })
    }
  })
})
