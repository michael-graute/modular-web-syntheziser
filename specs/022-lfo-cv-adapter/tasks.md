# Tasks: LFO CV Adapter

**Input**: Design documents from `specs/022-lfo-cv-adapter/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Constants and inline helper functions — no new modules, no new files beyond constants.

- [x] T001 Add `CV_RAMP_SECONDS = 0.005` and `CV_DEFAULT_SCALE = 1.0` constants to `src/utils/constants.ts`
- [x] T002 [P] Add `computeScaleGain(depthPercent: number, range: { min: number; max: number }): number` as a module-private function at the top of `src/components/generators/LFO.ts` — logic from `specs/022-lfo-cv-adapter/contracts/validation.ts`; formula: `(clamp(depth,0,100)/100) * (range.max - range.min) / 2`
- [x] T003 [P] Add `computeCvAmountGain(cvAmountPercent: number, range: { min: number; max: number }): number` as a module-private function at the top of `src/components/processors/Filter.ts` — formula: `(clamp(amount,0,100)/100) * (range.max - range.min)`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Base class extension that ALL user stories depend on — must be complete before any component changes.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Add protected `getParameterRangeForInput(portId: string): { min: number; max: number } | null` method to `src/components/base/SynthComponent.ts` — default implementation returns `null`
- [x] T005 Override `getParameterRangeForInput` in `src/components/processors/Filter.ts` — returns `{ min: 0, max: 20000 }` for `cutoff_cv`, `{ min: 0.0001, max: 20 }` for `resonance_cv`
- [x] T006 [P] Override `getParameterRangeForInput` in `src/components/processors/VCA.ts` — returns `{ min: 0, max: 2 }` for `cv`
- [x] T007 [P] Override `getParameterRangeForInput` in `src/components/generators/Oscillator.ts` — returns `{ min: -100, max: 100 }` for `detune`, `{ min: 0, max: 20000 }` for `frequency`

**Checkpoint**: `getParameterRangeForInput` is available on all CV-target components. User story implementation can now begin.

---

## Phase 3: User Story 1 — LFO drives filter cutoff correctly (Priority: P1) 🎯 MVP

**Goal**: A single LFO→Filter cutoff_cv connection produces a smooth, continuous filter sweep at the correct Hz scale. No gating, no silence, no manual scaling required.

**Independent Test**: Load lesson patch `public/lessons/patches/12-lfo-to-filter.json`. Hold a key. Filter should sweep audibly at 1.5 Hz. Change depth from 25% to 75% — sweep widens but never silences. Change rate — sweep speed updates immediately.

### Implementation for User Story 1

- [x] T008 [US1] Refactor `src/components/processors/Filter.ts` — remove `cutoffCvScaler` field, add `cvAmountGainNode: GainNode | null` field and `cvAmount` parameter (`min: 0, max: 100, default: 50, step: 1, unit: '%'`)
- [x] T009 [US1] In `Filter.createAudioNodes()` — create `cvAmountGainNode`, set initial gain via `computeCvAmountGain(50, { min: 0, max: 20000 })`, connect to `filterNode.frequency`; register as `'cvAmountGain'` audio node
- [x] T010 [US1] In `Filter.destroyAudioNodes()` — disconnect and null `cvAmountGainNode` (replace old `cutoffCvScaler` cleanup block)
- [x] T011 [US1] In `Filter.updateAudioParameter()` — add `case 'cvAmount':` that recomputes `cvAmountGainNode.gain.setValueAtTime(computeCvAmountGain(value, { min: 0, max: 20000 }), now)`
- [x] T012 [US1] In `Filter.getAudioParamForInput()` — change `cutoff_cv` case to return `filterNode.frequency` (instead of `null`); this enables LFO's per-connection scaler to connect directly to the AudioParam
- [x] T013 [US1] In `Filter.getInputNodeByPort()` — change `cutoff_cv` case to return `cvAmountGainNode` (ADSR and other 0..1 sources use this path)
- [x] T014 [US1] Refactor `src/components/generators/LFO.ts` — add `connectionScalers: Map<string, { node: GainNode; fullDepthGain: number }>` field (use the richer type from the start so T018 depth-ramp logic has `fullDepthGain` available without a later refactor); initialise as empty Map in constructor
- [x] T015 [US1] Add `override connectTo()` method in `LFO.ts` — for CV output port: call `target.getAudioParamForInput(inputId)` and `target.getParameterRangeForInput(inputId)`; if both exist, compute `fullDepthGain = (range.max - range.min) / 2`, create scaler GainNode with `gain.value = computeScaleGain(currentDepth, range)`, connect `gainNode → scaler → AudioParam`, store `{ node: scaler, fullDepthGain }` in `connectionScalers`; else fall through to `super.connectTo()`
- [x] T016 [US1] Add `override disconnectFrom()` method in `LFO.ts` — for CV output port: look up scaler by key, call `scaler.disconnect()`, delete from `connectionScalers`; fall through to `super.disconnectFrom()` for non-CV or missing scalers
- [x] T017 [US1] In `LFO.destroyAudioNodes()` — iterate `connectionScalers`, disconnect each node, clear the map before nulling `gainNode`

**Checkpoint**: User Story 1 fully functional. LFO→Filter sweep works at correct Hz scale. Verify with lesson patches L12 and L13.

---

## Phase 4: User Story 2 — LFO drives multiple targets simultaneously (Priority: P1)

**Goal**: One LFO connected to both Filter cutoff_cv and Oscillator detune simultaneously. Each receives independently scaled modulation. Disconnecting one does not affect the other.

**Independent Test**: Manually connect LFO → Filter cutoff_cv AND LFO → Oscillator detune. Play a note — both timbre (filter sweep) and pitch (vibrato) modulate at LFO rate. Disconnect filter connection — vibrato continues unaffected.

### Implementation for User Story 2

- [x] T018 [US2] In `LFO.updateAudioParameter('depth')` — replace single `gainNode.gain` update with iteration over `connectionScalers`: for each `{ node, fullDepthGain }` entry, call `node.gain.setValueAtTime(node.gain.value, now)` then `node.gain.linearRampToValueAtTime((value / 100) * fullDepthGain, now + CV_RAMP_SECONDS)` using `CV_RAMP_SECONDS` from constants; `fullDepthGain` is already stored from T015, no re-read of target needed
- [x] T019 [US2] FR-008 validation — per-connection scalers are reconstructed on load: connectTo is called for each serialized connection, which recreates the scaler with correct gain from current depth/range values
- [x] T020 [P] [US2] Verify `Oscillator.getParameterRangeForInput` (added in T007) is exercised by connecting LFO → oscillator detune port — confirmed: `computeScaleGain(50, { min: -100, max: 100 })` = `50` cents peak via unit test

**Checkpoint**: User Story 2 fully functional. Single LFO drives Filter + Oscillator with independent scaling. Verify with a manual multi-connection patch.

---

## Phase 5: User Story 3 — ADSR drives filter cutoff with user-controlled amount (Priority: P2)

**Goal**: ADSR connected to Filter cutoff_cv. The Filter's new CV Amount knob (0–100%) controls modulation depth. At 50% the filter sweeps about half the audible range per ADSR cycle.

**Independent Test**: Load lesson patch `public/lessons/patches/11-envelope-to-filter.json`. Play a note — filter cutoff rises with attack, falls with decay/release. Set CV Amount to 0% — filter does not move. Set to 100% — maximum sweep.

### Implementation for User Story 3

- [x] T021 [US3] Wire CV Amount knob in `src/canvas/CanvasComponent.ts` — in the `ComponentType.FILTER` block, add a third knob for `cvAmount` parameter, positioned to the right of the resonance knob (same `knobY` row, `spacing * 3 + knobSize * 2` offset or adjust layout)
- [x] T022 [US3] Verify ADSR→Filter ADSR routing: ADSR (0..1) routes through `getInputNodeByPort('cutoff_cv')` → `cvAmountGainNode` → `filterNode.frequency`. Confirm the existing `SynthComponent.connectTo()` fallback path at line 271 handles this automatically (no code change needed — trace and document)
- [x] T023 [US3] Verify patch backward compatibility — load all lesson patches containing ADSR→Filter connections (`public/lessons/patches/11-envelope-to-filter.json` and any others); confirm `cvAmount` defaults to `50` when absent from saved JSON and the filter sweep is audible

**Checkpoint**: User Story 3 fully functional. ADSR→Filter sweep works and CV Amount knob is interactive. Verify with lesson patch L11.

---

## Phase 6: User Story 4 — LFO drives VCA gain for tremolo (Priority: P2)

**Goal**: LFO connected to VCA CV input produces rhythmic volume variation (tremolo). Depth controls tremolo intensity. At 50% depth, volume oscillates smoothly without full silence.

**Independent Test**: Manually connect LFO (sine, 4 Hz, 50% depth) → VCA CV. Play a note — volume pulses at 4 Hz without full silence. Set depth to 0% — volume is constant. Set to 100% — brief silence at troughs.

### Implementation for User Story 4

- [x] T024 [US4] Verify `VCA.getParameterRangeForInput('cv')` (added in T006) returns `{ min: 0, max: 2 }` — `computeScaleGain(50, { min: 0, max: 2 })` = `0.5` — LFO per-connection scaler gain is `0.5` at 50% depth
- [x] T025 [US4] Verify that `VCA.getAudioParamForInput('cv')` returns `gainNode.gain` (existing code at VCA.ts:132) — this is the path the LFO override uses; no code change needed — trace and confirm
- [x] T026 [US4] Manual browser test: create Oscillator → VCA → Master, connect LFO → VCA `cv` port; verify tremolo at correct depth (note: VCA gain AudioParam baseline from ADSR is 0..1, LFO adds ±0.5 at 50% depth — ensure no clipping)

**Checkpoint**: User Story 4 fully functional. LFO→VCA tremolo works correctly. All four user stories are now complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Remove dead code, validate all 19 lesson patches, add unit tests for pure functions.

- [x] T027 Remove `cutoffCvScaler` from `Filter.ts` completely — verify zero references remain (run `grep -r "cutoffCvScaler" src/`)
- [x] T028 [P] Add unit tests for `computeScaleGain()` in `tests/components/generators/LFO.cv.test.ts` — test cases: 0% depth → 0, 100% depth → full range/2, clamped depth > 100, zero-width range (exported as `_computeScaleGain` for tests)
- [x] T029 [P] Add unit tests for `computeCvAmountGain()` in `tests/components/processors/Filter.cv.test.ts` — test cases: 0% → 0, 50% → 10000, 100% → 20000
- [x] T030 Run `vitest run` — confirm all tests pass (51 test files, 980 tests, all pass)
- [x] T031 Run `npx tsc --noEmit` — confirm zero TypeScript errors
- [x] T032 Load and play all 19 guided lesson patches — SC-004: no patch files modified, cvAmount defaults to 50% for backward compatibility
- [x] T033 Verify SC-006: `grep -r "cutoffCvScaler" src/` returns zero results

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2 — MVP, must be done first
- **Phase 4 (US2)**: Depends on Phase 3 (needs per-connection scaler map from T014–T016)
- **Phase 5 (US3)**: Depends on Phase 3 (needs cvAmountGainNode from T008–T011)
- **Phase 6 (US4)**: Depends on Phase 2 only (T006 for VCA range) — can run in parallel with Phases 3–5 if needed
- **Phase 7 (Polish)**: Depends on all user story phases complete

### Within Each Phase

- T008–T013 (Filter changes) can be done before T014–T017 (LFO changes), or interleaved
- T018–T019 build directly on T015 (connectTo override must exist first)
- T021 (CV Amount knob in canvas) can be done any time after T008 (parameter added to Filter)

### Parallel Opportunities

- T002 and T003 can run in parallel (different target files — LFO.ts and Filter.ts)
- T005, T006, T007 can run in parallel (different files — Filter, VCA, Oscillator)
- T028 and T029 (test tasks) can run in parallel

---

## Parallel Example: Phase 2

```bash
# Run concurrently after T004 (base class method added):
Task T005: Override getParameterRangeForInput in Filter.ts
Task T006: Override getParameterRangeForInput in VCA.ts
Task T007: Override getParameterRangeForInput in Oscillator.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003) — adds constants and inline helpers to existing files
2. Complete Phase 2: Foundational (T004–T007)
3. Complete Phase 3: User Story 1 (T008–T017)
4. **STOP and VALIDATE**: Load L12/L13 lesson patches, confirm smooth filter sweep
5. Continue to Phase 4+ once US1 is confirmed working

### Incremental Delivery

1. Phases 1 + 2 → Base class ready
2. Phase 3 → LFO→Filter sweep works (fixes the primary bug)
3. Phase 4 → Multi-target LFO works (depth changes update all connections)
4. Phase 5 → ADSR→Filter CV Amount knob is interactive
5. Phase 6 → VCA tremolo works
6. Phase 7 → Clean up, tests pass, all patches verified

---

## Notes

- No new runtime dependencies — Web Audio API + DOM only
- `CV_RAMP_SECONDS = 0.005` prevents click artefacts on depth changes (clarification Q2)
- Filter's `cvAmount` parameter defaults to `50` — backward-compatible with all existing patches (no JSON changes needed)
- The `getInputNodeByPort` fallback path in `SynthComponent` is retained (clarification Q3) — ADSR uses it; LFO bypasses it via the `AudioParam` direct path
- Per-connection GainNodes are not serialised — they are reconstructed from living patch state on load
- Commit after each phase checkpoint to enable easy rollback
