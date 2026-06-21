import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createAiImageHolderElement, normalizeScenePayload } from './scene.js'
import { planImageInsertion } from './image-insertion.js'

describe('planImageInsertion', () => {
  it('fills a selected AI image holder using the holder bounds', () => {
    const holder = createAiImageHolderElement({ id: 'holder-1', x: 40, y: 80, width: 320, height: 180 })
    const scene = normalizeScenePayload({
      elements: [holder],
      appState: { selectedElementIds: { 'holder-1': true } },
      files: {}
    })

    const result = planImageInsertion({
      scene,
      assetUrl: '/page-assets/main/render.png',
      fileName: 'render.png',
      mimeType: 'image/png',
      imageSize: { width: 1024, height: 576 },
      now: 1000,
      idSeed: 'render'
    })

    assert.equal(result.imageElement.type, 'image')
    assert.equal(result.imageElement.x, 40)
    assert.equal(result.imageElement.y, 80)
    assert.equal(result.imageElement.width, 320)
    assert.equal(result.imageElement.height, 180)
    assert.equal(result.imageElement.fileId, 'file_render')
    assert.equal(result.scene.files.file_render.id, 'file_render')
    assert.equal(result.scene.files.file_render.mimeType, 'image/png')
    assert.equal(result.scene.files.file_render.dataURL, '/page-assets/main/render.png')
    assert.equal(result.scene.files.file_render.created, 1000)
  })

  it('places an image to the right of a normal selected element', () => {
    const rectangle = {
      type: 'rectangle',
      id: 'rect-1',
      x: 100,
      y: 120,
      width: 240,
      height: 120,
      isDeleted: false
    }
    const scene = normalizeScenePayload({
      elements: [rectangle],
      appState: { selectedElementIds: { 'rect-1': true } },
      files: {}
    })

    const result = planImageInsertion({
      scene,
      assetUrl: '/page-assets/main/chart.png',
      fileName: 'chart.png',
      mimeType: 'image/png',
      imageSize: { width: 800, height: 400 },
      now: 2000,
      idSeed: 'chart'
    })

    assert.equal(result.imageElement.x, 380)
    assert.equal(result.imageElement.y, 120)
    assert.equal(result.imageElement.width, 512)
    assert.equal(result.imageElement.height, 256)
  })

  it('places an unanchored image to the right of existing canvas content', () => {
    const sourceImage = {
      type: 'image',
      id: 'image-1',
      x: 0,
      y: 0,
      width: 512,
      height: 768,
      fileId: 'file_source',
      isDeleted: false
    }
    const scene = normalizeScenePayload({
      elements: [sourceImage],
      files: {}
    })

    const result = planImageInsertion({
      scene,
      assetUrl: '/page-assets/main/new-poster.png',
      fileName: 'new-poster.png',
      mimeType: 'image/png',
      imageSize: { width: 800, height: 1200 },
      now: 2500,
      idSeed: 'new-poster'
    })

    assert.equal(result.imageElement.x, 552)
    assert.equal(result.imageElement.y, 0)
    assert.equal(result.imageElement.width, 512)
    assert.equal(result.imageElement.height, 768)
  })

  it('replaces a selected image in place when mode is replace', () => {
    const sourceImage = {
      type: 'image',
      id: 'image-1',
      x: 100,
      y: 120,
      width: 240,
      height: 320,
      fileId: 'file_source',
      isDeleted: false
    }
    const scene = normalizeScenePayload({
      elements: [sourceImage],
      appState: { selectedElementIds: { 'image-1': true } },
      files: {}
    })

    const result = planImageInsertion({
      scene,
      assetUrl: '/page-assets/main/revision.png',
      fileName: 'revision.png',
      mimeType: 'image/png',
      imageSize: { width: 800, height: 400 },
      mode: 'replace',
      now: 3000,
      idSeed: 'revision'
    })

    assert.equal(result.imageElement.x, 100)
    assert.equal(result.imageElement.y, 120)
    assert.equal(result.imageElement.width, 240)
    assert.equal(result.imageElement.height, 320)
    assert.equal(result.scene.elements.find((element) => element.id === 'image-1').isDeleted, true)
  })
})
