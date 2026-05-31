# Data Model: VU Meter (027)

**Phase**: Phase 1 — Design  
**Date**: 2026-05-31

---

## Entities

### VuMeter (SynthComponent subclass)

Extends `SynthComponent`. Lives at `src/components/analyzers/VuMeter.ts`.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique instance ID (from base class) |
| `type` | `ComponentType.VU_METER` | Discriminant |
| `inputGain` | `GainNode \| null` | Receives the connected audio signal |
| `analyser` | `AnalyserNode \| null` | Reads time-domain data each frame |
| `dataArray` | `Float32Array \| null` | Reusable buffer for `getFloatTimeDomainData` |

**Ports**:
- Input: `'input'` — `'Audio In'` — `SignalType.AUDIO`
- Outputs: _(none)_

**Parameters**: _(none)_ — the meter is stateless from the patch's perspective.

**Audio graph**: `[incoming signal] → inputGain → analyser`  
The analyser's output is not connected to any downstream node (passive tap).

**Public read method**:
```
getPeakLevel(): number   // 0.0 – 1.0; 0 when analyser is null
```

---

### VuMeterDisplay

Pure display renderer. Lives at `src/canvas/displays/VuMeterDisplay.ts`.

| Field | Type | Description |
|-------|------|-------------|
| `vuMeter` | `VuMeter \| null` | Reference to the audio component |
| `baseX/Y` | `number` | World-space top-left of the display area |
| `baseWidth/Height` | `number` | Display dimensions in world units |
| `peakHoldLevel` | `number` | Highest peak seen recently (0–1) |
| `peakHoldTimestamp` | `number` | `Date.now()` when the peak was set |
| `isFrozen` | `boolean` | When true, `render()` is a no-op |

**Constants** (in `VuMeterDisplay.ts`):
```typescript
const SEGMENT_COUNT = 20;
const GREEN_SEGMENTS = 12;   // segments 0–11
const YELLOW_SEGMENTS = 5;   // segments 12–16
const RED_SEGMENTS = 3;      // segments 17–19
const PEAK_HOLD_DURATION_MS = 1500;
const PEAK_DECAY_RATE = 0.02; // per frame, after hold expires
```

**Colour zones** (by segment index from bottom):
- 0–11: `#22c55e` (green)
- 12–16: `#eab308` (yellow)
- 17–19: `#ef4444` (red)
- Inactive segment: `#2a2a2a` (dark background)
- Peak hold marker: `#ffffff` (white, 1-segment bright stripe)

---

### ComponentType enum extension

Add to `src/core/types.ts`:
```typescript
VU_METER = 'vu-meter',
```

---

### componentLayout.ts extension

New cases in `getControlLayout()`:
```typescript
case ComponentType.VU_METER:
  return {
    hasDisplayArea: true,
    displayHeight: 200,
  };
```

New case in `getPortCounts()`:
```typescript
case ComponentType.VU_METER:
  return { inputs: 1, outputs: 0 };
```

New case in `calculateComponentWidth()`:
```typescript
if (type === ComponentType.VU_METER) {
  return 160;
}
```

---

### CanvasComponent extension

- Add `private vuMeterDisplay: VuMeterDisplay | null = null` field.
- In `createControls()`: add `ComponentType.VU_METER` case — creates `VuMeterDisplay`, no knobs/dropdowns.
- In `render()`: call `this.vuMeterDisplay?.render(ctx)` in the display rendering section.
- In `cleanup()`: call `this.vuMeterDisplay?.destroy()`.
- In `getDisplayName()`: map `ComponentType.VU_METER` → `'VU Meter'`.

---

### registerComponents.ts extension

```typescript
import { VuMeter } from './analyzers/VuMeter';

componentRegistry.register(
  ComponentType.VU_METER,
  'VU Meter',
  'Real-time peak level meter for audio and CV signals',
  'Analyzers',
  (id, position) => new VuMeter(id, position),
  calculateComponentDimensions(ComponentType.VU_METER)
);
```

---

## State Transitions

```
No input connected → getPeakLevel() → 0.0 → display shows silence floor
Signal connected   → getPeakLevel() → 0.0–1.0 → segments illuminate bottom-up
Signal > previous peak → peakHoldLevel updated, peakHoldTimestamp reset
After PEAK_HOLD_DURATION_MS → peakHoldLevel decays at PEAK_DECAY_RATE/frame
Signal disconnected → analyser still runs but buffer is silence → display falls
```

---

## Validation Rules

- `getPeakLevel()` must return values in `[0, 1]` — clamp if needed (`Math.min(1, Math.max(0, peak))`).
- `peakHoldLevel` must never exceed 1.0.
- `VuMeter` must not be in the `isBypassable()` list (it has no audio effect to bypass).
- `VuMeter` must not appear in any `bypassableTypes` array.
