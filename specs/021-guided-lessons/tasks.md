# Tasks: Guided Lessons

**Input**: Design documents from `specs/021-guided-lessons/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Exact file paths included in all descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the `src/lessons/` directory, add the CSS highlight rule, and wire the toolbar button. All phases depend on this.

- [x] T001 Create directory `src/lessons/` (new source module for all lesson logic)
- [x] T002 Create directory `public/lessons/patches/` (lesson PatchData JSON files)
- [x] T003 [P] Add `.lesson-highlight` CSS rule to `src/styles/components.css` — `box-shadow: 0 0 0 3px var(--accent-color, #ff9500), 0 0 12px rgba(255, 149, 0, 0.4);` on the component's root element; rule must not affect canvas rendering or audio pipeline
- [x] T004 [P] Add `btn-learn` button to `.top-bar` in `index.html` — place it after `btn-help`; use same button class and structure as existing toolbar buttons; label text "Learn"

**Checkpoint**: Directory structure ready; CSS and HTML foundations in place.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type contracts, validation helpers, `LessonLoader`, and `LessonProgressStorage` must exist before any user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T005 Copy `specs/021-guided-lessons/contracts/types.ts` to `src/lessons/types.ts` — this file is the canonical type contract; do not modify the contracts/ copy
- [x] T006 Copy `specs/021-guided-lessons/contracts/validation.ts` to `src/lessons/validation.ts` — update the import path from `'./types'` to match the new location
- [x] T007 Create `src/lessons/LessonProgressStorage.ts` — exports `loadProgress(): LessonProgress`, `saveProgress(p: LessonProgress): void`, `clearProgress(): void`; reads/writes `localStorage` key `'lesson-progress'` (constant from `types.ts`); falls back to an in-memory store when `localStorage` throws; uses `isValidLessonProgress()` from `validation.ts` to guard reads; exports a singleton `lessonProgressStorage`
- [x] T008 Create `src/lessons/LessonLoader.ts` — exports class `LessonLoader` with `loadManifest(): Promise<LessonManifest>` (fetches `public/lessons/manifest.json`), `loadLesson(filename: string): Promise<LessonData>` (fetches `public/lessons/<filename>`), `loadLessonPatch(patchFile: string): Promise<PatchData>` (fetches the given path); validates responses with `isValidLessonManifest()` and `isValidLessonData()` from `validation.ts`; throws descriptive errors on fetch failure or validation failure; exports singleton `lessonLoader`
- [x] T009 [P] Create `tests/lessons/LessonProgressStorage.test.ts` — tests: `loadProgress()` returns default when key absent; `saveProgress()` writes and `loadProgress()` reads back; `clearProgress()` removes key and returns default on next read; falls back to in-memory when `localStorage` throws (mock `localStorage.setItem` to throw)
- [x] T010 [P] Create `tests/lessons/LessonLoader.test.ts` — mock `fetch`; tests: `loadManifest()` resolves valid manifest; `loadManifest()` throws on HTTP error; `loadManifest()` throws on invalid JSON shape; `loadLesson()` resolves valid `LessonData`; `loadLesson()` throws on invalid shape; `loadLessonPatch()` resolves a `PatchData`-shaped object; **`loadManifest()` resolves a manifest with 5 modules and 15 total lessons distributed across them** (validates FR-011 infrastructure capacity)
- [x] T011 [P] Create `tests/lessons/validation.test.ts` — 100% coverage of all exported functions in `src/lessons/validation.ts`: valid and invalid inputs for `isValidLessonTask`, `isValidLessonData`, `isValidLessonManifest`, `isValidLessonProgress`; run `vitest run tests/lessons/` to confirm all pass

**Checkpoint**: Foundation ready — type-safe lesson loading and progress persistence proven by tests.

---

## Phase 3: User Story 1 — Follow a Guided Lesson (Priority: P1) 🎯 MVP

**Goal**: A user can open Lesson Mode, read Lesson 1's content, see the patch on the canvas, complete the task, and advance to Lesson 2.

**Independent Test**: Open app → click "Learn" → Lesson Sidebar shows Lesson 1 → patch loads on canvas → highlighted component visible → complete task → click Next → Lesson 2 loads. Verify against quickstart.md Scenarios 1, 2, and 3.

### Implementation for User Story 1

- [ ] T012 Create `src/lessons/LessonTaskValidator.ts` — exports class `LessonTaskValidator`; constructor takes `eventBus`; `setTask(task: LessonTask | null): void` activates/deactivates validation; `onComplete(cb: () => void): void` registers a one-time callback; subscribes to `EventType.CONNECTION_ADDED` and `EventType.PARAMETER_CHANGED` on activation; for `connect` tasks: checks `ConnectionEvent.sourceComponent.type === task.connect.sourceComponentType` and `targetComponent.type === task.connect.targetComponentType` and `targetPortId`; for `set-parameter` tasks: checks `ParameterEvent.componentType`, `parameterId`, and `Math.abs(value - targetValue) <= tolerance`; `observe` and `free` tasks never fire the validator; unsubscribes on `setTask(null)`; exports singleton `lessonTaskValidator`
- [ ] T013 [P] Create `tests/lessons/LessonTaskValidator.test.ts` — mock `eventBus`; tests: `connect` task completes when matching `CONNECTION_ADDED` fires; `connect` task does NOT complete when wrong component types; `connect` task does NOT complete when wrong port; `set-parameter` task completes when value within tolerance; `set-parameter` task does NOT complete when value outside tolerance; `set-parameter` task completes on first reach (subsequent events do not re-fire callback); `observe` task never fires callback; `setTask(null)` unsubscribes
- [ ] T014 Create `src/lessons/LessonSidebar.ts` — class `LessonSidebar`; constructor builds DOM (same pattern as `HelpSidebar`: fixed right panel, slide-in via CSS `right` transition, `z-index: 9998`); `toggle()`, `open()`, `close()` methods; internal `renderLesson(lesson: LessonData)` renders title, module/lesson number, concept text (`\n` → `<br>`), task instruction, and Next/Back buttons; `renderLoadingState()` and `renderErrorState(msg: string)` for async states; no curriculum overview yet (added in Phase 5); exports singleton `lessonSidebar`
- [ ] T015 Implement lesson navigation in `src/lessons/LessonSidebar.ts` — `loadLesson(lessonData: LessonData)` method: (1) calls `patchManager.hasUnsavedChanges()` and shows `window.confirm('Your changes will be lost — continue?')` if dirty — aborts if cancelled; (2) calls `lessonLoader.loadLessonPatch(lesson.patchFile)` if `patchFile` is not null and loads it via `patchManager`; (3) renders lesson content; (4) calls `lessonTaskValidator.setTask(lesson.task)`; (5) applies `.lesson-highlight` CSS class to DOM elements matching `lesson.highlightComponentTypes` via `document.querySelectorAll`; (6) saves `currentLessonId` to `lessonProgressStorage`
- [ ] T016 [US1] Implement Next/Back navigation in `src/lessons/LessonSidebar.ts` — `nextLesson()`: marks current lesson complete in `lessonProgressStorage`, loads next lesson in sequence from manifest; `prevLesson()`: loads previous lesson without marking complete; Next button is enabled when `taskComplete === true` OR task type is `observe`/`free`; Back button disabled on first lesson; show loading state during patch fetch
- [ ] T017 [US1] Wire `LessonSidebar` in `src/main.ts` — import and instantiate `lessonSidebar`; wire `btn-learn` click → `lessonSidebar.toggle()`; on `lessonSidebar.open()`, if `HelpSidebar` is open close it (mutual exclusion); on `helpSidebar.open()` close `lessonSidebar` if open; on first open with no `currentLessonId`, load the first lesson from the manifest automatically
- [ ] T018 [US1] Add dismiss button for highlight overlay in `src/lessons/LessonSidebar.ts` — a small "✕ Dismiss highlights" link/button in the sidebar dismisses by removing `.lesson-highlight` from all elements; sets `highlightDismissed = true` in `LessonState`; dismiss does not affect task validation
- [ ] T019 [US1] Run `vitest run tests/lessons/` — confirm all Phase 2 and Phase 3 tests pass with no regressions

**Checkpoint**: US1 fully functional — user can open Lesson Mode, view Lesson 1, complete a task, and advance.

---

## Phase 4: User Story 2 — Track and Resume Progress (Priority: P2)

**Goal**: Progress persists across sessions; returning users resume where they left off.

**Independent Test**: Complete 2 lessons, close browser, reopen, click "Learn" — verify sidebar opens at Lesson 3. Verify `localStorage` key `'lesson-progress'` contains expected state. See quickstart.md Scenario 4.

### Implementation for User Story 2

- [ ] T020 [US2] Verify `LessonProgressStorage` integration in `src/lessons/LessonSidebar.ts` — confirm `loadLesson()` writes `currentLessonId` (T015), `nextLesson()` appends to `completedLessons` (T016), and `open()` with no currentLessonId loads first lesson vs. resumes at currentLessonId; no new code needed if T015–T016 are correct — task is to trace and verify
- [ ] T021 [US2] Implement Resume on Open in `src/lessons/LessonSidebar.ts` — in the `open()` method: read `lessonProgressStorage.loadProgress()`; if `currentLessonId` is set, load that lesson directly (skipping the lesson-load confirmation since no patch is on canvas yet); if null, load the first lesson from the manifest
- [ ] T022 [US2] Handle `localStorage` unavailable — in `LessonProgressStorage.ts`, when `localStorage` throws on `setItem`, fall back to in-memory store for the session; add a one-time notice in the `LessonSidebar` UI: "Progress won't be saved in private browsing mode." (shown once, dismissable); the notice is shown only when the in-memory fallback is active
- [ ] T023 [US2] Run `vitest run tests/lessons/LessonProgressStorage.test.ts` — confirm in-memory fallback test (T009) passes

**Checkpoint**: US2 fully functional — progress survives browser close and restores correctly.

---

## Phase 5: User Story 3 — Browse the Curriculum (Priority: P2)

**Goal**: Users can see all modules and lessons with completion status and jump to any lesson directly.

**Independent Test**: Open Lesson Mode → click curriculum overview toggle → all 5 module slots visible (Module 1 with 3 lessons, Modules 2–5 as placeholders) → completed lessons show ✓ → current lesson highlighted → unstarted lessons dimmed but clickable → click a lesson → it loads. See quickstart.md Scenario 5.

### Implementation for User Story 3

- [ ] T024 [US3] Implement curriculum overview panel in `src/lessons/LessonSidebar.ts` — add a toggle button (e.g. list/grid icon) in the sidebar header that switches between the lesson view and a curriculum overview panel; the overview panel renders each module as a section with its lessons listed; completion state per lesson is read from `lessonProgressStorage`; completed → ✓ indicator; current → highlighted; not started → dimmed opacity (CSS class `.lesson-not-started`) but clickable; clicking any lesson calls `loadLesson()`
- [ ] T025 [US3] Ensure `manifest.json` drives the overview — `LessonSidebar` uses the loaded `LessonManifest` from `lessonLoader.loadManifest()` to build the overview (no hardcoded lesson list); manifest is loaded once on `LessonSidebar.open()` and cached; modules with no lessons in the current release still appear in the overview with a "Coming soon" placeholder
- [ ] T026 [US3] Run end-to-end curriculum navigation manually against quickstart.md Scenario 5 — verify all 5 modules visible, completion indicators correct, free navigation (no hard locks)

**Checkpoint**: US3 fully functional — users can browse and jump to any lesson.

---

## Phase 6: User Story 4 — Experiment Freely During a Lesson (Priority: P3)

**Goal**: Canvas remains fully interactive during lessons; extra patching does not break task validation.

**Independent Test**: Load a lesson → add extra components/connections not required by the task → complete the required task → task validates correctly. Dismiss highlight, patch freely, return to sidebar — lesson still active. See quickstart.md Scenario 8.

### Implementation for User Story 4

- [ ] T027 [US4] Verify task validation is additive in `src/lessons/LessonTaskValidator.ts` — `connect` task validation matches by component type and port ID, not by checking that ONLY the required connection exists; extra connections must not block completion; no code change expected if T012 is implemented correctly — task is to trace and confirm with a test case
- [ ] T028 [P] [US4] Add test in `tests/lessons/LessonTaskValidator.test.ts` — `connect` task completes even when additional `CONNECTION_ADDED` events for unrelated connections have fired first (extra patching does not interfere)
- [ ] T029 [US4] Verify sidebar stays open during free patching — `LessonSidebar` must not close or reset when `EventType.COMPONENT_ADDED`, `COMPONENT_MOVED`, or `CONNECTION_ADDED` (for non-task connections) fires; confirm no event listener in `LessonSidebar` inadvertently closes the panel
- [ ] T030 [US4] Run `vitest run tests/lessons/` — confirm all Phase 6 tests pass

**Checkpoint**: All four user stories independently functional.

---

## Phase 7: Module 1 Content

**Purpose**: Author the three Module 1 lesson JSON files and their patches.

- [ ] T031 [P] Create `public/lessons/manifest.json` — `LessonManifest` with 5 modules; Module 1 lists `['01-what-is-sound.json', '02-the-oscillator.json', '03-waveform-shapes.json']`; Modules 2–5 have empty `lessons: []` arrays and "Coming soon" in their titles
- [ ] T032 [P] Create `public/lessons/01-what-is-sound.json` — `LessonData`: id `lesson-01-what-is-sound`, moduleId `module-01`, index 1, title "What is Sound?", concept explains sine waves / frequency / amplitude in plain language (3–4 short paragraphs), `patchFile: '/lessons/patches/01-what-is-sound.json'`, `highlightComponentTypes: ['oscillator']`, task type `observe`, instruction "Listen to the sine wave. This is the purest form of sound — a single frequency."
- [ ] T033 [P] Create `public/lessons/patches/01-what-is-sound.json` — `PatchData` with: Oscillator (sine, 440 Hz) → Master Output; no Keyboard; component positions centred on canvas; patch name "Lesson 1 — What is Sound?"
- [ ] T034 [P] Create `public/lessons/02-the-oscillator.json` — `LessonData`: id `lesson-02-the-oscillator`, index 2, title "The Oscillator", concept explains oscillators as sound sources / frequency = pitch / the Keyboard sends pitch signals, `patchFile: '/lessons/patches/02-the-oscillator.json'`, `highlightComponentTypes: ['oscillator', 'keyboard-input']`, task type `connect`, instruction "Connect the Keyboard's frequency output to the Oscillator's frequency input.", `connect: { sourceComponentType: 'keyboard-input', targetComponentType: 'oscillator', targetPortId: 'frequency' }`
- [ ] T035 [P] Create `public/lessons/patches/02-the-oscillator.json` — `PatchData` with: Keyboard + Oscillator (sine) + Master Output; Oscillator → Master Output connected; Keyboard → Oscillator frequency connection intentionally MISSING (the user must make it); patch name "Lesson 2 — The Oscillator"
- [ ] T036 [P] Create `public/lessons/03-waveform-shapes.json` — `LessonData`: id `lesson-03-waveform-shapes`, index 3, title "Waveform Shapes", concept explains how waveform shape changes timbre / sine = pure / square = buzzy / sawtooth = bright / triangle = soft, `patchFile: '/lessons/patches/03-waveform-shapes.json'`, `highlightComponentTypes: ['oscillator']`, task type `set-parameter`, instruction "Change the Oscillator's waveform to Square and listen to how the sound changes.", `setParameter: { componentType: 'oscillator', parameterId: 'waveform', targetValue: 1, tolerance: 0 }` (waveform 1 = square per existing Oscillator waveform index)
- [ ] T037 [P] Create `public/lessons/patches/03-waveform-shapes.json` — `PatchData` with: Keyboard → Oscillator (sine) → Master Output; all connections present; patch name "Lesson 3 — Waveform Shapes"

**Checkpoint**: Module 1 is fully authored and ready to display in-app.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Integration quality, edge cases, and documentation.

- [ ] T038 [P] Handle lesson patch load failure gracefully in `src/lessons/LessonSidebar.ts` — if `lessonLoader.loadLessonPatch()` rejects, show an error notice in the sidebar ("Lesson patch couldn't load — you can still read the explanation") and leave the current canvas patch untouched; do not block the user from reading the lesson content
- [ ] T039 [P] Verify Reset Progress in `src/lessons/LessonSidebar.ts` — add a "Reset Progress" option in the sidebar footer or settings area; on click, show `window.confirm('Reset all lesson progress? This cannot be undone.')` — on confirm, call `lessonProgressStorage.clearProgress()`, reload the manifest, and navigate to Lesson 1
- [ ] T040 [P] Run full test suite `vitest run` — confirm zero regressions in existing Oscillator, LFO, and other component tests
- [ ] T041 [P] Run `npm run build` — confirm TypeScript compiles cleanly with no errors in `src/lessons/`
- [ ] T042 Update `CLAUDE.md` `## Recent Changes` section — add: `021-guided-lessons: Added TypeScript 5.6+, ES2020 target, strict mode + Web Audio API, DOM — zero new runtime dependencies`
- [ ] T043 Manual browser validation — follow all 8 scenarios in `specs/021-guided-lessons/quickstart.md` and confirm each passes; during validation manually verify SC-004 (sidebar + patch load < 1s) and SC-006 (task validation fires < 500ms)
- [ ] T044 [P] Create `tests/lessons/LessonSidebar.test.ts` — unit tests for `LessonSidebar` public API using a JSDOM environment; tests: `toggle()` opens a closed sidebar and closes an open one; `open()` applies visible CSS state; `close()` removes visible CSS state; `renderLesson()` inserts title, module/lesson number, and task instruction into the DOM; Next button is disabled when task type is `connect`/`set-parameter` and `taskComplete` is false; Next button is enabled when task type is `observe`/`free`; Back button is disabled on the first lesson; Back button is enabled on subsequent lessons (satisfies C1 — constitution requires public API test coverage)
- [ ] T045 [P] Keyboard navigation and ARIA in `src/lessons/LessonSidebar.ts` — (1) all interactive elements (Next, Back, curriculum toggle, Reset Progress, dismiss highlights) must be reachable via Tab and activatable via Enter/Space; (2) add `role="complementary"` and `aria-label="Guided Lessons"` to the sidebar container; (3) add `role="status"` and `aria-live="polite"` to the task-complete indicator so screen readers announce completion; (4) add `aria-label` to the dismiss-highlights button; (5) curriculum overview list items use `role="listitem"` with `aria-current="true"` on the active lesson; verify by tabbing through the sidebar in the browser during T043 (satisfies C2/C3 — WCAG 2.1 AA keyboard nav and ARIA constitution requirements)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — T001–T004 all independent, run in parallel.
- **Foundational (Phase 2)**: Depends on Phase 1 completion. T005 → T006 → T007/T008 (parallel) → T009/T010/T011 (parallel tests).
- **US1 (Phase 3)**: Depends on Phase 2. T012 → T013 (parallel test) → T014 → T015 → T016 → T017 → T018 → T019.
- **US2 (Phase 4)**: Depends on Phase 3. T020 → T021 → T022 → T023.
- **US3 (Phase 5)**: Depends on Phase 3 (needs `LessonSidebar` and manifest). T024 → T025 → T026.
- **US4 (Phase 6)**: Depends on Phase 3. T027 → T028 → T029 → T030.
- **Content (Phase 7)**: Depends on Phase 2 (LessonLoader must exist to validate JSON). All T031–T037 parallel.
- **Polish (Phase 8)**: Depends on all phases complete. T044 and T045 depend on Phase 3 (LessonSidebar must exist).

### User Story Dependencies

- **US1 (P1)**: Must complete first — LessonSidebar is the scaffolding all other stories extend.
- **US2 (P2)**: Depends on US1 (LessonSidebar structure must exist).
- **US3 (P2)**: Depends on US1 (LessonSidebar structure must exist). US2 and US3 are independent of each other.
- **US4 (P3)**: Depends on US1 (LessonTaskValidator must exist). Independent of US2 and US3.

### Within Phase 2 (Foundational)

```
T005 (copy types.ts)
  └─► T006 (copy validation.ts — imports types)
        ├─► T007 (LessonProgressStorage)  [parallel]
        └─► T008 (LessonLoader)           [parallel]
              ├─► T009 (storage tests)    [parallel]
              ├─► T010 (loader tests)     [parallel]
              └─► T011 (validation tests) [parallel]
```

### Within Phase 3 (US1)

```
T012 (LessonTaskValidator)
  └─► T013 (validator tests)  [parallel after T012]
T014 (LessonSidebar base UI)
  └─► T015 (loadLesson method)
        └─► T016 (Next/Back nav)
              └─► T017 (main.ts wiring)
                    └─► T018 (dismiss button)
                          └─► T019 (run tests)
```

---

## Parallel Opportunities

### Phase 1 (all parallel)
```
T001 || T002 || T003 (CSS) || T004 (HTML)
```

### Phase 2 (partial parallel)
```
T007 (LessonProgressStorage) || T008 (LessonLoader)   [after T006]
T009 || T010 || T011                                   [after T007/T008]
```

### Phase 7 (all parallel)
```
T031 || T032 || T033 || T034 || T035 || T036 || T037
```

### Phase 8 (partial parallel)
```
T038 || T039 || T040 || T041 || T042 || T044 || T045   [T043 last — requires all others]
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (T001–T004) — setup
2. Complete Phase 2 (T005–T011) — foundation + tests
3. Complete Phase 3 (T012–T019) — US1 implementation
4. Author one lesson for manual testing (T032–T033 only)
5. **STOP and VALIDATE**: Open browser, click Learn, verify Lesson 1 loads and task validates
6. Ship / demo if ready

### Incremental Delivery

1. Phases 1–2 → type system and storage proven
2. Phase 3 → lesson sidebar works end-to-end (MVP!)
3. Phase 4 → progress persists across sessions
4. Phase 5 → curriculum overview browsable
5. Phase 6 → free patching confirmed non-destructive
6. Phase 7 → Module 1 content complete
7. Phase 8 → full integration and browser validation

---

## Notes

- [P] tasks operate on different files or independent test cases — safe to run simultaneously
- Waveform index for Square is `1` — verify against `Oscillator.ts` waveform array before authoring T036
- `LessonSidebar` must NOT import from `src/canvas/` to avoid circular dependencies — use `document.querySelector` for DOM access
- `patchManager.loadPatchData()` vs `patchManager.loadPatch()` — check `PatchManager.ts` for the correct method to load a `PatchData` object directly (not from storage)
- Run tests with `vitest run` (not `npm test` — that starts watch mode)
