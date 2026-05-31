# Tasks: Ring Modulator

**Input**: Design documents from `/specs/028-ring-modulator/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Register the new `ComponentType` and wire it into the shared infrastructure that all phases depend on.

- [x] T001 Add `RING_MODULATOR = 'ring-modulator'` to `ComponentType` enum in `src/core/types.ts`
- [x] T002 Add `ComponentType.RING_MODULATOR` to the `bypassableTypes` array in `SynthComponent.isBypassable()` in `src/components/base/SynthComponent.ts`
- [x] T003 Add port counts for `RING_MODULATOR` (inputs: 2, outputs: 1) to `getPortCounts()` and empty control layout (`return {}`) to `getControlLayout()` in `src/utils/componentLayout.ts` — both edits in one file, do together

**Checkpoint**: `ComponentType.RING_MODULATOR` exists; `isBypassable()` returns true for it; layout calculates correct dimensions — no audio code yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core audio component — required for all user stories and the audio-correctness verification in US3.

**⚠️ CRITICAL**: All user story phases depend on this component existing and producing correct audio.

- [x] T005 Create `src/components/effects/RingModulator.ts` with the `RingModulator` class extending `SynthComponent`:
  - Constructor: `super(id, ComponentType.RING_MODULATOR, 'Ring Modulator', position)`
  - Add two audio inputs: `addInput('audio-in', 'Audio In', SignalType.AUDIO)` and `addInput('modulator', 'Modulator In', SignalType.AUDIO)`
  - Add one audio output: `addOutput('output', 'Audio Out', SignalType.AUDIO)`
  - No `addParameter()` calls
- [x] T006 Implement `createAudioNodes()` in `src/components/effects/RingModulator.ts`:
  - Create `carrierBypassGain` (GainNode, gain=1.0) — carrier signal entry and bypass path node
  - Create `modulatorEntry` (GainNode, gain=1.0) — modulator signal entry node
  - Create `multiplierGain` (GainNode, gain AudioParam base=0.0) — performs carrier × modulator
  - Create `outputGain` (GainNode, gain=1.0) — output node
  - Wire: `carrierBypassGain → multiplierGain` (signal input)
  - Wire: `modulatorEntry → multiplierGain.gain` (AudioParam — drives gain with modulator signal)
  - Wire: `multiplierGain → outputGain`
  - Register all four nodes via `registerAudioNode()`
- [x] T007 Implement `destroyAudioNodes()` in `src/components/effects/RingModulator.ts`: disconnect and null all four nodes in reverse creation order
- [x] T008 Implement `updateAudioParameter(_parameterId: string, _value: number): void` as a no-op in `src/components/effects/RingModulator.ts` (no parameters exist)
- [x] T009 Implement `getInputNode(portId?: string): AudioNode | null` in `src/components/effects/RingModulator.ts`:
  - `'audio-in'` → return `carrierBypassGain`
  - `'modulator'` → return `modulatorEntry`
  - default → return `carrierBypassGain`
- [x] T010 Implement `getOutputNode(): AudioNode | null` in `src/components/effects/RingModulator.ts` — return `outputGain`
- [x] T011 Implement `enableBypass()` in `src/components/effects/RingModulator.ts`:
  - Store connections in `_bypassConnections`: `{from: carrierBypassGain, to: multiplierGain}`
  - Disconnect `carrierBypassGain`; disconnect `multiplierGain`
  - Connect `carrierBypassGain → outputGain` (carrier passes through unchanged)
- [x] T012 Implement `disableBypass()` in `src/components/effects/RingModulator.ts`:
  - Disconnect `carrierBypassGain`
  - Restore `_bypassConnections` connections; also reconnect `multiplierGain → outputGain`
  - Clear `_bypassConnections`
- [x] T013 [P] Create `tests/components/RingModulator.test.ts` with full unit test suite:
  - Mock setup: `createGain` only (no oscillators or delay nodes needed)
  - Constructor tests: two input ports, one output port, no parameters, `isBypassable()` returns true
  - `createAudioNodes` tests: four nodes registered, `multiplierGain.gain.value === 0.0`, connections verified
  - `getInputNode` routing: `'audio-in'` → `carrierBypassGain`, `'modulator'` → `modulatorEntry`, default → `carrierBypassGain`
  - `getOutputNode` returns `outputGain`
  - Bypass tests: `setBypass(true)` sets `isBypassed`; `carrierBypassGain` connected to `outputGain` when bypassed; `multiplierGain` reconnected to `outputGain` on `setBypass(false)`; restored on `setBypass(false)`
  - Serialize: `isBypassed: true` present when bypassed; absent when not bypassed
  - **Note — manual-only acceptance gates (not automatable in Vitest)**: SC-001 (output spectrum −40 dB at 440 Hz) and SC-004 (50 ms silence on disconnect) require a live audio context and spectrum analyser. Verify these manually via the Phase 3 independent test. Do not add failing stubs for them.

**Checkpoint**: `vitest run tests/components/RingModulator.test.ts` passes. The component can be instantiated and activated in isolation.

---

## Phase 3: User Story 1 — Create Metallic / Bell-Like Timbres (Priority: P1) 🎯 MVP

**Goal**: Wire the RingModulator into the app so it appears in the component menu, can be dropped onto the canvas, accepts two audio connections, and produces ring-modulated output through Master Out.

**Independent Test** (from spec.md): Connect Oscillator A (440 Hz sine) → Ring Modulator Audio In; Oscillator B (220 Hz sine) → Ring Modulator Modulator In; route output to Master Out. Play audio — the result must be audibly different from either input, containing sum (660 Hz) and difference (220 Hz) frequencies with neither 440 Hz dominant.

- [x] T014 [US1] Import `RingModulator` and register it in `registerAllComponents()` in `src/components/registerComponents.ts`:
  ```ts
  componentRegistry.register(
    ComponentType.RING_MODULATOR,
    'Ring Modulator',
    'Analog-style signal multiplier for AM synthesis',
    'Effects',
    (id, position) => new RingModulator(id, position),
    calculateComponentDimensions(ComponentType.RING_MODULATOR)
  );
  ```
- [x] T015 [P] [US1] Add icon symbol `[ComponentType.RING_MODULATOR]: '⊗'` to the icon map in `src/ui/Sidebar.ts`
- [x] T016 [P] [US1] Add `[ComponentType.RING_MODULATOR]: '⊗'` to the component icon/display-name map in `src/canvas/CanvasComponent.ts` (wherever other effect icons are declared)

**Checkpoint**: Drop a Ring Modulator onto the canvas from the Effects section of the sidebar. Connect two oscillators. Verify audio output contains ring-modulated timbres. The bypass button appears in the header and toggles correctly.

---

## Phase 4: User Story 2 — Patch Persistence (Priority: P2)

**Goal**: The Ring Modulator saves to and reloads from localStorage with position and connections intact.

**Independent Test** (from spec.md): Build a patch with a Ring Modulator and both inputs/output connected. Save. Reload page. Confirm the component reappears at the same position with all connections restored and audio behaviour unchanged.

- [x] T017 [US2] Verify that `PatchSerializer` round-trips a `RingModulator` correctly by running the full test suite (`vitest run`) — no code changes expected; confirm `ComponentData` with `type: 'ring-modulator'` and `parameters: {}` serialises and deserialises without error
- [x] T018 [US2] Manually test patch save/reload: create a patch, save via UI, reload page, confirm Ring Modulator reappears with connections. Fix any registration or deserialization errors found.

**Checkpoint**: Ring Modulator survives a save/reload cycle. Loading a patch without a Ring Modulator produces no errors.

---

## Phase 5: User Story 3 — LFO as Modulator (Priority: P3)

**Goal**: Verify (no new code needed) that connecting an LFO to the Modulator In port produces amplitude-modulation effects at the LFO rate.

**Independent Test** (from spec.md): Connect LFO (sine, 4 Hz) → Ring Modulator Modulator In; Oscillator → Ring Modulator Audio In; route to Master Out. The output must pulse rhythmically at 4 Hz.

- [x] T019 [US3] Manual verification: connect LFO (4 Hz sine) → Modulator In, Oscillator → Audio In, output → Master Out. Confirm rhythmic amplitude pulsing at LFO rate. Document result. No code changes expected — this story exercises the general-purpose `getInputNode('modulator')` path already implemented in Phase 2.

**Checkpoint**: LFO-driven ring modulation works without additional implementation.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Lint pass, final validation, and test run to confirm nothing was broken.

- [x] T020 [P] Run `npm run lint` and fix any TypeScript or ESLint errors introduced by the new files
- [x] T021 Run full test suite `vitest run` and confirm all tests pass (including pre-existing tests)
- [x] T022 [P] Add `RING_MODULATOR` to the `effectsBypass.test.ts` effects array so the generic bypass toggle tests cover it alongside Bitcrusher, Flanger, Phaser, and Tremolo in `tests/components/effectsBypass.test.ts`
- [x] T023 Add a User Guide entry for the Ring Modulator to HelpSidebar.ts 

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. T001→T002→T003 run sequentially.
- **Foundational (Phase 2)**: Depends on Phase 1. T005–T012 must run sequentially (each task builds on the previous). T013 (tests) can start in parallel with T005 once the mock setup is written.
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion. T015 and T016 can run in parallel with T014.
- **User Story 2 (Phase 4)**: Depends on Phase 3 (component must be registered to appear in patches).
- **User Story 3 (Phase 5)**: Depends on Phase 3 (component must be on canvas and connectable).
- **Polish (Phase 6)**: Depends on all implementation phases.

### Within Phase 2

T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 (sequential — each builds the class)
T013 can start once mocks are decided (written against the component's public interface, TDD-style)

### Parallel Opportunities

- T015 + T016 are the only setup-phase parallel opportunities now that T003/T004 are merged
- T015 + T016 (different files: Sidebar.ts vs CanvasComponent.ts)
- T020 + T022 (lint vs test file addition — different files)

---

## Parallel Example: Phase 2 (Foundational)

```
# Write tests and implement in parallel (TDD approach):
Task T013: "Create tests/components/RingModulator.test.ts with full unit test suite"
↕ run in parallel with ↕
Tasks T005–T012: "Implement RingModulator.ts class, nodes, bypass"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T004)
2. Complete Phase 2: Foundational (T005–T013) — **CRITICAL GATE**
3. Complete Phase 3: User Story 1 (T014–T016)
4. **STOP and VALIDATE**: Drop component, connect two oscillators, verify ring-modulated audio output
5. Run `vitest run` — all tests must pass

### Incremental Delivery

1. Phase 1 + Phase 2 → Component exists and is tested
2. Phase 3 → Component appears in UI and produces audio (MVP)
3. Phase 4 → Patches save and reload correctly
4. Phase 5 → LFO modulation verified
5. Phase 6 → Lint + full test suite green

---

## Notes

- The Ring Modulator has no parameters, so `updateAudioParameter` is a no-op — do not add any parameter handling
- `multiplierGain.gain.value = 0.0` (base) is critical for FR-004 (silence when modulator absent)
- The bypass path must wire `carrierBypassGain → outputGain`, not `multiplierGain → outputGain`, to avoid the DC-zero multiplication
- No new `PatchData` fields needed — `ComponentData.parameters: {}` is already valid for parameter-less components
- No changes to `CanvasComponent.createControls()` switch statement — the absence of a `RING_MODULATOR` case correctly produces zero controls (the default), and the bypass button is rendered separately via `isBypassable()`
