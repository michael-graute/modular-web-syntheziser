# Tasks: 3-Band Parametric EQ

**Input**: Design documents from `specs/026-parametric-eq/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Register the new component type and wire up the minimal scaffolding all later phases depend on.

- [ ] T001 Add `PARAMETRIC_EQ = 'parametric-eq'` to `ComponentType` enum in `src/core/types.ts`
- [ ] T002 Add `PARAMETRIC_EQ` dimensions case in `src/utils/componentLayout.ts` — 4 input ports, 1 output port, 7 knobs, no dropdown
- [ ] T003 Add `PARAMETRIC_EQ` entry to the `names` record in `CanvasComponent.ts` and add icon `'♩'` in `src/ui/Sidebar.ts`

**Checkpoint**: TypeScript compiles without errors — `ComponentType.PARAMETRIC_EQ` is valid everywhere.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure-logic contracts that all user story phases depend on. No Web Audio API required — fully unit-testable.

- [ ] T004 [P] Verify `specs/026-parametric-eq/contracts/types.ts` compiles cleanly; run `vitest run` to confirm no existing tests regress
- [ ] T005 [P] Verify `specs/026-parametric-eq/contracts/validation.ts` compiles cleanly against types.ts
- [ ] T006 Write unit tests for `clampGain()`, `clampLowFreq()`, `clampMidFreq()`, `clampMidQ()`, `clampHighFreq()` — boundary values, within-range passthrough, out-of-range clamping in `tests/components/processors/ParametricEQ.test.ts`
- [ ] T007 Write unit tests for `validateEQConfig()` — valid config, invalid types, out-of-range values in `tests/components/processors/ParametricEQ.test.ts`
- [ ] T008 Write unit tests for `serializeEQConfig()` and `deserializeEQConfig()` — default config round-trip, non-default round-trip, missing keys fall back to defaults, out-of-range values are clamped on deserialize in `tests/components/processors/ParametricEQ.test.ts`
- [ ] T009 Run `vitest run tests/components/processors/ParametricEQ.test.ts` and confirm all pure-function tests pass

**Checkpoint**: All contract helper tests green. Foundation ready for component implementation.

---

## Phase 3: User Story 1 — Shape an Oscillator's Tone (Priority: P1) 🎯 MVP

**Goal**: A user connects an audio source → Parametric EQ → Master Output and hears each band's gain shaping the sound. All three bands work independently. Flat response (0 dB all bands) passes audio unchanged.

**Independent Test**: Connect Oscillator → Parametric EQ → Master Output. Boost low shelf +12 dB, verify bass-heavy sound. Cut mid peak, verify harshness reduced. All bands at 0 dB — A/B against bypass reveals no difference.

### Implementation

- [ ] T010 [US1] Create `src/components/processors/ParametricEQ.ts` — class skeleton extending `SynthComponent`, constructor with 7 parameters using defaults from `DEFAULT_EQ_CONFIG`, port declarations (`audio-in` Audio, `low-gain-cv` CV, `mid-gain-cv` CV, `high-gain-cv` CV, `audio-out` Audio)
- [ ] T011 [US1] Implement `createAudioNodes()` in `src/components/processors/ParametricEQ.ts` — create `inputGain` (GainNode), `lowShelf` (BiquadFilterNode type=`'lowshelf'`), `midPeak` (BiquadFilterNode type=`'peaking'`), `highShelf` (BiquadFilterNode type=`'highshelf'`), `outputGain` (GainNode); wire series chain `inputGain → lowShelf → midPeak → highShelf → outputGain`; set initial parameter values on all filter nodes
- [ ] T012 [US1] Implement `destroyAudioNodes()` in `src/components/processors/ParametricEQ.ts` — disconnect and null all five nodes in reverse order
- [ ] T013 [US1] Implement `getInputNode()` / `getOutputNode()` in `src/components/processors/ParametricEQ.ts` — return `inputGain` for `audio-in`, `outputGain` for `audio-out`
- [ ] T014 [US1] Implement `updateAudioParameter()` in `src/components/processors/ParametricEQ.ts` — handle all 7 parameter IDs (`lowGain`, `lowFreq`, `midGain`, `midFreq`, `midQ`, `highGain`, `highFreq`), using `setValueAtTime(value, ctx.currentTime)` on the appropriate BiquadFilterNode AudioParam
- [ ] T015 [US1] Implement bypass support in `src/components/processors/ParametricEQ.ts` — override `isBypassable()` returning `true`; `enableBypass()` sets `inputGain.gain` to 0; `disableBypass()` restores to 1
- [ ] T016 [US1] Import and register `ParametricEQ` in `src/components/registerComponents.ts` under `'Processors'` group with `calculateComponentDimensions(ComponentType.PARAMETRIC_EQ)`
- [ ] T017 [US1] Add `if (this.type === ComponentType.PARAMETRIC_EQ)` block in `createControls()` in `src/canvas/CanvasComponent.ts` — create 7 `Knob` instances for all parameters, positioned in two rows (Low row: lowGain, lowFreq; Mid row: midGain, midFreq, midQ; High row: highGain, highFreq)
- [ ] T018 [US1] Write component integration test: instantiate `ParametricEQ`, call `activate()`, verify `lowShelf.type === 'lowshelf'`, `midPeak.type === 'peaking'`, `highShelf.type === 'highshelf'`; verify initial gain values are 0 dB; verify bypass mutes `inputGain.gain` in `tests/components/processors/ParametricEQ.test.ts`

**Checkpoint**: Oscillator → ParametricEQ → Master Out patch audibly responds to all three band gain knobs. Flat response passes audio unchanged. All US1 tests green.

---

## Phase 4: User Story 2 — Set Mid Peak Frequency and Bandwidth (Priority: P2)

**Goal**: Adjusting the mid peak frequency and Q targets specific resonances. Changing frequency shifts the affected range; changing Q widens or narrows the band.

**Independent Test**: Set mid peak to 500 Hz, Q=5, gain=−12 dB with a broadband noise source. Verify a narrow notch audible near 500 Hz. Move frequency to 2000 Hz; notch audibly shifts.

### Implementation

- [ ] T019 [US2] Verify `updateAudioParameter('midFreq', value)` correctly calls `midPeak.frequency.setValueAtTime(value, now)` and `updateAudioParameter('midQ', value)` calls `midPeak.Q.setValueAtTime(value, now)` in `src/components/processors/ParametricEQ.ts` (already implicit from T014 — add explicit test coverage)
- [ ] T020 [US2] Write unit tests for mid peak frequency and Q: instantiate with mock context, call `setParameterValue('midFreq', 500)`, verify `midPeak.frequency` receives the value; call `setParameterValue('midQ', 5.0)`, verify `midPeak.Q` receives the value in `tests/components/processors/ParametricEQ.test.ts`

**Checkpoint**: Mid peak frequency and Q knobs affect the correct BiquadFilterNode AudioParams. US2 tests green. US1 still passes.

---

## Phase 5: User Story 3 — Set Shelf Frequencies (Priority: P2)

**Goal**: Adjusting the low shelf corner and high shelf corner frequencies shifts where each shelf effect starts.

**Independent Test**: Set low shelf corner to 200 Hz +6 dB; verify boost starts below 200 Hz. Move to 800 Hz; verify expanded range.

### Implementation

- [ ] T021 [US3] Verify `updateAudioParameter('lowFreq', value)` calls `lowShelf.frequency.setValueAtTime(value, now)` and `updateAudioParameter('highFreq', value)` calls `highShelf.frequency.setValueAtTime(value, now)` in `src/components/processors/ParametricEQ.ts` (already implicit from T014 — add explicit test coverage)
- [ ] T022 [US3] Write unit tests for shelf corner frequencies: set `lowFreq` to 200, verify `lowShelf.frequency` value; set `highFreq` to 12000, verify `highShelf.frequency` value in `tests/components/processors/ParametricEQ.test.ts`

**Checkpoint**: Shelf corner frequency knobs route to correct BiquadFilterNode AudioParams. US3 tests green. US1 + US2 still pass.

---

## Phase 6: User Story 4 — LFO Gain Modulation (Priority: P2)

**Goal**: Connecting an LFO to a gain CV input modulates that band's gain in real time at 1V = 1 dB. Disconnecting reverts to the knob value. CV beyond ±18 dB clamps.

**Independent Test**: Connect slow LFO (0.5 Hz sine) → EQ Low Gain CV In. Verify bass content rises and falls audibly in sync with the LFO.

### Implementation

- [ ] T023 [US4] Implement `getAudioParamForInput()` in `src/components/processors/ParametricEQ.ts` — return `lowShelf.gain` for `'low-gain-cv'`, `midPeak.gain` for `'mid-gain-cv'`, `highShelf.gain` for `'high-gain-cv'`, `null` otherwise
- [ ] T024 [US4] Implement `getParameterRangeForInput()` in `src/components/processors/ParametricEQ.ts` — return `{ min: -18, max: 18 }` for all three CV gain ports so the LFO's per-connection scaler implements 1V = 1 dB correctly
- [ ] T025 [US4] Write unit tests for CV routing: verify `getAudioParamForInput('low-gain-cv')` returns the `lowShelf.gain` AudioParam; same for mid and high; verify `getParameterRangeForInput('low-gain-cv')` returns `{ min: -18, max: 18 }` in `tests/components/processors/ParametricEQ.test.ts`
- [ ] T026 [US4] Write unit test for CV gain clamping: confirm `clampGain()` clamps ±18 dB at boundaries; confirm values beyond range (e.g. ±100) are clamped without error in `tests/components/processors/ParametricEQ.test.ts`

**Checkpoint**: LFO connects to each gain CV port and modulates the correct BiquadFilterNode.gain AudioParam via the existing per-connection scaler. US4 tests green. All prior stories still pass.

---

## Phase 7: User Story 5 — Patch Save & Restore (Priority: P3)

**Goal**: A patch containing a configured ParametricEQ saves and restores with all 7 parameters intact.

**Independent Test**: Configure non-default settings (e.g. lowGain=+6, midFreq=800, highGain=−3), save patch, reload page, verify all values restored exactly.

### Implementation

- [ ] T027 [US5] Implement `serialize()` in `src/components/processors/ParametricEQ.ts` — use `serializeEQConfig()` to write all 7 parameters into `ComponentData.parameters`
- [ ] T028 [US5] Implement `deserialize()` in `src/components/processors/ParametricEQ.ts` — use `deserializeEQConfig()` to restore config from `ComponentData.parameters`, call `updateAudioParameter()` for each value to sync filter nodes and canvas controls; apply documented defaults for missing keys
- [ ] T029 [US5] Write unit tests for round-trip serialization: configure non-default values, serialize, deserialize into a fresh instance, verify all 7 parameters match originals in `tests/components/processors/ParametricEQ.test.ts`
- [ ] T030 [US5] Write unit test for graceful fallback: deserialize with empty `parameters: {}`, verify all 7 parameters revert to `DEFAULT_EQ_CONFIG` values in `tests/components/processors/ParametricEQ.test.ts`

**Checkpoint**: Patch save/load preserves all EQ settings. US5 tests green. All prior stories still pass.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Edge-case hardening, final validation, and documentation.

- [ ] T031 [P] Verify all 7 parameter `setValueAtTime` calls use `ctx.currentTime` (not deferred) in `src/components/processors/ParametricEQ.ts` — ensures SC-002 (immediate effect, no dropout)
- [ ] T032 [P] Run full test suite `vitest run` and confirm zero regressions across all existing tests
- [ ] T033 [P] Run `npx tsc --noEmit` and confirm no TypeScript strict-mode errors
- [ ] T034 Smoke-test in browser: Oscillator → ParametricEQ → Master Out; adjust all 7 knobs and verify audible response per SC-001
- [ ] T035 Smoke-test bypass: toggle EQ bypass, verify A/B reveals no difference with all bands at 0 dB per SC-003
- [ ] T036 Smoke-test LFO modulation: LFO → Low Gain CV In at 0.5 Hz; verify smooth timbral sweep with no zipper noise per SC-006
- [ ] T037 Smoke-test patch persistence: save non-default config, reload, verify all values restored per SC-004
- [ ] T038 Update `docs/research/missing-features.md` — mark Parametric EQ as implemented

**Checkpoint**: All tests green, TypeScript clean, all smoke tests pass. Feature ready for review.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (needs `ComponentType.PARAMETRIC_EQ`)
- **Phase 3 (US1)**: Depends on Phase 2 — BLOCKS all other user stories
- **Phase 4 (US2)**: Depends on Phase 3 (mid freq/Q route through `updateAudioParameter()` added in T014)
- **Phase 5 (US3)**: Depends on Phase 3 (shelf freq routes through `updateAudioParameter()` added in T014)
- **Phase 6 (US4)**: Depends on Phase 3 (audio nodes must exist for `getAudioParamForInput()` to return them)
- **Phase 7 (US5)**: Depends on Phase 3 (serialize/deserialize needs audio node lifecycle)
- **Phase 8 (Polish)**: Depends on all story phases complete

### User Story Dependencies

- **US1 (P1)**: Core — all other stories build on it
- **US2 (P2)**: Extends US1's `updateAudioParameter()` — verify mid freq/Q routing
- **US3 (P2)**: Extends US1's `updateAudioParameter()` — verify shelf freq routing; parallel with US2
- **US4 (P2)**: Extends US1's audio nodes — adds CV routing; parallel with US2/US3
- **US5 (P3)**: Uses US1's audio node lifecycle — independent of US2/US3/US4

### Parallel Opportunities

Within Phase 2: T004 and T005 are parallel (different files).  
Within Phase 3: T010–T015 are sequential (build the class incrementally); T016–T017 can run after T010.  
Phase 4, 5, and 6 can be worked in parallel once Phase 3 is complete (different methods, different test cases).  
Within Phase 8: T031–T033 are all parallel.

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Complete Phase 1 (Setup) — 3 tasks
2. Complete Phase 2 (Foundational) — contract tests, no Web Audio
3. Complete Phase 3 (US1) — full component: 3 filter nodes, 7 knobs, bypass
4. **STOP and VALIDATE**: Oscillator → ParametricEQ → Master Out; all 3 band gains audible

### Incremental Delivery

1. Phase 1 + 2 → contract tests green
2. Phase 3 (US1) → MVP EQ usable in patches
3. Phase 4 + 5 (US2/US3) → parametric mid + shelf frequency controls
4. Phase 6 (US4) → LFO gain modulation
5. Phase 7 (US5) → patch persistence
6. Phase 8 → production-ready

---

## Notes

- `[P]` = different files or concerns, no dependencies on incomplete tasks in the same phase
- `[USn]` = maps task to user story for traceability
- Contracts (`specs/026-parametric-eq/contracts/`) are already written — import, don't rewrite
- All pure functions (`clampGain`, `serializeEQConfig`, etc.) are unit-testable without a Web Audio context
- `BiquadFilterNode.gain`, `.frequency`, `.Q` are all `AudioParam`s — the LFO's per-connection scaler wires up automatically once `getAudioParamForInput()` and `getParameterRangeForInput()` are implemented
- US2 and US3 verification tasks (T019–T022) are lightweight — the routing is already wired in T014; only explicit test coverage is needed
- Run `vitest run` (not `npm test`) to avoid watch mode hanging
