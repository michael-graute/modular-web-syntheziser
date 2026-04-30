# Quickstart: Audio Effects Pack

**Feature**: 018-audio-effects-pack

## What's being built

Four new effect modules for the modular synthesizer: **Bitcrusher**, **Flanger**, **Phaser**, and **Tremolo**. Each is a standard `SynthComponent` subclass under `src/components/effects/`, registered and available from the module browser.

## How to implement a new effect (pattern)

Every new effect follows this 5-step pattern, using `Chorus.ts` as the reference:

1. **Create the class** at `src/components/effects/<Name>.ts`
   - Extend `SynthComponent`
   - Call `super(id, ComponentType.<NAME>, '<Display Name>', position)` in constructor
   - Add ports: `this.addInput('input', 'Audio In', SignalType.AUDIO)` and `this.addOutput('output', 'Audio Out', SignalType.AUDIO)`
   - Add parameters using `this.addParameter(...)` with bounds from `contracts/types.ts`
   - Implement `createAudioNodes()`, `destroyAudioNodes()`, `updateAudioParameter()`, `getInputNode()`, `getOutputNode()`, `enableBypass()`, `disableBypass()`

2. **Add `ComponentType` enum value** in `src/core/types.ts`
   ```typescript
   BITCRUSHER = 'bitcrusher',
   FLANGER = 'flanger',
   PHASER = 'phaser',
   TREMOLO = 'tremolo',
   ```

3. **Register in `registerComponents.ts`**
   ```typescript
   componentRegistry.register(
     ComponentType.BITCRUSHER,
     'Bitcrusher',
     'Digital bit depth and sample rate reducer',
     'Effects',
     (id, position) => new Bitcrusher(id, position),
     calculateComponentDimensions(ComponentType.BITCRUSHER)
   );
   ```

4. **Add to `isBypassable()`** in `SynthComponent.ts`
   ```typescript
   ComponentType.BITCRUSHER,
   ComponentType.FLANGER,
   ComponentType.PHASER,
   ComponentType.TREMOLO,
   ```

5. **Add to `componentLayout.ts`** (knob count + port count cases)

## Dry/wet mix pattern (equal-power crossfade)

All four effects use the same crossfade as Chorus:

```typescript
private updateMix(mix: number): void {
  const ctx = audioEngine.getContext();
  const now = ctx.currentTime;
  const dryLevel = Math.cos(mix * 0.5 * Math.PI);
  const wetLevel = Math.cos((1.0 - mix) * 0.5 * Math.PI);
  this.dryGain!.gain.setValueAtTime(dryLevel, now);
  this.wetGain!.gain.setValueAtTime(wetLevel, now);
}
```

## Bitcrusher ScriptProcessorNode pattern

```typescript
this.scriptNode = ctx.createScriptProcessor(256, 1, 1);
this.scriptNode.onaudioprocess = (event) => {
  const input = event.inputBuffer.getChannelData(0);
  const output = event.outputBuffer.getChannelData(0);
  const step = Math.pow(2, this.currentBitDepth);
  const holdInterval = Math.round(100 / this.currentSampleRate);
  let held = 0;
  for (let i = 0; i < input.length; i++) {
    if (i % holdInterval === 0) {
      held = Math.round(input[i] * step) / step;
    }
    output[i] = held;
  }
};
```

## Phaser stage count change

When `stages` parameter changes, the allpass chain must be rebuilt:

```typescript
case 'stages':
  // Preserve all other parameter values
  const params = this.snapshotParameters();
  this.destroyAudioNodes();
  this.createAudioNodes();
  this.restoreParameters(params);
  break;
```

## Running tests

```bash
vitest run tests/components/Bitcrusher.test.ts
vitest run tests/components/Flanger.test.ts
vitest run tests/components/Phaser.test.ts
vitest run tests/components/Tremolo.test.ts
```

Or all at once:

```bash
vitest run
```
