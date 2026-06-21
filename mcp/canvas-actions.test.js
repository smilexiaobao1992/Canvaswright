import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { createAiImageHolderElement } from '../src/lib/scene.js'
import { loadScene, saveScene } from '../src/server/storage.js'
import {
  exportCanvaswrightEditTask,
  exportCanvaswrightImage,
  getCanvaswrightEditTasks,
  insertCanvaswrightImage,
  insertCanvaswrightImages
} from './canvas-actions.mjs'

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

  it('replaces an explicit source image in place', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'canvaswright-mcp-'))
    const imagePath = join(projectDir, 'replacement.png')
    try {
      await writeFile(imagePath, PNG_1X1)
      await saveScene({ projectDir }, {
        elements: [
          { id: 'image-1', type: 'image', x: 10, y: 20, width: 200, height: 100, fileId: 'file_image_1' }
        ],
        files: {
          file_image_1: {
            dataURL: 'data:image/png;base64,iVBORw0KGgo=',
            customData: { fileName: 'source.png' }
          }
        }
      })

      const result = await insertCanvaswrightImage({
        projectDir,
        imagePath,
        anchorElementId: 'image-1',
        mode: 'replace',
        now: 3000
      })
      const scene = await loadScene({ projectDir })

      assert.equal(result.mode, 'replace')
      assert.equal(result.bounds.x, 10)
      assert.equal(result.bounds.y, 20)
      assert.equal(result.bounds.width, 200)
      assert.equal(result.bounds.height, 100)
      assert.equal(scene.elements.find((element) => element.id === 'image-1').isDeleted, true)
      assert.equal(scene.elements.at(-1).fileId, result.fileId)
    } finally {
      await rm(projectDir, { recursive: true, force: true })
    }
  })

  it('inserts multiple generated images for multiple anchors', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'canvaswright-mcp-'))
    const imagePathA = join(projectDir, 'a.png')
    const imagePathB = join(projectDir, 'b.png')
    try {
      await writeFile(imagePathA, PNG_1X1)
      await writeFile(imagePathB, PNG_1X1)
      await saveScene({ projectDir }, {
        elements: [
          { id: 'image-1', type: 'image', x: 0, y: 0, width: 100, height: 80, fileId: 'file_image_1' },
          { id: 'image-2', type: 'image', x: 400, y: 0, width: 100, height: 80, fileId: 'file_image_2' }
        ],
        files: {}
      })

      const result = await insertCanvaswrightImages({
        projectDir,
        images: [
          { imagePath: imagePathA, anchorElementId: 'image-1' },
          { imagePath: imagePathB, anchorElementId: 'image-2' }
        ]
      })
      const scene = await loadScene({ projectDir })

      assert.equal(result.results.length, 2)
      assert.equal(result.results[0].anchorElementId, 'image-1')
      assert.equal(result.results[1].anchorElementId, 'image-2')
      assert.equal(scene.elements.filter((element) => element.type === 'image' && element.isDeleted !== true).length, 4)
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

describe('exportCanvaswrightEditTask', () => {
  it('exports the selected edit task and its source image asset', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'canvaswright-mcp-'))
    try {
      await saveScene({ projectDir }, {
        elements: [
          { id: 'image-1', type: 'image', x: 0, y: 0, width: 300, height: 200, fileId: 'file_image_1' },
          { id: 'title-note', type: 'text', x: 310, y: 20, width: 120, height: 24, text: '标题换成金色' }
        ],
        files: {
          file_image_1: {
            dataURL: `data:image/png;base64,${PNG_1X1.toString('base64')}`,
            customData: { fileName: 'source.png' }
          }
        }
      })

      const result = await exportCanvaswrightEditTask({ projectDir, targetElementId: 'image-1' })
      const taskPayload = JSON.parse(await readFile(result.taskFile, 'utf8'))

      assert.equal((await stat(result.sourceImageFile)).isFile(), true)
      assert.equal(taskPayload.task.targetElement.id, 'image-1')
      assert.equal(taskPayload.task.instructionText, '标题换成金色')
      assert.equal(taskPayload.sourceImage.fileName, 'source.png')
    } finally {
      await rm(projectDir, { recursive: true, force: true })
    }
  })
})

describe('exportCanvaswrightImage', () => {
  it('exports a selected image asset', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'canvaswright-mcp-'))
    try {
      await saveScene({ projectDir }, {
        elements: [
          { id: 'image-1', type: 'image', x: 0, y: 0, width: 300, height: 200, fileId: 'file_image_1' }
        ],
        files: {
          file_image_1: {
            dataURL: `data:image/png;base64,${PNG_1X1.toString('base64')}`,
            customData: { fileName: 'final.png' }
          }
        }
      })

      const result = await exportCanvaswrightImage({ projectDir, elementId: 'image-1', fileName: 'exported.png' })

      assert.equal(result.imageElementId, 'image-1')
      assert.equal(result.fileName, 'exported.png')
      assert.equal((await stat(result.imageFile)).isFile(), true)
      assert.deepEqual(await readFile(result.imageFile), PNG_1X1)
    } finally {
      await rm(projectDir, { recursive: true, force: true })
    }
  })
})
