# Tasks: Step Sequencer Refactor (012)

**Input**: Design documents from `/specs/012-step-sequencer-refactor/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Tests are not explicitly requested in the spec — test tasks are included only for the contracts helpers and serialization round-trip (critical correctness paths).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1–US5 maps to spec.md User Stories 1–5)
- Exact file paths are included in all descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the new file structure and import the contracts so all later tasks can reference them.

- [x] T001 Create `src/canvas/displays/StepSequencerDisplay.ts` as an empty class stub (constructor, empty `render()`, empty `renderDropdownMenus()`, empty `onMouseDown/Move/Up()`) — no logic yet; just establishes the module so imports resolve
- [x] T002 [P] Copy `specs/012-step-sequencer-refactor/contracts/types.ts` import path into `src/canvas/displays/StepSequencerDisplay.ts` and `src/components/utilities/StepSequencer.ts` — add the two import statements and verify `npm run build` still compiles with zero errors

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core changes to `StepSequencer.ts` and the contracts that all display and serialization work depends on. Must be complete before any user story display work begins.

**⚠️ CRITICAL**: No display or serialization work can start until this phase is complete.

- [x] T003 In `src/components/utilities/StepSequencer.ts` constructor: add `sequenceLength` Parameter (`addParameter('sequenceLength', 'Length', 16, 2, 16, 1, '')`) and `mode` Parameter (`addParameter('mode', 'Mode', 0, 0, 1, 1, '')`) — verify both appear in `component.parameters` map
- [x] T004 In `src/components/utilities/StepSequencer.ts` constructor: add all 64 per-step Parameters in a loop — `step_N_active` (0–1, default 1), `step_N_note` (0–127, default 60), `step_N_velocity` (0.0–1.0, default 0.8), `step_N_gateLength` (0–5, default 3) for N = 0–15
- [x] T005 In `src/components/utilities/StepSequencer.ts`: add `syncStepsFromParameters()` method that reads all `step_N_*` Parameters and writes them back into `this.steps[]`; call it at the end of the constructor after all Parameters are registered
- [x] T006 In `src/components/utilities/StepSequencer.ts`: override `updateAudioParameter()` — when `parameterId` matches `step_N_active/note/velocity/gateLength`, update the matching `this.steps[N]` field directly (in addition to any existing handling); also update `this.steps[N]` in `updateStep()` so live edits write through to Parameters
- [x] T007 In `src/components/utilities/StepSequencer.ts`: replace `getGateLength()` with `getGateDuration(step: SequencerStep, stepInterval: number): number | null` — returns `null` for `gateLength === 0` (tied), `stepInterval / Math.pow(2, step.gateLength - 1)` otherwise; update `scheduleStep()` to skip gate-off scheduling when `getGateDuration()` returns `null`
- [x] T008 In `src/components/utilities/StepSequencer.ts`: replace the implicit `isArpeggiatorMode()` body to read `this.getParameter('mode')!.getValue() === 1` instead of checking port connection state; update `startConnectionMonitoring()` so keyboard connection detection still works but no longer auto-sets mode — it may trigger a console warning if a keyboard is connected while mode is Sequencer
- [x] T009 In `src/components/utilities/StepSequencer.ts`: add `getDisplayState(): StepSequencerDisplayState` method that returns a snapshot of the current pattern (via `getSteps()`, `getParameter` calls) and transport state (`isPlaying`, `visualCurrentStep`) — import `StepSequencerDisplayState` from contracts/types.ts
- [x] T010 [P] In `src/components/utilities/StepSequencer.ts`: add `getSequenceLength(): number` and `getMode(): SequencerMode` convenience getters that read the corresponding Parameters — fix `scheduleNextSteps()` in two places: (1) wrap `this.currentStep` with `this.currentStep = (this.currentStep + 1) % this.getSequenceLength()` instead of hardcoded `% 16`; (2) the `setTimeout` callback that sets `this.visualCurrentStep = stepToSchedule` must also clamp to `sequenceLength` — if `stepToSchedule >= this.getSequenceLength()` the visual cursor must not advance past the active length
- [x] T011 Verify foundational changes compile and the basic timing still works: `npm run build` passes; add sequencer to canvas, press Play, audio plays — no regression in timing or gate behaviour

**Checkpoint**: `StepSequencer` has all 66 Parameters, correct tied-gate suppression, `getDisplayState()`, and explicit mode. Build passes. Basic audio playback works.

---

## Phase 3: User Story 5 — Pattern Persistence (Priority: P5) 🔑 Foundation for all stories

**Note**: US5 (persistence) is promoted above US2–US4 in task order because the serialization foundation enables round-trip testing during development of all other features. US5 depends only on the Phase 2 audio changes, not on the display.

**Goal**: All step parameters, BPM, note division, sequence length, and mode saved and restored with the patch.

**Independent Test**: Program a pattern with varied notes/velocities/gate lengths. Save patch (`Ctrl+S`), reload page, re-open patch — all step values, global settings and mode are identical.

- [x] T012 [US5] In patch load path: find where `PatchManager` or `CanvasComponent` restores a component from `ComponentData` (search for `setParameterValue` call loop) and add `if (component instanceof StepSequencer) component.syncStepsFromParameters();` immediately after the parameter restore loop completes — file: `src/patch/PatchManager.ts` or `src/canvas/CanvasComponent.ts`
- [x] T013 [US5] Write unit tests for contracts helpers in `tests/unit/step-sequencer-contracts.test.ts`: test `encodeMidiNote` / `decodeMidiNote` round-trip for all 128 MIDI notes; test `encodeArpOffset` / `decodeArpOffset` for offsets −12 to +12; test `stepToParams` / `paramsToStep` round-trip for a sample step; test `validatePatternFromParams` with valid data, missing keys (should use defaults), and out-of-range values (should throw)
- [x] T014 [P] [US5] Write integration test for serialization round-trip in `tests/unit/step-sequencer-serialization.test.ts`: create a `StepSequencer` instance, set varied step values via `updateStep()`, call `serialize()`, call `setParameterValue()` in a loop with the serialized parameters, call `syncStepsFromParameters()`, verify all 16 steps match the original values
- [x] T015 [US5] Manual verification: `npm test` passes for T013 and T014; save and reload a patch in the browser — confirm all step values present in localStorage under the component's parameter keys

**Checkpoint**: Patch save/load preserves 100% of step data. Unit tests green.

---

## Phase 4: User Story 1 — Basic Pattern Sequencing (Priority: P1) 🎯 MVP

**Goal**: Step Sequencer plays a programmed melody through connected oscillator/envelope at the configured BPM; active/inactive steps work; stop/reset work; sequence length loops correctly.

**Independent Test**: Add Step Sequencer, connect frequency and gate outputs to an oscillator and ADSR, set steps 1–4 to different notes, set length to 4, press Play — audio plays the 4-step pattern in a loop. Toggle a step inactive — it is skipped silently. Change BPM mid-playback — tempo changes immediately.

- [x] T016 [US1] In `src/canvas/displays/StepSequencerDisplay.ts`: implement the transport bar render — `renderTransportBar(ctx: CanvasRenderingContext2D, state: StepSequencerDisplayState): void` draws Play/Stop toggle button, Reset button, BPM label+value (read-only text for now), Division label, Length label, Mode label at `(baseX, baseY)` within a 32px-high row using the same color constants as `OscilloscopeDisplay`
- [x] T017 [US1] In `src/canvas/displays/StepSequencerDisplay.ts`: implement the step grid render — `renderStepGrid(ctx, state): void` draws 16 cells using `STEP_CELL_WIDTH = Math.floor((baseWidth - 32) / 16)`, each cell showing: filled circle (active indicator, top 6px), note label text (middle 16px), velocity bar (placeholder grey rect for now, 30px), gate label text (bottom 20px); highlight `state.transport.visualCurrentStep` cell with a bright accent color when `state.transport.isPlaying`
- [x] T018 [US1] In `src/canvas/displays/StepSequencerDisplay.ts`: implement `onMouseDown(worldX, worldY): boolean` for transport controls — hit-test Play/Stop button (toggle `sequencer.start()` / `sequencer.stop()`), hit-test Reset button (call `sequencer.reset()`); return `true` if handled
- [x] T019 [US1] In `src/canvas/displays/StepSequencerDisplay.ts`: implement step cell toggle in `onMouseDown` — after transport hit-test misses, identify the clicked step cell (index = `Math.floor((worldX - stepGridStartX) / cellWidth)`); the step cell is divided into sub-regions from top: active-indicator (0–6px), note-label (6–22px), velocity-knob (22–52px), gate-dropdown (52–72px). A click in the **active-indicator zone (0–6px) OR in the remainder of the cell below 72px** toggles the step. A click in the note-label, velocity-knob, or gate-dropdown zones does NOT toggle. Call `sequencer.updateStep(index, { active: !step.active })` when toggle fires.
- [x] T020 [US1] In `src/canvas/CanvasComponent.ts`: in `createControls()` (or equivalent display-creation path), add `case ComponentType.STEP_SEQUENCER`: construct `new StepSequencerDisplay(displayX, displayY, displayWidth, displayHeight, sequencer)` and store in `this.stepSequencerDisplay`; calculate `displayX/Y` as `position.x, position.y + COMPONENT.HEADER_HEIGHT + controlsHeight`, `displayWidth = this.width`, `displayHeight = SEQUENCER_DISPLAY_HEIGHT` (define constant as 112)
- [x] T021 [US1] In `src/canvas/CanvasComponent.ts`: in `render()` after the existing `oscilloscopeDisplay` block, add: `if (this.stepSequencerDisplay) { this.stepSequencerDisplay.render(ctx); }`
- [x] T022 [US1] In `src/canvas/CanvasComponent.ts`: in `onMouseDown()` / `onMouseMove()` / `onMouseUp()` event handlers, forward pointer events to `this.stepSequencerDisplay?.onMouseDown/Move/Up(worldX, worldY)` when the click falls within the display bounds — return `true` if the display handler returns `true`
- [x] T023 [US1] Remove old `SequencerDisplay` from `CanvasComponent.ts`: delete the `this.sequencerDisplay` field declaration, remove its constructor call in `createControls()`, remove its render call, remove its event forwarding, remove the `import { SequencerDisplay }` statement
- [x] T024 [US1] Delete `src/canvas/displays/SequencerDisplay.ts` and verify `npm run build` passes with zero errors and zero references to `SequencerDisplay` remain (`grep -r SequencerDisplay src/` returns nothing)
- [x] T025 [US1] Manual verification per quickstart.md Step 1 checklist: add sequencer to canvas → step grid visible; press Play → active step cursor moves; toggle a step → it goes dark; change BPM (by editing value directly in browser for now) → tempo changes; delete sequencer → no orphaned `<canvas>` element in DOM

**Checkpoint**: Basic playback works. Transport **buttons** (Play/Stop/Reset) are functional; BPM, Division, and Length are rendered as read-only labels until Phase 7. Step toggle works. No orphaned DOM elements. `npm run build` passes.

---

## Phase 5: User Story 4 — Crisp Rendering at Any Zoom Level (Priority: P4)

**Note**: US4 is implemented before US2/US3 because it validates the canvas rendering foundation. US2 (per-step editing) builds on top of this; resolving rendering correctness first avoids fixing blurriness after detailed controls are drawn.

**Goal**: Step grid pixel-crisp at all zoom levels (25%–400%); dropdowns render on top; no orphaned canvas; two sequencers don't cross-contaminate.

**Independent Test**: Add Step Sequencer, zoom to 50% and 200% — step grid crisp. Open gate-length dropdown — renders fully on top of step grid. Delete sequencer — no orphaned `<canvas>` in Elements panel. Add two sequencers — each draws in its own region.

- [x] T026 [US4] In `src/canvas/displays/StepSequencerDisplay.ts`: add `updatePosition(x: number, y: number, width: number, height: number): void` that updates `baseX/Y/Width/Height` — this is called by `CanvasComponent` whenever the component is moved or resized so the display follows world coordinates
- [x] T027 [US4] In `src/canvas/CanvasComponent.ts`: in `setPosition()` or wherever component position is updated after drag, call `this.stepSequencerDisplay?.updatePosition(newX, newY + headerHeight + controlsHeight, this.width, SEQUENCER_DISPLAY_HEIGHT)` — verify the display tracks the component when dragged
- [x] T028 [US4] In `src/canvas/CanvasComponent.ts`: add `renderDropdownMenus()` call for the step sequencer display — `if (this.stepSequencerDisplay) { this.stepSequencerDisplay.renderDropdownMenus(ctx); }` — this is the existing `renderDropdownMenus()` method that `Canvas.ts` calls in the post-component pass; ensures any dropdown menus opened by the sequencer display appear on top of all component draws
- [x] T029 [P] [US4] Verify no DOM element ownership: `StepSequencerDisplay` constructor must not call `document.createElement('canvas')` or any DOM API; `destroy()` method (if present) must not call `removeChild` — code review / grep check
- [x] T030 [US4] Manual verification: zoom to 50% → crisp; zoom to 200% → crisp; add two sequencers simultaneously → independent regions; delete one → the other still renders correctly; check DevTools Elements → zero `<canvas>` children added by sequencer

**Checkpoint**: Display is zoom-correct, z-order correct, no DOM elements. Ready for per-step controls.

---

## Phase 6: User Story 2 — Per-Step Parameter Editing (Priority: P2)

**Goal**: Every step permanently shows note, velocity indicator, and gate length. Clicking note label opens a two-selector note picker (note name C–B, octave 0–8). Velocity adjustable via draggable knob. Gate length selectable via dropdown. Clicking step cell (not a named control) toggles active/inactive.

**Independent Test**: Without any interaction, all steps show note, velocity, and gate length. Click a note label → two-selector picker opens. Select note + octave → step plays new pitch. Drag velocity knob → velocity changes. Open gate dropdown → select 1/8 → gate closes after 1/8-note duration. Click step cell body → toggles active/inactive.

- [x] T031 [US2] In `src/canvas/displays/StepSequencerDisplay.ts`: replace the velocity placeholder rect in `renderStepGrid()` with a proper inline `Knob` control per step — instantiate 16 `Knob` instances in `StepSequencerDisplay` constructor (one per step), positioned at step cell centre, bound to `step.velocity`; call `knob.render(ctx)` inside the step cell render loop
- [x] T032 [US2] In `src/canvas/displays/StepSequencerDisplay.ts`: replace the gate label placeholder with an inline `Dropdown` control per step — instantiate 16 `Dropdown` instances in constructor, each with options `[{value:0,label:'tied'},{value:1,label:'1/1'},{value:2,label:'1/2'},{value:3,label:'1/4'},{value:4,label:'1/8'},{value:5,label:'1/16'}]`, bound to `step.gateLength`; call `dropdown.render(ctx)` inside the step cell render loop
- [x] T033 [US2] In `src/canvas/displays/StepSequencerDisplay.ts`: implement `renderDropdownMenus(ctx)` — iterate the 16 gate `Dropdown` instances and call `dropdown.renderMenu(ctx)` for any that are open, then call `notePickerNoteDropdown?.renderMenu(ctx)` and `notePickerOctaveDropdown?.renderMenu(ctx)` if the note picker is open
- [x] T034 [US2] In `src/canvas/displays/StepSequencerDisplay.ts`: implement the note picker — add `openNotePicker(stepIndex: number): void` that creates two `Dropdown` instances (note names 12 options, octaves 9 options) positioned adjacent to the clicked step cell; add `closeNotePicker(): void`; add `notePickerState: NotePickerState` field (import from contracts/types.ts)
- [x] T035 [US2] In `src/canvas/displays/StepSequencerDisplay.ts`: update `onMouseDown()` hit-test to enforce priority order using the fixed sub-region offsets from T019 — within each step cell check in order: (1) note-label zone (cellY+6 to cellY+22) → `openNotePicker(stepIndex)`, (2) velocity-knob zone (cellY+22 to cellY+52) → `knob.onMouseDown(x, y)`, (3) gate-dropdown zone (cellY+52 to cellY+72) → `dropdown.onMouseDown(x, y)`, (4) active-indicator zone (cellY+0 to cellY+6) OR below cellY+72 → step toggle; return `true` from first matched handler
- [x] T036 [US2] In `src/canvas/displays/StepSequencerDisplay.ts`: update `onMouseMove()` to forward to the active velocity knob drag (if any knob returned `true` on mousedown, forward subsequent mousemove to it); update `onMouseUp()` to end any active knob drag
- [x] T037 [US2] In `src/canvas/displays/StepSequencerDisplay.ts`: wire note picker selection back to the step — when either the note-name or octave dropdown fires a selection, call `encodeMidiNote(noteNameIndex, octave)` and `sequencer.updateStep(stepIndex, { note: encoded })`; then close the picker; import `encodeMidiNote` from contracts/types.ts
- [x] T038 [US2] In `src/canvas/displays/StepSequencerDisplay.ts`: wire velocity knob changes back to the step — on knob value change callback, call `sequencer.updateStep(stepIndex, { velocity: knobValue })`
- [x] T039 [US2] In `src/canvas/displays/StepSequencerDisplay.ts`: wire gate dropdown selection back to the step — on dropdown selection, call `sequencer.updateStep(stepIndex, { gateLength: selectedValue as GateLength })`
- [x] T040 [US2] Manual verification per spec acceptance scenarios: all steps display note/velocity/gate without interaction; click note label → picker opens with two dropdowns; select C5 → step plays C5 on next cycle; drag velocity knob → step velocity changes audibly; open gate dropdown → select 1/8 → gate closes sooner; click step body → toggles; note picker stays open while sequencer plays

**Checkpoint**: Full per-step editing works. All three named controls intercept clicks before the toggle. Note picker closes on selection or outside click.

---

## Phase 7: User Story 1 Extension — Transport Knobs & Dropdowns (BPM, Division, Length, Mode)

**Note**: This phase completes US1 transport controls that were deferred (BPM knob, Division dropdown, Length control, Mode toggle). Split from Phase 4 to keep the MVP playback checkpoint achievable early.

**Goal**: BPM adjustable via draggable knob. Note division selectable via canvas dropdown. Sequence length adjustable. Mode toggleable between Sequencer and Arpeggiator.

**Independent Test**: Add sequencer. Drag BPM knob from 120 to 200 while playing — tempo increases immediately. Open Division dropdown, select 1/8 — steps play faster. Adjust Length to 8 — only steps 1–8 loop. Click Mode toggle — display switches label to "ARP".

- [x] T041 [US1] In `src/canvas/displays/StepSequencerDisplay.ts`: replace BPM read-only text in `renderTransportBar()` with a `Knob` control instance bound to `sequencer.getParameter('bpm')` — range 30–300, draw at transport bar position; wire `onMouseDown/Move/Up` forwarding; on value change call `sequencer.setParameterValue('bpm', value)`
- [x] T042 [P] [US1] In `src/canvas/displays/StepSequencerDisplay.ts`: add a `Dropdown` instance for note division in the transport bar — options `[{value:0,label:'1/1'},{value:1,label:'1/2'},{value:2,label:'1/4'},{value:3,label:'1/8'},{value:4,label:'1/16'},{value:5,label:'1/32'}]`; wire selection to `sequencer.setParameterValue('noteValue', value)`; include `dropdown.renderMenu(ctx)` in `renderDropdownMenus()`
- [x] T043 [P] [US1] In `src/canvas/displays/StepSequencerDisplay.ts`: add a sequence-length control in the transport bar — a small `Knob` or click-to-increment label (range 2–16, integer steps); wire to `sequencer.setParameterValue('sequenceLength', value)` and verify `scheduleNextSteps()` respects the new length
- [x] T044 [US1] In `src/canvas/displays/StepSequencerDisplay.ts`: add Mode toggle button in transport bar — canvas-drawn button showing "SEQ" or "ARP"; on click: if playing, call `sequencer.stop()` and `sequencer.reset()` first, then call `sequencer.setParameterValue('mode', newMode)`; update button label on next render frame

**Checkpoint**: All transport controls interactive. BPM knob works during playback. Division, length, mode all functional.

---

## Phase 8: User Story 3 — Arpeggiator Mode (Priority: P3)

**Goal**: Connect KeyboardInput to arpeggiator inputs, switch to Arpeggiator mode — sequencer cycles with each step's semitone offset applied to the keyboard frequency. Stops and resets when key released.

**Independent Test**: Connect KeyboardInput to sequencer arpeggiator inputs. Click Mode toggle to "ARP". Hold a key — sequencer plays arpeggiated pattern. Release key — sequencer stops and resets. Hold different key — arpeggio shifts to new base pitch.

- [x] T045 [US3] In `src/canvas/displays/StepSequencerDisplay.ts`: when `state.pattern.mode === SEQUENCER_MODE.ARPEGGIATOR`, render each step cell's note label as a semitone offset: decode `step.note` as `decodeArpOffset(step.note)` and display as e.g. `+3` / `−5` / `0`; import `decodeArpOffset` and `SEQUENCER_MODE` from contracts/types.ts
- [x] T046 [US3] In `src/canvas/displays/StepSequencerDisplay.ts`: when arpeggiator mode is active and the note picker opens, replace the MIDI note display with a semitone offset picker — a single `Dropdown` with options −12 to +12 (25 options); on selection call `sequencer.updateStep(stepIndex, { note: encodeArpOffset(offset) })`
- [x] T047 [US3] In `src/components/utilities/StepSequencer.ts`: update `startConnectionMonitoring()` — when keyboard arpeggiator ports are connected AND `mode === SEQUENCER_MODE.ARPEGGIATOR`, start arpeggiator gate monitoring; when mode is `SEQUENCER`, stop gate monitoring regardless of connections; this replaces the current implicit auto-start
- [x] T048 [US3] In `src/canvas/displays/StepSequencerDisplay.ts`: when `mode === SEQUENCER_MODE.ARPEGGIATOR` and no arpeggiator inputs are connected (`sequencer.inputs.get('arpFrequency')?.isConnected()` is false), display a hint text in the display area: `"Connect a Keyboard to Arp inputs to start"`
- [x] T049 [US3] Manual verification per spec acceptance scenarios: hold key in arp mode → sequencer starts, plays offsets applied to base note; release key → stops and resets; hold different key mid-play → base pitch shifts; mode toggle while playing → stop+reset first then switch

**Checkpoint**: Arpeggiator mode fully functional. Visual feedback for disconnected keyboard shown.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Finalize rendering quality, clean up, run all gates.

- [ ] T050 [P] In `src/canvas/displays/StepSequencerDisplay.ts`: audit all magic numbers — extract to named constants at top of file: `TRANSPORT_HEIGHT`, `STEP_GRID_HEIGHT`, `STEP_CELL_GAP`, `NOTE_LABEL_HEIGHT`, `VELOCITY_KNOB_HEIGHT`, `GATE_DROPDOWN_HEIGHT`, `ACTIVE_INDICATOR_HEIGHT`, color constants following `OscilloscopeDisplay` naming convention
- [ ] T051 [P] In `src/components/utilities/StepSequencer.ts`: remove all `console.log` debug calls (keep `console.warn` for missing parameters); matches codebase style of other components
- [ ] T052 [P] Verify no function exceeds 50 lines (constitution rule): split any overlong render sub-functions in `StepSequencerDisplay.ts` into helper methods
- [ ] T053 Run full validation checklist from `specs/012-step-sequencer-refactor/quickstart.md`: ✓ build passes; ✓ zoom 50%/200% crisp; ✓ dropdowns render on top; ✓ no orphaned DOM; ✓ two sequencers simultaneously; ✓ patch save/reload 100% fidelity; ✓ 120 BPM 60s timing; ✓ BPM change mid-play; ✓ tied gate legato; ✓ delete while playing cleans up; ✓ **set Length to 1, press Play — single step loops continuously without error or hang**; ✓ **set BPM to 30, play 30s — timing stable at minimum BPM**; ✓ **set BPM to 300, play 10s — no missed steps at maximum BPM**; ✓ **load an existing patch without a StepSequencer — it loads and plays correctly with no errors thrown**
- [ ] T054 Run `npm test && npm run lint` — zero errors, zero warnings; all unit tests from T013 and T014 pass

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
  └── Phase 2 (Foundational — audio component)
        ├── Phase 3 (US5 Persistence) ← can start in parallel with Phase 4
        └── Phase 4 (US1 Basic Playback) ← MVP critical path
              └── Phase 5 (US4 Zoom/Rendering)
                    └── Phase 6 (US2 Per-Step Editing)
                          ├── Phase 7 (US1 Transport Controls) ← in parallel with Phase 6
                          └── Phase 8 (US3 Arpeggiator)
                                └── Phase 9 (Polish)
```

### User Story Dependencies

| Story | Depends On | Notes |
|---|---|---|
| **US5 Persistence** (T012–T015) | Phase 2 only | Can start alongside US1 — no display dependency |
| **US1 Basic Playback** (T016–T025, T041–T044) | Phase 2 | First display work; enables MVP demo |
| **US4 Zoom/Rendering** (T026–T030) | US1 display stub | Validates rendering foundation before adding complex controls |
| **US2 Per-Step Editing** (T031–T040) | US4 | Builds detailed controls on top of correct rendering foundation |
| **US1 Transport Knobs** (T041–T044) | US1 display stub | Parallelisable with US4 since different transport bar sub-region |
| **US3 Arpeggiator** (T045–T049) | US2, US1 transport | Needs arp mode display + mode toggle |

### Within Each Phase

- Models/Parameters before dependent display code
- `syncStepsFromParameters()` before any patch load test
- Render method before event forwarding
- Core render before dropdown pass wiring

### Parallel Opportunities

Within Phase 2: T003 and T010 touch different methods — can be parallelised.
Within Phase 4 (US1): T016/T017 (render methods) can be written in parallel with T020/T021 (CanvasComponent wiring) since they touch different files.
Within Phase 7: T042 (division dropdown) and T043 (length control) are independent — both marked [P].
T029 (DOM audit) and T050 (constants audit) and T051 (console.log cleanup) are all independent — all marked [P].

---

## Parallel Example: Phase 4 (US1 Basic Playback)

```
# These can run in parallel (different files):
Task T016: renderTransportBar() in src/canvas/displays/StepSequencerDisplay.ts
Task T020: createControls() wiring in src/canvas/CanvasComponent.ts

# Then (after T016+T017 complete):
Task T018: Transport hit-test in StepSequencerDisplay.ts
Task T021: render() call addition in CanvasComponent.ts

# Then (sequential — T023 depends on T020 and T021 being stable):
Task T023: Remove old SequencerDisplay references from CanvasComponent.ts
Task T024: Delete SequencerDisplay.ts
```

---

## Implementation Strategy

### MVP (User Stories 1 + 4 + 5 only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational audio changes (T003–T011)
3. Complete Phase 3: Persistence (T012–T015) — small, de-risks serialization early
4. Complete Phase 4: Basic Playback display (T016–T025)
5. Complete Phase 5: Zoom correctness (T026–T030)
6. Complete Phase 7: Transport knobs (T041–T044)
7. **STOP and VALIDATE**: Sequencer plays, persists, renders correctly at all zoom levels — shippable
8. Continue with Phase 6 (US2), Phase 8 (US3), Phase 9 (Polish)

### Incremental Delivery

- After T025: Basic playback works → demo-able
- After T030: Zoom-correct → no visual regressions
- After T040: Full per-step editing → practical for melody programming
- After T044: Transport controls complete → BPM knob works
- After T049: Arpeggiator mode complete → full feature set
- After T054: Ship-ready

---

## Notes

- [P] tasks = different files or independent sub-regions, no dependencies on incomplete tasks in the same phase
- [US1]–[US5] labels map to User Stories 1–5 in spec.md
- Each phase ends with a manual verification checkpoint that can be demoed independently
- Import contracts from `specs/012-step-sequencer-refactor/contracts/types.ts` — do not re-declare types inline
- Pattern to follow for display integration: search `oscilloscopeDisplay` in `src/canvas/CanvasComponent.ts` — 4 locations to mirror
- Tied gate implementation: `getGateDuration()` returning `null` = suppress gate-off; the gate stays high until the next `scheduleStep()` fires a new gate-on
