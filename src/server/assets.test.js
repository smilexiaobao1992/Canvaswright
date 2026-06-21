import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { normalizeSceneAssets } from './assets.js'

const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='

describe('normalizeSceneAssets', () => {
  it('moves image data URLs into page assets and rewrites scene files', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'canvaswright-assets-'))
    try {
      const result = await normalizeSceneAssets({
        projectDir,
        scene: {
          elements: [{ id: 'image-1', type: 'image', fileId: 'file_1' }],
          files: {
            file_1: {
              id: 'file_1',
              mimeType: 'image/png',
              dataURL: PNG_DATA_URL,
              created: 1,
              customData: { fileName: 'upload.png' }
            }
          }
        }
      })

      assert.equal(result.normalizedCount, 1)
      assert.equal(result.scene.files.file_1.dataURL, '/page-assets/main/upload.png')
      assert.equal(result.scene.files.file_1.customData.fileName, 'upload.png')
      assert.equal((await stat(result.assets[0].filePath)).isFile(), true)
      assert.deepEqual(await readFile(result.assets[0].filePath), Buffer.from(PNG_DATA_URL.split(',')[1], 'base64'))
    } finally {
      await rm(projectDir, { recursive: true, force: true })
    }
  })
})
