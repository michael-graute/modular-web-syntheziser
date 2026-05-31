# Tasks: Arpeggiator

**Input**: Design documents from `/specs/029-arpeggiator/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Register the new `ComponentType` and wire it into the shared infrastructure that all phases depend on.

- [x] T001 Add `ARPEGGIATOR = 'arpeggiator'` to the `ComponentType` enum in `src/core/types.ts`
- [x] T002 Add port counts for `ARPEGGIATOR` (inputs: 2, outputs: 2) to `getPortCounts()` and a 4-knob control layout to `getControlLayout()` in `src/utils/componentLayout.ts` — both edits in one file, do together:
  - `getPortCounts`: return `{ inputs: 2, outputs: 2 }`
  - `getControlLayout`: return layout for 4 stepped knobs (direction, octaves, subdivision, gateLength) with no canvas display area

**Checkpoint**: `ComponentType.ARPEGGIATOR` exists; layout returns correct port counts and control layout — no audio code yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core Arpeggiator component — required by all user story phases.

**⚠️ CRITICAL**: All user story phases depend on this component existing and producing correct CV/Gate output.

- [x] T003 Create `src/components/utilities/Arpeggiator.ts` with the `Arpeggiator` class extending `SynthComponent`:
  - Constructor: `super(id, ComponentType.ARPEGGIATOR, 'Arpeggiator', position)`
  - Add inputs: `addInput('cv-in', 'CV In', SignalType.CV)` and `addInput('gate-in', 'Gate In', SignalType.GATE)`
  - Add outputs: `addOutput('cv-out', 'CV Out', SignalType.CV)` and `addOutput('gate-out', 'Gate Out', SignalType.GATE)`
  - Add parameters: `direction` (default 0, min 0, max 3), `octaves` (default 1, min 1, max 4), `subdivision` (default 2 = 1/16, min 0, max 3), `gateLength` (default 1 = medium, min 0, max 2)
  - Private fields: `noteSequence: number[]`, `_stepCycle: number[]`, `stepIndex: number`, `_prevGateHigh: boolean`, `_stepTimer: number | null`, `currentBpm: number`, `_cvGetter: (() => number) | null`, `_gateGetter: (() => number) | null`, `_globalBpmUnsubscribe: (() => void) | null`
  - Private audio node fields: `cvOutputNode: ConstantSourceNode | null`, `gateOutputNode: ConstantSourceNode | null`, `cvInputNode: GainNode | null`, `gateInputNode: GainNode | null`
- [x] T004 Implement `createAudioNodes()` in `src/components/utilities/Arpeggiator.ts`:
  - Create `cvInputNode` (GainNode, gain=1.0) — CV pitch input passthrough
  - Create `gateInputNode` (GainNode, gain=1.0) — Gate input passthrough
  - Create `cvOutputNode` (ConstantSourceNode, offset=0.0) — start it
  - Create `gateOutputNode` (ConstantSourceNode, offset=0.0) — start it
  - Register all four via `registerAudioNode()`
  - Read initial BPM: `this.currentBpm = globalBpmController.getBpm()`
  - Subscribe to BPM changes: store unsubscribe in `_globalBpmUnsubscribe`; on event update `currentBpm` and restart clock
  - Start step clock via `startClock()`
- [x] T005 Implement `destroyAudioNodes()` in `src/components/utilities/Arpeggiator.ts`:
  - Call `stopClock()`
  - Call `_globalBpmUnsubscribe?.()` and null it
  - Stop and disconnect all four nodes in reverse order; null each
  - Reset `noteSequence = []`, `stepIndex = 0`
- [x] T006 Implement `updateAudioParameter(parameterId, value)` in `src/components/utilities/Arpeggiator.ts`:
  - On `direction` or `octaves` change: call `rebuildStepCycle()` (clamps `stepIndex` to new cycle length)
  - On `subdivision` change: call `rebuildStepCycle()` AND then call `startClock()` — the `setInterval` interval must be restarted with the new step duration; `rebuildStepCycle` alone does not update the running timer
  - On `gateLength` change: no rebuild needed (applied on next tick)
- [x] T007 Implement private `stepIntervalMs(): number` in `src/components/utilities/Arpeggiator.ts`:
  - Map `subdivision` parameter value (0–3) to fraction (1.0 / 0.5 / 0.25 / 0.125) using `SUBDIVISION_FRACTIONS` constant from contracts
  - Return `timingCalculator.calculateGateDuration(this.currentBpm, fraction)`
- [x] T008 Implement private `buildStepCycle(): number[]` in `src/components/utilities/Arpeggiator.ts`:
  - Sort `noteSequence` ascending → `baseNotes`
  - Expand across octaves: for each octave 0..(octaves-1), append each base note + `octave * CV_OCTAVE`
  - Apply direction: Up = as-is; Down = reversed; Up-Down = ascending + inner reversed (no top/bottom repeat: `[...expanded, ...expanded.slice(1, -1).reverse()]`); Random = shuffle copy with `Math.random()`
  - Return resulting array
- [x] T009 Implement private `rebuildStepCycle()` in `src/components/utilities/Arpeggiator.ts`:
  - Recompute `_stepCycle = buildStepCycle()`
  - Clamp `stepIndex` to `Math.min(stepIndex, Math.max(0, _stepCycle.length - 1))`
- [x] T010 Implement private `tick()` in `src/components/utilities/Arpeggiator.ts`:
  - If `_gateGetter` is set: read gate value; if gate-high (≥ 0.5) and was previously low, latch `_cvGetter?.() ?? 0` into `noteSequence` (max 8, evict oldest); rebuild cycle; else if gate-low and was previously high, remove that pitch from `noteSequence`; rebuild cycle
  - If `_stepCycle` empty: ensure `gateOutputNode.offset.value = 0`; return
  - Advance `stepIndex = (stepIndex + 1) % _stepCycle.length`
  - Schedule CV: `cvOutputNode.offset.setValueAtTime(_stepCycle[stepIndex], ctx.currentTime)`
  - Schedule gate high: `gateOutputNode.offset.setValueAtTime(1, ctx.currentTime)`
  - Schedule gate low after gate duty: `gateOutputNode.offset.setValueAtTime(0, ctx.currentTime + gateDurationS)` where `gateDurationS = stepIntervalMs() * GATE_LENGTH_FRACTIONS[gateLength] / 1000`
- [x] T011 Implement private `startClock()` and `stopClock()` in `src/components/utilities/Arpeggiator.ts`:
  - `startClock`: `stopClock()` first; `_stepTimer = window.setInterval(() => this.tick(), this.stepIntervalMs())`
  - `stopClock`: `clearInterval(_stepTimer); _stepTimer = null`
- [x] T012 Implement `getInputNode(portId?)` and `getInputNodeByPort(portId)` in `src/components/utilities/Arpeggiator.ts`:
  - `'gate-in'` → return `gateInputNode`
  - default / `'cv-in'` → return `cvInputNode`
- [x] T013 Implement `getOutputNode()` and `getOutputNodeByPort(portId)` in `src/components/utilities/Arpeggiator.ts`:
  - `'gate-out'` → return `gateOutputNode`
  - default / `'cv-out'` → return `cvOutputNode`
- [x] T014 Implement getter registration and port lifecycle methods in `src/components/utilities/Arpeggiator.ts`:
  - `setCvGetter(fn: () => number): void` — store in `_cvGetter`
  - `setGateGetter(fn: () => number): void` — store in `_gateGetter`; reset `_prevGateHigh = false`
  - `clearCvGetter(portId?: string): void` — null `_cvGetter`
  - `clearGateGetter(portId?: string): void` — null `_gateGetter`; reset `_prevGateHigh = false`
  - `onInputDisconnected(portId: string): void` — if `portId === 'cv-in'`: call `clearCvGetter()`; if `portId === 'gate-in'`: call `clearGateGetter()`, set `gateOutputNode?.offset.setValueAtTime(0, ctx.currentTime)` to stop any in-progress gate pulse, and clear `noteSequence` + rebuild step cycle so the Arpeggiator silences immediately (covers the edge case: "CV input disconnected mid-arpeggio → Gate output stops")
  - `onInputConnected(portId: string): void` — no-op (getters are registered by ConnectionManager after this call); override required to satisfy abstract contract
- [x] T015 [P] Create `tests/components/Arpeggiator.test.ts` with full unit test suite:
  - Mock setup: `createGain`, `createConstantSource`, `eventBus.on`, `globalBpmController.getBpm`
  - Constructor tests: 2 inputs (cv-in, gate-in), 2 outputs (cv-out, gate-out), 4 parameters with correct defaults, `isBypassable()` returns false
  - `createAudioNodes` tests: 4 nodes registered; `cvOutputNode` and `gateOutputNode` started; BPM subscribed
  - `buildStepCycle` tests: Up (ascending), Down (descending), Up-Down (no endpoint repeat), Up-Down with exactly 2 notes produces `[low, high]` cycle (no boundary duplication), Random (all notes present); octave 2 doubles the notes with +1.0 CV offset
  - `tick` tests: step advances; CV and gate scheduled; gate goes low after duty cycle; empty sequence emits no gate
  - Getter registration: `setCvGetter`/`setGateGetter` store; `clearCvGetter`/`clearGateGetter` null them
  - BPM change: clock restarts with new interval
  - Serialize: all 4 parameter values present in `parameters` output

**Checkpoint**: `vitest run tests/components/Arpeggiator.test.ts` passes. The component can be instantiated, step-cycles computed, and CV/Gate scheduling verified in isolation.

---

## Phase 3: User Story 1 — Core Arpeggio from CV Input (Priority: P1) 🎯 MVP

**Goal**: Wire the Arpeggiator into the app so it appears in the Utilities sidebar, can be dropped onto the canvas, accepts CV+Gate connections from a Keyboard, and produces stepping CV+Gate output through an ADSR → VCA → Master Out chain.

**Independent Test** (from spec.md): Connect Keyboard → Arpeggiator CV In + Gate In; connect Arpeggiator CV Out → Oscillator; connect Arpeggiator Gate Out → ADSR → VCA → Master Out. Hold multiple keys — arpeggio must step through them in the selected direction.

- [x] T016 [US1] Import `Arpeggiator` and register it in `registerAllComponents()` in `src/components/registerComponents.ts`:
  ```ts
  componentRegistry.register(
    ComponentType.ARPEGGIATOR,
    'Arpeggiator',
    'Steps through held notes at a BPM-synced rate',
    'Utilities',
    (id, position) => new Arpeggiator(id, position),
    calculateComponentDimensions(ComponentType.ARPEGGIATOR)
  );
  ```
- [x] T017 [P] [US1] Add icon `[ComponentType.ARPEGGIATOR]: '⬆'` to the icon map in `src/ui/Sidebar.ts`
- [x] T018 [P] [US1] Add `[ComponentType.ARPEGGIATOR]: 'Arpeggiator'` to `getDisplayName()` in `src/canvas/CanvasComponent.ts`
- [x] T019 [US1] Add `case ComponentType.ARPEGGIATOR:` to `createControls()` in `src/canvas/CanvasComponent.ts` with 4 stepped knobs:
  - `direction` knob: labels `['Up', 'Dn', 'U-D', 'Rnd']`
  - `octaves` knob: labels `['1', '2', '3', '4']`
  - `subdivision` knob: labels `['1/4', '1/8', '1/16', '1/32']`
  - `gateLength` knob: labels `['Sht', 'Med', 'Lng']`
- [x] T020 [US1] Register CV and Gate getter functions in `src/canvas/ConnectionManager.ts` when connecting any CV/Gate source to the Arpeggiator's `cv-in` / `gate-in` ports — add a block analogous to the existing StepSequencer arp block (lines ~144–152):
  ```ts
  if (targetComponent.synthComponent instanceof Arpeggiator) {
    const arp = targetComponent.synthComponent;
    const src = sourceComponent.synthComponent;
    if (targetPortId === 'cv-in') arp.setCvGetter(() => (src as any).getCurrentFrequency?.() ?? 0);
    if (targetPortId === 'gate-in') arp.setGateGetter(() => (src as any).getGateValue?.() ?? 0);
  }
  ```
  Note: `getCurrentFrequency()` and `getGateValue()` are the actual method names on `KeyboardInput` (matching the StepSequencer arp block at lines ~150–151 of `ConnectionManager.ts`). Use `(src as any)` for non-`KeyboardInput` sources that may not expose these methods; the `?? 0` fallback keeps the gate silent if the method is absent.
  Also add the disconnect handler: when an arp port is disconnected, call `arp.clearCvGetter()` (for `cv-in`) or `arp.clearGateGetter()` (for `gate-in`) — mirrors the `clearArpSources` call for StepSequencer.

**Checkpoint**: Drop an Arpeggiator from the Utilities sidebar. Connect Keyboard CV Out → Arpeggiator CV In, Keyboard Gate Out → Arpeggiator Gate In. Connect Arpeggiator CV Out → Oscillator Frequency. Connect Arpeggiator Gate Out → ADSR. Hold keys — audible arpeggio steps.

---

## Phase 4: User Story 2 — Octave Range Control (Priority: P2)

**Goal**: The octave range parameter expands the step cycle across multiple octaves above the source notes.

**Independent Test** (from spec.md): Hold a 3-note chord with octaves=2 and direction=Up. The step cycle must play all 3 notes in the source octave then all 3 notes one octave higher before repeating.

- [x] T021 [US2] Verify `buildStepCycle()` in `src/components/utilities/Arpeggiator.ts` correctly transposes by octave: each note in octave N gets `+ N * CV_OCTAVE` added to its CV value. This is already implemented in T008 — confirm the test in T015 covers the octave-2 case. If test is missing, add it to `tests/components/Arpeggiator.test.ts`.
- [x] T022 [US2] Manual verification: set octaves=2, hold a chord, confirm two octaves of notes play before cycling. No code changes expected.

**Checkpoint**: Octave range parameter produces audibly correct multi-octave arpeggios.

---

## Phase 5: User Story 3 — Rate and BPM Sync (Priority: P2)

**Goal**: Subdivision parameter and BPM sync produce correctly timed step rates. BPM changes take effect immediately.

**Independent Test** (from spec.md): Set BPM=120, rate=1/8. Count gate pulses over 4 beats — must be exactly 8 (240 per minute).

- [x] T023 [US3] Verify `stepIntervalMs()` in `src/components/utilities/Arpeggiator.ts` returns correct values for all 4 subdivision options at BPM=120: 500ms (1/4), 250ms (1/8), 125ms (1/16), 62.5ms (1/32). Add timing unit tests to `tests/components/Arpeggiator.test.ts` if not already present from T015.
- [x] T024 [US3] Manual verification: set BPM=120, rate=1/8, count gate pulses for 4 beats. Change BPM to 60 while playing — confirm rate halves immediately. No code changes expected.

**Checkpoint**: Step rate matches BPM subdivision precisely. BPM changes apply within one step.

---

## Phase 6: User Story 4 — Patch Persistence (Priority: P3)

**Goal**: Arpeggiator parameters and connections survive a full save/reload cycle.

**Independent Test** (from spec.md): Build a patch, set all 4 parameters to non-default values, save, reload page. Confirm parameters and connections are restored identically.

- [x] T025 [US4] Run full test suite `vitest run` — no code changes expected; confirm `ComponentData` with `type: 'arpeggiator'` and all 4 parameters serialises and deserialises without error via `PatchSerializer`.
- [x] T026 [US4] Manual test: create patch, set direction=Down, octaves=3, rate=1/4, gateLength=Long, connect and save. Reload — confirm all values and connections restored. Fix any deserialization errors found.

**Checkpoint**: Arpeggiator survives a full save/reload cycle.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Lint pass, test suite validation, and final verification.

- [x] T027 [P] Run `npx tsc --noEmit` and fix any TypeScript errors introduced by the new files
- [x] T028 Run full test suite `vitest run` and confirm all tests pass (including pre-existing tests)
- [x] T029 Update `src/ui/HelpSidebar.ts` with two changes in the same edit: (1) add 'Arpeggiator' to the Utilities list in the component overview section; (2) add a full Arpeggiator entry under the Utilities section with port descriptions (CV In, Gate In, CV Out, Gate Out) and parameter descriptions (Direction: Up/Down/Up-Down/Random, Octaves: 1–4, Rate: 1/4 / 1/8 / 1/16 / 1/32, Gate Length: Short/Medium/Long)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. T001→T002 run sequentially.
- **Foundational (Phase 2)**: Depends on Phase 1. T003–T014 run sequentially (each builds the class). T015 (tests) can start in parallel with T003 once the mock setup is written.
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion. T017, T018 can run in parallel with T016.
- **User Story 2 (Phase 4)**: Depends on Phase 3 (component must be on canvas). T021 is a verification only.
- **User Story 3 (Phase 5)**: Depends on Phase 3 (component must be live). T023 is a unit test verification.
- **User Story 4 (Phase 6)**: Depends on Phase 3 (component must be registered).
- **Polish (Phase 7)**: Depends on all implementation phases.

### Parallel Opportunities

- T015 (tests) can be written against the public interface spec while T003–T014 are implemented
- T017 + T018 (icon + display name) are different files — run together after T016
- T027 (lint) can run in parallel with T028 (test suite) — different operations
- T029 (HelpSidebar) runs after T028; it modifies one file so is sequential

---

## Parallel Example: Phase 2 (Foundational)

```
# Write tests and implement in parallel (TDD approach):
Task T015: "Create tests/components/Arpeggiator.test.ts with full unit test suite"
↕ run in parallel with ↕
Tasks T003–T014: "Implement Arpeggiator.ts — class, audio nodes, step cycle, tick, clock, getters"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T015) — **CRITICAL GATE**
3. Complete Phase 3: User Story 1 (T016–T020)
4. **STOP and VALIDATE**: Drop component, connect Keyboard, verify audible arpeggio
5. Run `vitest run` — all tests must pass

### Incremental Delivery

1. Phase 1 + Phase 2 → Component exists and is tested
2. Phase 3 → Component appears in UI and produces audio (MVP)
3. Phase 4 → Octave range verified
4. Phase 5 → BPM timing verified
5. Phase 6 → Patch persistence confirmed
6. Phase 7 → Lint + full test suite green

---

## Notes

- The Arpeggiator is NOT bypassable — do NOT add it to `bypassableTypes` in `SynthComponent.ts`
- The note-latch gate-edge detection requires tracking previous gate state (`_prevGateHigh`); add this private field to `Arpeggiator.ts` in T003
- `buildStepCycle` for Random direction must produce a new shuffle each time it's called (not a cached one), so each cycle restart picks a fresh order — use `[...expanded].sort(() => Math.random() - 0.5)`
- When `noteSequence` becomes empty, the step cycle is empty; `tick()` must not advance `stepIndex` or emit gate pulses
- ConnectionManager changes in T020 must handle the case where the source component does not expose `getOutputCvValue` or `getGateValue` — use optional chaining with `?? 0` fallback
- The `cvOutputNode` and `gateOutputNode` must be started (`node.start()`) in `createAudioNodes()` — `ConstantSourceNode` requires explicit start before it outputs
