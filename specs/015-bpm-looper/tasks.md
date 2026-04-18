# Tasks: BPM-Synced Looper

**Input**: Design documents from `/specs/015-bpm-looper/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Included — validation helpers and state machine require 100% coverage per the constitution.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths are included in all task descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new directories are required — all changes extend existing files or follow established `src/` patterns. This phase documents the one-time review needed before work begins.

- [ ] T001 Review src/components/base/SynthComponent.ts, src/canvas/displays/ColliderDisplay.ts, src/keyboard/KeyboardController.ts, src/core/types.ts, and src/patch/PatchSerializer.ts to confirm current API surface before editing

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core type extensions and contracts that ALL user stories depend on.

**⚠️ CRITICAL**: No user story implementation can begin until T002–T006 are complete.

- [ ] T002 Add `LOOPER = 'looper'` to the `ComponentType` enum in src/core/types.ts
- [ ] T003 Add optional `audioBlob?: string` field to the `ComponentData` interface in src/core/types.ts — backward-compatible (no existing code sets it)
- [ ] T004 [P] Write unit tests for all validation helpers in tests/contracts/looper-validation.test.ts covering every function in specs/015-bpm-looper/contracts/validation.ts: `isValidBarCount`, `validateBarCount`, `validateBpm`, `isValidLooperState`, `stateIndexToLooperState`, `looperStateToIndex`, `validateLooperSerializedParams`, `isValidBase64`, `validateAudioBlob`, `validateLoopDuration`, `isValidStateTransition` (100% coverage required)
- [ ] T005 [P] Write unit tests for pure helper functions in tests/contracts/looper-types.test.ts covering `computeLoopDurationSeconds`, `computeLoopDurationSamples`, `normalizePlayHead`, and `playHeadToAngle` from specs/015-bpm-looper/contracts/types.ts (100% coverage required)
- [ ] T006 Add `LOOPER_SHORTCUT_RECORD`, `LOOPER_SHORTCUT_STOP`, `LOOPER_SHORTCUT_CLEAR`, `LOOPER_RESERVED_KEYS`, and `LOOPER_STATE_COLORS` constants from specs/015-bpm-looper/contracts/types.ts into a new production file src/components/utilities/LooperConstants.ts — these constants are shared between Looper.ts, LooperDisplay.ts, and KeyboardController.ts

**Checkpoint**: Types and constants in place — user story implementation can begin.

---

## Phase 3: User Story 1 - Record and Loop Audio (Priority: P1) 🎯 MVP

**Goal**: Record audio input into a buffer, loop it seamlessly, and display a green rotating playhead on the doughnut ring.

**Independent Test**: Add a Looper module, connect a signal source, press Record, wait one loop length, verify loop plays back with green ring and rotating playhead. Press Stop, verify ring returns to grey.

### Implementation for User Story 1

- [ ] T007 [US1] Create src/components/utilities/Looper.ts — define the `Looper` class extending `SynthComponent` implementing `TempoAware`: private fields (`config: LooperConfig`, `loopBuffer: Float32Array | null`, `loopLengthSamples: number`, `writeHead: number`, `playHead: number`, `filled: boolean`, `state: LooperState`, `currentBpm: number`, `sourceStartTime: number` (set to `audioCtx.currentTime` when `_startPlayback()` is called — used to derive `playHead` since `AudioBufferSourceNode` does not expose current position), `playbackSource: AudioBufferSourceNode | null`, `captureNode: ScriptProcessorNode | null`, `inputGain: GainNode | null`, `outputMix: GainNode | null`, `unsubscribeBpm: (() => void) | null`). Include empty stubs for all required methods.
- [ ] T008 [US1] Implement `createAudioNodes()` in src/components/utilities/Looper.ts: create `inputGain` (GainNode, gain=1), `captureNode` (ScriptProcessorNode, bufferSize=4096, 1 input/1 output channel), `outputMix` (GainNode). Wire: `inputGain → captureNode → outputMix`. Wire passthrough: `inputGain → outputMix` (always-on, FR-019). Register nodes with `audioEngine`.
- [ ] T009 [US1] Implement `destroyAudioNodes()` in src/components/utilities/Looper.ts: stop and disconnect `playbackSource`, `captureNode`, `inputGain`, `outputMix`. Null all node references. Clear `unsubscribeBpm`.
- [ ] T010 [US1] Implement `subscribeToGlobalBpm()` and `unsubscribeFromGlobalBpm()` and `applyGlobalBpm(bpm)` (TempoAware interface) in src/components/utilities/Looper.ts: subscribe to `EventType.GLOBAL_BPM_CHANGED`, store current BPM, do NOT alter an already-recorded loop.
- [ ] T011 [US1] Implement `pressRecord()` in src/components/utilities/Looper.ts: guard — only callable from `IDLE` state. Compute `loopLengthSamples = computeLoopDurationSamples(config.barCount, currentBpm, audioCtx.sampleRate)`. Allocate `loopBuffer = new Float32Array(loopLengthSamples)`. Reset `writeHead = 0`. Set `captureNode.onaudioprocess` to write mode: copy `inputBuffer.getChannelData(0)` into `loopBuffer` at `writeHead`, advance `writeHead`; when `writeHead >= loopLengthSamples` call `_commitRecording()`. Set `state = RECORDING`.
- [ ] T012 [US1] Implement `_commitRecording()` (private) in src/components/utilities/Looper.ts: set `filled = true`, call `_startPlayback()`.
- [ ] T013 [US1] Implement `_startPlayback()` (private) in src/components/utilities/Looper.ts: create `AudioBuffer` from `loopBuffer` Float32Array. Create `AudioBufferSourceNode`, set `loop = true`, `loopStart = 0`, `loopEnd = loopLengthSamples / sampleRate`. Connect to `outputMix`. Start. Store as `playbackSource`. Set `state = PLAYING`.
- [ ] T014 [US1] Implement `pressStop()` in src/components/utilities/Looper.ts: if `state === OVERDUBBING` → call `_commitOverdub()` then set `state = PLAYING` and return. If `state === PLAYING` → stop and null `playbackSource`, set `state = IDLE`.
- [ ] T015 [US1] Implement `getDisplayState(): LooperDisplayState` in src/components/utilities/Looper.ts: compute `playHead` as `((audioCtx.currentTime - sourceStartTime) % loopDurationSec) * sampleRate` (derived from context clock since `AudioBufferSourceNode` does not expose current position). Return `{ state, playHeadNormalized: normalizePlayHead(playHead, loopLengthSamples), barCount: config.barCount, filled }`. When state is IDLE or RECORDING, return `playHeadNormalized: 0`.
- [ ] T016 [US1] Create src/canvas/displays/LooperDisplay.ts — `LooperDisplay` class with: own `HTMLCanvasElement` (240×240 px logical), constructor `(x, y, w, h, looper: Looper)`. Implement `getCanvas()`, `updatePosition(x, y)`, `destroy()` (remove canvas from DOM).
- [ ] T017 [US1] Implement `render(state: LooperDisplayState)` in src/canvas/displays/LooperDisplay.ts: `clearRect`. Call `drawRing(state.state)` — filled arc full circle, colour from `LOOPER_STATE_COLORS`, ring thickness 10 px (outer radius 90 px, inner 80 px). Call `drawPlayhead(state.playHeadNormalized)` — only when `state.filled`, thin line from centre to outer ring edge at angle `playHeadToAngle(normalized)`. Call `drawLabel(state.barCount)` — centred text.
- [ ] T018 [US1] Wire `LooperDisplay` into `CanvasComponent` in src/canvas/CanvasComponent.ts: in `createControls()`, instantiate `LooperDisplay` when `this.synthComponent` is a `Looper`, append its canvas to the DOM parent of `#synth-canvas`. In `render()`, call `looperDisplay.render(looper.getDisplayState())`. In `destroy()`, call `looperDisplay.destroy()`. Wire `updatePosition` / `updateViewportTransform`.
- [ ] T019 [US1] Register `Looper` in src/main.ts: import `Looper`, add `ComponentType.LOOPER` to the component factory switch, call `looper.subscribeToGlobalBpm()` on activation.
- [ ] T020 [US1] Write unit tests in tests/components/Looper.test.ts: state transitions via `pressRecord()` / `pressStop()`, `applyGlobalBpm()` stores BPM but does not modify an existing buffer, `getDisplayState()` returns correct `playHeadNormalized`, `pressRecord()` is a no-op from any state other than idle (PLAYING, RECORDING, OVERDUBBING all leave state unchanged), after `_startPlayback()` `playbackSource.loopStart === 0` and `playbackSource.loopEnd === loopLengthSamples / sampleRate` (FR-007 seamless boundary), `pressRecord()` schedules capture start at next beat boundary by checking `sourceStartTime` offset against `audioCtx.currentTime` (FR-005 quantised start).
- [ ] T021 [US1] [P] Write unit tests in tests/canvas/LooperDisplay.test.ts: `render()` uses correct colour for each `LooperState`, playhead not drawn when `filled = false`, `drawLabel` renders bar count, canvas is removed from DOM on `destroy()`.

**Checkpoint**: User Story 1 fully functional. Record a signal, confirm loop plays back with green rotating playhead. Stop returns to grey idle.

---

## Phase 4: User Story 2 - Choose Loop Length Before Recording (Priority: P2)

**Goal**: User selects bar count (1/2/4/8) before recording. Loop duration is computed from global BPM at record start.

**Independent Test**: Set BPM to 60, select 1 bar, record — verify loop ends automatically after exactly 4 seconds.

### Implementation for User Story 2

- [ ] T022 [US2] Add bar count selector UI to `LooperDisplay` in src/canvas/displays/LooperDisplay.ts: render four small tap targets labelled "1", "2", "4", "8" around the bottom of the doughnut. Highlight the active selection. Implement `handleMouseDown(x, y): 'record' | 'stop' | 'clear' | BarCount | null` — returns the selected bar count when a bar count tap target is hit.
- [ ] T023 [US2] Add `setBarCount(barCount: BarCount): void` to `Looper` in src/components/utilities/Looper.ts: validates with `validateBarCount()`, updates `config.barCount`, no-op if a loop is already recorded (spec FR-003 — bar count only affects next recording).
- [ ] T024 [US2] Wire bar count selection in `CanvasComponent` in src/canvas/CanvasComponent.ts: when `looperDisplay.handleMouseDown()` returns a `BarCount`, call `looper.setBarCount(barCount)`.
- [ ] T025 [US2] Write unit tests in tests/components/Looper.test.ts (append): `setBarCount()` accepts valid values (1/2/4/8), rejects invalid values, does not alter an already-recorded loop, `computeLoopDurationSamples` produces correct length for each bar count / BPM combination.

**Checkpoint**: User Stories 1 and 2 work together. Selecting bar count before recording produces the correct loop length.

---

## Phase 5: User Story 3 - Overdub Additional Audio (Priority: P3)

**Goal**: While a loop is playing, press Overdub to layer new audio into the buffer. Ring turns orange. Press again to return to playing.

**Independent Test**: Record a loop, enter overdub, layer audio, exit overdub — verify both layers play back and ring colours transition correctly.

### Implementation for User Story 3

- [ ] T026 [US3] Add Overdub button to `LooperDisplay` in src/canvas/displays/LooperDisplay.ts: add an "OD" button to the canvas button row. Include it in `handleMouseDown()` return type: `'record' | 'stop' | 'clear' | 'overdub' | BarCount | null`.
- [ ] T027 [US3] Implement `pressOverdub()` in src/components/utilities/Looper.ts: guard — only callable from `PLAYING` state. Set `captureNode.onaudioprocess` to mix mode: `loopBuffer[writeHead % loopLengthSamples] += inputSample` (in-place accumulation at unity gain, FR-009). Reset `writeHead = 0`. Set `state = OVERDUBBING`.
- [ ] T028 [US3] Implement `_commitOverdub()` (private) in src/components/utilities/Looper.ts: re-create `AudioBuffer` from updated `loopBuffer`. Stop old `playbackSource`. Call `_startPlayback()` (resumes from position 0). Set `state = PLAYING`.
- [ ] T029 [US3] Wire overdub button in `CanvasComponent` in src/canvas/CanvasComponent.ts: when `looperDisplay.handleMouseDown()` returns `'overdub'`, call `looper.pressOverdub()`.
- [ ] T030 [US3] Write unit tests in tests/components/Looper.buffer.test.ts: overdub mixes samples additively (buffer values increase), `pressOverdub()` is a no-op when not in `PLAYING` state, `_commitOverdub()` restarts playback with updated buffer, `pressStop()` from `OVERDUBBING` transitions to `PLAYING` not `IDLE`.

**Checkpoint**: User Stories 1–3 work. Overdub layers audio additively. Stop from overdub returns to playing (not idle).

---

## Phase 6: User Story 4 - Clear the Loop (Priority: P4)

**Goal**: Press Clear (or key 0) to erase the buffer and return to idle from any state.

**Independent Test**: Record a loop, press Clear — ring returns to grey, output is silent, new recording can be started immediately.

### Implementation for User Story 4

- [ ] T031 [US4] Implement `pressClear()` in src/components/utilities/Looper.ts: stop `playbackSource` if running, set `captureNode.onaudioprocess = null`, null `loopBuffer`, set `filled = false`, `writeHead = 0`, `playHead = 0`, `loopLengthSamples = 0`, `state = IDLE`. Works from any state.
- [ ] T032 [US4] Wire Clear button in `CanvasComponent` in src/canvas/CanvasComponent.ts: when `looperDisplay.handleMouseDown()` returns `'clear'`, call `looper.pressClear()`.
- [ ] T033 [US4] Write unit tests in tests/components/Looper.test.ts (append): `pressClear()` from each state (idle, recording, playing, overdubbing) always transitions to idle, buffer is null after clear, `filled` is false after clear.

**Checkpoint**: User Stories 1–4 complete. Full record → play → overdub → clear loop works.

---

## Phase 7: User Story 5 - Keyboard Shortcuts (Priority: P2)

**Goal**: Keys 1 / 2 / 0 trigger Record / Stop / Clear. The musical Keyboard module ignores these keys.

**Independent Test**: With both Keyboard and Looper modules active, press 1 — Looper starts recording, no note fires on the Keyboard module. Press 2 to stop, 0 to clear.

### Implementation for User Story 5

- [ ] T034 [US5] Add `private static readonly RESERVED_KEYS: ReadonlySet<string> = new Set(['1', '2', '0'])` to `KeyboardController` in src/keyboard/KeyboardController.ts. In `handleKeyDown()`, add guard immediately after the input-field check: `if (KeyboardController.RESERVED_KEYS.has(e.key)) return;`
- [ ] T035 [US5] Add `LOOPER_KEY_RECORD = 'looper:key-record'`, `LOOPER_KEY_STOP = 'looper:key-stop'`, `LOOPER_KEY_CLEAR = 'looper:key-clear'` to the `EventType` enum in src/core/types.ts. In src/main.ts add a global `window.addEventListener('keydown', (e) => { if (e.repeat) return; if (e.key === '1') eventBus.emit(EventType.LOOPER_KEY_RECORD); else if (e.key === '2') eventBus.emit(EventType.LOOPER_KEY_STOP); else if (e.key === '0') eventBus.emit(EventType.LOOPER_KEY_CLEAR); })`. In `Looper.ts` subscribe to these events in `subscribeToGlobalBpm()` (or a dedicated `subscribeToKeyboardShortcuts()`) and call the corresponding press method — this pattern supports multiple Looper instances each independently responding, matching the spec Assumption of multiple simultaneous instances.
- [ ] T036 [US5] Add tooltip text to each button in `LooperDisplay` in src/canvas/displays/LooperDisplay.ts: render key hint below each button label (e.g. "R [1]", "■ [2]", "✕ [0]").
- [ ] T037 [US5] [P] Write unit tests in tests/keyboard/KeyboardController.reserved.test.ts: pressing '1', '2', '0' does not trigger `noteOn` on the voice manager, pressing a non-reserved note key ('a', 's', 'd') still triggers `noteOn` normally.

**Checkpoint**: All 5 user stories complete. Keyboard shortcuts work without interfering with musical keyboard.

---

## Phase 8: Serialization / Persistence (US1 + US4 dependency)

**Purpose**: Save/restore the loop buffer and state across patch load/save (FR-015, SC-006).

- [ ] T038 Implement `serialize()` in src/components/utilities/Looper.ts: return `ComponentData` with `parameters: { barCount: config.barCount, stateIndex: looperStateToIndex(state) }` and `audioBlob: loopBuffer ? float32ToBase64(loopBuffer) : undefined`. Add private helper `float32ToBase64(buffer: Float32Array): string` using `btoa` + `Uint8Array` view.
- [ ] T039 Implement `deserialize(data: ComponentData)` in src/components/utilities/Looper.ts: validate params with `validateLooperSerializedParams()`. Restore `config.barCount`. Restore `state` via `stateIndexToLooperState(stateIndex)`. If `audioBlob` present and valid, decode to `Float32Array` via `base64ToFloat32(audioBlob)`, set `loopBuffer`, `loopLengthSamples`, `filled = true`, call `_startPlayback()`.
- [ ] T040 [P] Write unit tests in tests/components/Looper.test.ts (append): `serialize()` produces valid `LooperSerializedParams`, `audioBlob` is valid Base64 when buffer exists, absent when no buffer. `deserialize()` restores bar count, restores state to `PLAYING` (not `RECORDING`/`OVERDUBBING`), restores loop for immediate playback.

**Checkpoint**: Patch save/reload works. Loop survives a browser refresh.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Edge case hardening, DPR scaling, and final validation.

- [ ] T041 [P] Apply device pixel ratio (DPR) scaling to `LooperDisplay` canvas in src/canvas/displays/LooperDisplay.ts: use `window.devicePixelRatio` for `ctx.scale()` as done in `ColliderDisplay`.
- [ ] T042 [P] Add `updateViewportTransform(zoom, panX, panY)` to `LooperDisplay` in src/canvas/displays/LooperDisplay.ts — mirrors `ColliderDisplay` to keep the embedded canvas in sync when the main canvas is panned or zoomed.
- [ ] T043 Add `destroy()` method to `Looper` in src/components/utilities/Looper.ts that calls `unsubscribeFromGlobalBpm()`, stops all audio nodes, and clears the buffer — ensures no memory leak when the module is removed from the canvas.
- [ ] T044 [P] Run `vitest run` and `npx tsc --noEmit` to confirm all tests pass and zero TypeScript errors.
- [ ] T045 [P] Manually validate the feature using all 8 steps in specs/015-bpm-looper/quickstart.md.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 — core audio + display + wiring
- **US2 (Phase 4)**: Depends on Phase 3 (bar count selector is part of existing LooperDisplay)
- **US3 (Phase 5)**: Depends on Phase 3 (overdub extends existing `pressStop` and `_startPlayback`)
- **US4 (Phase 6)**: Depends on Phase 3 (`pressClear` uses same node teardown as `pressStop`)
- **US5 (Phase 7)**: Depends on Phase 2 (constants) and Phase 3 (Looper methods exist); independent of US2–US4
- **Serialization (Phase 8)**: Depends on Phase 3 + Phase 6 (buffer + state fully defined)
- **Polish (Phase 9)**: Depends on Phases 3–8

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational. MVP.
- **US2 (P2)**: Depends on US1 (LooperDisplay and Looper.ts must exist). Extends them.
- **US3 (P3)**: Depends on US1. Independent of US2 (different method, different button).
- **US4 (P4)**: Depends on US1. Independent of US2/US3.
- **US5 (P2)**: Depends on Foundational constants and US1 Looper methods. Independent of US2–US4.

### Within User Story 1 — Parallel Opportunities

```bash
# These tasks touch different files and can run after T002–T006:
T007–T015  →  src/components/utilities/Looper.ts       (audio + state machine)
T016–T017  →  src/canvas/displays/LooperDisplay.ts     (canvas display)

# These depend on both streams above:
T018       →  src/canvas/CanvasComponent.ts             (wiring)
T019       →  src/main.ts                               (registration)

# Tests can be written in parallel with implementation:
T020       →  tests/components/Looper.test.ts
T021 [P]   →  tests/canvas/LooperDisplay.test.ts
```

---

## Parallel Example: User Story 1

```
Phase 2 complete → start simultaneously:

  Stream A (Looper.ts):
    T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T015

  Stream B (LooperDisplay.ts):
    T016 → T017

  When Stream A + B complete:
    T018 → T019  (CanvasComponent + main.ts wiring)

  Stream C (tests, can start anytime):
    T004 → T005 (contract tests)
    T020 → T021 (component + display tests)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (review)
2. Complete Phase 2: Foundational — types + constants + contract tests
3. Complete Phase 3: User Story 1 — Looper audio + LooperDisplay + wiring
4. **STOP and VALIDATE**: Record a loop, confirm playback and rotating playhead
5. Run `vitest run` — all tests pass

### Incremental Delivery

1. Setup + Foundational → types and constants in place
2. US1 → core record/play working (MVP — demonstrable)
3. US2 → bar count selection (correct loop length)
4. US3 → overdub layering
5. US4 → clear (session reuse)
6. US5 → keyboard shortcuts (live performance ready)
7. Serialization → patch persistence
8. Polish → DPR scaling, viewport sync, final validation

---

## Notes

- [P] tasks touch different files and have no blocking dependencies
- [Story] labels map each task to its user story for traceability
- `ScriptProcessorNode` is deprecated but is the only non-AudioWorklet audio capture in this codebase — justified in plan.md Complexity Tracking
- US2 and US5 are both P2 priority — implement US2 before US5 as it requires LooperDisplay changes
- `vitest run` (not `npm test`) per project convention
- Commit after each checkpoint to keep history clean
