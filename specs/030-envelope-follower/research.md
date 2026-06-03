# Research: Envelope Follower

**Branch**: `030-envelope-follower` | **Date**: 2026-06-03  
**Feature**: Amplitude-to-CV converter for modular synthesizer

---

## Decision 1: Audio Analysis Method

**Decision**: Periodic RMS analysis via Web Audio `AnalyserNode.getFloatTimeDomainData()`, sampled each animation frame.

**Rationale**: This is the exact pattern used by both existing analysers (VuMeter, Oscilloscope). The VuMeter uses `getFloatTimeDomainData()` with `fftSize = 256` and `smoothingTimeConstant = 0`; we follow the same approach. At 60 FPS the analysis window is ~16 ms — well within the musically acceptable latency range agreed in the spec. RMS gives a perceptually accurate loudness reading compared to peak, which is preferable for envelope following where continuous dynamics matter more than instantaneous peaks.

**RMS calculation**:
```
rms = sqrt( mean( sample[i]^2 ) )  for i in [0, fftSize)
```

**Alternatives considered**:
- Sample-accurate audio-rate ScriptProcessorNode / AudioWorklet: higher CPU, significant complexity, not used anywhere in the codebase. Rejected.
- Peak detection per frame: simpler but over-responds to single-sample transients. RMS is smoother and more musically useful for CV generation.

---

## Decision 2: Envelope Smoothing (Attack / Release)

**Decision**: Apply a first-order IIR low-pass filter on the RMS value computed each frame, with separate coefficients for rise (attack) and fall (release).

**Algorithm** (per frame):
```
if rmsNow >= envValue:
    envValue = envValue + attackCoeff * (rmsNow - envValue)
else:
    envValue = envValue + releaseCoeff * (rmsNow - envValue)
```

Where `attackCoeff = 1 - exp(-dt / attackTime)` and `releaseCoeff = 1 - exp(-dt / releaseTime)`, with `dt` = frame duration in seconds (~0.016 s at 60 FPS).

**Rationale**: This is the standard analogue-style envelope follower algorithm. It is frame-rate-agnostic (uses `dt` from `performance.now()` delta), requires no Web Audio scheduling, and produces smooth natural-sounding CV trajectories. The exponential coefficient formula maps millisecond time constants correctly to a discrete-time IIR.

**Alternatives considered**:
- Linear interpolation (lerp): simpler but time-constant is frame-rate-dependent. Rejected.
- Web Audio `GainNode.gain.setTargetAtTime()`: correct for audio-rate, but CV is produced as a JS number (not a Web Audio signal); inapplicable.

---

## Decision 3: CV Output Mechanism

**Decision**: The `EnvelopeFollower` component tracks its current envelope value as a JavaScript `number` (`envelopeValue: number`, range 0–1). It does **not** expose a `ConstantSourceNode` output. Instead, it uses the same pass-through-analysis pattern as `VuMeter` (`getInputNode()` → inputGain, `getOutputNode()` → null for signal path; CV value is read by the display each frame).

**Rationale**: Examining the codebase, CV outputs from `Quantizer` and `LFO` use `ConstantSourceNode` or `OscillatorNode` because they drive `AudioParam` targets (pitch, gain). However, the spec states the Envelope Follower outputs a CV *signal type* patchable to other CV-accepting inputs. The correct implementation therefore is a `ConstantSourceNode` whose `.offset` is updated each animation frame to the current `envelopeValue`. This matches the `Quantizer` pattern and enables real Web Audio graph routing.

**Revised decision** (correcting initial draft): Expose a `ConstantSourceNode` as `getOutputNode()`, with `SignalType.CV` on the output port. Update `cvNode.offset.value = envelopeValue` each animation frame in `getEnvelopeValue()` (or a dedicated `tick()` called from the display render).

**Alternatives considered**:
- No audio output node (display-read-only like VuMeter): would break patchability — CV couldn't be routed to Filter cutoff. Rejected.
- AudioWorklet: over-engineered; `ConstantSourceNode.offset` update from rAF is sufficient.

---

## Decision 4: Component Category

**Decision**: Place `EnvelopeFollower` under `src/components/analyzers/` (same as VuMeter, Oscilloscope).

**Rationale**: The Envelope Follower analyses audio to produce a derived signal; it is conceptually an analyser even though it produces a CV output. The existing `analyzers/` directory is the correct home. The sidebar category for display can be "Analyzers" or a new "Utilities" — the Arpeggiator and Quantizer are in `utilities/`, but Envelope Follower has primary analysis behaviour.

**Alternatives considered**:
- `src/components/utilities/`: reasonable but less accurate; analysers that produce CV (like Envelope Follower) are distinguished from pure signal-routing utilities.

---

## Decision 5: Parameter Ranges and Defaults

| Parameter | Min   | Max    | Default | Step  | Unit | Scale      |
|-----------|-------|--------|---------|-------|------|------------|
| attack    | 1     | 500    | 10      | 1     | ms   | Logarithmic |
| release   | 5     | 2000   | 100     | 5     | ms   | Logarithmic |
| gain      | 0.1   | 4.0    | 1.0     | 0.05  | ×    | Linear     |

**Rationale**:
- Attack 1–500 ms covers clicks (1 ms) through slow swells (500 ms).
- Release 5–2000 ms covers tight gating (5 ms) through 2-second tails.
- Gain 0.1×–4× gives roughly −20 dB to +12 dB, matching the spec assumption.
- Attack/Release use logarithmic knob scaling (standard for time parameters in audio).

---

## Decision 6: Canvas Display

**Decision**: `EnvelopeFollowerDisplay` follows the `VuMeterDisplay` pattern exactly — a vertical bar that fills upward proportionally to `envelopeValue` (0–1). Display height: 120 px (shorter than VuMeter's 200 px because the Envelope Follower also needs space for three knobs above the display).

**Color scheme**: Single solid green (`#22c55e`) bar on dark background (`#1a1a1a`) — no multi-colour segments. The Envelope Follower is not a peak meter; colour zones are not meaningful for CV display.

**Alternatives considered**:
- Multi-segment meter (VuMeter style): over-complex; colour zones imply audio level clipping, which doesn't apply to a CV signal.
- Waveform trace (Oscilloscope style): shows history, not current value; misleads users about CV-as-a-level.

---

## Decision 7: Component Size

**Decision**: Width = 80 px (same as VuMeter). Height = auto from content: header + 1 input port + 1 output port + 3 knobs (attack, release, gain) + display area.

**Rationale**: VuMeter is 80 px wide. The Envelope Follower has the same narrow form factor. Three knobs fit in a single row at this width using the existing `COMPONENT.KNOB_SIZE` and `COMPONENT.CONTROL_MARGIN_HORIZONTAL` constants.

---

## Existing Patterns Confirmed

| Pattern | Source file | Notes |
|---------|-------------|-------|
| AnalyserNode + getFloatTimeDomainData | VuMeter.ts | fftSize=256, smoothingTimeConstant=0 |
| Canvas display (no DOM element) | VuMeterDisplay.ts | world-coord render, updatePosition/Size |
| ConstantSourceNode CV output | Quantizer.ts | .offset updated with CV value, .start() in createAudioNodes |
| addParameter() in constructor | Oscilloscope.ts | name, default, min, max, step, unit |
| serialize/deserialize params as Record<string,number> | Quantizer.ts | standard pattern |
| createControls() if-block per ComponentType | CanvasComponent.ts L1607 | VuMeter block is closest match |
| ComponentType enum entry | src/core/types.ts L18 | add ENVELOPE_FOLLOWER = 'envelope-follower' |
