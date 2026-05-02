# Quickstart: FM Oscillator Component

**Feature**: 020-fm-oscillator
**Date**: 2026-05-02

## What This Feature Does

Adds a new **FM Oscillator** component to the Generators palette. Unlike the standard Oscillator, it has an **FM Input** port that accepts an audio signal and uses it to modulate the oscillator's frequency at audio rate — this is FM (frequency modulation) synthesis.

## Files to Change

| File | Change Type | Purpose |
|------|-------------|---------|
| `src/core/types.ts` | Edit | Add `FM_OSCILLATOR = 'fm-oscillator'` to `ComponentType` |
| `src/utils/componentLayout.ts` | Edit | Add `FM_OSCILLATOR` cases for port count and dimensions |
| `src/components/generators/FMOscillator.ts` | Create | New component class |
| `src/components/registerComponents.ts` | Edit | Register FM Oscillator in Generators group |
| `tests/components/generators/FMOscillator.test.ts` | Create | Unit tests |

## Key Implementation Pattern

```typescript
// FMOscillator.ts — core structure
export class FMOscillator extends Oscillator {
  private fmGain: GainNode | null = null;

  constructor(id: string, position: Position) {
    super(id, position);
    // Override name and type AFTER super() sets them
    this.name = 'FM Oscillator';
    this.type = ComponentType.FM_OSCILLATOR;

    this.addInput('fm', 'FM Input', SignalType.AUDIO);
    this.addParameter('fmDepth', 'FM Depth', FM_DEPTH_DEFAULT, FM_DEPTH_MIN, FM_DEPTH_MAX, 1, 'Hz');
  }

  override createAudioNodes(): void {
    super.createAudioNodes();                      // creates this.oscillator

    const ctx = audioEngine.getContext();
    this.fmGain = ctx.createGain();
    this.fmGain.gain.value = this.getParameter('fmDepth')?.getValue() ?? FM_DEPTH_DEFAULT;

    const oscillatorNode = this.getOutputNode() as OscillatorNode;
    this.fmGain.connect(oscillatorNode.frequency); // FM routing!

    this.registerAudioNode('fmInput', this.fmGain);

    const fmDepthParam = this.getParameter('fmDepth');
    if (fmDepthParam) {
      fmDepthParam.linkAudioParam(this.fmGain.gain);
    }
  }

  override destroyAudioNodes(): void {
    if (this.fmGain) {
      this.fmGain.disconnect();
      this.fmGain = null;
    }
    super.destroyAudioNodes();
  }

  override getInputNode(portId?: string): AudioNode | null {
    if (portId === 'fm') return this.fmGain;
    return super.getInputNode(portId);
  }

  override updateAudioParameter(parameterId: string, value: number): void {
    if (parameterId === 'fmDepth' && this.fmGain) {
      this.fmGain.gain.setValueAtTime(value, audioEngine.getContext().currentTime);
    } else {
      super.updateAudioParameter(parameterId, value);
    }
  }
}
```

## Registration Pattern

```typescript
// In registerComponents.ts — add alongside the OSCILLATOR entry:
componentRegistry.register(
  ComponentType.FM_OSCILLATOR,
  'FM Oscillator',
  'Frequency modulation oscillator',
  'Generators',
  (id, position) => new FMOscillator(id, position),
  calculateComponentDimensions(ComponentType.FM_OSCILLATOR)
);
```

## componentLayout.ts additions

```typescript
// In getPortCounts():
case ComponentType.FM_OSCILLATOR:
  return { inputs: 3, outputs: 1 }; // frequency CV, detune CV, FM audio in / audio out

// In getComponentLayoutOptions():
case ComponentType.FM_OSCILLATOR:
  return {
    hasDropdown: true,
    numKnobs: 3, // frequency, detune, fmDepth
  };
```

## Patch Persistence

No changes needed to `PatchSerializer` or `PatchData`. The `fmDepth` parameter serialises automatically through `SynthComponent.serialize()` into `ComponentData.parameters['fmDepth']`. The `FM_OSCILLATOR` component type string `'fm-oscillator'` is stored in `ComponentData.type` and used by `componentRegistry` to reconstruct the instance on load.

## Testing a Basic FM Patch

1. Add an **FM Oscillator** (carrier) — set frequency to 440 Hz
2. Add a standard **Oscillator** (modulator) — set frequency to 220 Hz
3. Connect modulator **Audio Out** → FM Oscillator **FM Input**
4. Connect FM Oscillator **Audio Out** → **Master Output**
5. Adjust **FM Depth** knob on the FM Oscillator — timbre should change noticeably
