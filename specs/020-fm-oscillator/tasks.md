# Tasks: FM Oscillator Component

**Input**: Design documents from `specs/020-fm-oscillator/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in all descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extend enums and layout utilities — no user story can be verified until these are done.

- [ ] T001 Add `FM_OSCILLATOR = 'fm-oscillator'` to `ComponentType` enum in `src/core/types.ts`
- [ ] T002 Add `FM_OSCILLATOR` port count case (`inputs: 3, outputs: 1`) to `getPortCounts()` in `src/utils/componentLayout.ts`
- [ ] T003 Add `FM_OSCILLATOR` layout options case (`hasDropdown: true, numKnobs: 3`) to `getComponentLayoutOptions()` in `src/utils/componentLayout.ts`

**Checkpoint**: Type system and layout utilities ready — `FMOscillator` can now be registered and rendered correctly.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the `FMOscillator` class and register it. All user stories depend on this.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T004 Create `src/components/generators/FMOscillator.ts` — class extending `Oscillator`, constructor sets `this.name = 'FM Oscillator'` and `this.type = ComponentType.FM_OSCILLATOR`, adds `fm` AUDIO input port, adds `fmDepth` parameter (default 100, range 0–1000, step 1, unit Hz) using constants from `specs/020-fm-oscillator/contracts/validation.ts`
- [ ] T005 Implement `createAudioNodes()` override in `src/components/generators/FMOscillator.ts` — calls `super.createAudioNodes()`, creates `fmGain` GainNode, sets `fmGain.gain.value` from `fmDepth` parameter, connects `fmGain` to `(this.getOutputNode() as OscillatorNode).frequency`, calls `this.registerAudioNode('fmInput', this.fmGain)`, links `fmDepth` param to `fmGain.gain` via `fmDepthParam.linkAudioParam()`
- [ ] T006 Implement `destroyAudioNodes()` override in `src/components/generators/FMOscillator.ts` — disconnects and nulls `fmGain`, then calls `super.destroyAudioNodes()`
- [ ] T007 Implement `getInputNode(portId?: string)` override in `src/components/generators/FMOscillator.ts` — returns `this.fmGain` when `portId === 'fm'`, otherwise delegates to `super.getInputNode(portId)`
- [ ] T008 Implement `updateAudioParameter(parameterId, value)` override in `src/components/generators/FMOscillator.ts` — when `parameterId === 'fmDepth'` calls `this.fmGain.gain.setValueAtTime(value, audioEngine.getContext().currentTime)`, otherwise delegates to `super.updateAudioParameter()`
- [ ] T009 Register `FM_OSCILLATOR` in `src/components/registerComponents.ts` — add `componentRegistry.register(ComponentType.FM_OSCILLATOR, 'FM Oscillator', 'Frequency modulation oscillator', 'Generators', (id, position) => new FMOscillator(id, position), calculateComponentDimensions(ComponentType.FM_OSCILLATOR))` alongside the existing `OSCILLATOR` entry; add `import { FMOscillator } from './generators/FMOscillator'`

**Checkpoint**: Foundation ready — FM Oscillator appears in the Generators palette and can be placed on the canvas.

---

## Phase 3: User Story 1 — Create and Hear an FM Patch (Priority: P1) 🎯 MVP

**Goal**: A user can add an FM Oscillator, connect a standard Oscillator's audio output to its FM input, and hear a distinct FM timbre.

**Independent Test**: Place two oscillators, connect one audio output → FM input, route FM Oscillator to Master Output, press play — hear a harmonically richer tone compared to a plain oscillator. Adjusting FM Depth changes the timbre.

### Tests for User Story 1

- [ ] T010 [P] [US1] Create `tests/components/generators/FMOscillator.test.ts` — test that `FMOscillator` constructor creates component with `type === ComponentType.FM_OSCILLATOR`, `name === 'FM Oscillator'`, has input ports `frequency`, `detune`, `fm` and output port `output`, has parameter `fmDepth` with default value 100
- [ ] T011 [P] [US1] Add test in `tests/components/generators/FMOscillator.test.ts` — after `activate()`, `getAudioNode('fmInput')` returns a `GainNode` instance
- [ ] T012 [P] [US1] Add test in `tests/components/generators/FMOscillator.test.ts` — `getInputNode('fm')` returns the same `GainNode` as `getAudioNode('fmInput')`
- [ ] T013 [P] [US1] Add test in `tests/components/generators/FMOscillator.test.ts` — `getInputNode('output')` (non-FM port) falls through to super and returns null (Oscillator has no audio input node)
- [ ] T014 [P] [US1] Add test in `tests/components/generators/FMOscillator.test.ts` — `getOutputNode()` returns an `OscillatorNode` (inherited, unchanged)

### Implementation for User Story 1

- [ ] T015 [US1] Verify end-to-end FM connection path in `src/canvas/ConnectionManager.ts` — confirm that connecting a source component's AUDIO output port to the FM Oscillator's `fm` AUDIO input port calls `target.getInputNode('fm')` and connects to `fmGain`; no code change expected (existing `connectTo` logic handles this); add an inline comment if the routing is non-obvious
- [ ] T016 [US1] Run `vitest run tests/components/generators/FMOscillator.test.ts` and confirm all Phase 3 tests pass

**Checkpoint**: User Story 1 fully functional — FM patch produces audible FM synthesis.

---

## Phase 4: User Story 2 — Control FM Depth Parameter (Priority: P2)

**Goal**: The FM Depth knob sweeps from 0 (no modulation, pure carrier) to 1000 Hz (maximum modulation), changing timbre in real time. Value persists across save/load.

**Independent Test**: Activate FM Oscillator with a connected modulator; change `fmDepth` from 0 → 500 → 1000 and verify `fmGain.gain.value` updates accordingly. Save patch, reload, confirm `fmDepth` restored.

### Tests for User Story 2

- [ ] T017 [P] [US2] Add test in `tests/components/generators/FMOscillator.test.ts` — after `activate()`, calling `setParameterValue('fmDepth', 200)` results in `(getAudioNode('fmInput') as GainNode).gain.value === 200`
- [ ] T018 [P] [US2] Add test in `tests/components/generators/FMOscillator.test.ts` — `setParameterValue('fmDepth', 0)` results in `gain.value === 0`
- [ ] T019 [P] [US2] Add test in `tests/components/generators/FMOscillator.test.ts` — `serialize()` includes `parameters.fmDepth` with the current value; `deserialize()` restores it via `setParameterValue`

### Implementation for User Story 2

- [ ] T020 [US2] Confirm `updateAudioParameter('fmDepth', value)` implementation in `src/components/generators/FMOscillator.ts` is complete (T008) — no additional code needed; this test phase verifies the behaviour
- [ ] T021 [US2] Run `vitest run tests/components/generators/FMOscillator.test.ts` and confirm all Phase 4 tests pass

**Checkpoint**: User Story 2 fully functional — FM Depth controls modulation intensity and survives save/load.

---

## Phase 5: User Story 3 — CV Modulation of FM Depth (Priority: P3)

**Goal**: A CV signal (LFO, envelope) connected to the FM Depth parameter port modulates FM intensity at control rate in real time.

**Independent Test**: Connect an LFO's CV output to the FM Depth parameter port; verify the connection is accepted and `fmGain.gain` is modulated by the LFO signal (AudioParam receives the CV signal via `linkAudioParam`).

### Tests for User Story 3

- [ ] T022 [P] [US3] Add test in `tests/components/generators/FMOscillator.test.ts` — after `activate()` and `linkAudioParam()` called on `fmDepth` parameter, confirm `fmGain.gain` has a connected audio node (i.e., `numberOfInputs > 0` or mock verifies `connect` was called on the AudioParam)
- [ ] T023 [P] [US3] Add test in `tests/components/generators/FMOscillator.test.ts` — `getAudioParamForInput('fm')` returns `null` (FM port routes to AudioNode, not AudioParam; CV modulation of fmDepth goes through the Parameter system, not port connection)

### Implementation for User Story 3

- [ ] T024 [US3] Verify CV-to-parameter routing for `fmDepth` in `src/components/base/SynthComponent.ts` — when a CV source connects to the `fmDepth` parameter port, `getAudioParamForInput('fmDepth')` on `FMOscillator` inherits from `Oscillator` which returns null for unknown IDs; confirm `fmDepth` parameter's `linkAudioParam(fmGain.gain)` call in `createAudioNodes` (T005) is the CV entry point — no additional code change expected
- [ ] T025 [US3] Run `vitest run tests/components/generators/FMOscillator.test.ts` and confirm all Phase 5 tests pass

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Ensure integration quality, backward compatibility, and documentation consistency.

- [ ] T026 [P] Verify backward compatibility — run `vitest run` for full test suite and confirm no regressions in existing `Oscillator` tests or other component tests
- [ ] T027 [P] Confirm `FM_OSCILLATOR` does not appear in `SynthComponent.isBypassable()` list in `src/components/base/SynthComponent.ts` (FM Oscillator is a generator, not an effect; bypass does not apply)
- [ ] T028 Update `CLAUDE.md` `## Recent Changes` section to reflect 020-fm-oscillator feature addition (TypeScript 5.6+, ES2020, Web Audio API — zero new runtime dependencies)
- [ ] T029 Run the full quickstart validation from `specs/020-fm-oscillator/quickstart.md` — create a manual FM patch in the browser (two oscillators, FM connection, Master Output) and confirm audible FM synthesis with real-time FM Depth control

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. T001, T002, T003 are independent and can run in parallel.
- **Foundational (Phase 2)**: Depends on Phase 1 completion. T004 → T005 → T006/T007/T008 (T006–T008 can run in parallel after T005) → T009.
- **User Story Phases (3–5)**: All depend on Phase 2 completion. Stories can proceed in priority order or in parallel.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Can start immediately after Phase 2. No dependency on US2 or US3.
- **US2 (P2)**: Can start after Phase 2. Shares test file with US1 but tasks are independent.
- **US3 (P3)**: Can start after Phase 2. Depends conceptually on US1/US2 being complete (P1→P2→P3 natural order) but tests are independent.

### Within Phase 2 (Foundational)

```
T004 (constructor + ports + params)
  └─► T005 (createAudioNodes)
        ├─► T006 (destroyAudioNodes)   [parallel]
        ├─► T007 (getInputNode)        [parallel]
        └─► T008 (updateAudioParam)    [parallel]
              └─► T009 (register)
```

---

## Parallel Opportunities

### Phase 1 (all parallel)
```
T001 (types.ts)  ||  T002 (componentLayout getPortCounts)  ||  T003 (componentLayout getComponentLayoutOptions)
```

### Phase 2
```
T006  ||  T007  ||  T008   (after T005 completes)
```

### Phase 3 Tests (all parallel)
```
T010  ||  T011  ||  T012  ||  T013  ||  T014
```

### Phase 4 Tests (all parallel)
```
T017  ||  T018  ||  T019
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (T001–T003)
2. Complete Phase 2 (T004–T009)
3. Complete Phase 3 (T010–T016)
4. **STOP and VALIDATE**: Build the app, create FM patch in browser, confirm FM synthesis works
5. Ship / demo if ready

### Incremental Delivery

1. Phase 1 + 2 → FM Oscillator in palette (no FM sound yet, just structure)
2. Phase 3 → FM patch works end-to-end (MVP!)
3. Phase 4 → FM Depth parameter confirmed correct + persisted
4. Phase 5 → CV modulation of FM Depth confirmed
5. Phase 6 → Full integration, backward compat, browser validation

---

## Notes

- [P] tasks operate on different files or independent test cases — safe to run simultaneously
- Test file `FMOscillator.test.ts` is created in T010 and extended in later phases; each phase appends new `it()` blocks
- `fmGain` is accessed via `getAudioNode('fmInput')` in tests (registered key from T005)
- No changes to `PatchSerializer`, `PatchData`, or connection validation logic are required
- Run tests with `vitest run` (not `npm test` — that starts watch mode)
