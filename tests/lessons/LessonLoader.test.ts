import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LessonLoader } from '../../src/lessons/LessonLoader';
import type { LessonManifest, LessonData } from '../../src/lessons/types';

const validManifest: LessonManifest = {
  modules: [
    { id: 'module-01', number: 1, title: 'Sound Basics', lessons: ['01-what-is-sound.json'] },
  ],
};

const bigManifest: LessonManifest = {
  modules: [
    { id: 'module-01', number: 1, title: 'Sound Basics', lessons: ['01.json', '02.json', '03.json'] },
    { id: 'module-02', number: 2, title: 'Oscillators', lessons: ['04.json', '05.json', '06.json'] },
    { id: 'module-03', number: 3, title: 'Filters', lessons: ['07.json', '08.json', '09.json'] },
    { id: 'module-04', number: 4, title: 'Envelopes', lessons: ['10.json', '11.json', '12.json'] },
    { id: 'module-05', number: 5, title: 'Effects', lessons: ['13.json', '14.json', '15.json'] },
  ],
};

const validLesson: LessonData = {
  id: 'lesson-01-what-is-sound',
  moduleId: 'module-01',
  index: 1,
  title: 'What is Sound?',
  concept: 'Sound is vibration.',
  patchFile: '/lessons/patches/01-what-is-sound.json',
  highlightComponentTypes: ['oscillator'],
  task: { type: 'observe', instruction: 'Listen.' },
};

function mockFetch(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 404,
    statusText: ok ? 'OK' : 'Not Found',
    json: () => Promise.resolve(body),
  });
}

describe('LessonLoader', () => {
  let loader: LessonLoader;

  beforeEach(() => {
    loader = new LessonLoader();
  });

  describe('loadManifest()', () => {
    it('resolves a valid manifest', async () => {
      global.fetch = mockFetch(validManifest);
      await expect(loader.loadManifest()).resolves.toEqual(validManifest);
    });

    it('resolves a 15-lesson manifest with 5 modules', async () => {
      global.fetch = mockFetch(bigManifest);
      const result = await loader.loadManifest();
      const totalLessons = result.modules.reduce((sum, m) => sum + m.lessons.length, 0);
      expect(result.modules).toHaveLength(5);
      expect(totalLessons).toBe(15);
    });

    it('throws on HTTP error', async () => {
      global.fetch = mockFetch(null, false);
      await expect(loader.loadManifest()).rejects.toThrow('Failed to fetch lesson manifest');
    });

    it('throws on invalid JSON shape', async () => {
      global.fetch = mockFetch({ not: 'a manifest' });
      await expect(loader.loadManifest()).rejects.toThrow('invalid shape');
    });
  });

  describe('loadLesson()', () => {
    it('resolves valid LessonData', async () => {
      global.fetch = mockFetch(validLesson);
      await expect(loader.loadLesson('01-what-is-sound.json')).resolves.toEqual(validLesson);
    });

    it('throws on HTTP error', async () => {
      global.fetch = mockFetch(null, false);
      await expect(loader.loadLesson('missing.json')).rejects.toThrow('Failed to fetch lesson');
    });

    it('throws on invalid shape', async () => {
      global.fetch = mockFetch({ bad: 'data' });
      await expect(loader.loadLesson('bad.json')).rejects.toThrow('invalid shape');
    });
  });

  describe('loadLessonPatch()', () => {
    it('resolves a PatchData-shaped object', async () => {
      const patch = { name: 'Test Patch', components: [], connections: [] };
      global.fetch = mockFetch(patch);
      await expect(loader.loadLessonPatch('/lessons/patches/test.json')).resolves.toEqual(patch);
    });

    it('throws on HTTP error', async () => {
      global.fetch = mockFetch(null, false);
      await expect(loader.loadLessonPatch('/lessons/patches/missing.json')).rejects.toThrow(
        'Failed to fetch lesson patch'
      );
    });
  });
});
