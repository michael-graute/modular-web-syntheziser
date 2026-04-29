# Tasks: Global Transport Controller (016)

**Input**: Design documents from `specs/016-global-transport/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Exact file paths are included in all descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extend the EventBus type system with transport events — prerequisite for all user stories.

- [X] T001 Add `TRANSPORT_PLAY`, `TRANSPORT_STOP`, `TRANSPORT_BEAT` to `EventType` enum in `src/core/types.ts`
- [X] T002 Add `TransportBeatPayload` payload type to `src/core/types.ts` (import from contracts or inline: `{ bar: number; beat: number }`)

**Checkpoint**: EventBus can now carry transport events. All stories may proceed.

---

## Phase 2: Foundational (GlobalTransportController)

**Purpose**: The singleton controller that all transport-aware components depend on.

**⚠️ CRITICAL**: User stories 1–3 and both integration phases depend on this phase.

- [X] T003 Create `src/core/GlobalTransportController.ts` — class with private `_state: TransportState`, `_position: TransportPosition`, `_nextBeatTime: number`, `_timeoutId: ReturnType<typeof setTimeout> | null`
- [X] T004 Implement `play()` in `GlobalTransportController` — guard no-op if PLAYING, set state to PLAYING, reset position to `{bar:1, beat:1}`, emit `TRANSPORT_PLAY`, read current BPM from `globalBpmController.getBpm()` to initialise `_nextBeatTime`, start scheduler
- [X] T005 Implement `stop()` in `GlobalTransportController` — guard no-op if STOPPED, clear timeout, set state to STOPPED, reset position, emit `TRANSPORT_STOP`
- [X] T006 Implement `_scheduleTick()` private method in `GlobalTransportController` — lookahead scheduler using `audioEngine.context.currentTime` (same pattern as `GlobalBpmController`); schedules next `setTimeout` with `TRANSPORT_LOOKAHEAD_MS` window; increments position and emits `TRANSPORT_BEAT` on each tick
- [X] T007 Implement `_onBpmChange()` handler in `GlobalTransportController` — subscribes to existing `BPM_CHANGED` event; resets `_nextBeatTime` from current `AudioContext.currentTime` so BPM changes take effect within one beat period (FR-009)
- [X] T008 Export singleton `export const globalTransportController = new GlobalTransportController()` at bottom of `src/core/GlobalTransportController.ts`
- [X] T009 [P] Create state machine unit tests in `tests/core/GlobalTransportController.test.ts` — initial state STOPPED, play() → PLAYING, stop() → STOPPED, play() no-op while PLAYING, stop() no-op while STOPPED, position resets on stop; use `beforeEach(() => globalTransportController.stop())` to reset singleton state between tests

**Checkpoint**: Controller exists, is testable. UI and integrations can now be built.

---

## Phase 3: User Story 1 — Play / Stop Transport (Priority: P1) 🎯 MVP

**Goal**: Single ▶/■ toggle button in the controls bar that broadcasts start/stop to all transport-aware components.

**Independent Test**: Open app, click ▶, confirm button shows ■ and transport state is PLAYING. Click ■, confirm button returns to ▶.

### Implementation

- [X] T010 [US1] Create `src/ui/GlobalTransportControl.ts` — constructs a container `<div>` with a toggle `<button>` (▶ text, `aria-label="Play transport"`) and a `<span>` initialised to `"1.1"` for position display; mirrors `GlobalBpmControl` DOM construction pattern
- [X] T011 [US1] Implement click handler in `GlobalTransportControl` — calls `globalTransportController.play()` when stopped, `globalTransportController.stop()` when playing; updates button text synchronously (▶ ↔ ■)
- [X] T012 [US1] Subscribe to `TRANSPORT_PLAY` and `TRANSPORT_STOP` in `GlobalTransportControl` to keep button text in sync if transport state changes programmatically
- [X] T013 [US1] Wire `GlobalTransportControl` into `src/main.ts` — instantiate and `insertAdjacentElement('beforebegin', ...)` on the `#global-bpm-control` element so the transport button appears immediately to its left in the top bar
- [X] T014 [P] [US1] Write `tests/ui/GlobalTransportControl.test.ts` — button renders with ▶ text; click calls `play()`; button changes to ■; click again calls `stop()`; button returns to ▶

**Checkpoint**: User Story 1 fully functional. ▶/■ toggle visible and working. Transport state broadcasts via EventBus.

---

## Phase 4: User Story 2 — Beat Clock & Position Display (Priority: P2)

**Goal**: Bar/beat counter in the controls bar updates in real time while transport plays; resets on Stop. Beat events are emitted for future subscribers.

**Independent Test**: Start transport at 120 BPM, observe "1.1" → "1.2" → "1.3" → "1.4" → "2.1" progression at ~500 ms intervals. Stop transport, confirm display resets to "1.1".

### Implementation

- [X] T015 [US2] Subscribe to `TRANSPORT_BEAT` in `GlobalTransportControl` — update the position `<span>` text to `"${bar}.${beat}"` on every tick
- [X] T016 [US2] Subscribe to `TRANSPORT_STOP` in `GlobalTransportControl` to reset position `<span>` to `"1.1"` when transport stops
- [X] T017 [P] [US2] Write beat-clock tests in `tests/core/GlobalTransportController.test.ts` — use `vi.useFakeTimers()`; verify `TRANSPORT_BEAT` fires at correct intervals for 120 BPM; verify position advances bar 1 beat 1 → 1.2 → … → 2.1; verify position resets on `stop()`

**Checkpoint**: User Story 2 fully functional. Position display live and accurate.

---

## Phase 5: User Story 3 — BPM Change While Playing (Priority: P3)

**Goal**: Changing BPM while transport is running adjusts the beat interval immediately without restarting the transport.

**Independent Test**: Start transport at 120 BPM, change to 60 BPM, observe beat interval doubles without stop/restart.

### Implementation

- [X] T018 [US3] Verify `_onBpmChange()` in `GlobalTransportController` re-anchors `_nextBeatTime` from `AudioContext.currentTime` on BPM change — no restart, no missed beat
- [X] T019 [P] [US3] Write BPM-change tests in `tests/core/GlobalTransportController.test.ts` — fake timers; change BPM mid-play; verify next beat fires at new interval; transport remains PLAYING; position not reset

**Checkpoint**: User Story 3 fully functional. BPM changes take effect live.

---

## Phase 6: Step Sequencer Transport Integration

**Purpose**: Step Sequencer starts/stops with the global transport.

- [X] T020 [P] Modify `src/components/utilities/StepSequencer.ts` — subscribe to `TRANSPORT_PLAY` → call `this.start()` (guard: no-op if already playing); subscribe to `TRANSPORT_STOP` → call `this.stop()`; add subscriptions in `createAudioNodes()` alongside existing BPM subscription; store unsubscribe callbacks and call them in `destroyAudioNodes()` / `deactivate()` (FR-012) ✅
- [X] T021 [P] Write `tests/components/StepSequencer.transport.test.ts` — mock EventBus; emit `TRANSPORT_PLAY` → verify `start()` called; emit `TRANSPORT_STOP` → verify `stop()` called; emit `TRANSPORT_PLAY` while already playing → verify no double-start ✅

**Checkpoint**: Step Sequencer starts/stops with transport.

---

## Phase 7: Looper Transport Integration

**Purpose**: Looper halts on transport stop; resumes on transport play if a loop is recorded.

- [X] T022 Implement `_resumePlayback()` private method in `src/components/utilities/Looper.ts` — calls `_startPlayback()` without modifying `_filled` flag or triggering recording; transitions state from IDLE → PLAYING without touching the buffer ✅
- [X] T023 [P] Modify `src/components/utilities/Looper.ts` — subscribe to `TRANSPORT_STOP` → call `this.pressStop()` (halts playback, preserves buffer); subscribe to `TRANSPORT_PLAY` → if `this._filled` call `this._resumePlayback()`, else no-op; add subscriptions in `createAudioNodes()`; store unsubscribe callbacks and call them in `destroyAudioNodes()` / `deactivate()` (FR-012) ✅
- [X] T024 [P] Write `tests/components/Looper.transport.test.ts` — mock EventBus; emit `TRANSPORT_STOP` while looper is PLAYING → verify state goes to IDLE, buffer preserved; emit `TRANSPORT_PLAY` with `_filled=true` → verify `_resumePlayback()` called; emit `TRANSPORT_PLAY` with `_filled=false` → verify looper stays IDLE ✅

**Checkpoint**: Looper integrates cleanly with transport. FR-008 fully satisfied.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Type-check, test suite green, manual verification.

- [X] T025 Run `npx tsc --noEmit` and fix any TypeScript errors in new/modified files (`src/core/GlobalTransportController.ts`, `src/ui/GlobalTransportControl.ts`, `src/core/types.ts`, `src/components/utilities/StepSequencer.ts`, `src/components/utilities/Looper.ts`, `src/main.ts`) ✅ (0 errors)
- [X] T026 Run `vitest run` — ensure all new and existing tests pass; zero regressions ✅ (600/600 tests, 33 files)
- [X] T027 Manual smoke test per `specs/016-global-transport/quickstart.md` steps 1–8: play/stop, Step Sequencer integration, Looper with/without loop, BPM change while playing, multi-component, idempotent press, regression check
- [X] T028 Document late-subscription contract in `src/core/GlobalTransportController.ts` JSDoc: callers that subscribe after transport is already playing MUST call `globalTransportController.getState()` and `getPosition()` on subscribe to self-initialise — no automatic state replay on subscription (resolves spec edge case 3) ✅

---

## Dependencies

```
T001, T002 (EventType additions)
  └─▶ T003–T009 (GlobalTransportController + contract tests)
        └─▶ T010–T014 (US1: UI widget + main.ts)
        └─▶ T015–T017 (US2: beat display + tests)
        └─▶ T018–T019 (US3: BPM change)
        └─▶ T020–T021 (StepSequencer integration)
        └─▶ T022–T024 (Looper integration)
              └─▶ T025–T028 (Polish)
```

## Parallel Execution Opportunities

| Parallel Group | Tasks | Prerequisite |
|----------------|-------|--------------|
| After T002 | T009 (contract tests) | T003–T008 exist |
| After T009 | T010–T014, T015–T017, T018–T019, T020–T021 | T008 (singleton) |
| After T022 | T023, T024 | T022 (_resumePlayback exists) |

## Implementation Strategy

**MVP (must-ship)**: T001–T014 — transport controller + toggle button. Gives coordinated play/stop with no beat display or component integration.

**Increment 1**: T015–T017 — beat display. Adds live position feedback.

**Increment 2**: T020–T024 — component integrations. Connects StepSequencer and Looper.

**Increment 3**: T018–T019 — BPM-change live adaptation.

**Finish**: T025–T028 — type-check, full test suite, manual smoke test, late-subscription contract docs.
