import { describe, it, expect } from 'vitest';
import {
  isValidLessonTask,
  isValidLessonData,
  isValidLessonManifest,
  isValidLessonProgress,
} from '../../src/lessons/validation';

describe('isValidLessonTask', () => {
  it('accepts observe task', () => {
    expect(isValidLessonTask({ type: 'observe', instruction: 'Listen.' })).toBe(true);
  });

  it('accepts free task', () => {
    expect(isValidLessonTask({ type: 'free', instruction: 'Experiment.' })).toBe(true);
  });

  it('accepts connect task with all fields', () => {
    expect(
      isValidLessonTask({
        type: 'connect',
        instruction: 'Connect the keyboard.',
        connect: {
          sourceComponentType: 'keyboard-input',
          targetComponentType: 'oscillator',
          targetPortId: 'frequency',
        },
      })
    ).toBe(true);
  });

  it('rejects connect task missing connect field', () => {
    expect(isValidLessonTask({ type: 'connect', instruction: 'Connect.' })).toBe(false);
  });

  it('accepts set-parameter task with all fields', () => {
    expect(
      isValidLessonTask({
        type: 'set-parameter',
        instruction: 'Set waveform.',
        setParameter: {
          componentType: 'oscillator',
          parameterId: 'waveform',
          targetValue: 1,
          tolerance: 0,
        },
      })
    ).toBe(true);
  });

  it('rejects set-parameter task missing setParameter field', () => {
    expect(isValidLessonTask({ type: 'set-parameter', instruction: 'Set it.' })).toBe(false);
  });

  it('rejects set-parameter task with negative tolerance', () => {
    expect(
      isValidLessonTask({
        type: 'set-parameter',
        instruction: 'Set it.',
        setParameter: { componentType: 'oscillator', parameterId: 'freq', targetValue: 440, tolerance: -1 },
      })
    ).toBe(false);
  });

  it('rejects task with unknown type', () => {
    expect(isValidLessonTask({ type: 'unknown', instruction: 'Do it.' })).toBe(false);
  });

  it('rejects task with empty instruction', () => {
    expect(isValidLessonTask({ type: 'observe', instruction: '' })).toBe(false);
  });

  it('rejects non-object', () => {
    expect(isValidLessonTask(null)).toBe(false);
    expect(isValidLessonTask('string')).toBe(false);
    expect(isValidLessonTask(42)).toBe(false);
  });
});

describe('isValidLessonData', () => {
  const valid = {
    id: 'lesson-01',
    moduleId: 'module-01',
    index: 1,
    title: 'Test Lesson',
    concept: 'Some concept.',
    patchFile: '/lessons/patches/test.json',
    highlightComponentTypes: ['oscillator'],
    task: { type: 'observe', instruction: 'Listen.' },
  };

  it('accepts valid LessonData', () => {
    expect(isValidLessonData(valid)).toBe(true);
  });

  it('accepts patchFile: null', () => {
    expect(isValidLessonData({ ...valid, patchFile: null })).toBe(true);
  });

  it('accepts empty highlightComponentTypes', () => {
    expect(isValidLessonData({ ...valid, highlightComponentTypes: [] })).toBe(true);
  });

  it('rejects missing id', () => {
    const { id: _, ...rest } = valid;
    expect(isValidLessonData(rest)).toBe(false);
  });

  it('rejects index < 1', () => {
    expect(isValidLessonData({ ...valid, index: 0 })).toBe(false);
  });

  it('rejects non-array highlightComponentTypes', () => {
    expect(isValidLessonData({ ...valid, highlightComponentTypes: 'oscillator' })).toBe(false);
  });

  it('rejects invalid task', () => {
    expect(isValidLessonData({ ...valid, task: { type: 'bad', instruction: '' } })).toBe(false);
  });

  it('rejects non-object', () => {
    expect(isValidLessonData(null)).toBe(false);
    expect(isValidLessonData('string')).toBe(false);
  });
});

describe('isValidLessonManifest', () => {
  const valid = {
    modules: [
      { id: 'module-01', number: 1, title: 'Sound Basics', lessons: ['01.json'] },
    ],
  };

  it('accepts valid manifest', () => {
    expect(isValidLessonManifest(valid)).toBe(true);
  });

  it('accepts manifest with empty modules array', () => {
    expect(isValidLessonManifest({ modules: [] })).toBe(true);
  });

  it('rejects missing modules key', () => {
    expect(isValidLessonManifest({ not: 'modules' })).toBe(false);
  });

  it('rejects module missing id', () => {
    expect(isValidLessonManifest({ modules: [{ number: 1, title: 'X', lessons: [] }] })).toBe(false);
  });

  it('rejects module with non-array lessons', () => {
    expect(
      isValidLessonManifest({ modules: [{ id: 'x', number: 1, title: 'X', lessons: 'bad' }] })
    ).toBe(false);
  });

  it('rejects non-object', () => {
    expect(isValidLessonManifest(null)).toBe(false);
    expect(isValidLessonManifest([])).toBe(false);
  });
});

describe('isValidLessonProgress', () => {
  const valid = {
    completedLessons: ['lesson-01'],
    currentLessonId: 'lesson-02',
    version: 1,
  };

  it('accepts valid progress', () => {
    expect(isValidLessonProgress(valid)).toBe(true);
  });

  it('accepts currentLessonId: null', () => {
    expect(isValidLessonProgress({ ...valid, currentLessonId: null })).toBe(true);
  });

  it('accepts empty completedLessons', () => {
    expect(isValidLessonProgress({ completedLessons: [], currentLessonId: null, version: 1 })).toBe(true);
  });

  it('rejects non-array completedLessons', () => {
    expect(isValidLessonProgress({ ...valid, completedLessons: 'lesson-01' })).toBe(false);
  });

  it('rejects wrong version', () => {
    expect(isValidLessonProgress({ ...valid, version: 2 })).toBe(false);
  });

  it('rejects currentLessonId as number', () => {
    expect(isValidLessonProgress({ ...valid, currentLessonId: 42 })).toBe(false);
  });

  it('rejects non-object', () => {
    expect(isValidLessonProgress(null)).toBe(false);
    expect(isValidLessonProgress('string')).toBe(false);
  });
});
