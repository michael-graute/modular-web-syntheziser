# Data Model: 3-Band Parametric EQ

**Feature**: 026-parametric-eq  
**Date**: 2026-05-31

---

## Component: ParametricEQ

Extends `SynthComponent`. Lives in `src/components/processors/ParametricEQ.ts`.

### Parameters (serialized in `ComponentData.parameters`)

| ID | Label | Default | Min | Max | Step | Unit |
|----|-------|---------|-----|-----|------|------|
| `lowGain` | Low Gain | 0 | −18 | +18 | 0.1 | dB |
| `lowFreq` | Low Freq | 80 | 20 | 800 | 1 | Hz |
| `midGain` | Mid Gain | 0 | −18 | +18 | 0.1 | dB |
| `midFreq` | Mid Freq | 1000 | 200 | 8000 | 1 | Hz |
| `midQ` | Mid Q | 1.0 | 0.1 | 10.0 | 0.01 | — |
| `highGain` | High Gain | 0 | −18 | +18 | 0.1 | dB |
| `highFreq` | High Freq | 8000 | 1000 | 20000 | 1 | Hz |

### Ports

| ID | Direction | Signal Type | Description |
|----|-----------|-------------|-------------|
| `audio-in` | Input | Audio | Mono audio signal to process |
| `low-gain-cv` | Input | CV | LFO/CV modulation for low shelf gain (1V = 1 dB) |
| `mid-gain-cv` | Input | CV | LFO/CV modulation for mid peak gain (1V = 1 dB) |
| `high-gain-cv` | Input | CV | LFO/CV modulation for high shelf gain (1V = 1 dB) |
| `audio-out` | Output | Audio | Processed mono audio signal |

### Audio Graph

```
audio-in
  └─► inputGain (GainNode, gain=1)
        └─► lowShelfNode (BiquadFilterNode, type='lowshelf')
              └─► midPeakNode (BiquadFilterNode, type='peaking')
                    └─► highShelfNode (BiquadFilterNode, type='highshelf')
                          └─► outputGain (GainNode, gain=1)
                                └─► audio-out

LFO/CV ─► [LFO per-connection scaler] ─► lowShelfNode.gain  (AudioParam)
LFO/CV ─► [LFO per-connection scaler] ─► midPeakNode.gain   (AudioParam)
LFO/CV ─► [LFO per-connection scaler] ─► highShelfNode.gain (AudioParam)
```

### Bypass behaviour

Uses the same connect/disconnect pattern as `Filter.ts`:
- `enableBypass()`: disconnect `inputGain` and the filter chain; connect `inputGain` directly to `outputGain`.
- `disableBypass()`: disconnect `inputGain`; reconnect the series chain `inputGain → lowShelf → midPeak → highShelf → outputGain`.

Filter node state (gain, frequency, Q values) is preserved during bypass so settings are intact when bypass is removed.

### Serialization format (`ComponentData.parameters`)

```json
{
  "lowGain":  0,
  "lowFreq":  80,
  "midGain":  0,
  "midFreq":  1000,
  "midQ":     1.0,
  "highGain": 0,
  "highFreq": 8000
}
```

Missing keys fall back to the defaults above (backward-compatibility rule FR-011).

---

## CV Modulation Model

The LFO uses a per-connection scaler `GainNode` (established pattern from `LFO.ts`). The scaler's gain is computed by `computeScaleGain(depth, range)` where `range = { min: -18, max: 18 }`.

At 100% LFO depth, the scaler gain is 18 — meaning the LFO's ±1 output drives ±18 dB on the `BiquadFilterNode.gain` AudioParam. This naturally implements 1V = 1 dB at full depth.

The `ParametricEQ` exposes the gain AudioParam directly via `getAudioParamForInput()` for each CV port, and `getParameterRangeForInput()` returns `{ min: -18, max: 18 }` so the LFO scaler computes the correct gain.

---

## ComponentType enum entry

```typescript
PARAMETRIC_EQ = 'parametric-eq'
```
