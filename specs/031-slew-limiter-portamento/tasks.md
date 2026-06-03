# Tasks: Slew Limiter / Portamento

**Input**: Design documents from `/specs/031-slew-limiter-portamento/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Register the new component type and lay the groundwork that all three user stories share.

- [x] T001 Add `SLEW_LIMITER = 'slew-limiter'` to the `ComponentType` enum in `src/core/types.ts`
- [x] T002 [P] Create `src/components/utilities/SlewLimiterValidation.ts` — export `SlewLimiterParams`, constants (`RISE_MIN/MAX`, `FALL_MIN/MAX`, `SLEW_DEFAULTS`), `validateRise`, `validateFall`, `validateSlewLimiterParams`, `clampCv`, `computeSlewCoeff`
- [x] T003 [P] Create `tests/components/utilities/SlewLimiterValidation.test.ts` — 100% coverage of all exported helpers: boundary values, out-of-range, non-finite inputs, `clampCv`, `computeSlewCoeff`

**Checkpoint**: Types and validation helpers in place; tests pass with `vitest run`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core `SlewLimiter` component class — required before any canvas or registration work.

**⚠️ CRITICAL**: No user story canvas or display work can begin until T004 is complete.

- [x] T004 Create `src/components/utilities/SlewLimiter.ts`:
  - `constructor(id, position)`: register `input` (CV In) + `cv` (CV Out) ports; `rise` param (0–5000 ms, default 50, step 1, unit ms); `fall` param (0–5000 ms, default 50, step 1, unit ms)
  - `createAudioNodes()`: `inputGain` (GainNode, gain=1), `analyser` (AnalyserNode, fftSize=256, smoothing=0), `inputGain→analyser`, `cvNode` (ConstantSourceNode, offset=0, started); register all three
  - `destroyAudioNodes()`: stop/disconnect all nodes, null fields, clear `audioNodes`
  - `getInputNode()` → `inputGain`; `getOutputNode()` → `cvNode`
  - `updateAudioParameter()`: no-op (params read live in `tick()`)
  - `getOutputValue(): number` → returns `outputValue` field
  - `tick(dtSec: number)`: read mean of `getFloatTimeDomainData` as target CV; clamp; apply rise or fall `computeSlewCoeff`; update `outputValue`; set `cvNode.offset.value`
  - `enableBypass()` / `disableBypass()`: disconnect `inputGain→analyser`, wire `inputGain→cvNode` directly (and reverse)
  - `serialize()` → `ComponentData` with `parameters: { rise, fall }`
  - `deserialize(data)` → `validateSlewLimiterParams`, set parameter values and position
- [x] T005 Create `tests/components/utilities/SlewLimiter.test.ts` — ≥80% coverage:
  - Constructor: correct ports (`input` CV, `cv` CV) and parameters (`rise`, `fall`) registered
  - `tick()`: output rises toward target with rise coeff; falls with fall coeff; pass-through when both times = 0
  - `serialize()` / `deserialize()`: round-trip fidelity; missing keys use defaults (50 ms)
  - `getOutputValue()`: returns current output
  - Bypass: `enableBypass()` active → output equals input CV unmodified with no smoothing applied; `disableBypass()` → smoothing resumes

**Checkpoint**: `SlewLimiter` class complete and tested; all `vitest run` tests pass.

---

## Phase 3: User Story 1 — Smooth Sequencer Pitch Glide (Priority: P1) 🎯 MVP

**Goal**: The Slew Limiter appears in the component menu under Utilities, can be added to the canvas, and CV patched through it produces audible portamento on pitch changes.

**Independent Test**: Add Slew Limiter to canvas → patch Step Sequencer CV Out → Slew Limiter CV In → Oscillator Pitch CV → set Rise to ~200 ms → press Play → verify pitch transitions glide instead of step.

- [x] T006 [US1] Add `SLEW_LIMITER` layout case to `src/utils/componentLayout.ts`:
  - `getControlLayout()`: `{ numKnobs: 2, hasDisplayArea: true, displayHeight: 80 }`
  - `getPortCounts()`: `{ inputs: 1, outputs: 1 }`
  - Width override block: `if (type === ComponentType.SLEW_LIMITER) { width = 140; }`
- [x] T007 [US1] Create `src/canvas/displays/SlewLimiterDisplay.ts` — mirrors `EnvelopeFollowerDisplay`:
  - Constructor `(x, y, width, height, slewLimiter: SlewLimiter)`
  - `render(ctx)`: compute `dtSec` from `performance.now()`; call `slewLimiter.tick(dtSec)`; draw dark background + green vertical bar proportional to `slewLimiter.getOutputValue()` in [0,1]
  - `updatePosition(x, y)`, `updateSize(w, h)`, `setFrozen(frozen)`, `destroy()`
- [x] T008 [US1] Wire `SlewLimiter` into `src/canvas/CanvasComponent.ts`:
  - Add `import { SlewLimiterDisplay }` at top
  - Add `private slewLimiterDisplay: SlewLimiterDisplay | null = null` field
  - Add `SLEW_LIMITER` case in `createControls()`: two `Knob` controls for `rise` and `fall` (same row layout as Envelope Follower 3-knob pattern but 2 knobs); verify/set the `logarithmic: true` flag on both `Parameter` objects so the knobs use exponential taper as specified in FR-003/FR-004; then create/update `SlewLimiterDisplay` below the knobs
  - Add `this.slewLimiterDisplay?.render(ctx)` in the display render pass
  - Add `this.slewLimiterDisplay?.destroy()` in component destroy/cleanup
  - Add `[ComponentType.SLEW_LIMITER]: 'Slew Limiter'` to the display-name map
- [x] T009 [US1] Register `SlewLimiter` in `src/components/registerComponents.ts`:
  - Add `import { SlewLimiter } from './utilities/SlewLimiter'`
  - Add `componentRegistry.register(ComponentType.SLEW_LIMITER, 'Slew Limiter', 'Smooths CV transitions — portamento and glide', 'Utilities', (id, pos) => new SlewLimiter(id, pos), calculateComponentDimensions(ComponentType.SLEW_LIMITER))`

**Checkpoint**: User Story 1 complete. Slew Limiter appears in Utilities menu, can be placed, patched, and produces audible portamento. Patch save/load round-trips `rise` and `fall` values correctly.

---

## Phase 4: User Story 2 — Independent Rise and Fall Control (Priority: P2)

**Goal**: Rise and Fall knobs operate independently; asymmetric glide (fast rise, slow fall) works correctly; values persist across patch save/reload.

**Independent Test**: Set Rise = 0 ms, Fall = 2000 ms → patch LFO square wave CV → Slew Limiter → any CV destination → verify output rises instantly but falls over ~2 seconds. Save patch, reload, confirm both knob values are restored exactly.

- [x] T010 [US2] Verify `tick()` direction logic in `SlewLimiter.ts`: confirm that when `target > outputValue` the Rise coefficient is used and when `target < outputValue` the Fall coefficient is used — add dedicated `tick()` asymmetry test to `tests/components/utilities/SlewLimiter.test.ts` if not already covered
- [x] T011 [US2] Verify `serialize()` / `deserialize()` round-trip for asymmetric values (rise ≠ fall) in `tests/components/utilities/SlewLimiter.test.ts`
- [x] T012 [US2] Confirm both knobs render and update independently in `CanvasComponent.ts` SLEW_LIMITER `createControls()` block — visually inspect that adjusting Rise does not affect Fall knob position and vice versa (manual verification step)

**Checkpoint**: User Story 2 complete. Rise and Fall are fully independent; patch persistence confirmed for both values.

---

## Phase 5: User Story 3 — Collider and LFO CV Smoothing (Priority: P3)

**Goal**: The Slew Limiter accepts CV from any source module (not just Step Sequencer), including LFO and Collider, and smooths any CV signal regardless of source type.

**Independent Test**: Patch LFO (square wave) → Slew Limiter CV In → Oscillator detune CV → with Rise+Fall > 0 verify the sharp LFO edges are softened into visible ramps on an Oscilloscope patched to the Oscillator output.

- [x] T013 [US3] Confirm `getInputNode()` returns `inputGain` (a standard `GainNode`) and verify that `SignalType.CV` connections from any CV source module connect to it without error — inspect `ConnectionManager` / patch wiring to confirm no `SLEW_LIMITER`-specific exclusions are needed
- [x] T014 [US3] Add acceptance scenario test to `tests/components/utilities/SlewLimiter.test.ts`: feed rapidly changing target values in quick succession → verify output continuously ramps toward the latest target without resetting mid-glide (edge case: rapid CV stream)
- [x] T015 [US3] Manual verification: patch Collider CV Out → Slew Limiter → Oscillator pitch; confirm no console errors and smooth glide behaviour

**Checkpoint**: User Story 3 complete. Any CV source can be routed through the Slew Limiter.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final quality pass across all stories.

- [x] T016 [P] Run `npm run lint` and fix any TypeScript or lint errors introduced across all new/modified files
- [x] T017 [P] Run `vitest run` and confirm all tests pass (0 failures)
- [x] T018 Add `SLEW_LIMITER` help sidebar entry following the pattern of other components (if a help/sidebar registry exists in the project)
- [x] T019 [P] Update `docs/research/missing-features.md` — mark Slew Limiter / Portamento as implemented with branch reference `031-slew-limiter-portamento`
- [ ] T020 Manual end-to-end validation per `specs/031-slew-limiter-portamento/quickstart.md`: primary patch (Sequencer → Slew → Oscillator), LFO edge softening, Collider glide, bypass A/B check

**Checkpoint**: All user stories integrated, lint clean, tests green, feature documented.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately; T002 and T003 are parallel
- **Phase 2 (Foundational)**: Depends on T001 (type registered) — T004 and T005 can overlap
- **Phase 3 (US1 MVP)**: Depends on Phase 2 complete — T006, T007 are parallel; T008, T009 depend on T007
- **Phase 4 (US2)**: Depends on Phase 3 complete — T010, T011, T012 can run in parallel
- **Phase 5 (US3)**: Depends on Phase 3 complete — T013, T014 can run in parallel
- **Phase 6 (Polish)**: Depends on Phases 3–5 complete

### User Story Dependencies

- **US1 (P1)**: Requires Phase 1 + 2 — no dependency on US2 or US3
- **US2 (P2)**: Requires US1 complete (same component, extending tick/persist tests)
- **US3 (P3)**: Requires US1 complete (same component, extending connection tests)
- **US2 and US3** can proceed in parallel once US1 is done

### Parallel Opportunities

- T002 + T003 (validation file + tests): different files, run together
- T006 + T007 (layout + display): different files, run together after Phase 2
- T010 + T011 + T012 (US2 tasks): different concerns, run together
- T013 + T014 (US3 tasks): different concerns, run together
- T016 + T017 + T019 (polish): different files, run together

---

## Parallel Example: Phase 1 + Setup

```
# Start immediately in parallel:
T002  Create SlewLimiterValidation.ts
T003  Create SlewLimiterValidation.test.ts

# Then after T001 is done:
T004  Create SlewLimiter.ts
T005  Create SlewLimiter.test.ts

# Then Phase 3 in parallel:
T006  Update componentLayout.ts
T007  Create SlewLimiterDisplay.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T005)
3. Complete Phase 3: US1 (T006–T009)
4. **STOP and VALIDATE**: patch Sequencer → Slew Limiter → Oscillator, hear portamento
5. Ship MVP

### Incremental Delivery

1. Setup + Foundational → `SlewLimiter` class tested
2. US1 → visible, patchable, audible portamento (MVP!)
3. US2 → independent Rise/Fall confirmed with asymmetric glide tests
4. US3 → general CV source compatibility verified
5. Polish → lint, docs, end-to-end

---

## Notes

- [P] tasks = different files, no shared state, safe to parallelise
- [Story] label maps each task to its user story for traceability
- Tests use `vitest run` (not `npm test` which starts watch mode)
- All new files follow the `EnvelopeFollower` / `EnvelopeFollowerDisplay` pattern exactly
- No new runtime dependencies; no `PatchData` schema changes needed
