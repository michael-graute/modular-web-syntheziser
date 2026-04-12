# Implementation Plan: Step Sequencer Refactor

**Branch**: `012-step-sequencer-refactor` | **Date**: 2026-04-12 | **Spec**: [spec.md](spec.md)
**Input**: Refactor the existing StepSequencer component to match the design in specs/step-sequencer-plan.md and the layout in specs/step-sequencer-layout-example.png.

---

## Summary

Replace the existing `SequencerDisplay` (separate HTML canvas overlay, CSS transform-based zoom synchronisation) with a `StepSequencerDisplay` that draws directly onto the main `CanvasRenderingContext2D` — the same migration already completed for the Oscilloscope (011) and ChordFinder (010). Simultaneously, the refactor adds always-visible per-step controls (note, velocity knob, gate dropdown), a canvas-drawn note-name + octave picker popup, an explicit mode toggle, full pattern serialisation via the existing Parameter/PatchSerializer pipeline, and a fix for incorrect tied-gate behaviour.

---

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020 target, strict mode
**Primary Dependencies**:
- Web Audio API (`ConstantSourceNode`, `GainNode`) — existing; no new audio nodes
- Canvas 2D API — existing main canvas context; no new DOM elements
- Zero new runtime dependencies
**Storage**: `localStorage` via existing `PatchSerializer` / `PatchStorage` pattern
**Testing**: `npm test && npm run lint`
**Target Platform**: Browser (Chrome / Firefox / Safari); no server-side code
**Performance Goals**: 60 FPS render, < 5 ms timing drift at 120 BPM over 60 s
**Constraints**:
- No new HTML elements (FR-020, FR-023)
- No backward-compatibility shim for old `SequencerDisplay` API
- Dropdown menus must render in a subsequent pass after all component draws (FR-022)

---

## Constitution Check

*Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| **I. Rapid Prototyping with Quality Foundation** | ✅ | Types self-documenting via contracts/types.ts; lint + test gates in place |
| **II. Monorepo Strategy with Modular Architecture** | ✅ | Feature organized in `src/canvas/displays/` and `src/components/utilities/`; independently testable |
| **III. Multi-Tenancy** | N/A | Browser-only, no server/DB |
| **IV. Observability / Audit Trail** | N/A | No server-side logging required; `console.log` calls in existing style retained |
| **V. Progressive Enhancement for UX** | ✅ | Always-visible per-step controls match the established knob/dropdown pattern |
| **VI. Deferred DevOps Complexity** | N/A | No deployment infrastructure |
| **VII. Security by Default** | N/A | No auth or secrets |
| **Code Quality** | ✅ | Max function length 50 lines enforced; no magic numbers (named constants in contracts/types.ts) |
| **Testing Standards** | ✅ | 80% coverage target for timing and serialization logic |
| **Performance** | ✅ | 60 FPS render; < 5 ms timing drift; display draws inline with main render pass |

No violations. Complexity Tracking not required.

---

## Project Structure

### Documentation (this feature)

```text
specs/012-step-sequencer-refactor/
├── plan.md              ← This file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   ├── types.ts         ← Authoritative type definitions
│   └── validation.ts    ← Runtime validators
└── tasks.md             ← Phase 2 output (/speckit.tasks — not yet created)
```

### Source Code (changes)

```text
src/
├── canvas/
│   ├── CanvasComponent.ts               ← MODIFY: wire StepSequencerDisplay, forward events, dropdown pass
│   └── displays/
│       ├── SequencerDisplay.ts          ← DELETE
│       └── StepSequencerDisplay.ts      ← CREATE
└── components/
    └── utilities/
        └── StepSequencer.ts             ← MODIFY: parameters, tied gate fix, syncStepsFromParameters, getDisplayState
```

---

## Phase 0: Research

**Status**: Complete. See [research.md](research.md).

Key decisions resolved:

| Decision | Resolution |
|---|---|
| Display draw signature | `render(ctx: CanvasRenderingContext2D)` with stored world coords — matches OscilloscopeDisplay |
| Tied gate behaviour | `null` gate duration → suppress gate-off; gate stays high until next active step |
| Serialization approach | 66 new `Parameter` instances; `syncStepsFromParameters()` on load |
| Note picker interaction | Two canvas-drawn `Dropdown` controls (note name C–B, octave 0–8) |
| Hit-test priority | Named controls consume event; step toggle fires on miss |
| Mode toggle | Explicit `mode` Parameter (0/1) replaces implicit port-connection detection |
| Arpeggiator timing | Externally driven by keyboard gate; SC-002 drift criterion applies to standalone mode only |
| Render FPS | 60 FPS, no internal throttle — matching OscilloscopeDisplay post-011 |

---

## Phase 1: Design & Contracts

**Status**: Complete.

### Data Model

See [data-model.md](data-model.md) for full entity definitions and serialization shape.

**Core entities**:
- `SequencerStep` — active, note (MIDI 0–127, arp-encoded as offset+64), velocity (0–1), gateLength (0–5 enum)
- `SequencerPattern` — 16 steps + bpm, noteValue, sequenceLength, mode
- `TransportState` — ephemeral; isPlaying, visualCurrentStep
- `NotePickerState` — ephemeral; stepIndex, noteNameIndex, octave

### Contracts

See [contracts/types.ts](contracts/types.ts) and [contracts/validation.ts](contracts/validation.ts).

**Key exports**:
- `GATE_LENGTH`, `SEQUENCER_MODE`, `NOTE_DIVISION` — named constants (no magic numbers)
- `DEFAULT_STEP`, `DEFAULT_PATTERN` — canonical defaults
- `encodeMidiNote()`, `decodeMidiNote()` — note picker ↔ MIDI note conversion
- `encodeArpOffset()`, `decodeArpOffset()` — arpeggiator offset encoding
- `stepToParams()`, `paramsToStep()` — PatchSerializer bridge
- `validatePatternFromParams()` — deserialisation safety

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Canvas.render() [60fps]                                      │
│                                                              │
│  CanvasComponent.render(ctx)                                 │
│    ├── renderControls()          ← knobs, dropdowns, buttons │
│    └── stepSequencerDisplay.render(ctx)                      │
│         ├── renderTransportBar() ← Play/Stop/Reset/BPM/Div   │
│         ├── renderStepGrid()     ← 16 cells with sub-regions │
│         │    └── per cell: active indicator                   │
│         │                 note label                          │
│         │                 velocity knob (Knob control)        │
│         │                 gate dropdown (Dropdown control)    │
│         └── renderNotePicker()   ← if open: 2 Dropdowns      │
│                                                              │
│  CanvasComponent.renderDropdownMenus(ctx)  ← AFTER all above │
│    └── stepSequencerDisplay.renderDropdownMenus(ctx)         │
│         └── notePicker dropdowns + gate dropdowns renderMenu()│
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ StepSequencer (audio, runs independently of render loop)     │
│                                                              │
│  scheduleInterval [25ms]                                     │
│    └── scheduleNextSteps()                                   │
│         └── scheduleStep(i, time)                            │
│              ├── frequencyNode.offset.setValueAtTime(hz, t)  │
│              ├── gateNode.offset.setValueAtTime(1, t)        │
│              ├── velocityNode.offset.setValueAtTime(v, t)    │
│              └── if gateLength != TIED:                      │
│                   gateNode.offset.setValueAtTime(0, t+dur)   │
└──────────────────────────────────────────────────────────────┘
```

### New Public API on StepSequencer

```typescript
// Returns all data the display needs per frame — no direct field access from display
getDisplayState(): StepSequencerDisplayState

// Called after patch load to sync this.steps[] from Parameter values
syncStepsFromParameters(): void

// Replaces isArpeggiatorMode() — reads mode Parameter
isArpeggiatorMode(): boolean  // kept as-is, but reads 'mode' parameter

// Transport (unchanged)
start(): void
stop(): void
reset(): void

// Step editing (unchanged signature, now also writes Parameter)
updateStep(stepIndex: number, step: Partial<SequencerStep>): void
```

### Step Cell Layout (world units, 480px wide component)

```
stepWidth = floor((displayWidth - 2 - 15 * 2) / 16)  // ~28px at 480px
┌──────────────────┐
│  ● active dot    │ 6px   — filled circle if active
│  C4              │ 16px  — note label, click opens picker
│  ⊙ velocity knob │ 30px  — Knob control, 0–100%
│  [1/4 ▾]         │ 20px  — Dropdown control for gate length
└──────────────────┘
   2px gap
```

Transport bar (full width, 32px high):
```
[▶/■]  [↺]  BPM[120]  DIV[1/4▾]  LEN[16]  [SEQ/ARP]
```

---

## Implementation Sequence

Tasks are ordered to minimise broken states during development.

### Task Group A — Audio Component Changes (no visual dependency)

**A1** Add 66 new `Parameter` instances to `StepSequencer` constructor
- `sequenceLength` (2–16, default 16)
- `mode` (0–1, default 0)
- `step_N_active/note/velocity/gateLength` for N = 0–15

**A2** Add `syncStepsFromParameters()` method; call it in `updateAudioParameter()` when any `step_*` param changes; also expose it for post-load call

**A3** Fix `getGateLength()` → replace with `getGateDuration(): number | null` returning `null` for tied steps; update `scheduleStep()` to skip gate-off scheduling when null

**A4** Replace implicit `isArpeggiatorMode()` with read of `mode` Parameter; update `startConnectionMonitoring()` to still detect keyboard connections but no longer auto-switch mode

**A5** Add `getDisplayState(): StepSequencerDisplayState` that snapshots current pattern + transport state

**A6** `updateStep()` now also writes through to the corresponding Parameters (so serialize captures live edits)

### Task Group B — New Display Class

**B1** Create `StepSequencerDisplay` with constructor matching `OscilloscopeDisplay` signature; store world coords; implement `render(ctx)` entry point

**B2** Implement `renderTransportBar()` — Play/Stop button, Reset button, BPM knob, Division dropdown, Length knob, Mode toggle button; wire up click handlers

**B3** Implement `renderStepGrid()` — 16 cells with active indicator, note label text, velocity knob (inline `Knob` control), gate dropdown (inline `Dropdown` control)

**B4** Implement hit-test in `onMouseDown(worldX, worldY)`: note label → velocity knob → gate dropdown → step toggle

**B5** Implement note picker: `openNotePicker(stepIndex)` instantiates two `Dropdown` controls; `closeNotePicker()` dismisses them; expose `renderDropdownMenus(ctx)` for the dropdown pass

**B6** Implement `updatePosition(x, y, width, height)` to support component movement

### Task Group C — CanvasComponent Wiring

**C1** In `createControls()` (or new `createDisplay()` helper): construct `StepSequencerDisplay` for `ComponentType.STEP_SEQUENCER`

**C2** In `render()`: call `stepSequencerDisplay.render(ctx)` after `renderControls()`, matching the oscilloscope block

**C3** In `renderDropdownMenus()`: call `stepSequencerDisplay.renderDropdownMenus(ctx)` for note picker and gate dropdowns

**C4** In `onMouseDown/Move/Up()`: forward pointer events to `stepSequencerDisplay` when inside display bounds

**C5** In `updatePosition()` / `setPosition()`: call `stepSequencerDisplay.updatePosition()`

**C6** Remove all references to old `SequencerDisplay`; delete `SequencerDisplay.ts`

### Task Group D — Serialization & Load

**D1** In patch load path (`PatchManager` or `CanvasComponent`): after `setParameterValue()` loop completes, call `sequencer.syncStepsFromParameters()`

**D2** Verify round-trip: save → reload → all 66 parameters present and correct

### Task Group E — Tests

**E1** Unit tests for `contracts/types.ts` helpers (`encodeMidiNote`, `decodeMidiNote`, `encodeArpOffset`, `decodeArpOffset`, `stepToParams`, `paramsToStep`)

**E2** Unit tests for `contracts/validation.ts` (`validatePatternFromParams` — valid, missing keys, out-of-range values)

**E3** Unit tests for `StepSequencer` timing: `getGateDuration()` returns null for tied, correct durations for all other enum values

**E4** Integration test: serialise a pattern, deserialise, verify all step values match

---

## Complexity Tracking

No constitution violations. No complexity justification required.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Step cell too narrow for three controls at 480px width | Medium | High | Define STEP_CELL_MIN_WIDTH constant; if display width < 256px, degrade to active indicator + note only |
| Tied gate across multiple tied steps — gate stays high indefinitely | Low | Medium | Ensure gate-off fires at component stop/delete via existing `stop()` path |
| Note picker dropdowns not appearing in dropdown pass | Low | High | Unit test: verify `renderDropdownMenus()` is called after all `render()` calls |
| Serialization of 66 parameters exceeds localStorage quota on old patches | Very Low | Low | Existing quota check in `PatchStorage.save()` handles gracefully |
| arpeggiator mode: mode parameter defaults to 0 but keyboard connected → user expects arp | Medium | Low | Display mode label clearly; connection does not auto-switch mode (FR-005 explicit toggle) |
