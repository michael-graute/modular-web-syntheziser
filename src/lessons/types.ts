/**
 * Type contracts for the Guided Lessons feature (021)
 *
 * These are the canonical TypeScript interfaces for lesson data, tasks,
 * progress persistence, and runtime state. Implementation files must
 * conform to these contracts.
 */

// ---------------------------------------------------------------------------
// Lesson content (JSON file format)
// ---------------------------------------------------------------------------

export type LessonTaskType = 'connect' | 'set-parameter' | 'observe' | 'free';

export interface ConnectTaskParams {
  sourceComponentType: string; // ComponentType enum value
  targetComponentType: string; // ComponentType enum value
  targetPortId: string;
}

export interface SetParameterTaskParams {
  componentType: string; // ComponentType enum value
  parameterId: string;
  targetValue: number;
  tolerance: number; // acceptable ± range; must be >= 0
}

export interface LessonTask {
  type: LessonTaskType;
  instruction: string;
  connect?: ConnectTaskParams;
  setParameter?: SetParameterTaskParams;
}

export interface LessonData {
  id: string;
  moduleId: string;
  index: number; // 1-based position within the module
  title: string;
  concept: string; // Markdown string
  patchFile: string | null; // path relative to public/, or null for no patch
  highlightComponentTypes: string[]; // ComponentType enum values
  task: LessonTask;
}

// ---------------------------------------------------------------------------
// Manifest (public/lessons/manifest.json)
// ---------------------------------------------------------------------------

export interface ModuleManifest {
  id: string;
  number: number;
  title: string;
  lessons: string[]; // filenames relative to public/lessons/
}

export interface LessonManifest {
  modules: ModuleManifest[];
}

// ---------------------------------------------------------------------------
// Progress persistence (localStorage)
// ---------------------------------------------------------------------------

export interface LessonProgress {
  completedLessons: string[]; // lesson IDs
  currentLessonId: string | null;
  version: 1;
}

export const LESSON_PROGRESS_STORAGE_KEY = 'lesson-progress';

export const LESSON_PROGRESS_DEFAULT: LessonProgress = {
  completedLessons: [],
  currentLessonId: null,
  version: 1,
};

// ---------------------------------------------------------------------------
// Runtime state (in-memory, not persisted)
// ---------------------------------------------------------------------------

export interface LessonState {
  currentLesson: LessonData | null;
  taskComplete: boolean;
  isLoadingLesson: boolean;
  highlightDismissed: boolean;
  patchLoaded: boolean;
  showingCurriculum: boolean;
}
