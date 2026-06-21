import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getCanvasEditTasks } from './edit-tasks.js'

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

function line(id, x, y, width, height) {
  return {
    id,
    type: 'line',
    x,
    y,
    width,
    height,
    isDeleted: false
  }
}

describe('getCanvasEditTasks', () => {
  it('assigns annotations to the image they overlap or sit nearest to', () => {
    const result = getCanvasEditTasks({
      elements: [
        image('poster-a', 0),
        image('poster-b', 520),
        rectangle('title-a', 20, 20, 220, 60),
        text('note-a', 405, 30, '标题更有艺术感'),
        rectangle('badge-b', 620, 180, 120, 80),
        text('note-b', 950, 190, '徽章换成蓝色')
      ],
      files: {
        'file_poster-a': { dataURL: '/page-assets/main/poster-a.png', customData: { fileName: 'poster-a.png' } },
        'file_poster-b': { dataURL: '/page-assets/main/poster-b.png', customData: { fileName: 'poster-b.png' } }
      }
    })

    assert.equal(result.editTasks.length, 2)
    assert.equal(result.ambiguousAnnotations.length, 0)
    assert.deepEqual(result.editTasks.map((task) => task.targetElement.id), ['poster-a', 'poster-b'])
    assert.deepEqual(result.editTasks[0].annotationElements.map((element) => element.id), ['title-a', 'note-a'])
    assert.deepEqual(result.editTasks[1].annotationElements.map((element) => element.id), ['badge-b', 'note-b'])
    assert.equal(result.editTasks[0].instructionText, '标题更有艺术感')
    assert.equal(result.editTasks[1].targetElement.assetUrl, '/page-assets/main/poster-b.png')
  })

  it('uses a selected image as the target when annotations are between images', () => {
    const result = getCanvasEditTasks({
      elements: [
        image('poster-a', 0),
        image('poster-b', 520),
        text('between-note', 430, 30, '只改第二张')
      ],
      appState: {
        selectedElementIds: {
          'poster-b': true
        }
      }
    })

    assert.equal(result.editTasks.length, 1)
    assert.equal(result.editTasks[0].targetElement.id, 'poster-b')
    assert.deepEqual(result.editTasks[0].annotationElements.map((element) => element.id), ['between-note'])
    assert.equal(result.editTasks[0].assignment, 'selected-target')
  })

  it('reports an annotation as ambiguous when it overlaps multiple images without a selected target', () => {
    const result = getCanvasEditTasks({
      elements: [
        image('poster-a', 0),
        image('poster-b', 250),
        rectangle('wide-note', 180, 40, 260, 80)
      ]
    })

    assert.equal(result.editTasks.length, 0)
    assert.deepEqual(result.ambiguousAnnotations.map((element) => element.id), ['wide-note'])
  })

  it('assigns callout text to the same image as its nearby line annotation', () => {
    const result = getCanvasEditTasks({
      elements: [
        image('poster-a', 0),
        image('poster-b', 900),
        line('callout-line', 320, 150, 280, 0),
        text('callout-text', 640, 140, '把这里换成红色')
      ]
    })

    assert.equal(result.editTasks.length, 1)
    assert.equal(result.editTasks[0].targetElement.id, 'poster-a')
    assert.deepEqual(result.editTasks[0].annotationElements.map((element) => element.id), ['callout-line', 'callout-text'])
    assert.equal(result.editTasks[0].instructionText, '把这里换成红色')
  })
})
