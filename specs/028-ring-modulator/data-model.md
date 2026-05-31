# Data Model: Ring Modulator

**Feature**: 028-ring-modulator  
**Date**: 2026-05-31

---

## Entities

### RingModulator (SynthComponent subclass)

| Field | Type | Source | Notes |
|---|---|---|---|
| `id` | `string` | `SynthComponent` | UUID assigned at creation |
| `type` | `ComponentType.RING_MODULATOR` | `SynthComponent` | Serialized as `'ring-modulator'` |
| `name` | `'Ring Modulator'` | `SynthComponent` | Display name |
| `position` | `Position` | `SynthComponent` | Canvas coordinates |
| `inputs` | `Map<string, Port>` | `SynthComponent` | See Ports below |
| `outputs` | `Map<string, Port>` | `SynthComponent` | See Ports below |
| `parameters` | `Map` (empty) | `SynthComponent` | No parameters |
| `_isBypassed` | `boolean` | `SynthComponent` | Bypass state |

### Audio Nodes (runtime, not serialized)

| Key | Node Type | Role |
|---|---|---|
| `carrierBypassGain` | `GainNode` (gain=1.0) | Carrier signal entry; doubles as bypass path node |
| `modulatorEntry` | `GainNode` (gain=1.0) | Modulator signal entry; output drives `multiplierGain.gain` |
| `multiplierGain` | `GainNode` (gain AudioParam base=0.0) | Performs carrier × modulator multiplication |
| `outputGain` | `GainNode` (gain=1.0) | Output node for downstream connections |

### Ports

| Port ID | Name | Type | Direction |
|---|---|---|---|
| `audio-in` | Audio In | `SignalType.AUDIO` | Input |
| `modulator` | Modulator In | `SignalType.AUDIO` | Input |
| `output` | Audio Out | `SignalType.AUDIO` | Output |

---

## Audio Graph

```
Audio In ──→ carrierBypassGain (1.0) ──→ multiplierGain [signal input]
                                                │
                                                ▼ (gain AudioParam, base=0.0)
Modulator In → modulatorEntry (1.0) ──→ multiplierGain.gain
                                                │
                                          multiplierGain output
                                                │
                                                ▼
                                           outputGain ──→ Audio Out
```

**Bypass path** (when `_isBypassed = true`):

```
Audio In ──→ carrierBypassGain ──(direct)──→ outputGain ──→ Audio Out
             (multiplierGain disconnected from carrierBypassGain)
```

---

## Serialization

`ComponentData` shape for Ring Modulator (no parameter-specific changes to `PatchData`):

```json
{
  "id": "uuid",
  "type": "ring-modulator",
  "position": { "x": 400, "y": 300 },
  "parameters": {},
  "isBypassed": true
}
```

- `parameters` is always `{}` (empty object) — no parameters to serialize.
- `isBypassed` is present only when `true` (follows `SynthComponent.serialize()` convention).
- No new top-level `PatchData` fields required — backward-compatible with all existing patches.

---

## State Transitions

| State | Condition | Behavior |
|---|---|---|
| Active, both inputs | carrier and modulator connected | Output = carrier × modulator (ring-modulated result) |
| Active, carrier only | only `audio-in` connected | `multiplierGain.gain` stays at base 0.0 → silence |
| Active, modulator only | only `modulator` connected | `multiplierGain` has no signal input → silence |
| Active, no inputs | neither connected | Output = silence |
| Bypassed | `isBypassed = true` | Carrier passes through to output; modulator has no effect |
| Bypassed, no carrier | `isBypassed = true`, `audio-in` absent | Output = silence |

---

## Validation Rules

- No runtime validation needed — GainNode handles all edge cases natively (absent inputs produce silence).
- `isBypassable()` must return `true` — enforced by adding `ComponentType.RING_MODULATOR` to the allowlist in `SynthComponent.isBypassable()`.
- `updateAudioParameter()` is a no-op (no parameters exist) — must not throw.
