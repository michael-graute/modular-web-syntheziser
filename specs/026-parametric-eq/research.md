# Research: 3-Band Parametric EQ

**Feature**: 026-parametric-eq  
**Date**: 2026-05-31

---

## Decision 1: Web Audio API node type for EQ bands

**Decision**: Use three `BiquadFilterNode` instances — one `lowshelf`, one `peaking`, one `highshelf`.

**Rationale**: `BiquadFilterNode` is the native Web Audio node for all standard EQ filter shapes. `lowshelf` and `highshelf` map exactly to the spec's shelf bands. `peaking` maps to the parametric mid peak (gain, frequency, Q). All three expose `frequency`, `gain`, and `Q` as `AudioParam`s, enabling direct real-time modulation without custom DSP.

**Alternatives considered**:
- Custom IIR filter coefficients: more flexible but requires manual coefficient recalculation on every parameter change; significant complexity for no gain in this use case.
- Single `BiquadFilterNode` with filter type switching: can't run three bands simultaneously.

---

## Decision 2: CV gain modulation routing (1V = 1 dB)

**Decision**: Each band exposes its `BiquadFilterNode.gain` `AudioParam` directly via `getAudioParamForInput()`. The LFO's per-connection scaler uses `getParameterRangeForInput()` returning `{ min: -18, max: 18 }` to scale the LFO's ±1 output to ±18 dB full range at 100% depth.

**Rationale**: `BiquadFilterNode.gain` is a native `AudioParam` measured in dB. Connecting an LFO output to it at 1:1 with the existing scaler pattern (LFO ±1 → scaler → AudioParam) naturally produces 1V=1dB when the scaler range is `[-18, 18]` — a scaler gain of 18 at 100% LFO depth means ±18 dB total swing. This is consistent with how Filter's `resonance_cv` is wired.

**Alternatives considered**:
- `ConstantSourceNode` intermediary: unnecessary indirection since `gain` is already an `AudioParam`.
- Additive GainNode chain: needed for the Filter's Hz CV because Hz is not directly an AudioParam; not needed here since dB gain is native.

---

## Decision 3: Audio graph topology

**Decision**: `inputGain → lowShelf → midPeak → highShelf → outputGain → destination`. Two bookend `GainNode`s (`inputGain`, `outputGain`) handle bypass routing identically to the existing `Filter` component pattern.

**Rationale**: Series chaining of three `BiquadFilterNode`s is the standard approach; each node applies its EQ curve independently. The bookend GainNode pattern is already established in `Filter.ts` and `VCA.ts` — reusing it maintains consistency and enables bypass without disconnecting the filter chain.

**Alternatives considered**:
- Parallel processing with gain mixing: correct for some EQ designs but unnecessary for standard parametric shelving/peaking topology; more nodes, more complexity.

---

## Decision 4: Parameter ranges and defaults

| Parameter | Default | Range | Step |
|-----------|---------|-------|------|
| Low shelf gain | 0 dB | −18 to +18 dB | 0.1 |
| Low shelf frequency | 80 Hz | 20–800 Hz | 1 |
| Mid peak gain | 0 dB | −18 to +18 dB | 0.1 |
| Mid peak frequency | 1000 Hz | 200–8000 Hz | 1 |
| Mid peak Q | 1.0 | 0.1–10.0 | 0.01 |
| High shelf gain | 0 dB | −18 to +18 dB | 0.1 |
| High shelf frequency | 8000 Hz | 1000–20000 Hz | 1 |

**Rationale**: Defaults from spec clarification (Q1/Q2/Q3). Q range 0.1–10 is the standard musical parametric EQ range; Q=0.707 (Butterworth) is about one octave bandwidth, Q=10 is very narrow. Gain step 0.1 dB provides fine control.

---

## Decision 5: Component placement

**Decision**: `src/components/processors/ParametricEQ.ts` — grouped with `Filter.ts` and `VCA.ts` in the `processors/` directory.

**Rationale**: The EQ is an audio processor (it transforms audio, not generates it). The `processors/` group already contains `Filter.ts` which is the closest analogue.

---

## Decision 6: Knob layout

**Decision**: 7 knobs arranged as three groups — Low (gain, freq), Mid (gain, freq, Q), High (gain, freq). No dropdown needed.

**Rationale**: All parameters are continuous numeric values; knobs are the established control for these in the existing canvas UI. 7 knobs is within the component height budget (comparable to FM Oscillator's 3 knobs + modulator dropdown). Labels distinguish groups.

---

## Decision 7: Port configuration

**Decision**:
- Inputs: `audio-in` (Audio), `low-gain-cv` (CV), `mid-gain-cv` (CV), `high-gain-cv` (CV)
- Outputs: `audio-out` (Audio)

**Rationale**: CV inputs only for gain (spec FR-012). Frequency and Q are knob-only per spec assumption. Port IDs follow the `kebab-case` convention used throughout the project.
