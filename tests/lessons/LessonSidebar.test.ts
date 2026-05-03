import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LessonData, LessonManifest } from '../../src/lessons/types';

// ── Hoist mocks so factories can reference them ───────────────────────────────

const {
  mockLoadManifest, mockLoadLesson, mockLoadLessonPatch,
  mockLoadProgress, mockSaveProgress, mockClearProgress,
} = vi.hoisted(() => ({
  mockLoadManifest: vi.fn(),
  mockLoadLesson: vi.fn(),
  mockLoadLessonPatch: vi.fn(),
  mockLoadProgress: vi.fn(),
  mockSaveProgress: vi.fn(),
  mockClearProgress: vi.fn(),
}));

vi.mock('../../src/lessons/LessonLoader', () => ({
  lessonLoader: { loadManifest: mockLoadManifest, loadLesson: mockLoadLesson, loadLessonPatch: mockLoadLessonPatch },
}));

vi.mock('../../src/lessons/LessonProgressStorage', () => ({
  lessonProgressStorage: {
    loadProgress: mockLoadProgress,
    saveProgress: mockSaveProgress,
    clearProgress: mockClearProgress,
    isUsingFallback: false,
  },
}));

vi.mock('../../src/lessons/LessonTaskValidator', () => ({
  lessonTaskValidator: { setTask: vi.fn(), onComplete: vi.fn() },
}));

vi.mock('../../src/patch/PatchManager', () => ({
  patchManager: { hasUnsavedChanges: vi.fn().mockReturnValue(false), loadFromData: vi.fn() },
}));

import { LessonSidebar } from '../../src/lessons/LessonSidebar';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeLesson = (overrides: Partial<LessonData> = {}): LessonData => ({
  id: 'lesson-01-what-is-sound',
  moduleId: 'module-01',
  index: 1,
  title: 'What is Sound?',
  concept: 'Sound is vibration.',
  patchFile: null,
  highlightComponentTypes: [],
  task: { type: 'observe', instruction: 'Listen to the sine wave.' },
  ...overrides,
});

const makeManifest = (lessons: string[] = ['01-what-is-sound.json']): LessonManifest => ({
  modules: [
    { id: 'module-01', number: 1, title: 'Sound Basics', lessons },
    { id: 'module-02', number: 2, title: 'Shaping Sound (Coming Soon)', lessons: [] },
  ],
});

const defaultProgress = { completedLessons: [], currentLessonId: null, version: 1 as const };

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSidebar(): LessonSidebar {
  return new LessonSidebar();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LessonSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadProgress.mockReturnValue(defaultProgress);
    mockSaveProgress.mockReturnValue(undefined);
    mockLoadManifest.mockResolvedValue(makeManifest());
    mockLoadLesson.mockResolvedValue(makeLesson());
    mockLoadLessonPatch.mockResolvedValue({});
    // Clean up any sidebars appended to body
    document.getElementById('lesson-sidebar')?.remove();
  });

  // ── toggle / open / close ─────────────────────────────────────────────────

  describe('toggle()', () => {
    it('opens a closed sidebar', () => {
      const sidebar = makeSidebar();
      sidebar.toggle();
      expect(sidebar['isVisible']).toBe(true);
      expect(sidebar['container'].style.right).toBe('0px');
    });

    it('closes an open sidebar', () => {
      const sidebar = makeSidebar();
      sidebar.toggle(); // open
      sidebar.toggle(); // close
      expect(sidebar['isVisible']).toBe(false);
    });
  });

  describe('open()', () => {
    it('applies visible CSS state', () => {
      const sidebar = makeSidebar();
      sidebar.open();
      expect(sidebar['container'].style.right).toBe('0px');
      expect(sidebar['isVisible']).toBe(true);
    });

    it('does nothing if already open', () => {
      const sidebar = makeSidebar();
      sidebar.open();
      const manifestCallCount = mockLoadManifest.mock.calls.length;
      sidebar.open(); // second open should no-op
      expect(mockLoadManifest.mock.calls.length).toBe(manifestCallCount);
    });
  });

  describe('close()', () => {
    it('removes visible CSS state', () => {
      const sidebar = makeSidebar();
      sidebar.open();
      sidebar.close();
      expect(sidebar['isVisible']).toBe(false);
    });

    it('does nothing if already closed', () => {
      const sidebar = makeSidebar();
      sidebar.close(); // should not throw
      expect(sidebar['isVisible']).toBe(false);
    });
  });

  // ── renderLesson() ────────────────────────────────────────────────────────

  describe('renderLesson()', () => {
    it('inserts lesson title into the DOM', () => {
      const sidebar = makeSidebar();
      const lesson = makeLesson({ title: 'What is Sound?' });
      sidebar['lessonFiles'] = ['01-what-is-sound.json'];
      sidebar['currentIndex'] = 0;
      sidebar.renderLesson(lesson);
      expect(sidebar['contentArea'].textContent).toContain('What is Sound?');
    });

    it('inserts module/lesson number meta label', () => {
      const sidebar = makeSidebar();
      const lesson = makeLesson({ moduleId: 'module-01', index: 1 });
      sidebar['lessonFiles'] = ['01-what-is-sound.json'];
      sidebar['currentIndex'] = 0;
      sidebar.renderLesson(lesson);
      expect(sidebar['contentArea'].textContent).toContain('Module 01');
      expect(sidebar['contentArea'].textContent).toContain('Lesson 1');
    });

    it('inserts task instruction into the DOM', () => {
      const sidebar = makeSidebar();
      const lesson = makeLesson({ task: { type: 'observe', instruction: 'Listen carefully.' } });
      sidebar['lessonFiles'] = ['01-what-is-sound.json'];
      sidebar['currentIndex'] = 0;
      sidebar.renderLesson(lesson);
      expect(sidebar['contentArea'].textContent).toContain('Listen carefully.');
    });
  });

  // ── Next button enabled/disabled ──────────────────────────────────────────

  describe('Next button state', () => {
    it('is disabled when task type is connect and taskComplete is false', () => {
      const sidebar = makeSidebar();
      const lesson = makeLesson({
        task: { type: 'connect', instruction: 'Connect it.', connect: { sourceComponentType: 'a', targetComponentType: 'b', targetPortId: 'x' } },
      });
      sidebar['lessonFiles'] = ['01.json', '02.json'];
      sidebar['currentIndex'] = 0;
      sidebar['state'] = { ...sidebar['state'], taskComplete: false };
      sidebar.renderLesson(lesson);
      const nextBtn = sidebar['contentArea'].querySelector('[aria-label="Go to next lesson"]') as HTMLButtonElement;
      expect(nextBtn).not.toBeNull();
      expect(nextBtn.disabled).toBe(true);
    });

    it('is disabled when task type is set-parameter and taskComplete is false', () => {
      const sidebar = makeSidebar();
      const lesson = makeLesson({
        task: { type: 'set-parameter', instruction: 'Set it.', setParameter: { componentType: 'oscillator', parameterId: 'waveform', targetValue: 1, tolerance: 0 } },
      });
      sidebar['lessonFiles'] = ['01.json', '02.json'];
      sidebar['currentIndex'] = 0;
      sidebar['state'] = { ...sidebar['state'], taskComplete: false };
      sidebar.renderLesson(lesson);
      const nextBtn = sidebar['contentArea'].querySelector('[aria-label="Go to next lesson"]') as HTMLButtonElement;
      expect(nextBtn.disabled).toBe(true);
    });

    it('is enabled when task type is observe', () => {
      const sidebar = makeSidebar();
      const lesson = makeLesson({ task: { type: 'observe', instruction: 'Listen.' } });
      sidebar['lessonFiles'] = ['01.json', '02.json'];
      sidebar['currentIndex'] = 0;
      sidebar['state'] = { ...sidebar['state'], taskComplete: false };
      sidebar.renderLesson(lesson);
      const nextBtn = sidebar['contentArea'].querySelector('[aria-label="Go to next lesson"]') as HTMLButtonElement;
      expect(nextBtn.disabled).toBe(false);
    });

    it('is enabled when task type is free', () => {
      const sidebar = makeSidebar();
      const lesson = makeLesson({ task: { type: 'free', instruction: 'Experiment.' } });
      sidebar['lessonFiles'] = ['01.json', '02.json'];
      sidebar['currentIndex'] = 0;
      sidebar['state'] = { ...sidebar['state'], taskComplete: false };
      sidebar.renderLesson(lesson);
      const nextBtn = sidebar['contentArea'].querySelector('[aria-label="Go to next lesson"]') as HTMLButtonElement;
      expect(nextBtn.disabled).toBe(false);
    });

    it('is enabled when taskComplete is true', () => {
      const sidebar = makeSidebar();
      const lesson = makeLesson({
        task: { type: 'connect', instruction: 'Connect it.', connect: { sourceComponentType: 'a', targetComponentType: 'b', targetPortId: 'x' } },
      });
      sidebar['lessonFiles'] = ['01.json', '02.json'];
      sidebar['currentIndex'] = 0;
      sidebar['state'] = { ...sidebar['state'], taskComplete: true };
      sidebar.renderLesson(lesson);
      const nextBtn = sidebar['contentArea'].querySelector('[aria-label="Go to next lesson"]') as HTMLButtonElement;
      expect(nextBtn.disabled).toBe(false);
    });
  });

  // ── Back button enabled/disabled ──────────────────────────────────────────

  describe('Back button state', () => {
    it('is disabled on the first lesson', () => {
      const sidebar = makeSidebar();
      const lesson = makeLesson();
      sidebar['lessonFiles'] = ['01.json', '02.json'];
      sidebar['currentIndex'] = 0;
      sidebar.renderLesson(lesson);
      const backBtn = sidebar['contentArea'].querySelector('[aria-label="Go to previous lesson"]') as HTMLButtonElement;
      expect(backBtn.disabled).toBe(true);
    });

    it('is enabled on subsequent lessons', () => {
      const sidebar = makeSidebar();
      const lesson = makeLesson({ id: 'lesson-02-the-oscillator', index: 2 });
      sidebar['lessonFiles'] = ['01.json', '02.json'];
      sidebar['currentIndex'] = 1;
      sidebar.renderLesson(lesson);
      const backBtn = sidebar['contentArea'].querySelector('[aria-label="Go to previous lesson"]') as HTMLButtonElement;
      expect(backBtn.disabled).toBe(false);
    });
  });

  // ── ARIA ──────────────────────────────────────────────────────────────────

  describe('ARIA attributes', () => {
    it('sidebar container has role=complementary and aria-label', () => {
      const sidebar = makeSidebar();
      expect(sidebar['container'].getAttribute('role')).toBe('complementary');
      expect(sidebar['container'].getAttribute('aria-label')).toBe('Guided Lessons');
    });

    it('task status element has role=status and aria-live=polite', () => {
      const sidebar = makeSidebar();
      const lesson = makeLesson();
      sidebar['lessonFiles'] = ['01.json'];
      sidebar['currentIndex'] = 0;
      sidebar.renderLesson(lesson);
      const status = sidebar['contentArea'].querySelector('[role="status"]');
      expect(status).not.toBeNull();
      expect(status!.getAttribute('aria-live')).toBe('polite');
    });
  });
});
