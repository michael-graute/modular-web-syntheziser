# Data Model: Mixer Channel Panning

**Feature**: 019-mixer-channel-panning
**Date**: 2026-05-01

## Entities

### ChannelPan

Represents the stereo pan position for a single Mixer channel.

| Field | Type | Range | Default | Description |
|-------|------|-------|---------|-------------|
| `panN` | `number` | [−1.0, +1.0] | 0.0 | Pan position for channel N (N = 1–4). Stored as a standard `SynthComponent` parameter. |

- **Identity**: Owned by the Mixer component instance; referenced by parameter ID `pan1`–`pan4`.
- **Lifecycle**: Created in `Mixer` constructor via `addParameter()`. Persisted automatically by `PatchSerializer` as part of `ComponentData.parameters`. Defaults to 0.0 on legacy patch load (key absent → `getValue()` returns constructor default).
- **State transitions**: Value changes via `setParameterValue('panN', value)` → `updateAudioParameter('panN', value)` → `StereoPannerNode.pan.setValueAtTime(value, now)`.

### StereoPanner (audio node, per channel)

| Field | Type | Description |
|-------|------|-------------|
| `pan` | `AudioParam` ([−1.0, +1.0]) | Equal-power stereo position. Driven by the `panN` parameter. |

- **Position in signal chain**: `inputGain → channelGain → stereoPanner → outputGain`
- **Created**: In `createAudioNodes()` via `ctx.createStereoPanner()`
- **Destroyed**: In `destroyAudioNodes()` — disconnected and nulled

## Patch Serialization

No changes to `PatchData` or `ComponentData` schemas. Pan values are serialized as standard component parameters under `ComponentData.parameters`:

```json
{
  "id": "mixer-1",
  "type": "MIXER",
  "parameters": {
    "gain1": 0.75,
    "gain2": 0.75,
    "gain3": 0.75,
    "gain4": 0.75,
    "master": 0.75,
    "pan1": -0.5,
    "pan2": 0.0,
    "pan3": 0.5,
    "pan4": 0.0
  }
}
```

Legacy patches omitting `pan1`–`pan4` load correctly; all channels default to 0.0 (center).

## Layout Changes

`componentLayout.ts` Mixer entry gains a `numPanKnobs: 4` field. The existing height formula adds:
- `+10` spacing above knob row
- `+12` knob label height
- `+40` knob size
- `+12` value text below

Total height increase: **74 px**.
