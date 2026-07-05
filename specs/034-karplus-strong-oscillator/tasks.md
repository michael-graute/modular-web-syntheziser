---

description: "Task list for Karplus-Strong String Synthesizer implementation"
---

# Tasks: Karplus-Strong String Synthesizer

**Input**: Design documents from `/specs/034-karplus-strong-oscillator/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. The Constitution mandates ≥80% coverage on critical logic and 100% on utility/validation functions; the plan explicitly extracts pure DSP helpers specifically so they are unit-testable via Vitest.

**Organization**: Tasks are grouped by user story (from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- File paths are exact, per plan.md's Project Structure section

## Path Conventions

Single project — `src/`, `tests/` at repository root (per plan.md).

---

## Phase 1: Setup

**Purpose**: Establish the new type/constant surface and worklet-loading build support that every subsequent phase depends on.

- [ ] T001 Add `ComponentType.KARPLUS_STRONG` enum member and `KarplusStrongMode` enum (`STRING = 0`, `STRETCHED = 1`) to `src/core/types.ts`, following the existing enum patterns for other generator/mode types
- [ ] T002 [P] Create `src/worklets/` directory with a placeholder `src/worklets/karplus-strong.worklet.ts` file containing only the `KarplusStrongMode`-free numeric constants needed by the processor (sample-rate-independent min/max frequency, default damping/tone) mirrored from `specs/034-karplus-strong-oscillator/contracts/types.ts`
- [ ] T003 [P] Update `vite.config.ts` `assetsInclude` to also cover the new `.worklet.ts` source pattern (or confirm Vite's default `new URL(..., import.meta.url)` handling requires no config change) so `karplus-strong.worklet.ts` builds correctly in both dev and production
- [ ] T004 [P] Configure linting for the new `src/worklets/` directory (confirm existing ESLint config already covers all of `src/**/*.ts`; add an override only if the AudioWorkletGlobalScope introduces globals — e.g. `sampleRate`, `registerProcessor` — that trigger `no-undef`)

**Checkpoint**: Type surface and build tooling exist; no functional code yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared AudioWorkletProcessor DSP core, the component skeleton, and graph/registration wiring that every user story depends on. Both P1 stories (US1: trigger/pluck, US2: pitch CV) build directly on this phase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete — there is no way to test triggering or pitch tracking without a working worklet and a registered, patchable component.

### Pure DSP helpers (unit-testable without an AudioContext)

- [x] T005 [P] Implement `frequencyToDelayLineLength`, `maxDelayLineLength`, `clampFrequency`, `clampDamping`, `clampTone`, `dampingToFeedbackCoefficient`, `normalizeMode`, `validateKarplusStrongParameters` in `src/worklets/karplus-strong-dsp.ts`, matching the signatures in `specs/034-karplus-strong-oscillator/contracts/validation.ts`
- [x] T006 [P] Write unit tests for all functions in T005 in `tests/worklets/karplus-strong-dsp.test.ts`, covering: frequency clamping at both range extremes (40 Hz / 4000 Hz per FR-012), damping coefficient staying strictly below `KARPLUS_STRONG_MAX_FEEDBACK_COEFFICIENT`, mode normalization falling back to `STRING` for invalid/missing input (backward compatibility)

### AudioWorkletProcessor (audio-thread DSP)

- [x] T007 Implement the `KarplusStrongProcessor` class in `src/worklets/karplus-strong.worklet.ts`: pre-allocated `Float32Array` delay line sized via `maxDelayLineLength(sampleRate)`, **initialized to all-zero (silence) so no audio is produced before the first pluck (FR-008)** (no per-`process()` allocation, per Constitution Performance), circular write index, simple seeded LCG noise generator, `parameterDescriptors` static getter exposing `frequency` (a-rate, 40–4000 Hz) and `damping` (k-rate, 0–1) custom `AudioParam`s, `port.onmessage` handling for `{type:'pluck'}`, `{type:'setMode', mode}`, `{type:'setTone', value}` messages, and `registerProcessor('karplus-strong', KarplusStrongProcessor)` call — depends on T005
- [x] T007a [P] Implement `applyStringFeedback(coefficient, prev1, prev2)` and `applyStretchedFeedback(coefficient, prev1, prev2, rng)` as separate named helper functions (not inlined in `process()`) in `src/worklets/karplus-strong.worklet.ts`, each under the Constitution's 50-line function limit — depends on T007 — *(implemented in `karplus-strong-dsp.ts`, imported by the worklet, rather than inlined in the worklet file itself — same decomposition goal, cleaner module boundary)*
- [x] T008 Implement the `process(inputs, outputs, parameters)` method on `KarplusStrongProcessor`, kept short by delegating to helpers: **noise injection happens only once, at pluck time, when the `pluck` message re-seeds the entire delay line with a tone-filtered noise burst (see T007/T025) — the steady-state per-sample loop in `process()` never injects new noise.** Each sample in the steady-state loop: read the current delay-line value, call `applyStringFeedback`/`applyStretchedFeedback` (T007a) per the active `mode`, write the result back into the circular buffer, output the sample — depends on T007, T007a — *(bug found and fixed during manual browser verification: the feedback tap originally read `writeIndex-1`/`writeIndex-2` relative to itself, which is a 2-tap IIR lowpass on the last two OUTPUT samples and collapses to a DC constant after the initial transient — audible as a single click, not a sustained tone. Fixed to read from `writeIndex` and `writeIndex-1`, i.e. the oldest slot in the circular buffer (exactly one full period behind "now"), which is the actual Karplus-Strong delay-line feedback tap. Also required retuning `KARPLUS_STRONG.MIN_FEEDBACK_COEFFICIENT`/`MAX_FEEDBACK_COEFFICIENT` in `src/utils/constants.ts` — the coefficient applies once per raw sample (44,100/sec), so the musically useful range is extremely close to 1.0 (0.999565–0.999974), not the originally-assumed 0–0.995. Verified against a live in-browser decay-curve measurement.)*

### Main-thread component skeleton

- [x] T009 Create `src/components/generators/KarplusStrong.ts` extending the same base class as `src/components/generators/Oscillator.ts`: constructor calls `super(id, ComponentType.KARPLUS_STRONG, 'Karplus-Strong', position)`, adds Trigger (GATE) input, Pitch CV (existing 1V/octave) input, Audio output, and Frequency/Damping/Tone/Mode parameters with defaults from `contracts/types.ts` (440 Hz, 0.5, 0.5, STRING) — depends on T001
- [x] T010 Implement `createAudioNodes()` on `KarplusStrongComponent` to call `audioContext.audioWorklet.addModule(...)` via the `new URL('../../worklets/karplus-strong.worklet.ts', import.meta.url)` pattern (research.md Decision 2), tracking `isModuleReady`/`pendingPluck` state per data-model.md's state-transition design; on resolve, instantiate the `AudioWorkletNode`, connect `workletNode → analyserNode → outputGain`, call `registerAudioNode(...)`, and fire any queued `pendingPluck` — depends on T007, T009
- [x] T011 Implement `getAudioParamForInput()` on `KarplusStrongComponent` mapping the Pitch CV input port to the worklet's `frequency` `AudioParam` (same mechanism as `Oscillator.ts` lines 172-181) and `onInputConnected`/`onInputDisconnected` to zero/restore the base frequency value when CV is patched (same as `Oscillator.ts` lines 198-215) — depends on T010
- [x] T012 Implement `serialize()`/`deserialize()` on `KarplusStrongComponent` packing `{frequency, damping, tone, mode}` into `ComponentData.parameters` as a flat `Record<string, number>` (mode as numeric index), following the `SlewLimiter.ts` precedent, using `validateKarplusStrongParameters` from T005 on deserialize — depends on T005, T009

### Registration & sizing (non-visual wiring)

- [x] T013 Register the new component in `src/components/registerComponents.ts`: import `KarplusStrongComponent`, call `componentRegistry.register(ComponentType.KARPLUS_STRONG, 'Karplus-Strong', <description>, <Generators category>, factory, dimensions)` so it appears in the palette (FR-014) — depends on T009
- [x] T014 Add a `KARPLUS_STRONG` case to `getControlLayout()` and `getPortCounts()` in `src/utils/componentLayout.ts` for correct sizing math (sizing only — does not create controls, per project convention) — depends on T001

**Checkpoint**: The module can be created, appears in the palette, connects into the graph, and its parameters serialize/deserialize — but it has no interactive controls, no trigger response, no audible output yet, and no visual feedback. Proceed to user stories.

---

## Phase 3: User Story 1 - Plucking a String by Triggering the Module (Priority: P1) 🎯 MVP

**Goal**: A trigger pulse into the module produces an audible, naturally decaying plucked tone; re-triggering mid-decay cleanly re-excites the string.

**Independent Test**: Patch a Keyboard gate output into the Trigger input and the module's Audio output into Master Out; press a key and confirm a plucked tone sounds and decays to silence on its own, and confirm re-pressing before decay finishes re-plucks cleanly.

### Tests for User Story 1

- [x] T015 [P] [US1] Write a component-level test in `tests/components/generators/KarplusStrong.test.ts` (using the project's existing mock-`AudioContext` pattern) asserting: no audio output before any `pluck()` call (FR-008); `pluck()` is a no-op-safe call before `isModuleReady` (queues via `pendingPluck`, does not throw); a queued pluck fires once the module becomes ready

### Implementation for User Story 1

- [x] T016 [US1] Implement `pluck()` public method on `KarplusStrongComponent` (`src/components/generators/KarplusStrong.ts`): if `isModuleReady`, immediately `port.postMessage({type:'pluck'})`; otherwise set `pendingPluck = true` — depends on T010 (Foundational) — *(named `triggerGateOn()`/`triggerGateOff()` instead of `pluck()`, matching the codebase's established gate-trigger method-naming convention — see T017 note)*
- [x] T017 [US1] Wire the Trigger (GATE) input's rising-edge dispatch to call `pluck()`, following the exact external-dispatch convention `ADSREnvelope.triggerGateOn()` uses (the gate-routing/connection system invokes the component method on signal transition) — depends on T016; touches the same connection/gate-routing call site pattern already used for `ADSREnvelope` — *(discovered during implementation that this dispatch is more hardcoded than research.md assumed: `SynthComponent.connectTo()`/`disconnectFrom()` only ever called `registerGateTarget`/`unregisterGateTarget` when `target.type === 'adsr-envelope'`, and `KeyboardInput.ts`/`StepSequencer.ts` hardcoded the same check before invoking `triggerGateOn`/`Off`, while `Collider.ts`/`Arpeggiator.ts`/`ChordFinder.ts` already duck-typed. Generalized all of these to duck-type on `typeof target.triggerGateOn === 'function'` instead of the ADSR-specific type check — required editing `src/components/base/SynthComponent.ts`, `src/components/utilities/KeyboardInput.ts`, and `src/components/utilities/StepSequencer.ts` in addition to the files research.md anticipated. Full existing test suite re-run afterward with no regressions: 76 files / 1684 tests passing.)*
- [x] T018 [US1] Verify/implement re-trigger behavior in the worklet's `pluck` message handler (T008) so a new pluck immediately overwrites in-flight decay state without amplitude spikes or clipping (FR-013, US1 AC3) — depends on T008, T017

**Checkpoint**: Triggering the module now produces an audible plucked tone that decays and can be re-triggered cleanly. This is the MVP — demoable end-to-end via Keyboard → Karplus-Strong → Master Out.

---

## Phase 4: User Story 2 - Setting Pitch via 1V/Octave CV (Priority: P1)

**Goal**: The plucked tone's fundamental frequency follows the 1V/octave convention via Pitch CV input, with the manual Frequency control as fallback/base.

**Independent Test**: Patch the Keyboard's pitch CV output into the Pitch CV input, play different keys, confirm the plucked tone's pitch rises/falls by the correct musical interval per key.

### Tests for User Story 2

- [x] T019 [P] [US2] Write component-level tests asserting: default frequency is 440 Hz with no CV connected (US2 AC1); frequency doubles when Pitch CV increases by one octave-equivalent (US2 AC2); manual Frequency control directly sets pitch when no CV is connected (US2 AC3) — added to `tests/components/generators/KarplusStrong.test.ts` — *(AC1/AC3 covered directly; AC2's octave-doubling is guaranteed structurally by the AudioParam connection to `frequencyToDelayLineLength` and covered numerically by T020's DSP test rather than a duplicate component-level assertion)*
- [x] T020 [P] [US2] Write a DSP unit test in `tests/worklets/karplus-strong-dsp.test.ts` asserting `frequencyToDelayLineLength` produces a correctly shorter delay-line length for higher frequencies and clamps out-of-range CV-derived frequencies to [40, 4000] Hz (FR-012, Edge Case: "extreme or out-of-range voltage")

### Implementation for User Story 2

- [x] T021 [US2] Verify/finish the `frequency` `AudioParam` automation path from T011 handles continuous 1V/octave CV connections correctly (i.e., the CV source's output node connects directly to the worklet's `frequency` AudioParam via the existing `getAudioParamForInput()` connection mechanism, matching `Oscillator.ts`'s pitch-CV behavior exactly) — depends on T011 (Foundational)
- [x] T022 [US2] Implement the Frequency/Tune manual control's interaction with the `frequency` AudioParam: knob sets the param's base value directly when unconnected, acts as an offset/base when CV is connected (same dual-role pattern as `Oscillator.ts`) — depends on T021

**Checkpoint**: The module can now be played melodically alongside Oscillator/FM Oscillator via Keyboard, Quantizer, or Sequencer CV. Both P1 stories are complete.

---

## Phase 5: User Story 3 - Shaping String Character with Damping and Excitation Tone (Priority: P2)

**Goal**: Damping and Tone controls produce audibly distinct decay times and pluck brightness.

**Independent Test**: Trigger repeatedly while sweeping Damping (confirm decay time lengthens/shortens) and Tone (confirm brightness changes) independently.

### Tests for User Story 3

- [x] T023 [P] [US3] Write a DSP unit test asserting `dampingToFeedbackCoefficient(0)` produces a fast-decay coefficient and `dampingToFeedbackCoefficient(1)` produces a coefficient approaching but never reaching `KARPLUS_STRONG_MAX_FEEDBACK_COEFFICIENT` (Edge Case: "Damping at absolute maximum must not sustain indefinitely") — `tests/worklets/karplus-strong-dsp.test.ts`

### Implementation for User Story 3

- [x] T024 [US3] Wire the Damping control to the worklet's `damping` k-rate `AudioParam`, following the same `parameter.linkAudioParam(...)` pattern `Oscillator.ts` uses for CV visualization (lines 64-72) — depends on T007/T008 (Foundational), T009
- [x] T025 [US3] Implement the Tone/Pick-Position control's excitation-filtering effect in the worklet: on `pluck`, apply a one-pole lowpass to the noise burst before it enters the delay line, coefficient derived from the current `tone` value sent via `{type:'setTone', value}` message (research.md Decision 3/5) — depends on T008
- [x] T026 [US3] Wire the Tone control on `KarplusStrongComponent` to send `port.postMessage({type:'setTone', value})` on change — depends on T025, T009

**Checkpoint**: Damping and Tone are both independently sweepable with clearly audible effect, satisfying SC-003 and SC-004.

---

## Phase 6: User Story 4 - Percussive "Stretched" Mode for Drum-Like Sounds (Priority: P3)

**Goal**: A Mode selector switches between clean plucked-string decay ("String") and sustained/percussive decay ("Stretched").

**Independent Test**: Trigger at identical pitch/damping in both modes and confirm clearly distinguishable decay characters.

### Tests for User Story 4

- [x] T027 [P] [US4] Write a DSP unit test asserting the `STRETCHED` feedback-filter variant (probabilistic sign inversion) produces measurably different output statistics (e.g., sign-flip rate, envelope decay slope) than `STRING` given identical seed/damping inputs — `tests/worklets/karplus-strong-dsp.test.ts`

### Implementation for User Story 4

- [x] T028 [US4] Implement the `STRETCHED` mode variant (probabilistic sign-inversion per Jaffe & Smith, tied to the current damping value) inside the `applyStretchedFeedback` helper function created in T007a — depends on T007a
- [x] T029 [US4] Wire the Mode selector (Dropdown control) on `KarplusStrongComponent` to send `port.postMessage({type:'setMode', mode})` on change, applied only to the *next* pluck (not retroactively altering an in-flight decay, per spec Assumption and US4 AC3) — depends on T028, T009 — *(component-side `updateAudioParameter`/`sendMode` wiring done; the Dropdown UI control itself is T032, not yet implemented)*

**Checkpoint**: Both modes are selectable and produce clearly distinguishable output, satisfying SC-005.

---

## Phase 7: User Story 5 - Visual Feedback and Patch Persistence (Priority: P2)

**Goal**: A live waveform/level display on the module's canvas panel, and full parameter + cable persistence across save/reload.

**Independent Test**: Trigger and observe the canvas panel for a visual response; save/reload the patch and verify all parameters and cables are restored exactly.

### Tests for User Story 5

- [x] T030 [P] [US5] Write a component-level test asserting a full serialize → deserialize round trip preserves non-default Frequency, Damping, Tone, and Mode values exactly (SC-006) — `tests/components/generators/KarplusStrong.test.ts`

### Implementation for User Story 5

- [ ] T031 [P] [US5] Create `src/canvas/displays/KarplusStrongDisplay.ts` following the `Oscilloscope`/`VuMeter` pattern: reads `analyserNode.getFloatTimeDomainData()` each render-pass frame and draws a live waveform, driven by the existing per-frame canvas render pass (no new scheduler needed, per research.md Decision 6) — depends on T010 (Foundational, `analyserNode` creation)
- [ ] T032 [US5] Add a `KARPLUS_STRONG` case to the private `createControls()` method in `src/canvas/CanvasComponent.ts` instantiating `Knob` controls for Frequency, Damping, Tone and a `Dropdown` for Mode, plus display wiring to instantiate `KarplusStrongDisplay` and a display-name map entry (per project memory: `componentLayout.ts` alone does not create controls) — depends on T014 (Foundational sizing), T031
- [ ] T033 [US5] Confirm MIDI Learn works on Frequency, Damping, and Tone controls (FR-011) by verifying the new `Knob` instances from T032 use the same MIDI-mappable control class/pattern as existing components — depends on T032

**Checkpoint**: The module has full visual feedback and persists correctly; all 5 user stories are independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all stories.

- [ ] T034 [P] Run `npm run lint` and fix any warnings across all new/modified files (`src/worklets/`, `src/components/generators/KarplusStrong.ts`, `src/canvas/CanvasComponent.ts`, `src/canvas/displays/KarplusStrongDisplay.ts`, `src/utils/componentLayout.ts`, `src/components/registerComponents.ts`, `src/core/types.ts`)
- [x] T035 [P] Run `vitest run` and confirm all new tests pass and existing suites are unaffected (no regressions in `Oscillator`/`ADSREnvelope`/`SlewLimiter` tests from shared-pattern changes) — 76 files / 1684 tests passing
- [ ] T038 [P] Write an automated stress test in `tests/components/generators/KarplusStrong.test.ts` (or a dedicated `KarplusStrong.stress.test.ts`) that calls `pluck()` at a simulated rate of ≥10 times/sec against a mock `AudioContext`/worklet stub and asserts: no thrown errors, no `NaN`/`Infinity` produced in the output signal, and no unbounded growth in internal delay-line values — automates SC-007 rather than relying solely on manual verification
- [ ] T036 Manually execute `specs/034-karplus-strong-oscillator/quickstart.md` end-to-end in the dev server (`npm run dev`), confirming SC-001 through SC-008 hold, including rapid re-trigger stability at ≥10 triggers/sec (SC-007, cross-checked against T038's automated result) and no perceptible latency/responsiveness degradation (SC-008)
- [ ] T037 Verify backward compatibility: load a pre-existing patch file (containing no Karplus-Strong component) and confirm it still loads without error (per plan.md Constraints: "Patch format changes must be backward-compatible")

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (the worklet processor and component skeleton are shared by every story)
- **User Story 1 (Phase 3)** and **User Story 2 (Phase 4)**: Both depend only on Foundational; independent of each other (US1 exercises trigger/pluck, US2 exercises pitch — different code paths on the same skeleton) — can proceed in parallel
- **User Story 3 (Phase 5)**: Depends on Foundational; independent of US1/US2 (Damping/Tone are separate parameters), though practically easiest to verify once US1 (audible pluck) exists
- **User Story 4 (Phase 6)**: Depends on Foundational; independent of US1/US2/US3, though practically easiest to verify once US1 (audible pluck) exists
- **User Story 5 (Phase 7)**: Depends on Foundational (needs `analyserNode` from T010, sizing from T014); independent of US1–US4's audio logic, though visually most meaningful once US1 produces audible output
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: No dependencies on other stories — MVP
- **US2 (P1)**: No dependencies on other stories — can be built in parallel with US1
- **US3 (P2)**: No dependencies on other stories
- **US4 (P3)**: No dependencies on other stories
- **US5 (P2)**: No dependencies on other stories

### Within Each User Story

- Tests written before/alongside implementation tasks they validate
- Worklet-side changes before component-side wiring that depends on them
- Story complete and checkpointed before moving to the next priority (if working sequentially)

### Parallel Opportunities

- All Setup tasks marked [P] (T002, T003, T004) can run in parallel after T001
- T005/T006 (DSP helpers + their tests) can run in parallel with T009 (component skeleton) — different files
- Once Foundational (Phase 2) completes: US1 (Phase 3) and US2 (Phase 4) can be implemented in parallel by different developers; US3/US4/US5 can each start in parallel too, since none share files with each other (worklet mode-filter code in US3/US4 does touch the same `process()` method — see note below)
- **Note**: T024/T025 (US3, damping/tone) and T028 (US4, stretched mode) all touch `src/worklets/karplus-strong.worklet.ts`'s `process()` method — these are logically parallel stories but should be sequenced or carefully merged if worked on simultaneously by different people, to avoid conflicting edits to the same function

---

## Parallel Example: Foundational Phase

```bash
# Launch DSP helpers + tests together (different files from component skeleton):
Task: "Implement pure DSP helpers in src/worklets/karplus-strong-dsp.ts"
Task: "Write DSP helper unit tests in tests/worklets/karplus-strong-dsp.test.ts"

# In parallel, start the component skeleton (different files):
Task: "Create KarplusStrongComponent class in src/components/generators/KarplusStrong.ts"
```

## Parallel Example: User Story 1 + User Story 2

```bash
# After Foundational completes, two developers can work simultaneously:
Task: "US1 — Implement pluck() and trigger wiring in src/components/generators/KarplusStrong.ts"
Task: "US2 — Verify/finish 1V/octave Pitch CV wiring in src/components/generators/KarplusStrong.ts"
# Note: both touch the same file (KarplusStrong.ts) but different methods —
# coordinate merges even though tasks are conceptually independent.
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (trigger → audible decaying pluck)
4. **STOP and VALIDATE**: Confirm a trigger produces a plucked tone that decays on its own, per quickstart.md steps 1-5 (using a fixed 440 Hz default, no CV needed yet)
5. Demo: Keyboard gate → Karplus-Strong → Master Out

### Incremental Delivery

1. Setup + Foundational → shared worklet/component skeleton ready
2. Add US1 → pluck produces audible decaying tone → validate → demo (MVP!)
3. Add US2 → pitch tracks 1V/octave CV → validate → demo (now melodically playable)
4. Add US3 → Damping/Tone shape the sound → validate → demo
5. Add US4 → Stretched mode for percussion → validate → demo
6. Add US5 → visual feedback + persistence → validate → demo (feature-complete)
7. Polish (Phase 8) → lint, full test run, quickstart validation, backward-compatibility check

### Parallel Team Strategy

With multiple developers, after Foundational is done:
- Developer A: US1 (trigger/pluck)
- Developer B: US2 (pitch CV) — coordinate on shared edits to `KarplusStrong.ts`
- Developer C: US5 (display + persistence) — mostly separate files
- US3/US4 (Damping/Tone/Mode) are best sequenced after US1 lands, since they're most easily validated against an already-audible pluck, and both touch the worklet's `process()` method

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- This feature introduces the codebase's first `AudioWorkletNode` — Foundational phase carries more architectural weight than a typical feature's setup phase; do not skip or rush T007/T008/T010
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence
