# Tasks: Audio Effects Pack (Bitcrusher, Flanger, Phaser, Tremolo)

**Input**: Design documents from `specs/018-audio-effects-pack/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths included in every task description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the four new `ComponentType` enum values and shared layout/sidebar entries that all four effects depend on. Must complete before any effect class can be written.

- [x] T001 Add `BITCRUSHER = 'bitcrusher'`, `FLANGER = 'flanger'`, `PHASER = 'phaser'`, `TREMOLO = 'tremolo'` to `ComponentType` enum in `src/core/types.ts`
- [x] T002 Add the four new types to the `isBypassable()` allowlist in `src/components/base/SynthComponent.ts`
- [x] T003 [P] Add knob-count cases for `BITCRUSHER` (3), `FLANGER` (4), `PHASER` (5), `TREMOLO` (3) in `src/utils/componentLayout.ts`
- [x] T004 Add port-count cases `{ inputs: 1, outputs: 1 }` for all four new types in `src/utils/componentLayout.ts` (sequential after T003 — same file)
- [x] T005 [P] Add sidebar icons (`▓`, `〜`, `◎`, `∿`) for the four new types in `src/ui/Sidebar.ts`

**Checkpoint**: `src/core/types.ts` compiles with four new enum values; sidebar and layout code reference them without errors.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure validation/conversion helpers extracted from `contracts/` — used by all four effect classes and their tests.

- [x] T006 Adapt `specs/018-audio-effects-pack/contracts/types.ts` into `src/components/effects/effectConstants.ts`: keep only the named constant exports (`RATE_MIN`, `RATE_MAX`, `BITCRUSHER_BIT_DEPTH_MIN`, etc.) and the `PHASER_STAGES_OPTIONS` array; strip spec-only interface types (`BitcrusherParams`, `FlangerParams`, etc.) and the `EffectParams` union that are not needed at runtime
- [x] T007 Adapt `specs/018-audio-effects-pack/contracts/validation.ts` into `src/components/effects/effectHelpers.ts`: update imports to reference `effectConstants.ts` instead of `./types`; keep all pure helper functions (`clamp`, `safeFeedback`, `depthToFlangerLfoGain`, `depthToPhaserLfoGain`, `tremoloLfoParams`, `isValidPhaserStages`)
- [x] T008 Write unit tests for all helpers in `tests/components/effectHelpers.test.ts` (100% coverage required per constitution)

**Checkpoint**: `vitest run tests/components/effectHelpers.test.ts` passes; all helpers verified with boundary values.

---

## Phase 3: User Story 1 — Bitcrusher (Priority: P1) 🎯 MVP

**Goal**: A Bitcrusher effect module is available in the module browser, processes audio with adjustable bit depth and sample rate reduction, supports wet/dry mix and bypass, and persists its state in patches.

**Independent Test**: Add an Oscillator → Bitcrusher → Master Output patch. Reduce bit depth to 4 — output becomes visibly/audibly degraded. Reduce sample rate to 10% — aliasing artifacts appear. Toggle bypass — signal passes clean. Save and reload patch — parameters restored.

### Implementation for User Story 1

- [x] T009 [US1] Implement `src/components/effects/Bitcrusher.ts`:
  - Constructor: ports (`input`/`output`), parameters (`bitDepth` 1–16 default 16, `sampleRate` 1–100 default 100, `mix` 0–1 default 1.0)
  - `createAudioNodes()`: `inputGain`, `ScriptProcessorNode` (256 frames), `dryGain`, `wetGain`, `outputGain`; wire dry and wet paths; set `onaudioprocess` using helpers from `effectHelpers.ts`
  - `destroyAudioNodes()`: disconnect and null all nodes
  - `updateAudioParameter()`: update `currentBitDepth`/`currentSampleRate` fields read by `onaudioprocess`; update `mix` via equal-power crossfade
  - `getInputNode()` / `getOutputNode()`: return `inputGain` / `outputGain`
  - `enableBypass()` / `disableBypass()`: follow `Chorus.ts` `_bypassConnections` pattern
- [x] T010 [US1] Register `ComponentType.BITCRUSHER` in `src/components/registerComponents.ts` (import `Bitcrusher`, add `componentRegistry.register(...)` call in Effects section)
- [x] T011 [US1] Write unit tests for Bitcrusher in `tests/components/Bitcrusher.test.ts`:
  - Constructor creates correct ports and parameters
  - `createAudioNodes()` creates and connects ScriptProcessorNode
  - `updateAudioParameter('bitDepth', ...)` updates internal state
  - `updateAudioParameter('mix', ...)` calls equal-power crossfade
  - `enableBypass()` wires `inputGain` → `outputGain` directly
  - `disableBypass()` restores original graph

**Checkpoint**: Bitcrusher appears in module browser under Effects; Oscillator → Bitcrusher → MasterOutput patch works; bypass toggles cleanly; patch saves and reloads.

---

## Phase 4: User Story 2 — Flanger (Priority: P2)

**Goal**: A Flanger effect module is available, produces comb-filtering sweep with adjustable rate/depth/feedback/mix, supports bypass, and persists parameters.

**Independent Test**: Add Oscillator → Flanger → Master Output. Set rate 0.5 Hz, depth 80%, feedback 50% — audible jet-sweep modulation. Rate at max (20 Hz) — fast sweep. Feedback at 95% — intense resonance but stable. Bypass toggles cleanly. Patch saves/reloads.

### Implementation for User Story 2

- [x] T012 [US2] Implement `src/components/effects/Flanger.ts`:
  - Constructor: ports, parameters (`rate` 0.1–20 default 0.5, `depth` 0–100 default 50, `feedback` 0–95 default 0, `mix` 0–1 default 0.5)
  - `createAudioNodes()`: `inputGain`, `delayNode` (max 0.02s), `feedbackGain`, LFO (`OscillatorNode` + `lfoGain`), `dryGain`, `wetGain`, `outputGain`; wire: dry path `inputGain→dryGain→outputGain`; wet path `inputGain→delayNode→wetGain→outputGain`; feedback `wetGain→feedbackGain→delayNode`; LFO `lfo→lfoGain→delayNode.delayTime`
  - `destroyAudioNodes()`: stop LFO, disconnect all
  - `updateAudioParameter()`: rate → `lfo.frequency`; depth → `lfoGain.gain` via `depthToFlangerLfoGain`; feedback → `feedbackGain.gain` via `safeFeedback`; mix → equal-power crossfade
  - `getInputNode()` / `getOutputNode()` / `enableBypass()` / `disableBypass()`: follow Chorus pattern
- [x] T013 [US2] Register `ComponentType.FLANGER` in `src/components/registerComponents.ts`
- [x] T014 [US2] Write unit tests for Flanger in `tests/components/Flanger.test.ts`:
  - Correct ports and parameters in constructor
  - `createAudioNodes()` wires dry/wet/feedback paths
  - Feedback clamped: `updateAudioParameter('feedback', 100)` → gain ≤ 0.95
  - `updateAudioParameter('rate', ...)` updates LFO frequency
  - Bypass/restore follows Chorus pattern

**Checkpoint**: Flanger appears in module browser; sweep audible with default settings; feedback stays stable at 95%; patch saves/reloads.

---

## Phase 5: User Story 3 — Phaser (Priority: P3)

**Goal**: A Phaser effect module is available, produces all-pass phase sweep with selectable stage count (2/4/6/8), adjustable rate/depth/feedback/mix, supports bypass, and persists parameters.

**Independent Test**: Add Oscillator → Phaser → Master Output. Set rate 0.5 Hz, depth 70%, stages 4 — audible phase sweep distinct from flanging. Change stages to 8 — richer sweep character. Feedback 50% — resonant peaks. Bypass toggles cleanly. Patch saves/reloads.

### Implementation for User Story 3

- [x] T015 [US3] Implement `src/components/effects/Phaser.ts`:
  - Constructor: ports, parameters (`rate` 0.1–20 default 0.5, `depth` 0–100 default 50, `feedback` 0–95 default 0, `stages` 2–8 step 2 default 4, `mix` 0–1 default 0.5)
  - `createAudioNodes()`: `inputGain`, allpass chain (`BiquadFilterNode[]` of length `stages`, type `'allpass'`), `feedbackGain`, LFO (`OscillatorNode` + `lfoGain`), `dryGain`, `wetGain`, `outputGain`; wire chain sequentially; feedback from chain end back to chain start; LFO modulates all allpass `frequency` AudioParams
  - `destroyAudioNodes()`: stop LFO, disconnect all, clear allpass array
  - `updateAudioParameter()`: rate → LFO frequency; depth → `lfoGain.gain` via `depthToPhaserLfoGain`; feedback → `feedbackGain.gain` via `safeFeedback`; mix → crossfade; `stages` → snapshot params, call `destroyAudioNodes()` + `createAudioNodes()`, restore params
  - `getInputNode()` / `getOutputNode()` / `enableBypass()` / `disableBypass()`: follow Chorus pattern; `enableBypass` must handle variable-length allpass array
- [x] T016 [US3] Register `ComponentType.PHASER` in `src/components/registerComponents.ts`
- [x] T017 [US3] Write unit tests for Phaser in `tests/components/Phaser.test.ts`:
  - Constructor creates correct ports and parameters (stages default 4)
  - `createAudioNodes()` creates 4 allpass filters with `type === 'allpass'`
  - `updateAudioParameter('stages', 2)` triggers graph rebuild → 2 allpass filters
  - `updateAudioParameter('stages', 8)` triggers graph rebuild → 8 allpass filters
  - `isValidPhaserStages(3)` returns false; `isValidPhaserStages(4)` returns true
  - Feedback clamped to ≤ 0.95
  - Bypass/restore works after stage-count change

**Checkpoint**: Phaser appears in module browser; phase sweep audible and distinct from Flanger; stage-count selector changes character; patch saves/reloads.

---

## Phase 6: User Story 4 — Tremolo (Priority: P4)

**Goal**: A Tremolo effect module is available, produces rhythmic amplitude modulation with adjustable rate/depth/mix, supports bypass, and persists parameters.

**Independent Test**: Add Oscillator → Tremolo → Master Output. Rate 4 Hz, depth 80% — audible pulsing. Depth 0% — no modulation (constant volume). Depth 100% — volume cuts to silence at trough. Bypass toggles cleanly. Patch saves/reloads.

### Implementation for User Story 4

- [ ] T018 [US4] Implement `src/components/effects/Tremolo.ts`:
  - Constructor: ports, parameters (`rate` 0.1–20 default 4.0, `depth` 0–100 default 50, `mix` 0–1 default 1.0)
  - `createAudioNodes()`: `inputGain`, `tremoloGain` (GainNode), LFO (`OscillatorNode` + `lfoGain`), `constantSource` (ConstantSourceNode), `dryGain`, `wetGain`, `outputGain`; wire: wet path `inputGain→tremoloGain→wetGain→outputGain`; dry path `inputGain→dryGain→outputGain`; connect `constantSource→tremoloGain.gain` and `lfo→lfoGain→tremoloGain.gain`; set DC offset and LFO amplitude via `tremoloLfoParams(depth)` from `effectHelpers.ts`; start LFO and constantSource
  - `destroyAudioNodes()`: stop LFO and constantSource, disconnect all
  - `updateAudioParameter()`: rate → `lfo.frequency`; depth → recompute `tremoloLfoParams`, update `lfoGain.gain` and `constantSource.offset`; mix → equal-power crossfade
  - `getInputNode()` / `getOutputNode()` / `enableBypass()` / `disableBypass()`: follow Chorus pattern
- [ ] T019 [US4] Register `ComponentType.TREMOLO` in `src/components/registerComponents.ts`
- [ ] T020 [US4] Write unit tests for Tremolo in `tests/components/Tremolo.test.ts`:
  - Constructor creates correct ports and parameters
  - `tremoloLfoParams(0)` returns `{ lfoAmplitude: 0, dcOffset: 1.0 }` (no modulation)
  - `tremoloLfoParams(100)` returns `{ lfoAmplitude: 0.5, dcOffset: 0.5 }` (full depth)
  - `updateAudioParameter('depth', 0)` sets constant gain to 1.0
  - `updateAudioParameter('rate', ...)` updates LFO frequency
  - Bypass/restore follows Chorus pattern

**Checkpoint**: Tremolo appears in module browser; pulsing amplitude modulation audible; depth=0 is transparent; depth=100 cuts to silence; patch saves/reloads.

---

## Phase 7: User Story 5 — Bypass (Cross-cutting, Priority: P2)

**Goal**: All four effects support glitch-free bypass toggle that preserves signal flow and visual state.

**Independent Test**: For each of the four effects, toggle bypass on and off rapidly while signal plays — no audible clicks or dropouts. Verify the visual active/bypassed indicator updates immediately on toggle.

### Implementation for User Story 5

- [ ] T021 [P] [US5] Confirm that the active/bypassed CSS class is applied to the `BITCRUSHER` module panel when `setBypass()` is called — inspect `src/ui/Sidebar.ts` and the component panel rendering path; if the existing pattern does not cover the new type, add the necessary case
- [ ] T022 [P] [US5] Confirm active/bypassed CSS class applies to `FLANGER`, `PHASER`, and `TREMOLO` panels — same check as T021; add missing cases if needed
- [ ] T023 [US5] Write cross-cutting bypass tests in `tests/components/effectsBypass.test.ts`:
  - For each of the four effects: `setBypass(true)` → `isBypassed === true`; `setBypass(false)` → `isBypassed === false`
  - Double-toggle (true→false→true) leaves state consistent
  - `serialize()` includes `isBypassed: true` when bypassed; omits field when not bypassed
  - `deserialize()` restores bypass state flag

**Checkpoint**: All four effects bypass correctly; serialization round-trip preserves bypass state.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final integration checks, help text, and validation sweep.

- [ ] T024 [P] Update `src/ui/HelpSidebar.ts` to mention the four new effects (Bitcrusher, Flanger, Phaser, Tremolo) in the Effects section alongside existing entries
- [ ] T025 Run `vitest run` — all new and existing tests pass; fix any regressions
- [ ] T026 Run `npm run lint` — zero new warnings; fix any TypeScript strict-mode issues
- [ ] T027 [P] Validate patch round-trip for each new effect: create a patch containing all four effects with non-default parameters, save to localStorage, reload, confirm all values restored (`PatchSerializer` / `PatchStorage` integration check)
- [ ] T028 [P] Manual smoke test per quickstart.md: Oscillator → each new effect → Master Output; confirm audible transformation, bypass, and parameter response for all four
- [ ] T029 [P] Manual chaining smoke test (spec.md Edge Cases): Oscillator → Bitcrusher → Flanger → Phaser → Tremolo → Master Output; confirm no mutual interference, no audio graph errors, and bypass on any single effect in the chain passes signal cleanly

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (needs `ComponentType` enum values)
- **Phase 3–6 (US1–US4)**: All depend on Phases 1 & 2 — can proceed independently after that
- **Phase 7 (US5 Bypass)**: Depends on Phases 3–6 (requires all four effects to exist)
- **Phase 8 (Polish)**: Depends on all previous phases

### User Story Dependencies

- **US1 Bitcrusher (P1)**: Start after Phase 2 — no dependency on US2–US4
- **US2 Flanger (P2)**: Start after Phase 2 — no dependency on US1, US3, US4
- **US3 Phaser (P3)**: Start after Phase 2 — no dependency on US1, US2, US4
- **US4 Tremolo (P4)**: Start after Phase 2 — no dependency on US1, US2, US3
- **US5 Bypass (P2)**: Start after US1–US4 are complete

### Within Each User Story

- Effect class implementation → registration → tests
- Stage-count graph rebuild (Phaser) handled inside `updateAudioParameter` — no external dependency

### Parallel Opportunities

- T003 and T005 can run in parallel (different files); T004 must follow T003 (same file)
- T009 (Bitcrusher), T012 (Flanger), T015 (Phaser), T018 (Tremolo) can all run in parallel once Phase 2 is complete — each is a separate file
- T011, T014, T017, T020 (test files) can run in parallel with each other and alongside implementations

---

## Parallel Example: Phases 3–6

```bash
# After Phase 2 completes, launch all four effect implementations simultaneously:
Task: "Implement src/components/effects/Bitcrusher.ts"     # T009
Task: "Implement src/components/effects/Flanger.ts"        # T012
Task: "Implement src/components/effects/Phaser.ts"         # T015
Task: "Implement src/components/effects/Tremolo.ts"        # T018
```

---

## Implementation Strategy

### MVP First (User Story 1 — Bitcrusher only)

1. Complete Phase 1: Setup (T001–T005)
2. Complete Phase 2: Foundational helpers (T006–T008)
3. Complete Phase 3: Bitcrusher (T009–T011)
4. **STOP and VALIDATE**: Bitcrusher works end-to-end in browser
5. Ship Bitcrusher as first deliverable

### Incremental Delivery

1. Setup + Foundational → shared infrastructure ready
2. Bitcrusher (MVP) → test → ship
3. Flanger → test → ship
4. Phaser → test → ship
5. Tremolo → test → ship
6. Bypass cross-cut + Polish → final release

### Parallel Team Strategy

With two developers after Phase 2:
- Developer A: Bitcrusher (T009–T011) + Phaser (T015–T017)
- Developer B: Flanger (T012–T014) + Tremolo (T018–T020)
- Both: Phase 7 bypass tests + Phase 8 polish together

---

## Notes

- [P] tasks = different files, no dependency conflicts
- [Story] label maps each task to its user story for traceability
- `Chorus.ts` is the canonical reference pattern for all four effect classes
- Phaser is the only effect requiring graph rebuild on parameter change (`stages`)
- Bitcrusher is the only effect using `ScriptProcessorNode` — keep `onaudioprocess` callback short, delegate math to `effectHelpers.ts`
- Feedback safety: always apply `safeFeedback()` before setting `feedbackGain.gain` — never allow ≥ 1.0
