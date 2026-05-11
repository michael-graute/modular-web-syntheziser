# Research: Guided Lessons

**Feature**: `021-guided-lessons`
**Date**: 2026-05-02

---

## Decision 1: Lesson Sidebar Architecture

**Decision**: Implement `LessonSidebar` as a new standalone class in `src/ui/`, mirroring the `HelpSidebar` pattern (programmatic DOM construction, fixed-right panel, slide-in transition).

**Rationale**: `HelpSidebar` already solves the same layout problem (fixed right panel, resizable, slide-in/out). Reusing the same structural pattern gives visual consistency with zero framework overhead. The two sidebars share the right-hand panel slot and are mutually exclusive — opening one closes the other.

**Alternatives considered**:
- Extending `HelpSidebar` with a tab system — rejected because lessons have significantly different state (progress, task validator, patch loading) that would bloat HelpSidebar.
- A full-screen modal overlay — rejected because it would hide the canvas entirely, defeating the "experiment alongside the lesson" design goal.

---

## Decision 2: Lesson Content Format — JSON files

**Decision**: Lesson content is stored as individual JSON files under `public/lessons/` (e.g. `public/lessons/01-what-is-sound.json`). A `LessonLoader` class (in `src/lessons/`) fetches them via `fetch()`, mirroring the existing `FactoryPatchLoader` pattern.

**Rationale**: Static JSON under `public/` is zero-config for the Vite build and Cloudflare Pages CDN. It keeps lesson content editable without touching TypeScript source. The `FactoryPatchLoader` already establishes this exact fetch-from-public pattern.

**Alternatives considered**:
- Markdown with YAML frontmatter — richer authoring UX but requires a markdown parser (new dependency, violates zero-runtime-deps constraint).
- Hardcoded TypeScript objects — violates FR-012 (content must be externalised) and makes content authoring a code change.

---

## Decision 3: Task Validation via EventBus

**Decision**: `LessonTaskValidator` subscribes to existing `EventType.CONNECTION_ADDED` and `EventType.PARAMETER_CHANGED` events from the global `eventBus` to detect `connect` and `set-parameter` task completion. No new event types are required for the initial release.

**Rationale**: `CONNECTION_ADDED` fires with a `ConnectionEvent` payload containing `sourceComponentId`, `targetComponentId`, and `targetPortId` — exactly the data needed to match a `connect` task. `PARAMETER_CHANGED` fires with `componentId`, `parameterId`, and `value` — sufficient for `set-parameter` tasks. Subscribing to existing events avoids any changes to the canvas or component layers.

**Alternatives considered**:
- Polling canvas state on a timer — fragile, burns CPU, not reactive.
- New dedicated `LESSON_TASK_PROGRESS` event — over-engineering for the initial release; can be added later if cross-component communication is needed.

---

## Decision 4: Progress Persistence — `localStorage` key

**Decision**: Lesson progress is stored under the key `'lesson-progress'` as a JSON-serialised `LessonProgress` object (`{ completedLessons: string[], currentLessonId: string | null }`). Reads/writes follow the same pattern as `PatchStorage`.

**Rationale**: Consistent with the existing `PatchStorage` pattern. No new abstraction needed — a thin `LessonProgressStorage` helper (≤30 lines) wraps `localStorage.getItem` / `setItem` with typed serialisation.

**Alternatives considered**:
- Storing progress in `PatchData` alongside the patch — would pollute the patch format and break the separation of concerns between patch content and learning state.
- IndexedDB — overkill for a small progress object; `localStorage` is sufficient.

---

## Decision 5: Component Highlighting — CSS class on CanvasComponent

**Decision**: `LessonOverlay` highlights components by adding a `.lesson-highlight` CSS class to the relevant `CanvasComponent` DOM elements. The class applies a glowing border via CSS box-shadow. A dismiss button removes the class from all components.

**Rationale**: `CanvasComponent` elements are standard DOM nodes accessible via `document.getElementById(componentId)`. Adding/removing a CSS class is the simplest, most reversible approach with zero impact on the audio or canvas rendering pipeline. No new `CanvasComponent` method is needed — `highlight()` as a method is unnecessary complexity.

**Alternatives considered**:
- Canvas overlay layer drawn on top of the WebGL/2D canvas — complex, requires knowing exact component positions, and fights with existing canvas rendering.
- A separate overlay `<div>` per highlighted component — more DOM nodes, harder to clean up, same visual result achievable with a simple CSS class.

---

## Decision 6: "Learn" Entry Point — Toolbar button alongside "Help"

**Decision**: Add a `btn-learn` button to the existing `.top-bar` in `index.html`, positioned next to the existing `btn-help` button. The button toggles `LessonSidebar` open/closed. Opening `LessonSidebar` closes `HelpSidebar` if open, and vice versa.

**Rationale**: The toolbar already has `btn-help` wired in `main.ts` via `document.getElementById('btn-help')`. Adding `btn-learn` follows the exact same pattern with no structural changes to the layout. Mutual exclusion between the two sidebars is handled in `main.ts` with two lines of toggle logic.

**Alternatives considered**:
- A tab inside HelpSidebar — mixes two distinct concerns (reference docs vs. guided learning) in one component; lesson state management would leak into HelpSidebar.
- A separate full-screen "Lesson Mode" that hides the toolbar — would disrupt free patching and require a mode-switch architecture.

---

## Decision 7: Unsaved Changes — Delegate to existing `patchManager.hasUnsavedChanges()`

**Decision**: Before loading a lesson patch, `LessonSidebar` calls `patchManager.hasUnsavedChanges()`. If true, it shows a native `confirm()` dialog: "Your changes will be lost — continue?". If the user cancels, lesson navigation is aborted. If confirmed, `patchManager.loadPatchData()` is called with the lesson patch.

**Rationale**: `PatchManager` already exposes `hasUnsavedChanges()` (line 48) and uses `window.confirm()` internally for the same scenario in `newPatch()` and `loadPatch()`. Reusing this approach is consistent with the existing UX pattern at zero added complexity.

**Alternatives considered**:
- A custom modal dialog — consistent with the app's `Modal` class but adds async complexity to what should be a simple guard. Acceptable future improvement.

---

## Decision 8: Module 1 Lesson Patches

**Decision**: Three lesson patches will be authored for Module 1:
- `public/lessons/patches/01-what-is-sound.json` — single Oscillator (sine) → Master Output; no keyboard
- `public/lessons/patches/02-the-oscillator.json` — Keyboard → Oscillator → Master Output
- `public/lessons/patches/03-waveform-shapes.json` — Keyboard → Oscillator → Master Output (same patch, task is to change waveform)

**Rationale**: Simplest possible patches that isolate the concept of each lesson. Lesson 1 avoids the keyboard to remove the "press a key" mental model; lessons 2–3 introduce it naturally.

---

## No Changes Required

- `PatchSerializer`, `PatchData`, `ConnectionManager`, `SynthComponent` — no modifications needed.
- `EventBus` — no new event types needed for the initial release.
- `CanvasComponent` — no new methods; CSS class injection is sufficient for highlighting.
