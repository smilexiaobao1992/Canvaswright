import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { createAiImageHolderElement } from '../src/lib/scene.js'
import { loadScene, saveScene } from '../src/server/storage.js'
import { insertCanvaswrightImage } from './canvas-actions.mjs'

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
})
