import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getCanvasTaskOverview } from './task-overview.js'

function image(id, x) {
  return {
    id,
    type: 'image',
    x,
    y: 0,
    width: 400,
    height: 300,
    fileId: `file_${id}`,
    isDeleted: false
  }
}

function rectangle(id, x, y, width, height) {
  return {
    id,
    type: 'rectangle',
    x,
    y,
    width,
    height,
    isDeleted: false
  }
}

function text(id, x, y, value) {
  return {
    id,
    type: 'text',
    x,
    y,
    width: value.length * 10,
    height: 24,
    text: value,
    isDeleted: false
  }
}

describe('getCanvasTaskOverview', () => {
  it('reports locked single-image mode and only analyzes the locked target', () => {
    const overview = getCanvasTaskOverview({
      scene: {
        elements: [
          image('poster-a', 0),
          image('poster-b', 520),
          text('between-note', 430, 30, '只改第一张')
        ]
      },
      lockedTarget: { id: 'poster-a', type: 'image' },
      currentSelection: [{ id: 'poster-b', type: 'image' }]
    })

    assert.equal(overview.mode, 'locked-single')
    assert.equal(overview.modeLabel, '单图锁定')
    assert.equal(overview.imageCount, 2)
    assert.equal(overview.taskCount, 1)
    assert.equal(overview.tasks[0].targetId, 'poster-a')
    assert.match(overview.hint, /取消锁定/)
  })

  it('reports multi-image batch mode with one task per annotated image', () => {
    const overview = getCanvasTaskOverview({
      scene: {
        elements: [
          image('poster-a', 0),
          image('poster-b', 520),
          rectangle('badge-a', 40, 120, 120, 80),
          text('note-a', 30, 330, '徽章换色'),
          rectangle('title-b', 560, 20, 160, 60),
          text('note-b', 580, 330, '标题更醒目')
        ]
      },
      lockedTarget: null,
      currentSelection: []
    })

    assert.equal(overview.mode, 'batch')
    assert.equal(overview.modeLabel, '多图批量')
    assert.equal(overview.imageCount, 2)
    assert.equal(overview.taskCount, 2)
    assert.deepEqual(overview.tasks.map((task) => task.targetId), ['poster-a', 'poster-b'])
    assert.deepEqual(overview.tasks.map((task) => task.annotationCount), [2, 2])
  })

  it('surfaces ambiguous annotations instead of hiding them', () => {
    const overview = getCanvasTaskOverview({
      scene: {
        elements: [
          image('poster-a', 0),
          image('poster-b', 250),
          rectangle('wide-note', 180, 40, 260, 80)
        ]
      },
      lockedTarget: null,
      currentSelection: []
    })

    assert.equal(overview.mode, 'batch')
    assert.equal(overview.taskCount, 0)
    assert.equal(overview.ambiguousCount, 1)
    assert.match(overview.warning, /不确定/)
  })

  it('reports a locked generation holder separately from image edit modes', () => {
    const overview = getCanvasTaskOverview({
      scene: {
        elements: [
          image('poster-a', 0),
          rectangle('holder-1', 520, 0, 320, 220)
        ]
      },
      lockedTarget: { id: 'holder-1', type: 'rectangle', isAiImageHolder: true },
      currentSelection: []
    })

    assert.equal(overview.mode, 'holder-locked')
    assert.equal(overview.modeLabel, '占位锁定')
    assert.equal(overview.imageCount, 1)
    assert.equal(overview.taskCount, 0)
    assert.match(overview.hint, /生成图/)
  })
})
