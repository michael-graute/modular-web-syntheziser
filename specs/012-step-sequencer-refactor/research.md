# Research: Step Sequencer Refactor (012)

**Date**: 2026-04-12
**Branch**: `012-step-sequencer-refactor`

---

## 1. Display Migration — Main Canvas Pattern

**Decision**: `StepSequencerDisplay` follows the exact same pattern as `OscilloscopeDisplay` and `ChordFinderDisplay` — draws directly onto the main `CanvasRenderingContext2D`, owns no DOM elements.

**Rationale**: Both prior migrations (010, 011) establish a proven, tested pattern. The existing `SequencerDisplay` class creates an `HTMLCanvasElement`, positions it with `position: absolute`, and synchronises it via CSS transforms — the same defect class documented and fixed for the Oscilloscope. Reusing the established pattern eliminates the defect class entirely.

**Alternatives considered**:
- Keep separate HTML canvas with DPR-aware scaling: rejected — still prone to z-index conflicts with canvas-drawn dropdowns and requires manual viewport synchronisation.
- Shadow DOM isolation: rejected — overkill and inconsistent with the rest of the codebase.

**Key files to replace**: `src/canvas/displays/SequencerDisplay.ts` → new `src/canvas/displays/StepSequencerDisplay.ts`

---

## 2. Draw Method Signature

**Decision**: `draw(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void`

**Rationale**: Matches `OscilloscopeDisplay.render()` and `ChordFinderDisplay.render()` conventions exactly (both store world coordinates and draw at them). The main render loop in `CanvasComponent` calls the display's draw method after all controls are rendered, before the dropdown-menu pass — this ordering must be preserved.

**Wiring point**: `CanvasComponent.render()` around line 1250 — add a new block:
```typescript
if (this.stepSequencerDisplay) {
  this.stepSequencerDisplay.render(ctx);
}
```
`renderDropdownMenus()` runs after all component renders, so canvas-drawn dropdowns inside the step cells will appear on top.

---

## 3. Tied Gate Audio Behaviour

**Decision**: When `gateLength === 0` (tied), no gate-off event is emitted for that step. The existing `getGateLength()` method returns `stepInterval` for tied steps, which schedules a gate-off at the *end* of the step — this is **incorrect** per the spec. The fix: suppress the gate-off scheduling entirely for tied steps; the gate will remain high until the next *active* step triggers a new gate-on (which implicitly starts at high, producing no retrigger).

**Implementation note**: The gate-off for a tied step should only be emitted if the *next active step* actually fires a gate-on; if the step after a tied step is also tied, the gate continues uninterrupted. This requires a look-ahead to the next active step in `scheduleStep()`.

---

## 4. Sequencer Step Serialization

**Decision**: Step data is serialized as a flat JSON array appended to the component's `parameters` map using a namespaced key convention: `step_0_active`, `step_0_note`, `step_0_velocity`, `step_0_gateLength`, …, `step_15_gateLength`. Global settings (`bpm`, `noteValue`) are already `Parameter` instances and serialize automatically. `sequenceLength` and `mode` (0=sequencer, 1=arpeggiator) are added as new `Parameter` instances.

**Rationale**: The base `SynthComponent.serialize()` method already iterates `this.parameters` and writes all values to `parameters: Record<string, number>`. No custom `serialize()` override is needed if all data lives in `Parameter` objects. This keeps the serialization path identical to every other component and ensures `PatchSerializer` / `PatchStorage` work unchanged.

**Alternatives considered**:
- Custom `serialize()` override with nested step array: rejected — would require a matching `deserialize()` override and custom `PatchSerializer` handling; adds complexity for no benefit.
- Store steps in `StateManager` separate from the patch: rejected — breaks patch portability.

**New parameters to add**:
| Parameter ID | Min | Max | Default | Notes |
|---|---|---|---|---|
| `sequenceLength` | 2 | 16 | 16 | Active step count |
| `mode` | 0 | 1 | 0 | 0=Sequencer, 1=Arpeggiator |
| `step_N_active` | 0 | 1 | 1 | Per-step (N = 0–15) |
| `step_N_note` | 0 | 127 | 60 | MIDI note (standalone) or semitone offset+64 (arp) |
| `step_N_velocity` | 0 | 1 | 0.8 | Step velocity |
| `step_N_gateLength` | 0 | 5 | 3 | 0=tied,1=1/1,2=1/2,3=1/4,4=1/8,5=1/16 |

**Note on semitone offset encoding**: In arpeggiator mode `step_N_note` stores `semitoneOffset + 64` (offset −12 → 52, +12 → 76) to keep the Parameter within 0–127 MIDI range. The display layer decodes this as `value − 64` for rendering.

---

## 5. Note Picker — Two-Selector Design

**Decision**: The canvas-drawn note picker popup contains two canvas-drawn dropdowns side by side: **Note Name** (C, C#, D, D#, E, F, F#, G, G#, A, A#, B — 12 options) and **Octave** (0–8 — 9 options). These reuse the existing `Dropdown` control class rendered at world coordinates within the step cell area.

**Rationale**: Two small dropdowns are simpler to implement than a scrolling list and map directly to how musicians think about notes. The existing `Dropdown` class already handles canvas rendering and the dropdown-menu pass already ensures menus appear on top.

**Popup open/close behaviour**: The popup is a transient overlay state managed by `StepSequencerDisplay`. When a note-label click is detected, the display instantiates two `Dropdown` controls positioned adjacent to the clicked step cell and registers them for the dropdown-menu pass. On selection (either dropdown) or outside click, the popup is dismissed.

---

## 6. Hit-Test Priority Within a Step Cell

**Decision**: Each step cell is divided into three non-overlapping sub-regions by layout (note label area top, velocity knob centre, gate dropdown bottom). The hit-test order is: note-label area → velocity knob circle → gate dropdown button → step toggle. This is enforced by checking the most specific target first in the mouse-down handler.

**Rationale**: With deliberate layout, sub-regions are mutually exclusive by geometry. Priority checking is still needed for edge cases at boundaries. The rule "named controls consume the event; toggle fires only on miss" (FR-010) is implemented by returning `true` (handled) from the sub-region check before the toggle check.

---

## 7. Arpeggiator Mode — Visual Toggle

**Decision**: A dedicated `mode` parameter (0=Sequencer, 1=Arpeggiator) replaces the current implicit detection (`isArpeggiatorMode()` checks port connection state). A canvas-drawn toggle button in the transport row switches the mode explicitly. Arpeggiator-mode gate-start/stop behaviour (keyboard gate driving playback) is retained.

**Rationale**: The current implicit detection based on whether ports are connected is fragile (e.g., if a keyboard is connected but user wants to play the sequencer in standalone mode). An explicit mode toggle matches FR-005 and User Story 3.

---

## 8. Timing Scheduler — No Changes Required

**Decision**: The existing lookahead scheduling approach (`window.setInterval` at 25ms, 100ms lookahead window, Web Audio API `setValueAtTime`) is retained unchanged. SC-002 (5 ms drift at 120 BPM) is achievable with this approach.

**Rationale**: Web Audio API lookahead scheduling is the industry-standard approach for browser sequencers. The 100ms lookahead with 25ms checks provides sufficient precision. The existing implementation already uses this pattern correctly; the refactor focuses on the display layer, not the timing engine.

---

## 9. Render Performance — 60 FPS

**Decision**: `StepSequencerDisplay.render()` draws every frame (60 FPS) with no internal throttle — matching `OscilloscopeDisplay` which removed its 30 FPS throttle in feature 011.

**Rationale**: The main canvas already runs at 60 FPS via `VisualUpdateScheduler`. Internal throttling at 30 FPS causes visible stutter on the step cursor during fast playback. Canvas drawing of the step grid is inexpensive compared to the audio scheduling work.

---

## 10. Component Width / Layout

**Decision**: The component display area is sized to accommodate 16 steps in a single row with per-step controls (note label, velocity knob, gate dropdown) visible simultaneously. A minimum component width of 480px (world units) is established. The exact pixel layout is defined in `StepSequencerDisplay` constants.

**Layout zones per step cell** (example at 480px / 16 steps = 30px per step):
- Step cell width: 28px + 2px gap
- Sub-regions (top to bottom): active indicator (4px), note label (10px), velocity knob (8px), gate dropdown (8px)

**Note**: At small zoom levels (25–50%) the controls become very small. The spec requires pixel-crisp rendering at all zoom levels (SC-007) but does not require the controls to remain interactive at extreme zoom — this is consistent with every other component in the application.
