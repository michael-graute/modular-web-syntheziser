# Developer Quickstart: 3-Band Parametric EQ

**Feature**: 026-parametric-eq  
**Date**: 2026-05-31

---

## What you're building

A `ParametricEQ` component (`src/components/processors/ParametricEQ.ts`) that chains three `BiquadFilterNode`s — `lowshelf`, `peaking`, `highshelf` — to implement a three-band parametric equalizer with optional LFO modulation on each band's gain.

---

## Files to create / modify

| Action | File |
|--------|------|
| CREATE | `src/components/processors/ParametricEQ.ts` |
| CREATE | `tests/components/processors/ParametricEQ.test.ts` |
| MODIFY | `src/core/types.ts` — add `PARAMETRIC_EQ = 'parametric-eq'` |
| MODIFY | `src/components/registerComponents.ts` — import + register |
| MODIFY | `src/canvas/CanvasComponent.ts` — add knob controls case |
| MODIFY | `src/utils/componentLayout.ts` — add dimensions case |
| MODIFY | `src/ui/Sidebar.ts` — add icon |

---

## Key patterns to follow

### 1. Extending SynthComponent (follow `Filter.ts`)

```typescript
export class ParametricEQ extends SynthComponent {
  private lowShelf: BiquadFilterNode | null = null;
  private midPeak:  BiquadFilterNode | null = null;
  private highShelf: BiquadFilterNode | null = null;
  private inputGain: GainNode | null = null;
  private outputGain: GainNode | null = null;

  constructor(id: string, position: Position) {
    super(id, ComponentType.PARAMETRIC_EQ, 'Parametric EQ', position);
    this.addInput('audio-in', 'Audio In', SignalType.AUDIO);
    this.addInput('low-gain-cv',  'Low Gain CV',  SignalType.CV);
    this.addInput('mid-gain-cv',  'Mid Gain CV',  SignalType.CV);
    this.addInput('high-gain-cv', 'High Gain CV', SignalType.CV);
    this.addOutput('audio-out', 'Audio Out', SignalType.AUDIO);
    // addParameter for all 7 params...
  }
}
```

### 2. Audio graph wiring in `createAudioNodes()`

```
inputGain → lowShelf → midPeak → highShelf → outputGain
```

Set `BiquadFilterNode.type`: `'lowshelf'`, `'peaking'`, `'highshelf'`.

### 3. Exposing gain AudioParams for CV modulation

```typescript
override getAudioParamForInput(inputId: string): AudioParam | null {
  switch (inputId) {
    case 'low-gain-cv':  return this.lowShelf?.gain ?? null;
    case 'mid-gain-cv':  return this.midPeak?.gain  ?? null;
    case 'high-gain-cv': return this.highShelf?.gain ?? null;
    default: return null;
  }
}

override getParameterRangeForInput(portId: string): { min: number; max: number } | null {
  if (['low-gain-cv', 'mid-gain-cv', 'high-gain-cv'].includes(portId)) {
    return GAIN_CV_RANGE; // { min: -18, max: 18 }
  }
  return null;
}
```

This is all the LFO needs — it calls `getAudioParamForInput()` to find the target `AudioParam` and `getParameterRangeForInput()` to compute its per-connection scaler gain.

### 4. Bypass pattern (follow `Filter.ts`)

Use `inputGain`/`outputGain` bookend nodes. On bypass: mute `inputGain.gain` to 0; on restore: set back to 1.

### 5. Knob controls in `CanvasComponent.ts`

Add a `ComponentType.PARAMETRIC_EQ` case in `createControls()`. Create 7 `Knob` instances, one per parameter. Follow the same positioning logic used for `Oscillator` (frequency + detune knobs).

### 6. Serialization

Use `serializeEQConfig()` / `deserializeEQConfig()` from `contracts/validation.ts`. Override `serialize()` and `deserialize()` in `ParametricEQ`.

---

## Testing approach

- **Pure-function tests** (no Web Audio): `clampGain()`, `clampMidQ()`, `serializeEQConfig()`, `deserializeEQConfig()`, `validateEQConfig()` — 100% coverage target.
- **Component integration tests**: mock `AudioContext` (use existing `MockAudioContext`), instantiate `ParametricEQ`, call `activate()`, verify `BiquadFilterNode` types and initial values, verify `getAudioParamForInput()` returns the correct AudioParam references.
- **Serialization round-trip**: serialize non-default config, deserialize, verify exact match.
- **Graceful fallback**: deserialize empty/out-of-range params, verify defaults applied.

---

## Quick reference: contracts

```typescript
import { DEFAULT_EQ_CONFIG, GAIN_CV_RANGE } from 'specs/026-parametric-eq/contracts/types';
import { serializeEQConfig, deserializeEQConfig, clampGain } from 'specs/026-parametric-eq/contracts/validation';
```
