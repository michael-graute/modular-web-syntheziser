# Feature Specification: Learn Mode — Beginner Sound Synthesis & Music Theory Platform

**Feature Branch**: `014-learn-platform`  
**Created**: 2026-04-17  
**Status**: Draft  

## Overview

A dedicated learning mode accessible at `/learn` that guides complete beginners through sound synthesis and music theory via a structured, linear course. Each lesson presents a purposefully constrained interactive patch — hiding the full studio complexity — alongside step-by-step explanations. Students graduate to the full Studio at `/` once they have built foundational understanding.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Navigate to Learn Mode and start the course (Priority: P1)

A brand-new user visits the app for the first time, sees a clear entry point to the learning platform, navigates to `/learn`, and begins Lesson 1 without any prior knowledge of synthesis or the studio interface.

**Why this priority**: Without this story nothing else in Learn mode is reachable. It is the entry point for every other user journey.

**Independent Test**: Open the app at `/`, follow the path to `/learn`, and confirm Lesson 1 loads and is interactive without any studio canvas visible.

**Acceptance Scenarios**:

1. **Given** the user is on the studio home page at `/`, **When** they click the "Learn" navigation entry, **Then** the browser navigates to `/learn` and Lesson 1 of Unit 1 is displayed.
2. **Given** the user navigates directly to `/learn`, **When** they have no saved progress, **Then** Lesson 1 is loaded automatically.
3. **Given** the user navigates directly to `/learn`, **When** they have saved progress, **Then** the course resumes at their last completed lesson.
4. **Given** the user is on `/learn`, **When** the page loads, **Then** the full studio canvas is not visible anywhere on the page.

---

### User Story 2 — Work through a lesson step by step (Priority: P1)

A beginner reads the lesson explanation, interacts with the constrained patch controls exposed for that lesson, and advances to the next step or lesson via clearly labelled navigation.

**Why this priority**: This is the core learning interaction. All other stories depend on this working correctly.

**Independent Test**: Load any single lesson definition and verify the explanation renders, exposed controls respond, and the Next button advances the learner.

**Acceptance Scenarios**:

1. **Given** Lesson 1 is loaded, **When** the learner adjusts the frequency slider, **Then** the audible pitch changes in real time and the oscilloscope waveform updates.
2. **Given** a lesson is loaded, **When** controls not exposed by that lesson exist in the underlying patch, **Then** those controls are not visible or interactable.
3. **Given** the learner is on a lesson step, **When** they click "Next", **Then** the next step or lesson loads and the explanation panel updates accordingly.
4. **Given** the learner is on the first step of a lesson, **When** the page loads, **Then** a "Back" button is visible but navigates to the previous lesson (or is disabled on Lesson 1).
5. **Given** the learner is on the last lesson, **When** they complete it, **Then** a completion screen is shown with an invitation to open the Studio.

---

### User Story 3 — See real-time audio visualisation on every lesson (Priority: P2)

The oscilloscope is always visible during every lesson so the learner can connect parameter changes to a visual representation of the waveform.

**Why this priority**: Immediate visual feedback is central to the pedagogical approach. It is needed on every lesson but is not a blocker for navigation or lesson delivery.

**Independent Test**: Load any lesson and confirm the oscilloscope panel is present and updates as the learner adjusts exposed controls.

**Acceptance Scenarios**:

1. **Given** any lesson is loaded, **When** the lesson view renders, **Then** an oscilloscope display is visible without the learner needing to scroll.
2. **Given** the learner adjusts a frequency or waveform control, **When** the change is applied, **Then** the oscilloscope waveform updates within one display frame.
3. **Given** no audio is playing, **When** the oscilloscope is visible, **Then** it shows a flat line rather than noise or a stale waveform.

---

### User Story 4 — Progress is saved automatically (Priority: P2)

When a learner closes the browser or navigates away and later returns, their completed lessons are remembered and the course resumes where they left off.

**Why this priority**: Without persistence, learners must restart from Lesson 1 on every visit, which is a significant usability failure for a multi-session course.

**Independent Test**: Complete two lessons, close the tab, reopen `/learn`, and confirm the course resumes on lesson 3.

**Acceptance Scenarios**:

1. **Given** a learner completes a lesson and clicks "Next", **When** they close and reopen the browser, **Then** the course reopens at the first incomplete lesson.
2. **Given** a learner has completed all lessons, **When** they return to `/learn`, **Then** the completion screen is shown with an option to restart or open the Studio.
3. **Given** a learner clears their browser storage, **When** they visit `/learn`, **Then** the course starts from Lesson 1 with no errors.

---

### User Story 5 — Unit 4: interact with a pre-wired patch and cable system (Priority: P3)

In Unit 4, the learner sees a pre-wired cable connection for the first time, can disconnect it, reconnect it, and observe the difference — learning what patch cables mean without building from scratch.

**Why this priority**: Routing/patching is unique to Unit 4. It depends on stories 1 and 2 working and is scoped to a single lesson.

**Independent Test**: Load the Unit 4 lesson definition and confirm a cable is rendered, can be disconnected, and reconnected, with audible result changing accordingly.

**Acceptance Scenarios**:

1. **Given** Unit 4 is loaded, **When** the lesson view renders, **Then** at least one pre-wired cable connection is visible between two components.
2. **Given** the cable is visible, **When** the learner disconnects it, **Then** the audio output changes to reflect the broken signal path.
3. **Given** the cable is disconnected, **When** the learner reconnects it, **Then** the audio output is restored.

---

### Edge Cases

- What happens if a lesson definition file is missing or malformed? The learner should see a friendly error message, not a blank screen or JavaScript exception.
- What happens if the Web Audio API is unavailable (e.g., blocked by browser policy)? The lesson should load with a clear message that audio is unavailable and controls are disabled.
- What happens if a learner navigates directly to a deep lesson URL (e.g., `/learn/unit-4`) without prior progress? The lesson loads normally; progress is not gated.
- What happens on a very small screen (mobile portrait)? The oscilloscope and explanation panel must both remain accessible without horizontal scrolling.
- What happens if localStorage is full or blocked? Progress silently fails to save; no error is surfaced to the learner (graceful degradation).

---

## Requirements *(mandatory)*

### Functional Requirements

**Routing & Navigation**

- **FR-001**: The application MUST expose a `/learn` route that renders the Learn mode UI independently of the Studio canvas.
- **FR-002**: The Studio at `/` MUST display a clearly labelled link to `/learn`.
- **FR-003**: Learn mode MUST display a clearly labelled link back to the Studio at `/`.
- **FR-004**: The URL MUST reflect the current lesson so learners can bookmark or share a specific lesson directly.

**Lesson Player**

- **FR-005**: Learn mode MUST include a lesson player that accepts a lesson definition and renders the corresponding constrained patch view and explanation.
- **FR-006**: The lesson player MUST display only the components and controls declared as visible in the lesson definition; all other studio components MUST be hidden.
- **FR-007**: The lesson player MUST display an explanation panel with the lesson title, body text, and step counter.
- **FR-008**: The lesson player MUST provide "Next" and "Back" navigation controls between lessons.
- **FR-009**: The oscilloscope MUST be visible on every lesson without the learner needing to scroll or toggle it.
- **FR-010**: The lesson player MUST render a completion screen after the final lesson with an invitation to open the Studio.

**Lesson Definitions**

- **FR-011**: Each lesson MUST be defined as a standalone data structure (not embedded logic) declaring: lesson title, explanation text per step, visible components, exposed interactive controls, pre-wired connections (if any), and an optional success condition.
- **FR-012**: The system MUST ship with at least 6 lesson definitions covering the planned arc (Units 1–6).
- **FR-013**: Lesson definitions MUST be addable without modifying the lesson player component.

**Audio Interaction**

- **FR-014**: All audio controls exposed in a lesson MUST respond in real time with no perceptible lag.
- **FR-015**: The oscilloscope display MUST update in real time as the learner adjusts exposed controls.

**Progress Tracking**

- **FR-016**: The system MUST automatically save lesson completion state to browser-local storage after each lesson is advanced past.
- **FR-017**: On returning to `/learn`, the system MUST resume at the first incomplete lesson.
- **FR-018**: The system MUST allow the learner to restart the course, clearing saved progress.
- **FR-019**: Progress storage MUST degrade gracefully if local storage is unavailable; the learner can still use the course without errors.

### Key Entities

- **Lesson**: A single instructional unit. Attributes: id, unit number, title, ordered steps (each with explanation text), visible component list, exposed control list, pre-wired connection list, optional success condition.
- **Step**: One screen within a lesson. Attributes: step index, explanation text, any step-specific control overrides.
- **LearnerProgress**: Persisted record of completed lesson ids and the id of the current lesson.
- **LessonPlayerState**: Runtime state of the player — current lesson, current step, audio context status.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with no prior synthesis knowledge can complete Unit 1 (Lesson 1) within 5 minutes of landing on `/learn` for the first time.
- **SC-002**: Every exposed control in a lesson produces an audible and visible oscilloscope change within one second of interaction.
- **SC-003**: Lesson progress survives a full browser close and reopen with 100% fidelity.
- **SC-004**: The lesson player loads and renders any valid lesson definition in under 2 seconds on a standard broadband connection.
- **SC-005**: The full course (all 6 units) is completable end-to-end without encountering any error screen or broken interaction.
- **SC-006**: On a viewport of 375 × 667 px (iPhone SE), the oscilloscope and explanation panel are both fully visible without horizontal scrolling on any lesson.
- **SC-007**: Adding a new lesson definition requires changes to no files other than the lesson data directory.

---

## Assumptions

- The existing `OscilloscopeDisplay` component can be embedded in the learn-mode layout without modification; if it requires its own canvas context, a thin adapter may be needed (confirmed during planning).
- Lesson navigation is not gated — learners can jump to any lesson freely; no prerequisite lock is implemented in this version.
- Audio playback starts when the learner first interacts with a control (browser autoplay policy); a prompt to "click to enable audio" is shown until interaction occurs.
- Mobile support targets portrait phone viewports (≥ 375 px wide); landscape and tablet layouts are a bonus, not a requirement.
- No user accounts or server-side persistence; everything lives in the browser.
- The six lesson definitions are authored as TypeScript constant objects co-located in a lessons data directory; no external CMS or database is involved.
