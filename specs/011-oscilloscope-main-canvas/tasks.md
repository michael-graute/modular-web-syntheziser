# Tasks: Oscilloscope Display — Main Canvas Migration

**Input**: Design documents from `/specs/011-oscilloscope-main-canvas/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1–US3)
- All paths are relative to the repository root

---

## Phase 1: Setup (Audit & Verify)

**Purpose**: Read all affected files and confirm exact line numbers and interfaces before making any changes. Prevents errors from stale assumptions.

- [X] T001 Read and annotate `src/canvas/displays/OscilloscopeDisplay.ts` in full — note all public methods, private fields, the scheduler subscription, and the DOM canvas lifecycle
- [X] T002 [P] Read `src/canvas/CanvasComponent.ts` lines 750–790 and 1400–1440 — note the `appendChild` call, the `updateViewportTransform` oscilloscope branch, and the `destroy()` call
- [X] T003 [P] Read `src/canvas/Canvas.ts` lines 460–530 and 600–630 — note every call to `component.updateViewportTransform()` and any oscilloscope-related comments
- [X] T004 Verify project compiles cleanly with `npx tsc --noEmit` before making any changes — establish green baseline

**Checkpoint**: All affected locations confirmed. TypeScript baseline is green.

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: Rewrite `OscilloscopeDisplay` to the new interface. This is the single blocking dependency — all three user stories are satisfied by this one change plus the wiring in Phase 3.

- [X] T005 Rewrite `src/canvas/displays/OscilloscopeDisplay.ts` — remove all DOM canvas fields and methods (`canvas`, `ctx` as internal canvas, `getCanvas()`, `updateViewportTransform()`, `isVisible()`); remove `visualUpdateScheduler` import and subscription; add 30 FPS timestamp throttle (`lastRenderTime`, `frameInterval`) directly in the new `render(ctx)` method body
- [X] T006 Implement `render(ctx: CanvasRenderingContext2D): void` in `src/canvas/displays/OscilloscopeDisplay.ts` — draws background (`fillRect`), border (`strokeRect`), grid, waveform, and/or spectrum at world coordinates (`baseX`, `baseY`, `baseWidth`, `baseHeight`) using the supplied context; reads `displayMode`, `gain`, waveform buffer, and spectrum buffer from the stored `oscilloscope` reference; returns early when frozen or when `< frameInterval` ms have elapsed since last render
- [X] T007 Implement `updatePosition(x, y)`, `updateSize(w, h)`, `setFrozen(frozen)`, and `destroy()` in `src/canvas/displays/OscilloscopeDisplay.ts` — `destroy()` releases the `oscilloscope` reference (no DOM removal); `updatePosition`/`updateSize` update `baseX`/`baseY`/`baseWidth`/`baseHeight`
- [X] T008 Verify `src/canvas/displays/OscilloscopeDisplay.ts` compiles with `npx tsc --noEmit` and satisfies the `IOscilloscopeDisplay` interface from `specs/011-oscilloscope-main-canvas/contracts/interfaces.ts`

**Checkpoint**: `OscilloscopeDisplay` is a pure rendering class with no DOM element. TypeScript compiles.

---

## Phase 3: User Story 1 — Sharp, Correctly-Scaled Oscilloscope at Any Zoom Level (Priority: P1)

**Goal**: The oscilloscope display renders via the main canvas render pass so it scales correctly at all zoom levels.

**Independent Test**: Add an Oscilloscope module, connect an audio source, zoom to 50% and 200% — waveform lines and grid are pixel-crisp matching other component controls.

- [X] T009 [US1] In `src/canvas/CanvasComponent.ts` `createControls()` — remove the `document.getElementById('synth-canvas')` lookup and `parentElement.appendChild(this.oscilloscopeDisplay.getCanvas())` lines; the display constructor call remains unchanged
- [X] T010 [US1] In `src/canvas/CanvasComponent.ts` `render(ctx)` — add `if (this.oscilloscopeDisplay) { this.oscilloscopeDisplay.render(ctx); }` after the `renderControls(ctx)` call and before `ctx.restore()`, following the identical pattern used for `chordFinderDisplay` at the same location
- [X] T011 [US1] In `src/canvas/CanvasComponent.ts` `updateViewportTransform()` — remove the `if (this.oscilloscopeDisplay) { this.oscilloscopeDisplay.updateViewportTransform(...) }` branch; leave the sequencer and collider branches untouched
- [X] T012 [US1] Verify `npx tsc --noEmit` passes after T009–T011; manually test in browser: add Oscilloscope, zoom to 50% and 200%, confirm waveform and grid are crisp and correctly positioned

**Checkpoint**: Oscilloscope renders on the main canvas. Zoom artefacts are gone. Dropdown menus (Phase 4) and DOM cleanup (Phase 5) are automatic consequences of this wiring.

---

## Phase 4: User Story 2 — No Z-Index Conflicts with Dropdown Menus (Priority: P2)

**Goal**: Dropdown menus always render on top of the oscilloscope display area. This is satisfied structurally by Phase 3 — the render call in T010 happens before `renderDropdownMenus()` in `Canvas.ts`'s second pass. This phase confirms and validates that ordering.

**Independent Test**: Open the Display-mode dropdown on an Oscilloscope module — the dropdown list is fully visible with no portion obscured by the waveform display area.

- [ ] T013 [US2] Confirm in `src/canvas/Canvas.ts` that `component.render(ctx)` (line ≈763) is called before `component.renderDropdownMenus(ctx)` (line ≈776) in the render loop — no code change expected; add an inline comment if the ordering is not obvious
- [ ] T014 [US2] Manually verify: add an Oscilloscope, open its Display dropdown, confirm the dropdown popup fully overlaps the waveform area; test with the Oscilloscope adjacent to another component with a dropdown and verify no cross-obscuring

**Checkpoint**: Dropdown menus are always on top of the oscilloscope. No code changes needed beyond documenting the ordering.

---

## Phase 5: User Story 3 — No Orphaned DOM Overlay Elements (Priority: P3)

**Goal**: Deleting an Oscilloscope leaves no `<canvas>` element behind. This is satisfied structurally by the Phase 2 rewrite — `destroy()` no longer calls `removeChild`. This phase validates the lifecycle.

**Independent Test**: Add an Oscilloscope, delete it, inspect DOM — no orphaned `<canvas>` child under the synth canvas container.

- [ ] T015 [US3] Confirm `src/canvas/CanvasComponent.ts` `destroy()` still calls `this.oscilloscopeDisplay.destroy()` — this call must remain; verify it exists and is unconditional
- [ ] T016 [US3] Manually verify: add two Oscilloscope modules, delete both, use browser devtools to confirm the DOM canvas container holds only the main `<canvas>` element and no overlay children

**Checkpoint**: No DOM leaks. The destroy lifecycle is correct.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, comments cleanup, viewport transform call removal from Canvas.ts, and final validation.

- [ ] T017 [P] In `src/canvas/Canvas.ts` — remove or update any comments referencing the oscilloscope overlay canvas or CSS transform viewport synchronisation (lines ≈466, ≈520); ensure `updateViewportTransform` calls on other components (Collider, Sequencer) are unaffected
- [ ] T018 [P] Verify edge case: add Oscilloscope with no audio connected — confirm display renders an empty waveform (flat line) or empty spectrum bars without throwing errors; guard `if (!data || data.length === 0) return;` must be present in `renderWaveform` and `renderSpectrum`
- [ ] T019 [P] Verify edge case: pan the Oscilloscope fully off-screen — confirm no JavaScript errors in console and the main canvas render loop continues at normal frame rate
- [ ] T020 [P] Verify edge case: add two Oscilloscopes on the canvas simultaneously — confirm each renders its own independent data in its own region with no cross-contamination
- [ ] T021 Run `npx tsc --noEmit` and `npm run lint` — fix all type errors and lint warnings
- [ ] T022 Smoke-test against quickstart.md validation scenarios: Scenario 1 (crisp at 50%/200% zoom), Scenario 2 (dropdown not obscured), Scenario 3 (no DOM leak), Scenario 4 (two oscilloscopes independent)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately; T002 and T003 can run in parallel with T001
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS Phases 3, 4, 5**
- **Phase 3 (US1)**: Depends on Phase 2 — primary wiring; T009, T010, T011 are sequential (same file)
- **Phase 4 (US2)**: Depends on Phase 3 — validation only; T013 and T014 can start once T010 is done
- **Phase 5 (US3)**: Depends on Phase 2 — validation only; can run in parallel with Phase 4
- **Phase 6 (Polish)**: Depends on Phases 3, 4, 5 — T017–T020 can run in parallel; T021 must be last before T022

### Critical Path

```
T001–T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 → T021 → T022
                                    ↑
                              T013, T014, T015, T016 (parallel after T010)
```

### Parallel Opportunities

```
# Phase 1 — run simultaneously:
T002: Read CanvasComponent.ts
T003: Read Canvas.ts

# Phase 4 + Phase 5 — run simultaneously after T010:
T013: Confirm render order in Canvas.ts
T014: Manual dropdown test
T015: Confirm destroy() call
T016: Manual DOM leak test

# Phase 6 — run simultaneously:
T017: Clean up Canvas.ts comments
T018: Edge case — no audio
T019: Edge case — off-screen
T020: Edge case — two oscilloscopes
```

---

## Implementation Strategy

### Minimal Scope

This is a focused refactor of a single class and two wiring sites. The entire implementation can be completed in one session:

1. **Phase 1** (≈15 min): Read all affected files, confirm locations
2. **Phase 2** (≈45 min): Rewrite `OscilloscopeDisplay.ts`
3. **Phase 3** (≈20 min): Wire into `CanvasComponent.ts`, remove DOM append and transform call
4. **Phases 4–5** (≈15 min): Manual validation (no code changes expected)
5. **Phase 6** (≈15 min): Edge cases, lint, smoke test

### Files Changed Summary

| File | Change Type |
|------|-------------|
| `src/canvas/displays/OscilloscopeDisplay.ts` | Full rewrite |
| `src/canvas/CanvasComponent.ts` | 3 targeted edits (remove append, add render call, remove transform branch) |
| `src/canvas/Canvas.ts` | Comment-only update (no logic change) |

### Notes

- `src/components/analyzers/Oscilloscope.ts` — **not touched**
- `src/visualization/scheduler.ts` — **not touched**
- The `isFrozen` flag and `setFrozen()` method are retained with no behaviour change
- Drawing coordinate formula is in `quickstart.md` — reference it during T006
