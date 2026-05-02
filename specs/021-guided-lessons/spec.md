# Feature Specification: Guided Lessons

**Feature Branch**: `021-guided-lessons`
**Created**: 2026-05-02
**Status**: Draft
**Input**: `docs/research/guided-lessons-feature.md`

## Overview

A structured, in-app learning mode that guides users with no prior audio synthesis knowledge through the fundamentals of synthesis. Users progress through a curriculum of short lessons delivered via a lesson sidebar alongside the live synthesizer canvas. Each lesson loads a prepared patch, explains a concept, and invites the user to complete a hands-on task — with the free-patching canvas always accessible for experimentation.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Follow a Guided Lesson (Priority: P1)

A first-time user opens the app and wants to understand what an oscillator is. They enter Lesson Mode, start the first lesson, read the explanation, listen to the pre-loaded patch playing, and complete the task (e.g. change the waveform). The sidebar advances to the next lesson.

**Why this priority**: This is the entire value proposition. Without a single working lesson the feature does not exist.

**Independent Test**: Open the app, enter Lesson Mode, load Lesson 1, read the explanation, complete the task, and verify the sidebar advances to Lesson 2.

**Acceptance Scenarios**:

1. **Given** the user has never used the app, **When** they click "Learn" in the toolbar, **Then** the Lesson Sidebar opens showing Lesson 1 with a title, concept explanation, and task instruction.
2. **Given** the Lesson Sidebar is open, **When** a lesson is loaded, **Then** the corresponding factory patch is automatically loaded onto the canvas and relevant components are visually highlighted.
3. **Given** a lesson is active with a task of type "connect", **When** the user makes the required connection, **Then** the task is marked complete and a success indicator appears.
4. **Given** a task is complete, **When** the user clicks "Next", **Then** the next lesson loads with its patch and explanation.
5. **Given** a lesson with a task of type "observe" or "free", **When** the user clicks "Next", **Then** no validation is required and the lesson advances immediately.

---

### User Story 2 — Track and Resume Progress (Priority: P2)

A user completes three lessons over two sessions. When they return to the app, Lesson Mode remembers where they left off and they resume from Lesson 4 without losing their progress.

**Why this priority**: Without persistence, every visit restarts from Lesson 1 — the learning journey is lost and motivation collapses.

**Independent Test**: Complete two lessons, close the browser, reopen, enter Lesson Mode — verify the sidebar opens at Lesson 3 (the next uncompleted lesson).

**Acceptance Scenarios**:

1. **Given** a user has completed lessons 1 and 2, **When** they close and reopen the browser, **Then** Lesson Mode opens at lesson 3.
2. **Given** a user is mid-lesson and closes the browser, **When** they reopen, **Then** they are returned to the start of the lesson they were on.
3. **Given** a completed lesson, **When** the user navigates back to it via the lesson list, **Then** it re-opens and can be replayed.
4. **Given** the user wants to restart entirely, **When** they use the "Reset Progress" option, **Then** all progress is cleared and the curriculum restarts from Lesson 1.

---

### User Story 3 — Browse the Curriculum (Priority: P2)

A user already familiar with oscillators wants to skip to the filter lessons. They open the lesson list, see all modules and lessons with completion status, and jump directly to Module 3.

**Why this priority**: Linear-only navigation frustrates users who already have partial knowledge. Browsing ensures the tool is useful to intermediate learners too.

**Independent Test**: Open Lesson Mode, open the lesson list view, click on a lesson in Module 3 — verify it loads directly without requiring completion of earlier lessons.

**Acceptance Scenarios**:

1. **Given** Lesson Mode is open, **When** the user opens the curriculum overview, **Then** all 5 modules and their lessons are visible with completion indicators (completed / current / locked).
2. **Given** the curriculum overview is open, **When** the user clicks any previously completed lesson, **Then** that lesson loads immediately.
3. **Given** the curriculum overview is open, **When** the user clicks a not-yet-reached lesson, **Then** they can still enter it (lessons are not hard-locked; the curriculum is a guide, not a gate).

---

### User Story 4 — Experiment Freely During a Lesson (Priority: P3)

A user is on the "What is a filter?" lesson and wants to connect extra components not mentioned in the lesson. They click away from the sidebar, patch freely on the canvas, and then return to the lesson sidebar to complete the task.

**Why this priority**: Restricting the canvas during lessons would undermine the exploratory spirit of the app. Freedom to experiment is a core design value.

**Independent Test**: Load a lesson, add components and connections not required by the task, then complete the required task — verify the lesson validates successfully despite the extra patching.

**Acceptance Scenarios**:

1. **Given** a lesson is active, **When** the user interacts with the canvas outside the task requirements, **Then** the lesson sidebar remains open and the task state is unaffected.
2. **Given** the user has made extra connections, **When** they complete the lesson task, **Then** validation succeeds regardless of the extra patch state.
3. **Given** the user dismisses the component highlight overlay, **When** they return to the lesson sidebar, **Then** the lesson is still active and the task can still be completed.

---

### Edge Cases

- What happens if a lesson patch fails to load? → The lesson loads with an empty canvas and an error notice; the user can still read the explanation.
- What happens if the user deletes a highlighted component during a lesson? → The highlight disappears; the lesson remains active; the task can still be completed if the user adds the component back.
- What happens if localStorage is unavailable (private browsing)? → Progress is stored in memory for the session; a notice informs the user that progress will not persist.
- What happens on very small screens where the sidebar and canvas overlap? → The sidebar overlays the canvas; a collapse toggle allows the user to hide the sidebar while patching.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST provide a "Learn" entry point in the main toolbar that opens Lesson Mode.
- **FR-002**: Lesson Mode MUST display a sidebar showing: lesson title, module and lesson number, concept explanation (plain-language markdown), task instruction, and Next/Back navigation.
- **FR-003**: Opening a lesson MUST automatically load the lesson's associated patch onto the canvas, replacing any current patch (with a confirmation prompt if the current patch has unsaved changes).
- **FR-004**: Opening a lesson MUST highlight the lesson's relevant components on the canvas with a visual indicator; the indicator MUST be dismissable.
- **FR-005**: The system MUST support four task types: `connect` (make a specific cable connection), `set-parameter` (change a parameter to a target value within a tolerance), `observe` (no validation required, advance manually), and `free` (no constraint, advance manually).
- **FR-006**: For `connect` tasks, the system MUST detect when the required connection is made and automatically mark the task complete.
- **FR-007**: For `set-parameter` tasks, the system MUST detect when a parameter reaches the target value (within the specified tolerance) and mark the task complete.
- **FR-008**: Lesson progress MUST persist across browser sessions using local storage.
- **FR-009**: Users MUST be able to navigate to any lesson in the curriculum regardless of completion status (no hard locks).
- **FR-010**: Users MUST be able to reset their progress from within Lesson Mode.
- **FR-011**: The curriculum MUST contain at least 15 lessons across 5 modules (as defined in the curriculum outline).
- **FR-012**: Lesson content (title, explanation, task) MUST be authored in external JSON files under `public/lessons/` — not hardcoded in source.
- **FR-013**: The lesson sidebar MUST remain open and functional while the user interacts freely with the canvas.
- **FR-014**: The system MUST display a curriculum overview showing all modules, lessons, and per-lesson completion status.

### Key Entities

- **Lesson**: A single learning unit with an ID, module number, index, title, concept explanation (markdown), associated patch file path, components to highlight, and a task definition.
- **LessonTask**: Defines what the user must do — type (`connect` / `set-parameter` / `observe` / `free`), instruction text, and type-specific validation parameters (source/target component types and port IDs for connections; component type, parameter ID, target value and tolerance for parameter tasks).
- **LessonProgress**: Tracks the user's completed lesson IDs and their current lesson ID; persisted to local storage.
- **Module**: A named grouping of related lessons with a sequence number and title.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with no prior synthesis knowledge can complete Module 1 (3 lessons) in under 15 minutes.
- **SC-002**: 90% of users who start a lesson successfully complete its task without external help.
- **SC-003**: Lesson progress is restored correctly on return visits in 100% of cases where local storage is available.
- **SC-004**: The lesson sidebar opens and a patch loads within 1 second of clicking "Next" or selecting a lesson.
- **SC-005**: All 15 lessons are accessible and completable on both desktop and tablet screen sizes.
- **SC-006**: Task validation fires within 500ms of the user completing the required action.

---

## Assumptions

- English is the only language for the initial release; lesson content strings are externalised to JSON to enable future localisation.
- Lessons are not hard-locked — the curriculum is a recommended path, not a gate. Any user can access any lesson at any time.
- Audio examples within lessons rely entirely on the live synthesizer canvas; no pre-recorded audio clips are required for the initial release.
- The "Learn" button is added to the existing top toolbar alongside the patch and help controls.
- Lesson patches are stored separately from factory patches under `public/lessons/` and are not listed in the main patch browser.
- The lesson sidebar shares the right-hand panel slot with the Help sidebar; a tab or toggle switches between them.
- Progress reset is a manual action in a settings/menu within Lesson Mode — not triggered accidentally.
