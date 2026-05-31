# Tasks: VU Meter (027)

**Input**: Design documents from `/specs/027-vu-meter/`  
**Branch**: `027-vu-meter`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Unit tests for `VuMeter.ts` are included (critical business logic). No tests for `VuMeterDisplay.ts` (no canvas mock in this project's test stack — consistent with Oscilloscope pattern).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Wire the new component type into the type system and component registry — all user stories depend on these.

- [ ] T001 [P] Add `VU_METER = 'vu-meter'` to the `ComponentType` enum in `src/core/types.ts`
- [ ] T002 [P] Add VU_METER case to `getPortCounts()` in `src/utils/componentLayout.ts` returning `{ inputs: 1, outputs: 0 }`
- [ ] T003 [P] Add VU_METER case to `getControlLayout()` in `src/utils/componentLayout.ts` returning `{ hasDisplayArea: true, displayHeight: 200 }`
- [ ] T004 [P] Add VU_METER width override in `calculateComponentWidth()` in `src/utils/componentLayout.ts` returning `160`

**Checkpoint**: `ComponentType.VU_METER` is available and `calculateComponentDimensions(ComponentType.VU_METER)` returns correct dimensions.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core audio component and display renderer — must exist before `CanvasComponent` wiring and registration.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T005 Create `src/components/analyzers/VuMeter.ts` — `VuMeter` class extending `SynthComponent` with `ComponentType.VU_METER`, one `'input'` port (`SignalType.AUDIO`), no outputs, no parameters
- [ ] T006 Implement `createAudioNodes()` in `src/components/analyzers/VuMeter.ts` — create `inputGain` (GainNode, gain=1.0) and `analyser` (AnalyserNode, fftSize=256, smoothingTimeConstant=0); wire `inputGain → analyser`; register both nodes; allocate `dataArray` (Float32Array of length 256)
- [ ] T007 Implement `destroyAudioNodes()` in `src/components/analyzers/VuMeter.ts` — disconnect and null `inputGain`, `analyser`, `dataArray`
- [ ] T008 Implement `getInputNode()` returning `inputGain`, `getOutputNode()` returning `null`, `updateAudioParameter()` as no-op in `src/components/analyzers/VuMeter.ts`
- [ ] T009 Implement `getPeakLevel()` in `src/components/analyzers/VuMeter.ts` — call `analyser.getFloatTimeDomainData(dataArray)`, iterate buffer to find `max(|sample|)`, return value clamped to `[0, 1]`; return 0 when analyser is null
- [ ] T010 [P] Create `src/canvas/displays/VuMeterDisplay.ts` — class with constructor `(x, y, width, height, vuMeter: VuMeter)`, fields: `peakHoldLevel: number`, `peakHoldTimestamp: number`, `isFrozen: boolean`; define constants `SEGMENT_COUNT=20`, `GREEN_SEGMENTS=12`, `YELLOW_SEGMENTS=5`, `RED_SEGMENTS=3`, `PEAK_HOLD_DURATION_MS=1500`, `PEAK_DECAY_RATE=0.02`
- [ ] T011 Implement `render(ctx: CanvasRenderingContext2D)` in `src/canvas/displays/VuMeterDisplay.ts` — draw background, compute `currentLevel` from `vuMeter.getPeakLevel()`, update `peakHoldLevel`/`peakHoldTimestamp`, decay after hold expires, draw 20 segments (green/yellow/red) bottom-up, draw white peak hold marker stripe
- [ ] T012 [P] Implement `updatePosition(x, y)`, `updateSize(width, height)`, `setFrozen(frozen)`, `destroy()` in `src/canvas/displays/VuMeterDisplay.ts`

**Checkpoint**: `VuMeter` and `VuMeterDisplay` compile without errors under `tsc --noEmit`.

---

## Phase 3: User Story 1 — Monitor a Mixer Channel Level (Priority: P1) 🎯 MVP

**Goal**: A working VU Meter appears on canvas, accepts an Audio connection, and displays real-time peak levels with colour-coded segments and a peak hold indicator.

**Independent Test**: Connect any audio source (Oscilloscope output or Oscillator) → VU Meter. Play audio and verify the meter display rises and falls with the signal. Disconnect and verify meter falls to silence.

### Tests for User Story 1

- [ ] T013 [P] [US1] Create `tests/components/VuMeter.test.ts` — mock `audioEngine` with `MockGainNode` and `MockAnalyserNode`; test constructor: has input port `'input'` with `SignalType.AUDIO`, has zero output ports, has zero parameters
- [ ] T014 [US1] Add test in `tests/components/VuMeter.test.ts` — `getPeakLevel()` returns `0` before `activate()` (analyser is null)
- [ ] T015 [US1] Add test in `tests/components/VuMeter.test.ts` — `activate()` calls `createGain` and `createAnalyser` on the context; `getInputNode()` returns non-null; `getOutputNode()` returns null
- [ ] T016 [US1] Add test in `tests/components/VuMeter.test.ts` — `getPeakLevel()` after `activate()` returns value in `[0, 1]` (mock returns zeros → expects 0.0)
- [ ] T017 [US1] Add test in `tests/components/VuMeter.test.ts` — `destroyAudioNodes()` disconnects gain and analyser nodes; subsequent `getPeakLevel()` returns 0

### Implementation for User Story 1

- [ ] T018 [US1] Add `private vuMeterDisplay: VuMeterDisplay | null = null` field and import to `src/canvas/CanvasComponent.ts`
- [ ] T019 [US1] Add `ComponentType.VU_METER` case in `createControls()` in `src/canvas/CanvasComponent.ts` — compute `displayY` below the single port row, create `VuMeterDisplay` if null or update position, no knobs/dropdowns
- [ ] T020 [US1] Add `this.vuMeterDisplay?.render(ctx)` call in the display rendering section of `render()` in `src/canvas/CanvasComponent.ts` (alongside the `oscilloscopeDisplay` render call)
- [ ] T021 [US1] Add `[ComponentType.VU_METER]: 'VU Meter'` to the `getDisplayName()` names map in `src/canvas/CanvasComponent.ts`
- [ ] T022 [US1] Add `vuMeterDisplay` cleanup in `cleanup()` in `src/canvas/CanvasComponent.ts` — call `destroy()` and null the field
- [ ] T023 [US1] Register `VuMeter` in `src/components/registerComponents.ts` — import `VuMeter`, add `componentRegistry.register(ComponentType.VU_METER, 'VU Meter', 'Real-time peak level meter for audio and CV signals', 'Analyzers', (id, position) => new VuMeter(id, position), calculateComponentDimensions(ComponentType.VU_METER))`
- [ ] T024 [US1] Run `vitest run tests/components/VuMeter.test.ts` and verify all tests pass; run `npm run lint` and fix any warnings

**Checkpoint**: Add VU Meter from the component menu → it appears on canvas with a single Audio In port and an empty segmented display. Connect an Oscillator → meter reacts in real time. Disconnect → meter falls to silence. Peak hold marker is visible for ~1.5 seconds after a transient.

---

## Phase 4: User Story 2 — Monitor a CV Signal Range (Priority: P2)

**Goal**: An LFO (or other CV source that supports Audio connections) connected to the VU Meter causes the meter to sweep slowly up and down in sync with the LFO waveform.

**Independent Test**: Connect an LFO output → VU Meter. Set LFO to 0.5 Hz. Verify meter slowly sweeps up and down in sync with the LFO. Verify a narrow-range CV (amplitude 0.1) shows a low-level reading rather than zero.

### Implementation for User Story 2

- [ ] T025 [US2] Verify in `src/components/analyzers/VuMeter.ts` that `getInputNode()` returns the `inputGain` GainNode — this is what the connection manager routes any Audio-typed source into. No code changes should be needed; this task is a verification step. If the routing does not work (e.g. port type mismatch), fix the port declaration.
- [ ] T026 [US2] Manual test: connect LFO output (Audio-typed port) → VU Meter input; confirm meter responds (no code change expected — US1 wiring covers this). Document result in a brief comment in `src/components/analyzers/VuMeter.ts` if any edge case is discovered.

**Checkpoint**: LFO sweeping at 0.5 Hz produces a smooth meter sweep. Low-amplitude signals show non-zero levels. No code changes expected beyond what US1 delivered — this phase is primarily a verification gate.

---

## Phase 5: User Story 3 — Save and Restore the Meter in a Patch (Priority: P3)

**Goal**: A patch containing a VU Meter saves and reloads with the meter in its correct position and reconnected — zero manual rewiring required.

**Independent Test**: Place a VU Meter, connect it, save the patch, reload the page, verify the meter reappears connected and begins monitoring immediately.

### Implementation for User Story 3

- [ ] T027 [US3] Verify `VuMeter.serialize()` in `src/components/analyzers/VuMeter.ts` — the base class `SynthComponent.serialize()` is called and should return `{ id, type: 'vu-meter', position, parameters: {}, isBypassed: undefined }`. Write a quick manual check or extend the test file: add a test in `tests/components/VuMeter.test.ts` asserting `serialize()` returns `type === 'vu-meter'` and `parameters` is an empty object.
- [ ] T028 [US3] Verify `PatchSerializer` handles `ComponentType.VU_METER` without error — since `VU_METER` is now in the enum and the serializer uses the `type` string directly, no code changes should be needed. Run the existing patch serializer tests (`vitest run tests/patch`) to confirm no regressions.
- [ ] T029 [US3] Verify legacy patch loading — manually load a patch that does not contain a VU Meter and confirm no errors occur in the browser console. No code changes expected.

**Checkpoint**: Save a patch with a VU Meter → reload the page → meter appears at saved position with connection restored → monitoring begins automatically. Legacy patches load without error.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, help text, and edge case hardening.

- [ ] T030 [P] Update `src/ui/HelpSidebar.ts` (or equivalent help content) to add a VU Meter entry in the user manual section, describing: one Audio In port, passive monitoring, green/yellow/red zones, peak hold behaviour
- [ ] T031 Verify edge cases from spec.md manually in the browser: (a) digital silence (signal = 0) → display shows floor, not frozen mid-scale; (b) clipping signal (amplitude > 1.0) → `getPeakLevel()` clamps to 1.0 → all segments red + peak hold at top; (c) audio context suspended → meter shows silence, resumes when context resumes; (d) SC-004 timing — disconnect a live source, start a timer, confirm the display reaches silence within 2 seconds
- [ ] T032 [P] Run full test suite `vitest run` and `npm run lint` — fix any regressions introduced by the `ComponentType` enum extension or `CanvasComponent` additions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (T001–T004)
- **Phase 3 (US1)**: Depends on Phase 2 (T005–T012)
- **Phase 4 (US2)**: Depends on Phase 3 completion (meter must be on canvas to test CV routing)
- **Phase 5 (US3)**: Depends on Phase 3 completion (meter must be registerable)
- **Phase 6 (Polish)**: Depends on Phase 3, 4, 5 complete

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational (Phase 2) — no other story dependency
- **US2 (P2)**: Depends on US1 completion — verification of LFO routing requires the meter to be on canvas
- **US3 (P3)**: Depends on US1 completion — patch serialization requires the component to be registered

### Within Each Phase

- T001–T004 are independent and can run in parallel (different parts of `componentLayout.ts` and `types.ts`)
- T005–T009 are sequential (each builds on the class created in T005)
- T010–T012 are parallel with T005–T009 (different file: `VuMeterDisplay.ts`)
- T013–T017 (tests) are parallel with each other (same file, different describe blocks — write sequentially for clarity)
- T018–T023 are broadly sequential (each modifies `CanvasComponent.ts` or `registerComponents.ts`)

---

## Parallel Execution Example: Phase 2

```
# Can run in parallel:
Task T010: Create VuMeterDisplay.ts class skeleton + constants
Task T012: Implement VuMeterDisplay utility methods

# Must be sequential (building the VuMeter class):
T005 → T006 → T007 → T008 → T009
```

## Parallel Execution Example: Phase 3 (US1)

```
# Write tests first (all parallel):
T013, T014, T015, T016, T017

# Then implement (broadly sequential in CanvasComponent.ts):
T018 → T019 → T020 → T021 → T022 → T023 → T024
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T004)
2. Complete Phase 2: Foundational (T005–T012)
3. Complete Phase 3: User Story 1 (T013–T024)
4. **STOP and VALIDATE**: Add VU Meter from menu, connect an Oscillator, confirm real-time response
5. Ship US1 as the complete, self-contained MVP

### Incremental Delivery

1. Phase 1 + 2 → foundation compiles cleanly
2. Phase 3 → VU Meter on canvas, real-time level display working → **demo-able MVP**
3. Phase 4 → CV signal monitoring verified (likely zero code changes)
4. Phase 5 → patch save/load verified (likely zero code changes)
5. Phase 6 → help text + edge case hardening

---

## Notes

- Phases 4 and 5 are primarily verification gates — the implementation from Phase 3 should cover them without additional code
- `VuMeter` must NOT appear in the `isBypassable()` list in `SynthComponent.ts` (it is a passive tap with no effect to bypass)
- `analyser.smoothingTimeConstant = 0` is intentional — we want raw per-frame peak values, not smoothed averages
- `fftSize = 256` gives a 256-sample time-domain buffer (~5.8ms at 44100 Hz) — sufficient for peak detection at 60 FPS
- [P] tasks = different files, no dependencies on incomplete sibling tasks
- [Story] label maps each task to its user story for traceability
