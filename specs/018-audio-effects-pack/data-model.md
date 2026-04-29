# Data Model: Audio Effects Pack

**Feature**: 018-audio-effects-pack  
**Date**: 2026-04-29

---

## Entities

### Bitcrusher

Extends `SynthComponent`. Registered as `ComponentType.BITCRUSHER = 'bitcrusher'`.

| Parameter ID | Display Name  | Default | Min | Max  | Step | Unit |
|--------------|---------------|---------|-----|------|------|------|
| `bitDepth`   | Bit Depth     | 16      | 1   | 16   | 1    | bits |
| `sampleRate` | Sample Rate   | 100     | 1   | 100  | 1    | %    |
| `mix`        | Mix           | 1.0     | 0   | 1    | 0.01 |      |

- `bitDepth`: 1 = maximally crushed (1-bit), 16 = transparent (no quantization)
- `sampleRate`: 100% = full sample rate (no reduction); 1% = extreme reduction (aliasing)
- `mix`: 0 = 100% dry, 1 = 100% wet

**Audio graph**:
```
inputGain → ScriptProcessorNode (bitcrusher) → wetGain → outputGain
inputGain → dryGain → outputGain
```

**Bypass**: `inputGain → outputGain` directly (ScriptProcessorNode and dry path disconnected)

---

### Flanger

Extends `SynthComponent`. Registered as `ComponentType.FLANGER = 'flanger'`.

| Parameter ID | Display Name | Default | Min | Max  | Step | Unit |
|--------------|--------------|---------|-----|------|------|------|
| `rate`       | Rate         | 0.5     | 0.1 | 20   | 0.1  | Hz   |
| `depth`      | Depth        | 50      | 0   | 100  | 1    | %    |
| `feedback`   | Feedback     | 0       | 0   | 95   | 1    | %    |
| `mix`        | Mix          | 0.5     | 0   | 1    | 0.01 |      |

**Audio graph**:
```
inputGain → dryGain → outputGain
inputGain → delayNode → wetGain → outputGain
                  ↑ feedbackGain ↗
lfo → lfoGain → delayNode.delayTime (AudioParam)
```

- Delay range: 0.001–0.010s (1–10ms); LFO modulates within this window
- Feedback path: `wetGain → feedbackGain → delayNode` (clamped to 0–0.95)

**Bypass**: `inputGain → outputGain` directly

---

### Phaser

Extends `SynthComponent`. Registered as `ComponentType.PHASER = 'phaser'`.

| Parameter ID | Display Name | Default | Min | Max  | Step | Unit   |
|--------------|--------------|---------|-----|------|------|--------|
| `rate`       | Rate         | 0.5     | 0.1 | 20   | 0.1  | Hz     |
| `depth`      | Depth        | 50      | 0   | 100  | 1    | %      |
| `feedback`   | Feedback     | 0       | 0   | 95   | 1    | %      |
| `stages`     | Stages       | 4       | 2   | 8    | 2    | stages |
| `mix`        | Mix          | 0.5     | 0   | 1    | 0.01 |        |

**Audio graph**:
```
inputGain → [allpass₁ → allpass₂ → … → allpassN] → wetGain → outputGain
                                              ↑ feedbackGain ↗
inputGain → dryGain → outputGain
lfo → lfoGain → allpass₁.frequency, allpass₂.frequency, … (AudioParam)
```

- `stages` ∈ {2, 4, 6, 8} — determines chain length
- Allpass center frequency sweeps: LFO modulates between 200–1600 Hz
- Stage count change triggers graph recreation (destroyAudioNodes + createAudioNodes)

**Bypass**: `inputGain → outputGain` directly

---

### Tremolo

Extends `SynthComponent`. Registered as `ComponentType.TREMOLO = 'tremolo'`.

| Parameter ID | Display Name | Default | Min | Max  | Step | Unit |
|--------------|--------------|---------|-----|------|------|------|
| `rate`       | Rate         | 4.0     | 0.1 | 20   | 0.1  | Hz   |
| `depth`      | Depth        | 50      | 0   | 100  | 1    | %    |
| `mix`        | Mix          | 1.0     | 0   | 1    | 0.01 |      |

**Audio graph**:
```
inputGain → tremoloGain → outputGain
lfo (sine) → lfoGain → tremoloGain.gain (AudioParam)
constantSource (DC 1.0) → tremoloGain.gain (AudioParam)
```

- LFO output range [-1, 1] scaled by `depth/2`; DC offset of `1 - depth/2` keeps gain in [0, 1]
- At depth=0%: `tremoloGain.gain` = constant 1.0 (no modulation)
- At depth=100%: gain oscillates [0, 1]

**Bypass**: `inputGain → outputGain` directly

---

## PatchData Compatibility

No new top-level `PatchData` fields required. Each effect serializes via the existing `ComponentData.parameters` map. Legacy patches load without error; new effect types simply won't appear in older patches.

The four new `ComponentType` enum values are additive — no existing serialized type strings change.

---

## isBypassable() Addition

`SynthComponent.isBypassable()` must include the four new types:

```typescript
ComponentType.BITCRUSHER,
ComponentType.FLANGER,
ComponentType.PHASER,
ComponentType.TREMOLO,
```

---

## componentLayout.ts Additions

### Knob counts (for UI panel sizing)

| Type              | numKnobs | Notes                                     |
|-------------------|----------|-------------------------------------------|
| `BITCRUSHER`      | 3        | bitDepth, sampleRate, mix                 |
| `FLANGER`         | 4        | rate, depth, feedback, mix                |
| `PHASER`          | 5        | rate, depth, feedback, stages, mix        |
| `TREMOLO`         | 3        | rate, depth, mix                          |

### Port counts

All four effects: `{ inputs: 1, outputs: 1 }` — audio in / audio out.

---

## Sidebar.ts Icon Additions

| Type         | Icon | Rationale                                |
|--------------|------|------------------------------------------|
| `BITCRUSHER` | `▓`  | Suggests digital/pixelated degradation   |
| `FLANGER`    | `〜` | Suggests sweeping wave modulation        |
| `PHASER`     | `◎`  | Suggests circular phase sweep            |
| `TREMOLO`    | `∿`  | Suggests amplitude oscillation           |
