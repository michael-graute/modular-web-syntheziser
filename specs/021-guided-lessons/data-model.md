# Data Model: Guided Lessons

**Feature**: `021-guided-lessons`
**Date**: 2026-05-02

---

## Entities

### `LessonManifest` (JSON — `public/lessons/manifest.json`)

Top-level index loaded once on `LessonLoader` init. Lists all modules and their lesson file paths.

```typescript
interface LessonManifest {
  modules: ModuleManifest[];
}

interface ModuleManifest {
  id: string;           // e.g. 'module-01'
  number: number;       // 1
  title: string;        // 'Sound Basics'
  lessons: string[];    // relative paths: ['01-what-is-sound.json', ...]
}
```

---

### `LessonData` (JSON — `public/lessons/<filename>.json`)

One file per lesson. Loaded on demand when the user navigates to a lesson.

```typescript
interface LessonData {
  id: string;                      // 'lesson-01-what-is-sound'
  moduleId: string;                // 'module-01'
  index: number;                   // 1 (within module)
  title: string;                   // 'What is Sound?'
  concept: string;                 // Markdown — plain-language explanation
  patchFile: string | null;        // '/lessons/patches/01-what-is-sound.json' or null
  highlightComponentTypes: string[]; // ComponentType strings to spotlight on canvas
  task: LessonTask;
}
```

---

### `LessonTask`

Embedded in `LessonData`. Defines what the user must do and how to validate it.

```typescript
type LessonTaskType = 'connect' | 'set-parameter' | 'observe' | 'free';

interface LessonTask {
  type: LessonTaskType;
  instruction: string;            // Human-readable task prompt shown in sidebar

  // Populated only when type === 'connect'
  connect?: {
    sourceComponentType: string;  // ComponentType string
    targetComponentType: string;  // ComponentType string
    targetPortId: string;         // e.g. 'input', 'fm', 'cv'
  };

  // Populated only when type === 'set-parameter'
  setParameter?: {
    componentType: string;        // ComponentType string
    parameterId: string;          // e.g. 'frequency', 'waveform'
    targetValue: number;
    tolerance: number;            // Acceptable ± range
  };
}
```

**Validation rules**:
- `type` must be one of `'connect' | 'set-parameter' | 'observe' | 'free'`
- When `type === 'connect'`, `connect` field must be present and fully populated
- When `type === 'set-parameter'`, `setParameter` field must be present; `tolerance >= 0`
- `instruction` must be a non-empty string
- `observe` and `free` tasks require only `type` and `instruction`

---

### `LessonProgress` (localStorage — key: `'lesson-progress'`)

Persisted state for the current user's curriculum progress.

```typescript
interface LessonProgress {
  completedLessons: string[];     // Lesson IDs that have been completed
  currentLessonId: string | null; // Lesson the user was last on (null = not started)
  version: 1;                     // Schema version for future migration
}
```

**State transitions**:
- `currentLessonId`: set when user opens any lesson; cleared on Reset Progress
- `completedLessons`: a lesson ID is added when the user clicks "Next" after task completion (or for `observe`/`free` tasks, when they click "Next")
- Reset Progress: sets `completedLessons = []` and `currentLessonId = null`

**Persistence**:
- Written to `localStorage` key `'lesson-progress'` as JSON
- Read on `LessonSidebar` open; missing key treated as `{ completedLessons: [], currentLessonId: null, version: 1 }`
- When `localStorage` is unavailable: in-memory fallback; non-persistence notice shown to user

---

### `LessonState` (runtime in-memory — `LessonSidebar`)

Transient UI state not persisted to storage.

```typescript
interface LessonState {
  currentLesson: LessonData | null;
  taskComplete: boolean;
  isLoadingLesson: boolean;
  highlightDismissed: boolean;
}
```

---

## Relationships

```
LessonManifest
  └── ModuleManifest[]
        └── lesson filenames[]
              └── LessonData (loaded on demand)
                    └── LessonTask (embedded)

LessonProgress (localStorage)
  ↔ LessonData.id (foreign key — string match)

LessonData.patchFile
  → public/lessons/patches/*.json (PatchData format — existing schema)

LessonData.highlightComponentTypes[]
  → ComponentType enum values (validated against known types)
```

---

## Storage Layout

```
public/
└── lessons/
    ├── manifest.json                    # LessonManifest
    ├── 01-what-is-sound.json           # LessonData
    ├── 02-the-oscillator.json          # LessonData
    ├── 03-waveform-shapes.json         # LessonData
    └── patches/
        ├── 01-what-is-sound.json       # PatchData (existing format)
        ├── 02-the-oscillator.json      # PatchData
        └── 03-waveform-shapes.json     # PatchData

src/lessons/                            # New source directory
├── LessonLoader.ts                     # Fetches manifest + lesson JSON
├── LessonProgressStorage.ts           # localStorage read/write
├── LessonTaskValidator.ts             # EventBus subscriber, validates tasks
└── LessonSidebar.ts                   # UI — sidebar, curriculum overview, nav
```
