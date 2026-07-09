# Quickstart Guide: Clock Divider

**Feature**: `038-clock-divider`
**Created**: 2026-07-09
**Target Audience**: Developers implementing this feature
**Prerequisites**: Familiarity with TypeScript 5.6+, this project's `SynthComponent`/`TempoAware` architecture, and the multi-output pattern (see `ChordFinder` as precedent). Read `research.md` first — every technical decision below is justified there against specific existing code, not invented fresh.

---

## Architecture Overview

Clock Divider is a zero-audio-node, six-gate-output component. It has no ports other than its six outputs (no inputs at all — per spec Assumptions, it follows the shared global tempo exclusively, not an external clock signal). Its entire job is running one shared lookahead scheduler that advances six independent `nextTickTime` cursors, each at its own rate but all derived from the same BPM, and setting each output's `ConstantSourceNode.offset` high-then-low on that output's own schedule.

```typescript
import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, EventType } from '../../core/types';
import type { GlobalBpmChangedPayload } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';
import { globalBpmController } from '../../core/GlobalBpmController';
import { eventBus } from '../../core/EventBus';
import {
  ClockDividerRate,
  CLOCK_DIVIDER_OUTPUT_COUNT,
  DEFAULT_RATES,
} from '../../../specs/038-clock-divider/contracts/types';
import { collectDueTicks, clampRateIndex, pulseWidthMs } from '../../../specs/038-clock-divider/contracts/validation';

export class ClockDivider extends SynthComponent {
  private _rates: ClockDividerRate[] = [...DEFAULT_RATES];
  private _gateNodes: (ConstantSourceNode | null)[] = new Array(CLOCK_DIVIDER_OUTPUT_COUNT).fill(null);
  private _nextTickTime: number[] = new Array(CLOCK_DIVIDER_OUTPUT_COUNT).fill(0);
  private _currentBpm: number = globalBpmController.getBpm();
  private _schedulerIntervalId: number | null = null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.CLOCK_DIVIDER, 'Clock Divider', position);
    for (let i = 0; i < CLOCK_DIVIDER_OUTPUT_COUNT; i++) {
      this.addOutput(`out${i + 1}`, `Out ${i + 1}`, SignalType.GATE);
      this.addParameter(`rate${i + 1}`, `Output ${i + 1} Rate`, DEFAULT_RATES[i], 0, 5, 1, '');
    }
  }

  // createAudioNodes(): create+start all 6 ConstantSourceNodes, seed
  // _nextTickTime[i] = ctx.currentTime for all i, start the 25ms
  // setInterval scheduler loop, subscribe to GLOBAL_BPM_CHANGED /
  // TRANSPORT_PLAY / TRANSPORT_STOP (see research.md decision 5).

  private scheduleLoop(): void {
    const ctx = audioEngine.getContext();
    if (!ctx) return;
    const horizon = ctx.currentTime + 0.1; // lookaheadTime, matches StepSequencer
    for (let i = 0; i < CLOCK_DIVIDER_OUTPUT_COUNT; i++) {
      const { dueTimes, nextTickTime } = collectDueTicks(
        this._nextTickTime[i],
        horizon,
        this._currentBpm,
        this._rates[i]
      );
      for (const t of dueTimes) {
        const node = this._gateNodes[i];
        node?.offset.setValueAtTime(1, t);
        // Pulse width is 25% of THIS output's own period (not a fixed ms value) — matches
        // StepSequencer's proportional gate-duration convention (stepInterval / 2^(gateLength-1)),
        // scaling correctly across all six rates and any BPM (research.md's pulse-width decision).
        node?.offset.setValueAtTime(0, t + pulseWidthMs(this._currentBpm, this._rates[i]) / 1000);
      }
      this._nextTickTime[i] = nextTickTime;
    }
  }

  protected override getOutputNodeByPort(portId: string): AudioNode | null {
    const match = /^out([1-6])$/.exec(portId);
    if (!match) return null;
    return this._gateNodes[Number(match[1]) - 1];
  }
}
```

## Component Setup

1. Add `CLOCK_DIVIDER = 'clock-divider'` to `ComponentType` in `src/core/types.ts`. No `ComponentData` schema changes needed (data-model.md — all state is `Parameter`-backed).
2. Create `src/components/utilities/ClockDivider.ts` per data-model.md: six `addOutput`/`addParameter` calls in the constructor, `createAudioNodes`/`destroyAudioNodes` managing six `ConstantSourceNode`s plus the shared scheduler and three event subscriptions, `getOutputNodeByPort` override (ChordFinder's pattern), `updateAudioParameter` updating `_rates[i]` from `rateN` parameter changes.
3. Import `ClockDividerRate`/`RATE_LABELS`/etc. from this spec's `contracts/types.ts`, and `collectDueTicks`/`clampRateIndex`/`ratePeriodMs` from `contracts/validation.ts` — these pure functions carry all the scheduling math; `ClockDivider.ts` itself should only glue them to the Web Audio API and event subscriptions, keeping the component file thin and the math independently testable.

## Module Integration

1. **`src/core/types.ts`**: add `CLOCK_DIVIDER` to the `ComponentType` enum.
2. **`src/components/registerComponents.ts`**: one `componentRegistry.register(ComponentType.CLOCK_DIVIDER, 'Clock Divider', 'Derives synchronized division/multiplication gate pulses from the shared tempo', 'Controllers', (id, position) => new ClockDivider(id, position), calculateComponentDimensions(ComponentType.CLOCK_DIVIDER))` call — category `'Controllers'`, alongside Step Sequencer/Arpeggiator/Chord Finder (per this project's existing Controllers/Utilities sidebar split).
3. **`src/utils/componentLayout.ts`**:
   - `getControlLayout` case: `{ hasDropdown: true }` (six dropdowns; exact row count handled by the height special-case below, matching Arpeggiator's approach — `hasDropdown` here is just a layout-family marker, not a count).
   - `getPortCounts` case: `{ inputs: 0, outputs: 6 }`.
   - `calculateComponentHeight`: new `if (type === ComponentType.CLOCK_DIVIDER)` special case, `HEADER_HEIGHT + portAreaHeight + CONTROL_MARGIN_TOP + dropdownRowHeight * 6 + 10` (Arpeggiator's exact formula, generalized from 4 rows to 6 — see research.md).
   - `calculateComponentWidth`: a width comparable to Arpeggiator's other multi-dropdown components (~150-160px) so six rate labels aren't cramped — no established formula ties width to dropdown count, so pick a value and adjust if labels truncate during manual testing.
4. **`src/canvas/CanvasComponent.ts`**:
   - `createControls()`: new `if (this.type === ComponentType.CLOCK_DIVIDER)` block, looping the six `rateN` parameters and placing one `Dropdown` per row at `baseY + rowH * i` (Arpeggiator's block is the direct template — see `CanvasComponent.ts:802-877`), each dropdown's options built from `CLOCK_DIVIDER_RATES.map(rate => ({ value: rate, label: RATE_LABELS[rate] }))`.
   - `getDisplayName` map: add `[ComponentType.CLOCK_DIVIDER]: 'Clock Divider'` — TypeScript's exhaustive `Record<ComponentType, string>` forces this or the build fails (this project's established compile-time gate, hit by every prior new component).
5. **`src/ui/Sidebar.ts`**: icon glyph entry in `getComponentIcon` — also compiler-forced.

Patch save/load works automatically: `PatchSerializer` is polymorphic over `component.serialize()`, and every rate is a plain `Parameter`, so no serializer changes are needed at all (data-model.md).

## Interaction Lifecycle

```
Add Clock Divider from sidebar → six rows appear, each pre-set to a distinct default rate (/2, /4, /8, /16, x2, x3)
Global transport is playing → all six outputs immediately begin pulsing at their assigned rates, phase-locked to the shared tempo
Change an output's dropdown to a different rate → that output's rate changes on its next natural pulse boundary, others unaffected
Connect an output to a gate-accepting component (Collider, ADSR, Arpeggiator Gate In, etc.) → that component receives pulses exactly as it would from any other gate source
Change the global BPM while playing → all six outputs re-time immediately, no glitch, relative alignment between outputs preserved
Stop the global transport → all six outputs stop pulsing (gate nodes zeroed)
Resume the global transport → scheduler restarts; per spec edge case, outputs align to the ongoing beat grid rather than introducing an arbitrary offset
Save patch → each output's rate index is stored via the standard Parameter mechanism (rate1…rate6)
Load patch → each output's rate is restored exactly; dropdowns reflect the saved selection
Delete component → cleanup() clears the scheduler interval and all three event subscriptions, stops all six ConstantSourceNodes
```

## Testing Strategy

- `clampRateIndex`, `ratePeriodMs`, `advanceTick`, `collectDueTicks` (`contracts/validation.ts`) — 100% coverage, no DOM/AudioContext mocks needed: boundary values at the enum's min/max indices; `ratePeriodMs` correctness for each of the six named rates at a known BPM (e.g. 120 BPM → verify `/4`'s period is exactly 2000ms, `x2`'s is exactly 250ms); `collectDueTicks` returning zero, one, and multiple due ticks depending on the horizon gap, and correctly advancing the cursor by exactly the number of periods consumed (proving the "no drift, no reset" property from research.md decision 1).
- `ClockDivider` unit tests (mock `audioEngine`/`ConstantSourceNode`, following `XYPad.test.ts`'s established mocking conventions): `setRate`/`getRate` round-trip; `serialize()`/`deserialize()` round-trips all six rates exactly (proving the generic `Parameter` mechanism needs no override, per data-model.md); default rates on a fresh instance match `DEFAULT_RATES`; `getOutputNodeByPort` returns the correct node for `'out1'`…`'out6'` and `null` for an invalid port ID.
- Multi-output coincidence: a focused test asserting that, given the same starting `nextTickTime` and BPM, `Div2`'s and `Div4`'s due-tick times returned by `collectDueTicks` over a sufficiently long horizon always include every `Div2` tick time as a subset relationship check — i.e. every `Div4` tick coincides with a `Div2` tick (directly verifying FR-007 and spec US3 acceptance scenario 2 at the pure-function level, no audio engine needed).
- Manual dev-server walkthrough (this project's established convention — canvas rendering can't be reliably driven by browser-automation tooling): confirm six dropdowns render, rates change live, connecting an output to Collider/ADSR actually triggers it, BPM change doesn't audibly glitch, save/reload preserves all six rates.

## Common Pitfalls & Debugging

- **Do not reset `_nextTickTime[i]` on a rate or BPM change** — only the interval used to advance it should change; resetting the cursor to "now" is exactly the Arpeggiator-style phase-discontinuity bug this feature must avoid (research.md decision 1).
- **Do not use `calculateGateDuration`/`GateSize` for pulse periods** — that helper only covers fractions below 1 (divisions), not multipliers (x2/x3). Use `TimingCalculator.beatsToMs` (or this feature's own `ratePeriodMs` wrapper, which encapsulates the same math) instead (research.md decision 4).
- **Remember the six-output `getOutputNodeByPort` override** — the base `SynthComponent.getOutputNodeByPort` default falls back to the single "main" output and will silently misroute connections from outputs 2-6 if the override is forgotten.
- **All six outputs share one scheduler loop, not six independent timers** — six independent `setInterval`s would reintroduce exactly the cross-output jitter this design avoids; the coincidence guarantee (FR-007) depends on all six being advanced from the same 25ms poll and the same BPM read.
- **No `bpmMode` parameter** — unlike StepSequencer/Collider, Clock Divider always follows global BPM unconditionally (research.md decision 5); do not copy the local/global toggle pattern here, it has no meaningful "local" state for this component.
- **Do not use a fixed millisecond pulse width** (e.g. a flat 10ms high pulse) — StepSequencer's actual gate duration is proportional to its step interval (`getGateDuration`: `stepInterval / 2^(gateLength-1)`), not a fixed value; use `pulseWidthMs(bpm, rate)` (25% duty cycle of that output's own period) instead, so the pulse scales correctly across all six rates instead of becoming vanishingly short relative to a slow `/16` output or disproportionately long relative to a fast `x3` output (research.md's pulse-width decision, added after `/speckit-analyze` caught this mismatch).
