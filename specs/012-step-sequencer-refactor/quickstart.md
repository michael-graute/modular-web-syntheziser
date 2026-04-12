# Quickstart: Step Sequencer Refactor (012)

**Date**: 2026-04-12
**Branch**: `012-step-sequencer-refactor`

This guide covers what to build, where to build it, and how to verify the result.

---

## What Changes

| Area | Before | After |
|---|---|---|
| Display | `SequencerDisplay` — creates an `HTMLCanvasElement`, positions with CSS, subscribes to scheduler | `StepSequencerDisplay` — draws directly onto main canvas context in `CanvasComponent.render()` |
| Per-step controls | Drawn on the overlay canvas; no always-visible controls | Always-visible note label, velocity knob, gate dropdown per step cell, all on main canvas |
| Note selection | Not implemented in the current spec | Canvas popup with two Dropdown controls (note name C–B, octave 0–8) |
| Serialization | Only `bpm` and `noteValue` persisted via Parameters | All 66 step + global parameters persisted; `syncStepsFromParameters()` called on load |
| Mode | Implicit detection via port connection state | Explicit `mode` Parameter (0=Sequencer, 1=Arpeggiator) with UI toggle button |
| Tied gate | Gate-off scheduled at end of step interval (incorrect) | Gate-off suppressed for tied steps; gate stays high until next active step triggers |

---

## Files to Create

```
src/canvas/displays/StepSequencerDisplay.ts   ← New display (replaces SequencerDisplay.ts)
specs/012-step-sequencer-refactor/contracts/types.ts       ← (already created)
specs/012-step-sequencer-refactor/contracts/validation.ts  ← (already created)
```

## Files to Modify

```
src/components/utilities/StepSequencer.ts     ← Add parameters, fix tied gate, add syncStepsFromParameters()
src/canvas/CanvasComponent.ts                 ← Wire StepSequencerDisplay, add dropdown pass for step cell controls
src/canvas/displays/SequencerDisplay.ts       ← DELETE (replaced)
```

---

## Build Order

Follow this sequence to avoid circular dependency issues and to be able to test each layer independently:

### Step 1 — Audio Component: Parameters & Tied Gate Fix

**File**: `src/components/utilities/StepSequencer.ts`

1. Add 66 new `Parameter` instances in the constructor:
   ```typescript
   this.addParameter('sequenceLength', 'Length', 16, 2, 16, 1, '');
   this.addParameter('mode', 'Mode', 0, 0, 1, 1, '');
   for (let i = 0; i < 16; i++) {
     this.addParameter(`step_${i}_active`, ..., 1, 0, 1, 1, '');
     this.addParameter(`step_${i}_note`, ..., 60, 0, 127, 1, '');
     this.addParameter(`step_${i}_velocity`, ..., 0.8, 0, 1, 0.01, '');
     this.addParameter(`step_${i}_gateLength`, ..., 3, 0, 5, 1, '');
   }
   ```

2. Add `syncStepsFromParameters()`:
   ```typescript
   syncStepsFromParameters(): void {
     for (let i = 0; i < 16; i++) {
       this.steps[i] = {
         active: this.getParameter(`step_${i}_active`)!.getValue() !== 0,
         note: this.getParameter(`step_${i}_note`)!.getValue(),
         velocity: this.getParameter(`step_${i}_velocity`)!.getValue(),
         gateLength: this.getParameter(`step_${i}_gateLength`)!.getValue() as GateLength,
       };
     }
   }
   ```

3. Call `syncStepsFromParameters()` in `setParameterValue()` override (or after patch load).

4. Fix `getGateLength()` — tied gate: return `Infinity` (or a sentinel) to signal no gate-off:
   ```typescript
   private getGateDuration(step: SequencerStep, stepInterval: number): number | null {
     if (step.gateLength === GATE_LENGTH.TIED) return null; // null = no gate-off
     const divisor = Math.pow(2, step.gateLength - 1);
     return stepInterval / divisor;
   }
   ```

5. In `scheduleStep()`: only schedule gate-off if `getGateDuration()` returns non-null.

6. Replace `isArpeggiatorMode()` check: read `this.getParameter('mode')!.getValue() === 1`.

### Step 2 — Display: StepSequencerDisplay

**File**: `src/canvas/displays/StepSequencerDisplay.ts`

Implement the `render(ctx: CanvasRenderingContext2D)` method using stored `baseX/Y/Width/Height`:

**Layout constants** (world units):
```typescript
const TRANSPORT_HEIGHT = 32;   // row with Play/Stop/Reset/BPM/Division/Length/Mode
const STEP_AREA_HEIGHT = 80;   // remaining height for step grid
const STEP_GAP = 2;
// stepWidth = (baseWidth - STEP_GAP * 15) / 16
// Sub-regions per step (top to bottom):
//   active indicator: 6px
//   note label: 16px
//   velocity knob: 30px
//   gate dropdown: 20px + 8px gap
```

**Render method structure**:
```typescript
render(ctx: CanvasRenderingContext2D): void {
  const state = this.sequencer.getDisplayState(); // new method on StepSequencer
  this.renderTransportBar(ctx, state);
  this.renderStepGrid(ctx, state);
  if (this.notePickerState.stepIndex >= 0) {
    this.renderNotePicker(ctx);
  }
}
```

**Note picker**: Two `Dropdown` instances created lazily when picker opens. Their `renderMenu()` must be called in the dropdown pass — see Step 3.

**Mouse event handling**: `StepSequencerDisplay` exposes:
```typescript
onMouseDown(worldX: number, worldY: number): boolean
onMouseMove(worldX: number, worldY: number): boolean
onMouseUp(): void
```
Hit-test order within a step cell: note label area → velocity knob circle → gate dropdown → step toggle.

### Step 3 — Canvas Wiring: CanvasComponent

**File**: `src/canvas/CanvasComponent.ts`

1. In `createControls()` (or `createDisplay()`) for `ComponentType.STEP_SEQUENCER`:
   ```typescript
   this.stepSequencerDisplay = new StepSequencerDisplay(
     displayX, displayY, displayWidth, displayHeight,
     this.synthComponent as StepSequencer
   );
   ```

2. In `render()` after the controls block (mirroring the oscilloscope/chord-finder pattern):
   ```typescript
   if (this.stepSequencerDisplay) {
     this.stepSequencerDisplay.render(ctx);
   }
   ```

3. In `renderDropdownMenus()`: also call `StepSequencerDisplay.renderDropdownMenus(ctx)` to ensure the note picker dropdowns render on top.

4. In `onMouseDown/Move/Up()`: forward events to `StepSequencerDisplay` when the click is within the display bounds.

5. Delete all references to the old `SequencerDisplay` class.

### Step 4 — Cleanup

1. Delete `src/canvas/displays/SequencerDisplay.ts`.
2. Remove any `import { SequencerDisplay }` references.
3. Verify no orphaned HTML canvas element is created.

---

## Verification Checklist

Run through these manually after each step:

**Step 1 — Audio component**
- [ ] `npm run build` passes with no TypeScript errors
- [ ] Add sequencer, save patch, reload — all step values present in browser devtools (localStorage key)
- [ ] Set step 1 to tied, step 2 to C5, play — no gate-off heard between steps 1 and 2

**Step 2 — Display**
- [ ] Step grid renders in main canvas area with correct 16 cells
- [ ] Active step cursor moves in sync with audio playback
- [ ] At 50% zoom: no blur, crisp edges
- [ ] Click note label: two dropdowns appear (note name C–B, octave 0–8)
- [ ] Select a note: picker closes, step displays new note
- [ ] Click step cell area (not label/knob/dropdown): step toggles active/inactive

**Step 3 — Integration**
- [ ] Delete sequencer: no orphaned `<canvas>` in DOM (check DevTools Elements)
- [ ] Add two sequencers: each draws independently, no cross-contamination
- [ ] Open gate-length dropdown: renders fully on top of step grid (not clipped)
- [ ] `npm test && npm run lint` passes

**Timing**
- [ ] At 120 BPM, run 60 seconds — no audible drift (SC-002)
- [ ] Change BPM while playing: tempo updates within one step cycle, no missed step

---

## Key Contracts

Import from the contracts directory for type-safe development:

```typescript
import type { SequencerStep, SequencerPattern, StepSequencerDisplayState } from
  '../../../specs/012-step-sequencer-refactor/contracts/types';
import { GATE_LENGTH, SEQUENCER_MODE, NOTE_DIVISION, encodeMidiNote, decodeMidiNote } from
  '../../../specs/012-step-sequencer-refactor/contracts/types';
import { validatePatternFromParams } from
  '../../../specs/012-step-sequencer-refactor/contracts/validation';
```

---

## Patterns to Follow

- **Display pattern**: `OscilloscopeDisplay` at `src/canvas/displays/OscilloscopeDisplay.ts`
- **Display wiring in CanvasComponent**: search for `oscilloscopeDisplay` — 4 locations
- **Dropdown rendering pass**: `renderDropdownMenus()` in `CanvasComponent.ts`
- **Knob control**: `src/canvas/controls/Knob.ts` — use for velocity knob per step
- **Dropdown control**: `src/canvas/controls/Dropdown.ts` — use for gate length and note name/octave
- **Parameter serialization**: any existing component (e.g., `Filter.ts`) — parameters auto-serialize via `SynthComponent.serialize()`
