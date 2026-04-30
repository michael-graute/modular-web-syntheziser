# Quickstart: Mixer Channel Panning

**Feature**: 019-mixer-channel-panning

## Integration Scenarios

### Scenario 1 — Basic stereo spread

```
Oscillator A (bass)  → Mixer input 1  [pan1 = 0.0]   → Master Output
Oscillator B (pad)   → Mixer input 2  [pan2 = −0.6]  → Master Output
Oscillator C (lead)  → Mixer input 3  [pan3 = +0.6]  → Master Output
```

Drag the pan knob for channel 2 left and channel 3 right. Bass stays centered. Result: wide stereo image with distinct instrument positions.

### Scenario 2 — Mixing into mono (backward compatibility)

All four pan knobs at 0.0 (default). All four channels sum equally to both output channels — identical to behaviour before this feature.

### Scenario 3 — Legacy patch load

A patch saved without pan data loads; `PatchSerializer` finds no `pan1`–`pan4` keys in the parameters map and leaves them at their constructor defaults (0.0). No migration, no error.

## Key Implementation Notes

1. **Signal chain**: `inputGain → channelGain → stereoPanner → outputGain` — pan after fader.
2. **Parameter IDs**: `pan1`, `pan2`, `pan3`, `pan4` — one per channel, consistent with `gain1`–`gain4`.
3. **Audio node registration**: `stereoPanner1`–`stereoPanner4` registered via `registerAudioNode()`.
4. **Bypass**: Bypass path (`inputGain → outputGain`) skips both channelGain and stereoPanner — no pan in bypass.
5. **Canvas layout**: Pan knobs rendered in a row below the fader row; Mixer component height increases ~74 px.
6. **Test mock**: `MockStereoPannerNode` added to `tests/mocks/WebAudioAPI.mock.ts`, following the `MockGainNode` pattern.
