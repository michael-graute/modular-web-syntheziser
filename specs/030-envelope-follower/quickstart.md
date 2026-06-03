# Quickstart: Envelope Follower (030)

**Branch**: `030-envelope-follower`

## What It Does

The Envelope Follower converts the loudness of any audio signal into a 0–1 CV signal. Louder audio → higher CV; silence → CV near zero. Use it to make one signal dynamically control another — open a filter when a drum hits, duck a pad when a bass plays, or modulate LFO depth with your playing dynamics.

## Files to Create / Modify

| Action | Path |
|--------|------|
| CREATE | `src/components/analyzers/EnvelopeFollower.ts` |
| CREATE | `src/canvas/displays/EnvelopeFollowerDisplay.ts` |
| CREATE | `tests/components/analyzers/EnvelopeFollower.test.ts` |
| MODIFY | `src/core/types.ts` — add `ENVELOPE_FOLLOWER` to `ComponentType` |
| MODIFY | `src/canvas/CanvasComponent.ts` — add display field + createControls block |
| MODIFY | `src/main.ts` — register component in factory |

## Key Patterns to Follow

- **Component class**: copy structure of `src/components/analyzers/VuMeter.ts`; add `ConstantSourceNode` output like `src/components/utilities/Quantizer.ts`
- **Display class**: copy structure of `src/canvas/displays/VuMeterDisplay.ts`; simplify to single-colour bar (no segments, no peak hold)
- **CanvasComponent wiring**: copy the VU Meter block at line 1607 of `CanvasComponent.ts`; add three knobs (attack, release, gain) above the display
- **Validation helpers**: use `specs/030-envelope-follower/contracts/validation.ts` — copy to `src/` or import directly

## IIR Smoothing Algorithm (core logic)

```typescript
// Called once per animation frame from EnvelopeFollowerDisplay.render()
tick(dt: number): void {
  this.analyser!.getFloatTimeDomainData(this.dataArray!); // dataArray must be Float32Array(256) = fftSize

  // RMS
  let sumSq = 0;
  for (const s of this.dataArray!) sumSq += s * s;
  const rmsRaw = Math.sqrt(sumSq / this.dataArray!.length);

  // Apply gain and clamp
  const gain = this.getParameter('gain')!.getValue();
  const rmsNow = Math.min(1, Math.max(0, rmsRaw * gain));

  // IIR envelope
  const attackMs = this.getParameter('attack')!.getValue();
  const releaseMs = this.getParameter('release')!.getValue();
  const attackCoeff = 1 - Math.exp(-dt / (attackMs / 1000));
  const releaseCoeff = 1 - Math.exp(-dt / (releaseMs / 1000));
  const coeff = rmsNow >= this.envelopeValue ? attackCoeff : releaseCoeff;
  this.envelopeValue += coeff * (rmsNow - this.envelopeValue);
  this.envelopeValue = Math.min(1, Math.max(0, this.envelopeValue));

  // Update CV output
  this.cvNode!.offset.value = this.envelopeValue;
}
```

## Running Tests

```bash
vitest run tests/components/analyzers/EnvelopeFollower.test.ts
```

## Patch a Typical Sidechain

1. Drop an Oscillator → route audio to a Delay or VCA
2. Drop an Envelope Follower → patch your drum/bass audio into its **Audio In**
3. Patch **CV Out** of the Envelope Follower to the VCA **Gain** CV input
4. Adjust Attack (~1 ms) and Release (~200 ms) for the pumping feel
5. Lower Gain if the CV is railing at 1.0 on every hit
