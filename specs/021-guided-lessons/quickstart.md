# Quickstart: Guided Lessons

**Feature**: `021-guided-lessons`
**Date**: 2026-05-02

This document describes the integration scenarios and manual validation steps for the Guided Lessons feature.

---

## Scenario 1 — Open Lesson Mode and complete Lesson 1

**Goal**: Verify the full P1 user story end-to-end.

1. Open the app. A "Learn" button appears in the top toolbar.
2. Click "Learn". The Lesson Sidebar slides in from the right showing Lesson 1: "What is Sound?".
   - Title, concept text, and task instruction are visible.
   - The canvas loads the `01-what-is-sound.json` patch (Oscillator → Master Output, playing).
   - The Oscillator component is visually highlighted with a glowing border.
3. Read the concept. The task instruction reads: **"Click the Oscillator's play button to start the sound."** (observe task — no auto-validation).
4. Click "Next". Lesson 2 loads.
   - Canvas patch replaced with `02-the-oscillator.json`.
   - Lesson 2 content appears in the sidebar.

**Pass**: Sidebar shows correct content, patch loads and plays, highlight appears, Next advances correctly.

---

## Scenario 2 — Complete a `connect` task

**Goal**: Verify auto-validation fires for connection tasks.

1. Navigate to Lesson 2: "The Oscillator" (Keyboard → Oscillator → Master Output patch, Keyboard and Oscillator are loaded but the Keyboard-to-Oscillator connection is intentionally missing).
2. The task instruction reads: **"Connect the Keyboard's frequency output to the Oscillator's frequency input."**
3. Draw the connection on the canvas.
4. The task immediately shows a ✓ success indicator in the sidebar.
5. The "Next" button becomes available (or advances automatically).

**Pass**: `CONNECTION_ADDED` event triggers validation; correct connection matches task spec; success indicator appears within 500ms.

---

## Scenario 3 — Complete a `set-parameter` task

**Goal**: Verify parameter change validation.

1. Navigate to Lesson 3: "Waveform Shapes".
2. The task instruction reads: **"Change the waveform to Square."**
3. Open the Oscillator's waveform dropdown and select Square.
4. Task marks complete immediately.

**Pass**: `PARAMETER_CHANGED` event triggers validation; parameter matches target value within tolerance; task completes on first reach.

---

## Scenario 4 — Progress persists across sessions

**Goal**: Verify `localStorage` persistence.

1. Complete Lessons 1 and 2.
2. Close the browser tab entirely.
3. Reopen the app and click "Learn".
4. The sidebar opens at Lesson 3 (the next uncompleted lesson).

**Pass**: `lesson-progress` key in `localStorage` contains `{ completedLessons: ['lesson-01-what-is-sound', 'lesson-02-the-oscillator'], currentLessonId: 'lesson-03-waveform-shapes', version: 1 }`.

---

## Scenario 5 — Browse the curriculum

**Goal**: Verify curriculum overview and free navigation.

1. Open Lesson Mode. Click the curriculum overview toggle (e.g. a list icon).
2. All 5 modules are visible. Module 1 shows 3 lessons. Completed lessons show a ✓. The current lesson is highlighted. Unstarted lessons are dimmed but clickable.
3. Click a lesson in Module 2 (unstarted). It loads directly without prompting.
4. Click Back to return to the previously active lesson.

**Pass**: All modules/lessons visible; completion indicators correct; free navigation works without hard locks.

---

## Scenario 6 — Unsaved changes prompt

**Goal**: Verify the "Your changes will be lost" guard.

1. Load a factory patch from the main patch browser.
2. Add a new component (marks the patch as dirty).
3. Click "Learn" and then navigate to Lesson 1.
4. A confirm dialog appears: "Your changes will be lost — continue?"
5. Click "Cancel". The lesson does not load; the existing patch remains.
6. Click "Learn" again, navigate to Lesson 1, and confirm. The lesson patch loads.

**Pass**: `patchManager.hasUnsavedChanges()` gates lesson navigation; confirm cancel aborts; confirm proceed loads lesson.

---

## Scenario 7 — Reset Progress

**Goal**: Verify full curriculum reset.

1. Complete Lessons 1 and 2.
2. Open the lesson settings/menu within Lesson Mode and click "Reset Progress".
3. Confirm the reset.
4. Lesson Mode returns to Lesson 1. The curriculum overview shows all lessons as "not started".
5. `localStorage` key `'lesson-progress'` is cleared to the default state.

**Pass**: All progress wiped; curriculum restarts from Lesson 1.

---

## Scenario 8 — Dismiss highlight overlay

**Goal**: Verify highlight is dismissable and lesson remains active.

1. Load any lesson. The relevant component(s) show a glowing highlight.
2. Click the dismiss button on the highlight overlay (or the component itself).
3. The highlight disappears. The lesson sidebar remains open and active.
4. Complete the task. Validation still fires correctly.

**Pass**: CSS class removed from components; task validation unaffected by highlight state.

---

## File Locations

| File | Purpose |
|---|---|
| `src/lessons/LessonLoader.ts` | Fetches manifest + lesson JSON from `public/lessons/` |
| `src/lessons/LessonProgressStorage.ts` | `localStorage` read/write for `LessonProgress` |
| `src/lessons/LessonTaskValidator.ts` | EventBus subscriber; detects task completion |
| `src/lessons/LessonSidebar.ts` | Full sidebar UI (lesson view + curriculum overview) |
| `public/lessons/manifest.json` | Module/lesson index |
| `public/lessons/01-what-is-sound.json` | Lesson 1 content |
| `public/lessons/02-the-oscillator.json` | Lesson 2 content |
| `public/lessons/03-waveform-shapes.json` | Lesson 3 content |
| `public/lessons/patches/*.json` | PatchData files for lesson patches |
| `index.html` | Add `btn-learn` button to `.top-bar` |
| `src/main.ts` | Wire `btn-learn` → `LessonSidebar.toggle()` |
| `src/styles/components.css` | Add `.lesson-highlight` CSS rule |
