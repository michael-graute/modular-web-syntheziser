# Tasks: 4-Voice Polyphony

**Input**: Design documents from `/specs/032-polyphony/`
**Branch**: `032-polyphony`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extend the type system and signal routing layer — no component logic yet.

- [x] T001 Add `POLY_CV = 'poly-cv'` to `SignalType` enum in `src/core/types.ts`
- [x] T002 Add `POLY_OSCILLATOR`, `POLY_ADSR`, `POLY_VCA` to `ComponentType` enum in `src/core/types.ts`
- [x] T003 [P] Update `areSignalTypesCompatible` in `src/utils/validators.ts` — POLY_CV → POLY_CV only; all cross-type pairs rejected
- [x] T004 [P] Add `POLY_CV = '#c084fc'` to `COLORS` constant in `src/utils/constants.ts`
- [x] T005 [P] Add `POLY_CV` color case to `CanvasConnection.getColor()` in `src/canvas/Connection.ts`

**Checkpoint**: Type system extended — `npm run lint` passes, no regressions in existing connection validation.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core voice allocation logic and the Keyboard POLY_CV extension — required before any poly component can work.

**⚠️ CRITICAL**: No poly component work can begin until this phase is complete.

- [x] T006 Create `VoiceAllocator` class in `src/components/utilities/VoiceAllocator.ts` — `noteOn`, `noteOff`, `releaseAll`, `getSlots` per `contracts/types.ts` `IVoiceAllocator`; oldest-voice stealing using `findOldestActiveVoiceIndex` from `contracts/validation.ts`
- [x] T007 Write unit tests for `VoiceAllocator` in `tests/unit/VoiceAllocator.test.ts` — cover: allocate first idle slot, allocate all 4 slots, retrigger same note, oldest-voice steal, noteOff releases correct slot, releaseAll zeros all slots
- [x] T008 Extend `KeyboardInput` in `src/components/utilities/KeyboardInput.ts`:
  - Add `private voiceAllocator: VoiceAllocator` (constructed in constructor)
  - Add parameter `polyMode` (default 0, min 0, max 1, step 1)
  - Add output port `poly-cv` with `SignalType.POLY_CV`
  - Add `isPolyMode(): boolean`, `setPolyMode(mode: 0 | 1): void`, `getVoiceSlots(): Readonly<VoiceSlot[]>`
  - Override `triggerNoteOn` / `triggerNoteOff` to branch on `isPolyMode()`
  - In poly mode: delegate to `voiceAllocator`; freeze mono outputs (gate stays 0)
  - In mono mode: existing logic unchanged
- [x] T009 Update `KEYBOARD_INPUT` port count in `src/utils/componentLayout.ts` — outputs: 4 (freq, gate, velocity, poly-cv)
- [x] T010 Add `polyMode` Button control for `KEYBOARD_INPUT` case in `CanvasComponent.createControls()` in `src/canvas/CanvasComponent.ts` — label toggles `MONO` / `POLY`; clicking calls `setPolyMode` and emits `PARAMETER_CHANGED`; on `setSynthComponent()` read the current `polyMode` parameter value to set the initial button label so patches deserialized with `polyMode=1` show `POLY` immediately (U1 fix)

**Checkpoint**: `vitest run` passes all new VoiceAllocator tests. Keyboard renders poly-cv port on canvas. polyMode persists in saved patch (save → reload shows correct mode).

---

## Phase 3: User Story 1 — Play a Chord from the Keyboard (Priority: P1) 🎯 MVP

**Goal**: Full poly chain — Keyboard (poly mode) → PolyOscillator → PolyADSR → PolyVCA → Master Out — produces 4 independent simultaneous voices.

**Independent Test**: Place Keyboard (poly mode), PolyOscillator, PolyADSR, PolyVCA, Master Out. Connect them: Keyboard:poly-cv → PolyOscillator:poly-cv, Keyboard:poly-cv → PolyADSR:poly-cv, PolyOscillator:output → PolyVCA:audio-0..3, PolyADSR:env-0..3 → PolyVCA:cv-0..3, PolyVCA:output → MasterOut. Hold 3 keys → 3 simultaneous notes. Release one → only that voice fades.

### Implementation for User Story 1

- [ ] T011 [P] [US1] Create `PolyOscillator` in `src/components/generators/PolyOscillator.ts`:
  - Extends `SynthComponent`, implements `PolyConsumer` from `contracts/types.ts`
  - Ports: input `poly-cv` (POLY_CV), output `output` (AUDIO)
  - Parameter: `waveform` (0–3, default 0)
  - `createAudioNodes`: 4 `OscillatorNode` + 4 `GainNode` (voice gates) + 1 summing `GainNode` (outputMix)
  - RAF polling loop: read `voiceSlotsGetter()` — reads **only `slot.frequency`** per slot (FR-001a: PolyOscillator ignores gate field); update `oscillators[i].frequency.value` and `voiceGates[i].gain.value`
  - When `voiceSlotsGetter` is null (no cable connected), RAF loop skips updates — voices sustain at last known frequency (no crash)
  - `setVoiceSlotsGetter` / `clearVoiceSlotsGetter` + cancel RAF on clear
  - `getOutputNode()` returns `outputMix`
- [ ] T012 [P] [US1] Create `PolyADSR` in `src/components/processors/PolyADSR.ts`:
  - Extends `SynthComponent`, implements `PolyConsumer`
  - Ports: input `poly-cv` (POLY_CV), outputs `env-0` through `env-3` (CV)
  - Parameters: `attack` (0.01s), `decay` (0.1s), `sustain` (0.7), `release` (0.3s)
  - `createAudioNodes`: 4 `ConstantSourceNode` + 4 envelope `GainNode` + 4 output `GainNode`
  - RAF polling loop: reads **only `slot.gate`** per slot (FR-001a: PolyADSR ignores frequency field); edge-detect gate 0→1 / 1→0; fire `triggerGateOn(i)` / `triggerGateOff(i)`
  - When `voiceSlotsGetter` is null, RAF loop skips updates — envelopes hold at current value (no crash)
  - `getOutputNodeByPort(portId)`: return `outputGains[N]` for `env-N`
- [ ] T013 [P] [US1] Create `PolyVCA` in `src/components/processors/PolyVCA.ts`:
  - Extends `SynthComponent`
  - Ports: inputs `audio-0..3` (AUDIO) + `cv-0..3` (CV); output `output` (AUDIO)
  - No parameters
  - `createAudioNodes`: 4 voice input `GainNode` + 4 voice gain `GainNode` + 1 summing `GainNode` (gain = 0.25)
  - Graph per voice i: `voiceInputs[i] → voiceGains[i] → sumGain → output`
  - `getInputNode(portId)`: return `voiceInputs[N]` for `audio-N`; return `null` for `cv-N` (CV uses AudioParam)
  - `getAudioParamForInput(portId)`: return `voiceGains[N].gain` for `cv-N`
  - `getOutputNode()`: return `sumGain`
- [ ] T014 [US1] Update `ConnectionManager.createConnection()` in `src/canvas/ConnectionManager.ts`:
  - After audio connection, check `sourcePort.type === SignalType.POLY_CV`
  - If source has `getVoiceSlots` and target has `setVoiceSlotsGetter`, register getter
  - Update `removeConnection()` to call `clearVoiceSlotsGetter()` on poly-cv target
- [ ] T015 [US1] Add layout entries for `POLY_OSCILLATOR`, `POLY_ADSR`, `POLY_VCA` in `src/utils/componentLayout.ts`:
  - `POLY_OSCILLATOR`: 1 Dropdown (waveform); inputs 1, outputs 1
  - `POLY_ADSR`: 4 Sliders (A/D/S/R); inputs 1, outputs 4
  - `POLY_VCA`: no controls; inputs 8, outputs 1
- [ ] T016 [US1] Add `createControls()` cases for `POLY_OSCILLATOR`, `POLY_ADSR`, `POLY_VCA` in `src/canvas/CanvasComponent.ts`:
  - `POLY_OSCILLATOR`: waveform Dropdown (same options as Oscillator)
  - `POLY_ADSR`: 4 vertical Sliders (same layout as ADSREnvelope)
  - `POLY_VCA`: no controls
- [ ] T017 [US1] Register all 3 new component types in `src/components/registerComponents.ts`:
  - `POLY_OSCILLATOR` under 'Generators'
  - `POLY_ADSR` under 'Processors'
  - `POLY_VCA` under 'Processors'
- [ ] T018 [US1] Write unit tests for `PolyOscillator` in `tests/unit/PolyOscillator.test.ts`:
  - Creates 4 oscillator nodes on activate
  - RAF loop updates frequencies from voice slots
  - Voice gate gain set to slot.gate value
  - clearVoiceSlotsGetter stops polling
- [ ] T019 [US1] Write unit tests for `PolyADSR` in `tests/unit/PolyADSR.test.ts`:
  - Gate 0→1 edge fires triggerGateOn for correct voice
  - Gate 1→0 edge fires triggerGateOff for correct voice
  - Independent per-voice envelope (no cross-slot interference)
- [ ] T020 [US1] Write integration test for full poly chain in `tests/integration/poly-chain.test.ts`:
  - US1 acceptance scenario 1: 3 held keys → 3 voices active
  - US1 acceptance scenario 2: Release 1 key → only that voice enters release, others continue
  - US1 acceptance scenario 3: Release all keys → all voices silent after release
  - US1 acceptance scenario 4: 5th note on 4 active voices → oldest voice stolen, no crash
  - US1 acceptance scenario 5 (A2): Same key pressed twice without releasing → voice retriggered on same slot index, no new slot allocated
  - Latency note (SC-001/C2): gate transitions are detected within one RAF frame (≤16ms); document this accepted delta in a test comment alongside the synchronous mono path

**Checkpoint**: All US1 tests pass. Full poly chain functional. `vitest run` green.

---

## Phase 4: User Story 2 — Switch Between Mono and Poly Mode (Priority: P2)

**Goal**: Keyboard mono/poly toggle works live — no patch rebuild required. Mono mode fully restores pre-feature behaviour.

**Independent Test**: Start in poly mode, play chords. Flip to mono → only last-held key sounds. Flip back to poly → chords return. Save patch in poly mode → reload → Keyboard restores in poly mode.

### Implementation for User Story 2

- [ ] T021 [US2] Implement `setPolyMode` mode-switch behaviour in `src/components/utilities/KeyboardInput.ts`:
  - mono→poly: call `voiceAllocator.releaseAll()`; immediately zero `gateNode`, `frequencyNode`, `velocityNode` via `cancelScheduledValues + setValueAtTime(0, now)` (SC-003: takes effect within one audio buffer)
  - poly→mono: call `voiceAllocator.releaseAll()`; cancel any in-flight RAF frame; restore `gateNode`, `frequencyNode`, `velocityNode` to normal operation
  - Freeze all three mono outputs (gate=0, frequency=last value, velocity=0) while in poly mode — not just gate (I3 fix per data-model.md)
  - Emit `PARAMETER_CHANGED` event so UI button label updates synchronously
- [ ] T022 [P] [US2] Write unit tests for Keyboard mode switching in `tests/unit/KeyboardInput.poly.test.ts`:
  - Switching to mono mode stops all poly voices
  - Mono mode: multiple keys held → only last-key frequency active, single gate
  - Poly mode: multiple keys → multiple voice slots populated
  - In poly mode: `gateNode`, `frequencyNode`, `velocityNode` are locked — `getGateValue()` returns 0, gate output stays 0 (U3 fix)
  - `polyMode` parameter value persists in `serialize()`
- [ ] T023 [US2] Write integration test for patch save/reload of polyMode in `tests/integration/poly-chain.test.ts` (add to existing file):
  - US2 scenario 3: patch saved with Keyboard in poly mode → serialize → deserialize → Keyboard.isPolyMode() === true
  - U2 fix: PolyOscillator with waveform=2 → serialize → deserialize → waveform parameter still 2

**Checkpoint**: Mode toggle works live. `polyMode` round-trips through patch save/load. `vitest run` green.

---

## Phase 5: User Story 3 — Poly Voices Feed the Existing Effects Chain (Priority: P3)

**Goal**: PolyVCA's mono `output` port connects directly to any existing mono audio input (Filter, Reverb, Master Out) using the standard audio cable — no special handling required from downstream components.

**Independent Test**: Connect PolyVCA:output → Filter:audio-in → Reverb:audio-in → MasterOut. Play chords. All voices pass through filter and reverb as a mixed mono signal.

### Implementation for User Story 3

- [ ] T024 [US3] Add a 1-line unit test to `tests/unit/PolyVCA.test.ts` asserting `polyVca.getOutputNode() instanceof GainNode` — confirms the output is a standard AUDIO node compatible with any downstream mono component without `SynthComponent.connectTo()` changes (A3 fix)
- [ ] T025 [P] [US3] Write integration test for effects chain in `tests/integration/poly-chain.test.ts` (add to existing file):
  - US3 scenario 1: PolyVCA output → Filter → audio passes through (signal > 0 on Filter output)
  - US3 scenario 2: PolyVCA output → MasterOut — connection accepted with standard AUDIO type
  - US3 scenario 3: Mixed 4-voice output does not exceed 1.0 amplitude at 0.25 summing gain

**Checkpoint**: PolyVCA output integrates with existing effects chain. No changes to Filter/Reverb/MasterOut. `vitest run` green.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation helpers, edge cases, constitution compliance review.

- [ ] T026 [P] Write 100%-coverage tests for `specs/032-polyphony/contracts/validation.ts` in `tests/unit/poly-validation.test.ts`:
  - `isValidVoiceIndex`: 0–3 valid, -1/4/1.5 invalid
  - `isValidVoiceSlot`: valid slot, missing fields, wrong gate values
  - `isValidVoiceSlotArray`: length 4 required, voiceIndex must match position
  - `isValidPolyMode`: 0 and 1 valid, 2/-1 invalid
  - `findOldestActiveVoiceIndex`: returns lowest-timestamp active slot, -1 when all idle
  - `findFirstIdleVoiceIndex`: returns first gate=0 slot, -1 when all active
  - `findVoiceIndexForNote`: returns correct slot, -1 when not found
- [ ] T027 [P] Verify backward compatibility: existing patches with `keyboard-input` (no `polyMode` field) load as mono — add test to `tests/persistence/` or existing patch serialization test suite
- [ ] T028 [P] Verify POLY_CV connection rejection: add to `tests/unit/` — confirm `areSignalTypesCompatible(POLY_CV, CV) === false`, `areSignalTypesCompatible(CV, POLY_CV) === false`, `areSignalTypesCompatible(POLY_CV, POLY_CV) === true`
- [ ] T029 Validate no orphaned RAF loops: verify `PolyOscillator.destroyAudioNodes()` and `PolyADSR.destroyAudioNodes()` cancel `rafHandle` — add teardown assertions to unit tests
- [ ] T030 Run `npm run lint` and resolve any TypeScript strict-mode issues in new files
- [ ] T031 Manual golden-path validation per `specs/032-polyphony/quickstart.md` — full patch build and 4-voice chord play

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately. T003, T004, T005 are parallel.
- **Phase 2 (Foundational)**: Depends on Phase 1. T006 must precede T007 (tests need implementation). T008 depends on T006. T009, T010 can run in parallel after T008.
- **Phase 3 (US1)**: Depends on Phase 2. T011, T012, T013 are parallel (different files). T014 depends on T011+T012. T015 depends on T011+T012+T013. T016 depends on T015. T017 depends on T016. T018–T020 run after T011–T017.
- **Phase 4 (US2)**: Depends on Phase 2. T021 extends T008 work. T022–T023 run after T021.
- **Phase 5 (US3)**: Depends on Phase 3 (PolyVCA must exist). T024 is a verification task; T025 is a test task.
- **Phase 6 (Polish)**: Depends on all prior phases. All [P] tasks are parallel.

### Within Phase 3 — Parallel Opportunities

```bash
# These 3 tasks can run in parallel (different files):
T011: src/components/generators/PolyOscillator.ts
T012: src/components/processors/PolyADSR.ts
T013: src/components/processors/PolyVCA.ts
```

### User Story Dependencies

- **US1 (P1)**: Requires Phase 2 complete. Core deliverable — MVP.
- **US2 (P2)**: Requires Phase 2 complete (T008 Keyboard extension). Independent of US1.
- **US3 (P3)**: Requires US1 complete (PolyVCA must exist). Primarily a verification story.

---

## Parallel Example: Phase 3 (User Story 1)

```text
# After Phase 2 checkpoint, launch in parallel:
T011: Create PolyOscillator in src/components/generators/PolyOscillator.ts
T012: Create PolyADSR in src/components/processors/PolyADSR.ts
T013: Create PolyVCA in src/components/processors/PolyVCA.ts

# After T011+T012+T013 complete:
T014: Update ConnectionManager (depends on T011, T012)
T015: Update componentLayout.ts (depends on T011, T012, T013)

# After T015:
T016: Update CanvasComponent createControls()
T017: Register components in registerComponents.ts

# After T011–T017, in parallel:
T018: PolyOscillator tests
T019: PolyADSR tests
T020: Integration test for poly chain
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) — ~30 min
2. Complete Phase 2 (Foundational) — ~60 min; VoiceAllocator + Keyboard extension
3. Complete Phase 3 (US1) — ~90 min; 3 new components + ConnectionManager + registration
4. **STOP and VALIDATE**: run `vitest run`, build patch in browser, play 4-note chord
5. Ship MVP

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready, Keyboard has POLY_CV port
2. Phase 3 → Full poly chain works → **MVP Demo**
3. Phase 4 → Live mode switch + persistence → **UX Complete**
4. Phase 5 → Effects chain integration verified → **Integration Complete**
5. Phase 6 → Polish, edge cases, lint → **Production Ready**

---

## Notes

- `[P]` = different files, no blocking dependencies between them — safe to run in parallel
- `[USN]` maps task to user story from spec.md for traceability
- RAF polling loops are the primary risk surface — ensure `destroyAudioNodes` always cancels them
- PolyVCA summing gain of `0.25` is a named constant — do not inline it
- `polyMode` parameter default `0` is the sole backward-compat guarantee for existing patches
- Run `vitest run` (not `npm test`) to avoid watch mode hanging
