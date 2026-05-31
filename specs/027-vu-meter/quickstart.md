# Quickstart: Implementing VU Meter (027)

**Prerequisite**: Read `research.md` and `data-model.md` before starting.

---

## File Checklist

New files to create:
- `src/components/analyzers/VuMeter.ts` — audio component
- `src/canvas/displays/VuMeterDisplay.ts` — canvas display renderer
- `tests/components/VuMeter.test.ts` — unit tests

Files to modify:
- `src/core/types.ts` — add `VU_METER = 'vu-meter'` to `ComponentType`
- `src/utils/componentLayout.ts` — add VU_METER cases to `getControlLayout`, `getPortCounts`, `calculateComponentWidth`
- `src/canvas/CanvasComponent.ts` — add `vuMeterDisplay` field, case in `createControls`, render call, cleanup
- `src/components/registerComponents.ts` — register `VuMeter`

---

## Step 1 — ComponentType enum

In `src/core/types.ts`, add after `PARAMETRIC_EQ`:
```typescript
VU_METER = 'vu-meter',
```

Also add to the `getDisplayName()` map inside `CanvasComponent.ts`:
```typescript
[ComponentType.VU_METER]: 'VU Meter',
```

---

## Step 2 — VuMeter audio component

```typescript
// src/components/analyzers/VuMeter.ts
import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, SignalType } from '../../core/types';
import { audioEngine } from '../../core/AudioEngine';

export class VuMeter extends SynthComponent {
  private inputGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Float32Array | null = null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.VU_METER, 'VU Meter', position);
    this.addInput('input', 'Audio In', SignalType.AUDIO);
  }

  createAudioNodes(): void { /* see data-model.md */ }
  destroyAudioNodes(): void { /* disconnect + null */ }
  updateAudioParameter(_parameterId: string, _value: number): void { /* no params */ }
  getInputNode(): AudioNode | null { return this.inputGain; }
  getOutputNode(): AudioNode | null { return null; }

  getPeakLevel(): number {
    if (!this.analyser || !this.dataArray) return 0;
    this.analyser.getFloatTimeDomainData(this.dataArray);
    let peak = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const abs = Math.abs(this.dataArray[i]!);
      if (abs > peak) peak = abs;
    }
    return Math.min(1, peak);
  }
}
```

---

## Step 3 — VuMeterDisplay canvas renderer

Key render logic:
1. Compute `litSegments = Math.floor(currentLevel * SEGMENT_COUNT)`.
2. Draw segments from bottom to top. Segment `i` (0 = bottom) is lit if `i < litSegments`.
3. Colour: `i < GREEN_SEGMENTS` → green, `i < GREEN_SEGMENTS + YELLOW_SEGMENTS` → yellow, else red.
4. Draw peak hold marker: a single bright white rect at segment index `Math.floor(peakHoldLevel * SEGMENT_COUNT) - 1`.
5. On each frame: update `peakHoldLevel` if `currentLevel > peakHoldLevel` (reset timestamp). Decay after hold expires.

---

## Step 4 — componentLayout.ts

```typescript
case ComponentType.VU_METER:
  return { hasDisplayArea: true, displayHeight: 200 };
// in getPortCounts:
case ComponentType.VU_METER:
  return { inputs: 1, outputs: 0 };
// in calculateComponentWidth:
if (type === ComponentType.VU_METER) return 160;
```

---

## Step 5 — CanvasComponent.ts

Add alongside `oscilloscopeDisplay`:
```typescript
private vuMeterDisplay: VuMeterDisplay | null = null;
```

In `createControls()`, add a `ComponentType.VU_METER` case that creates `VuMeterDisplay`.  
In `render()`, call `this.vuMeterDisplay?.render(ctx)`.  
In `cleanup()`, call `this.vuMeterDisplay?.destroy()`.  
In `getDisplayName()`, add `[ComponentType.VU_METER]: 'VU Meter'`.

---

## Step 6 — registerComponents.ts

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

## Step 7 — Tests

File: `tests/components/VuMeter.test.ts`

Cover:
- Constructor: has input port `'input'` with `SignalType.AUDIO`, no output ports, no parameters
- `activate()` creates `inputGain` and `analyser` nodes
- `getPeakLevel()` returns 0 before activation
- `getPeakLevel()` returns value in [0, 1] when active (mock returns zeros → 0.0)
- `destroyAudioNodes()` disconnects and nulls nodes
- `getOutputNode()` returns null

---

## Verification

```bash
vitest run tests/components/VuMeter.test.ts
npm run lint
```

Then start the dev server (`npm run dev`) and:
1. Add a VU Meter from the component menu → appears on canvas.
2. Connect an Oscilloscope or LFO output → meter reacts.
3. Check peak hold: play a loud burst, observe hold marker before it decays.
4. Disconnect source → meter falls to silence within 2 seconds.
5. Save patch → reload → meter reappears connected.
