# Research: Mixer Channel Panning

**Feature**: 019-mixer-channel-panning
**Date**: 2026-05-01

## Decision 1: Web Audio API Node for Stereo Panning

**Decision**: Use `StereoPannerNode` (not `PannerNode`) for per-channel stereo panning.

**Rationale**: `StereoPannerNode` is the correct choice for simple left/right stereo positioning:
- Accepts a single `pan` AudioParam in the range [−1.0, +1.0]
- Uses equal-power (cosine) panning by default — exactly what FR-008 requires
- Designed for stereo mixing workflows; `PannerNode` is a 3D spatial audio node intended for positional audio (binaural, HRTF), which is overkill and semantically wrong for this use case
- Created via `ctx.createStereoPanner()` — available in all modern browsers

**Alternatives considered**:
- `PannerNode`: Rejected — 3D spatial node, requires position/orientation coordinates, adds unnecessary complexity
- Manual gain split (two `GainNode`s, one per ear): Rejected — reinvents what `StereoPannerNode` already does correctly and requires manual equal-power math

## Decision 2: Signal Chain Order

**Decision**: Signal chain per channel: `inputGain → channelGain (volume fader) → stereoPanner → outputGain (bus)`.

**Rationale**: Per the clarification in spec.md (session 2026-05-01), pan follows the fader. This matches standard mixing console convention: the fader determines how much signal reaches the pan stage. Turning a channel down reduces its contribution to both L and R symmetrically; only then does panning position that reduced signal in the field.

**Alternatives considered**:
- Pan before fader (`inputGain → panner → channelGain → bus`): Rejected — non-standard, causes the pan position to interact unexpectedly with the fader (lowering fader would not reduce the panned position).

## Decision 3: Pan Parameter Naming and Range

**Decision**: Parameters named `pan1`–`pan4`, range [−1.0, +1.0], step 0.01, default 0.0, unit `''`.

**Rationale**: Matches the existing `gain1`–`gain4` naming pattern exactly. Range [−1.0, +1.0] maps directly to the `StereoPannerNode.pan.value` AudioParam range. Step 0.01 gives 200 discrete positions — sufficient precision for perceptible stereo placement.

## Decision 4: Persistence Strategy

**Decision**: Use the existing `SynthComponent.addParameter()` / `PatchSerializer` pipeline — no custom serialization needed.

**Rationale**: `addParameter()` registers the pan values as standard component parameters. `PatchSerializer` already serializes and deserializes all component parameters as part of `ComponentData.parameters`. Legacy patches (without `pan1`–`pan4`) will simply be missing these keys, so `getParameter('pan1')?.getValue()` will fall back to the constructor default of 0.0 — satisfying FR-006 automatically.

## Decision 5: Component Height Increase

**Decision**: Increase Mixer component height by adding `numPanKnobs: 4` to the layout descriptor in `componentLayout.ts`, letting the existing height-calculation formula add the standard knob row height.

**Rationale**: The height formula already handles knob rows: `+12 (label) + 40 (knob) + 12 (value text)` = 64 px per row, plus `+10` spacing above = 74 px total increase. This is the same pattern used by every other knob-equipped component. No special-casing needed.

## Decision 6: Bypass Behavior

**Decision**: During bypass, include `StereoPannerNode` connections in `_bypassConnections` so `disableBypass()` restores them automatically. The bypass path (`inputGain → outputGain` direct) skips both fader and panner.

**Rationale**: The Mixer's existing `enableBypass()` already captures `channelGain → outputGain` connections. Adding `channelGain → stereoPanner` and `stereoPanner → outputGain` to the same array keeps the restoration symmetrical and avoids a custom `disableBypass()` override.

## Decision 7: MockStereoPannerNode for Tests

**Decision**: Add `MockStereoPannerNode` to `tests/mocks/WebAudioAPI.mock.ts` extending `MockAudioNode`, exposing `pan: MockAudioParam`.

**Rationale**: Follows the exact same pattern as `MockGainNode` (exposes `gain: MockAudioParam`) and `MockBiquadFilterNode` (exposes `frequency: MockAudioParam`). The mock lets tests assert `pan.value` without a real audio context.
