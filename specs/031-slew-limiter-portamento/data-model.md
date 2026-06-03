# Data Model: Slew Limiter / Portamento

**Feature**: 031-slew-limiter-portamento
**Date**: 2026-06-03

---

## Entities

### SlewLimiter (runtime state)

| Field | Type | Range | Default | Description |
|-------|------|-------|---------|-------------|
| `id` | `string` | — | generated | Unique component ID |
| `position` | `Position` | — | — | Canvas `{x, y}` position |
| `rise` | `number` (ms) | 0–5000 | 50 | Upward slew time constant |
| `fall` | `number` (ms) | 0–5000 | 50 | Downward slew time constant |
| `outputValue` | `number` | 0–1 | 0 | Current smoothed output (runtime only, not persisted) |
| `isBypassed` | `boolean` | — | `false` | Bypass state (input passes through unmodified) |

### SlewLimiterParams (patch persistence)

Stored inside `ComponentData.parameters` as a flat `Record<string, number>`:

| Key | Type | Range | Description |
|-----|------|-------|-------------|
| `rise` | `number` | 0–5000 | Rise time in ms |
| `fall` | `number` | 0–5000 | Fall time in ms |

`isBypassed` is stored at the top-level `ComponentData.isBypassed` field (already defined in `ComponentData`, consistent with other bypassable components).

---

## Signal Flow

```
CV Source
  │
  ▼
[inputGain: GainNode, gain=1.0]  ←── CV patch cable connects here
  │
  ├──► [analyser: AnalyserNode]  ← reads current CV scalar each frame
  │
[SlewLimiter.tick(dt)]           ← frame-driven IIR update
  │
  ▼
[cvNode: ConstantSourceNode]     ← offset updated to outputValue each frame
  │
  ▼
CV Destination (Oscillator pitch, Filter cutoff, VCA gain, etc.)
```

---

## State Transitions

```
Initial state: outputValue = 0, no input connected

Input arrives (value V):
  if V > outputValue → apply Rise coefficient → outputValue approaches V
  if V < outputValue → apply Fall coefficient → outputValue approaches V
  if V == outputValue → no change

Bypass enabled:
  inputGain disconnected from internal graph
  inputGain connected directly to cvNode
  outputValue tracking paused

Bypass disabled:
  restore internal graph
  outputValue tracking resumes
```

---

## Validation Rules

| Parameter | Rule |
|-----------|------|
| `rise` | Clamp to [0, 5000] ms; round to nearest integer ms |
| `fall` | Clamp to [0, 5000] ms; round to nearest integer ms |
| Any unknown parameter key | Ignored (backward-compatible deserialise) |
| Non-finite / NaN values | Fall back to default (50 ms) |

---

## Patch Compatibility

- No new top-level `PatchData` fields required.
- Legacy patches without a `slew-limiter` component load without error.
- A patch containing a `slew-limiter` component with missing `rise`/`fall` keys deserialises to defaults (50 ms each).
