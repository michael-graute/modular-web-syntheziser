# Tasks: Envelope Follower

**Input**: Design documents from `specs/030-envelope-follower/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: User story this task belongs to (US1–US5)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Register the new ComponentType and wire the component into the app's factory — everything else depends on this.

- [x] T001 Add `ENVELOPE_FOLLOWER = 'envelope-follower'` to `ComponentType` enum in `src/core/types.ts`
- [x] T002 Add `'Env Follower'` display-name entry to the `ComponentType` label map in `src/canvas/CanvasComponent.ts` (same location as `[ComponentType.VU_METER]: 'VU Meter'`)
- [x] T003 [P] Copy validation helpers from `specs/030-envelope-follower/contracts/validation.ts` into `src/components/analyzers/EnvelopeFollowerValidation.ts` and verify exports compile under strict mode

**Checkpoint**: `ComponentType.ENVELOPE_FOLLOWER` resolves in TypeScript; `npm run lint` passes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core component class — required before display, CanvasComponent wiring, registration, and tests can proceed.

- [x] T004 Create `src/components/analyzers/EnvelopeFollower.ts` — extend `SynthComponent`, add constructor with `addInput('input', 'Audio In', SignalType.AUDIO)`, `addOutput('cv', 'CV Out', SignalType.CV)`, and three parameters: `attack` (10 ms default, 1–500 ms), `release` (100 ms default, 5–2000 ms), `gain` (1.0 default, 0.1–4.0×)
- [x] T005 Implement `createAudioNodes()` in `EnvelopeFollower.ts`: create `inputGain` (GainNode, fixed gain 1.0), `analyser` (AnalyserNode, fftSize=256, smoothingTimeConstant=0), connect `inputGain → analyser`; create `cvNode` (ConstantSourceNode, offset=0), call `cvNode.start()`; allocate `dataArray = new Float32Array(256)`; register all nodes via `registerAudioNode()`
- [x] T006 Implement `getInputNode()` returning `inputGain` and `getOutputNode()` returning `cvNode` in `EnvelopeFollower.ts`
- [x] T007 Implement `tick(dt: number)` in `EnvelopeFollower.ts`: read `analyser.getFloatTimeDomainData(dataArray)`, compute RMS, apply gain, run IIR smoother with separate attack/release coefficients (`1 - Math.exp(-dt / (timeMs / 1000))`), clamp result to [0, 1], write to `cvNode.offset.value`; expose current value via `getEnvelopeValue(): number`
- [x] T008 Implement `serialize()` and `deserialize()` in `EnvelopeFollower.ts` using `validateEnvelopeFollowerParams()` from `EnvelopeFollowerValidation.ts`; missing params fall back to defaults

**Checkpoint**: `EnvelopeFollower` compiles; `getInputNode()` and `getOutputNode()` return correctly typed nodes; `tick()` can be called without crashing in a mocked audio context.

---

## Phase 3: User Story 1 — Basic Amplitude-to-CV Conversion (Priority: P1) 🎯 MVP

**Goal**: A musician patches audio into the module and its CV output tracks amplitude in real time.

**Independent Test**: Route any audio source into `EnvelopeFollower`, patch `cv` output to a `VCA` gain input; confirm VCA gain moves with audio loudness and returns to zero when silent.

### Tests for User Story 1

- [x] T009 [P] [US1] Create `tests/components/analyzers/EnvelopeFollower.test.ts` — test `tick()` with a simulated rising signal: `envelopeValue` must increase; with a silent signal: `envelopeValue` must converge to zero; `cvNode.offset.value` must equal `envelopeValue` after each tick
- [x] T010 [P] [US1] Add validation-helper tests in `tests/components/analyzers/EnvelopeFollower.test.ts` — 100% coverage of `validateAttack`, `validateRelease`, `validateGain`, `clampEnvelope`, `computeSmoothingCoeff` (boundary values: 0 ms, 1 ms, 5 ms, max ms, NaN, out-of-range floats); assert that coefficients at minimum time values (attack=1 ms, release=5 ms) produce finite, non-NaN IIR steps

### Implementation for User Story 1

- [x] T011 [US1] Register `EnvelopeFollower` in `src/components/registerComponents.ts` and `src/utils/componentLayout.ts` (import + add to registry alongside `VuMeter`, `Oscilloscope`); verify the component can be instantiated and added to the canvas

**Checkpoint**: `EnvelopeFollower` appears in the component menu; audio can be patched in; CV output port exists and is cabeable to a VCA. Tests T009–T010 pass.

---

## Phase 4: User Story 2 — Attack and Release Time Control (Priority: P1)

**Goal**: Adjusting Attack and Release knobs produces audibly distinct tracking speeds on percussive sources.

**Independent Test**: Patch a drum/noise source into input and VCA gain into CV out. Set attack=1 ms / release=2000 ms vs attack=500 ms / release=5 ms; the CV decay tail must be visually and audibly longer in the first configuration.

### Implementation for User Story 2

- [x] T012 [P] [US2] Create `src/canvas/displays/EnvelopeFollowerDisplay.ts` — follow `VuMeterDisplay.ts` exactly: constructor `(x, y, width, height, envelopeFollower: EnvelopeFollower)`, `render(ctx)` calls `envelopeFollower.tick(dt)` (using `performance.now()` delta), draws dark background + border, then a single green `#22c55e` bar filling upward proportionally to `envelopeValue`; implement `updatePosition()`, `updateSize()`, `setFrozen()`, `destroy()`
- [x] T013 [US2] Add `private envelopeFollowerDisplay: EnvelopeFollowerDisplay | null = null` field to `CanvasComponent.ts` and import `EnvelopeFollowerDisplay` and `EnvelopeFollower`
- [x] T014 [US2] Add `ComponentType.ENVELOPE_FOLLOWER` block in `createControls()` in `CanvasComponent.ts` (after the VU Meter block, ~line 1628): calculate port area height (1 input + 1 output); create three `Knob` controls for `attack`, `release`, `gain` parameters in a single row; calculate display area below knobs (height: 120 px); create/update `EnvelopeFollowerDisplay`
- [x] T015 [US2] Wire `envelopeFollowerDisplay.render(ctx)` into the main `render()` method of `CanvasComponent.ts` (same pattern as `vuMeterDisplay?.render(ctx)`); propagate `setFrozen()` and `destroy()` calls to the display

**Checkpoint**: Module appears on canvas with three knobs (Attack, Release, Gain) and a live green bar below them. Adjusting Release knob changes how quickly the bar falls after sound stops.

---

## Phase 5: User Story 3 — Gain/Sensitivity Control (Priority: P2)

**Goal**: The Gain knob adjusts the effective input sensitivity so quiet sources reach full CV range and loud sources don't rail.

**Independent Test**: Connect a low-amplitude LFO output used as audio; without gain adjustment, bar barely moves; increasing Gain brings bar into full range.

### Implementation for User Story 3

- [x] T016 [US3] Verify Gain knob created in T014 correctly uses the `gain` parameter already wired in `tick()` (T007) — confirm `rmsRaw * gain` scaling is applied before clamping; manually test with a low-amplitude source to confirm CV range expansion

**Checkpoint**: Gain knob is functional. Low-amplitude source at gain=0.1× shows minimal CV; same source at gain=4× reaches near full-scale CV.

---

## Phase 6: User Story 4 — Real-Time Visual Feedback (Priority: P2)

**Goal**: The vertical bar meter updates live and its decay speed visibly reflects the Release setting.

**Independent Test**: Connect audio source; observe bar during playback vs silence; adjust Release knob mid-playback and confirm decay speed changes visibly.

### Implementation for User Story 4

- [x] T017 [US4] Verify `EnvelopeFollowerDisplay.render()` from T012 correctly tracks `performance.now()` delta between frames; add a guard: if `dt > 0.1` (tab hidden / wakeup jank), clamp `dt` to `0.1` to prevent envelope jump on tab-switch return
- [x] T018 [US4] Validate display dimensions in `CanvasComponent.ts` createControls block (T014): confirm the 120 px display area does not overflow the component bounding box; adjust component height constants if needed so all three knobs + display fit without clipping
- [x] T018b [US4] Verify cable-disconnect edge case in `EnvelopeFollower.ts`: when the audio input cable is removed mid-playback the analyser receives silence, so `rmsNow` falls to 0 and `envelopeValue` decays naturally through the release curve rather than snapping to zero; confirm this is the automatic result of the IIR algorithm (no special handling needed) and document it in a test comment

**Checkpoint**: Bar meter animates smoothly at 60 FPS. Release knob change is immediately reflected in bar decay speed. No overflow or clipping of display area.

---

## Phase 7: User Story 5 — Patch Persistence (Priority: P3)

**Goal**: Attack, Release, and Gain values survive a save-and-reload cycle; cable connections are restored.

**Independent Test**: Set all three params to non-default values, save patch, reload page; verify all three knob positions and both cables (audio in + CV out) are restored exactly.

### Tests for User Story 5

- [x] T019 [P] [US5] Add serialize/deserialize round-trip tests to `tests/components/EnvelopeFollower.test.ts` — serialize with non-default values, deserialize into a fresh instance, assert all three param values match; also test that missing params in patch data fall back to defaults

### Implementation for User Story 5

- [x] T020 [US5] Verify `serialize()` / `deserialize()` from T008 produce and consume the correct `ComponentData.parameters` shape `{ attack, release, gain }` — load an existing patch containing an `EnvelopeFollower` entry and confirm parameters restore without error (integration smoke test)

**Checkpoint**: Full round-trip persistence confirmed. Test T019 passes.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final integration checks and missing-features doc update.

- [ ] T021 [P] Run `vitest run` and confirm all tests in `tests/components/analyzers/EnvelopeFollower.test.ts` pass with ≥80% coverage on `EnvelopeFollower.ts` and 100% on `EnvelopeFollowerValidation.ts`
- [ ] T022 [P] Run `npm run lint` (or equivalent) and resolve any TypeScript strict-mode or lint warnings introduced by new files
- [ ] T023 Mark Envelope Follower as implemented in `docs/research/missing-features.md` (strikethrough entry + branch reference, matching the pattern used for Quantizer, VU Meter, etc.)
- [ ] T024 Manual smoke test: add Oscillator → Envelope Follower → Filter patch; confirm filter cutoff modulates with oscillator amplitude; adjust Attack and Release; save and reload patch

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (T001 must complete so `ComponentType.ENVELOPE_FOLLOWER` is available)
- **Phase 3 (US1)**: Depends on Phase 2 complete — T009, T010 can run in parallel; T011 depends on T009/T010
- **Phase 4 (US2)**: T012 and T013 depend on Phase 2 only (display class and import field are independent of registration); T014 and T015 depend on T011 (component must be registered before the createControls block is meaningful) and T012+T013
- **Phase 5 (US3)**: Depends on T014 complete (Gain knob must exist)
- **Phase 6 (US4)**: Depends on T012 complete (display must exist)
- **Phase 7 (US5)**: Depends on T008 complete (serialize/deserialize must exist)
- **Phase 8 (Polish)**: Depends on all prior phases complete

### User Story Dependencies

- **US1 (P1)**: Foundational only — no other story dependency
- **US2 (P1)**: Foundational + US1 registration — display needs the component registered
- **US3 (P2)**: US2 (Gain knob created in T014)
- **US4 (P2)**: US2 (display created in T012)
- **US5 (P3)**: Foundational (serialize/deserialize from T008)

### Within Each Phase

- Setup tasks T001–T003: T003 can run parallel to T001/T002; T001 must finish before T004
- Foundational T004 → T005 → T006, T007 (T006 and T007 can be parallel once T005 done) → T008

### Parallel Opportunities

- T003, T009, T010, T012, T013, T019, T021, T022, T023 are all marked `[P]`
- T012 and T013 (display class + CanvasComponent field) can be written simultaneously
- T009 and T010 (two test groups) can be written simultaneously
- T021 and T022 (tests + lint) can run simultaneously

---

## Parallel Example: Phase 4 (US2 — Attack/Release Display)

```text
# T012 and T013 can start together:
Task T012: Create EnvelopeFollowerDisplay.ts
Task T013: Add display field + imports to CanvasComponent.ts

# T014 starts after both T012 and T013 complete:
Task T014: Add createControls() block for ENVELOPE_FOLLOWER

# T015 starts after T014:
Task T015: Wire render/frozen/destroy calls in CanvasComponent.ts
```

---

## Implementation Strategy

### MVP (User Stories 1 only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T008)
3. Complete Phase 3: US1 (T009–T011)
4. **STOP and VALIDATE**: `EnvelopeFollower` appears on canvas; audio in → CV out cabeable; CV drives VCA gain
5. Ship MVP — basic amplitude-to-CV routing works

### Incremental Delivery

1. Setup + Foundational → component class compiles and registers
2. US1 → component instantiable and cabeable (MVP)
3. US2 → knobs + display appear; Attack/Release audibly work
4. US3 → Gain knob effective on low/high amplitude sources
5. US4 → display decay speed reflects Release setting reliably
6. US5 → persistence confirmed; full patch round-trip works

---

## Notes

- [P] tasks = different files, no blocking inter-task dependencies
- [Story] label maps each task to its user story for traceability
- `vitest run` not `npm test` (watch mode) — see project memory
- Every new component needs an explicit `if (this.type === ComponentType.ENVELOPE_FOLLOWER)` block in `CanvasComponent.createControls()` — `componentLayout.ts` sizes the box but does NOT create controls (see project memory)
- Commit after each phase checkpoint
