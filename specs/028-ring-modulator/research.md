# Research: Ring Modulator

**Feature**: 028-ring-modulator  
**Date**: 2026-05-31

---

## RT-001 — Web Audio API Primitive for Ring Modulation

**Decision**: Use `GainNode` with audio-rate `gain` modulation.

**Rationale**: Web Audio API does not have a dedicated ring modulator node. The standard technique is:

```
carrier signal → GainNode (input)
modulator signal → GainNode.gain (AudioParam)
GainNode output → ring-modulated result
```

Because `GainNode.gain` is an `AudioParam`, any `AudioNode` (including another `GainNode` carrying audio) can connect to it. The `GainNode` performs sample-accurate multiplication: `output[n] = carrier[n] × modulator[n]`. This produces the sum and difference frequencies required by the spec (FR-002).

**Why this is correct ring modulation**: Ring modulation is defined as multiplication of two signals. The GainNode computes `carrier × gain`. When the gain AudioParam is driven by a full-amplitude oscillator (± 1.0), the output contains *only* the sum (fcarrier + fmodulator) and difference (|fcarrier − fmodulator|) frequencies — neither original is present. This satisfies FR-005.

**Alternatives considered**:
- `ScriptProcessorNode` / `AudioWorkletNode`: Would require manual sample-by-sample multiplication. More complex, higher latency with ScriptProcessorNode, overkill for a native-supported operation. Rejected.
- Third-party DSP library: Contradicts the zero-runtime-dependency constraint. Rejected.

---

## RT-002 — Multi-Input Port Architecture

**Decision**: Implement two named input ports (`audio-in` and `modulator`) routed to different audio nodes via `getInputNode(portId?)` override.

**Rationale**: The component has two distinct audio inputs. The existing Mixer and FMOscillator patterns both demonstrate multi-input routing by overriding `getInputNode(portId?)`:
- FMOscillator: `portId === 'fm'` returns `fmGain`; default returns oscillator node.
- Mixer: `portId.startsWith('input')` returns per-channel gain node.

For Ring Modulator:
- `portId === 'audio-in'` → returns `carrierGain` (a GainNode at gain=1.0 that feeds into the multiplier GainNode)
- `portId === 'modulator'` → returns a `GainNode` at gain=1.0 whose output connects to `multiplierGain.gain` (the AudioParam)

The carrier does not need a separate GainNode — the multiplierGain node IS the signal path for the carrier. But for the modulator, a GainNode is needed as the "connection entry point" because `AudioParam`s cannot be directly passed as `AudioNode` targets in the `connectTo` dispatch in `SynthComponent.connectTo()`. Looking at the code: for `SignalType.AUDIO` connections, `connectTo()` calls `target.getInputNode(inputId)` and then `outputNode.connect(inputNode)` — this works if `inputNode` is a GainNode whose output is connected to the AudioParam.

**Audio graph**:
```
Audio In ──→ carrierGain (gain=1.0) ──→ multiplierGain (input) → outputGain → Audio Out
                                                       ↑
Modulator In ──→ modulatorGain (gain=1.0) ──────────→ multiplierGain.gain (AudioParam)
```

Wait — GainNode multiplies its input signal by its gain AudioParam: `output = input × gain`. If we connect the modulator to `multiplierGain.gain`, then `multiplierGain.gain` will be the *sum* of its base value (0.0 for pure ring mod) plus the modulator signal. Setting the base gain to 0.0 and letting the modulator fully drive it gives true ring modulation (no carrier bleed from DC offset).

**Base gain value**: Set `multiplierGain.gain.value = 0.0` before connecting the modulator. This ensures that when no modulator is connected, the output is silence (FR-004 — "if either input is absent, output must be silence").

**Corrected audio graph**:
```
Audio In ──→ multiplierGain (input)
                     │ output → outputGain → Audio Out
Modulator In ──→ modulatorEntry (GainNode, gain=1.0)
                     │ output → multiplierGain.gain (AudioParam, base=0.0)
```

- Carrier absent: multiplierGain input is silence → output is silence ✅
- Modulator absent: multiplierGain.gain stays at 0.0 → output is silence ✅  
- Both present: output = carrier × modulator (pure multiplication) ✅

**Port IDs** (matching SynthComponent.addInput conventions in the codebase):
- `'audio-in'` → Audio In port → `getInputNode('audio-in')` returns `multiplierGain`
- `'modulator'` → Modulator In port → `getInputNode('modulator')` returns `modulatorEntry`

---

## RT-003 — Bypass Architecture

**Decision**: Bypass connects `multiplierGain` output directly to `outputGain`, bypassing multiplication. The carrier (Audio In) passes through unchanged.

**Rationale**: The clarification established that bypass = "carrier passes through to output unchanged". 

In the audio graph, the carrier signal enters `multiplierGain`'s signal input. To bypass:
1. Disconnect `multiplierGain.connect(outputGain)` — stops the multiplied signal
2. Connect carrier input directly to `outputGain` — but the carrier input is `multiplierGain` itself (its signal input is the carrier)

Actually, the carrier IS `multiplierGain`'s audio input, but GainNode still processes it (multiplies by gain = 0.0 when modulator absent). To truly pass the carrier through on bypass:

**Revised bypass approach**: Add a `carrierBypassGain` node:
```
Audio In ──→ carrierBypassGain (gain=1.0) ──→ multiplierGain
                                          └──→ [bypass path] → outputGain
```

Actually, simpler: Use the same single-input approach as Distortion/Tremolo — maintain the `_bypassConnections` array and reconnect `carrierBypassGain` directly to `outputGain`:

```
Audio In ──→ carrierBypassGain ──(normal)──→ multiplierGain → outputGain
                               └─(bypass)──→ outputGain
```

In bypass mode: disconnect `carrierBypassGain` from `multiplierGain`; connect it to `outputGain` directly. This lets the unmodified carrier signal pass through. Restore on `disableBypass()`.

**Final audio graph**:
```
Audio In     → carrierBypassGain (gain=1.0) → multiplierGain (gain AudioParam base=0.0) → outputGain → Audio Out
Modulator In → modulatorEntry    (gain=1.0) → multiplierGain.gain (AudioParam)
```

Bypass path: `carrierBypassGain → outputGain` (skipping multiplication entirely).

---

## RT-004 — ComponentType Enum Value

**Decision**: `RING_MODULATOR = 'ring-modulator'`

**Rationale**: Follows the kebab-case string pattern used by all other component types (`fm-oscillator`, `adsr-envelope`, `step-sequencer`, etc.). The string value is used as the serialized type in `PatchData.ComponentData.type`.

---

## RT-005 — No Parameters, No Controls

**Decision**: No `addParameter()` calls. No controls in `CanvasComponent.createControls()`.

**Rationale**: FR-007 specifies no user-adjustable parameters beyond bypass. Bypass is handled automatically by `isBypassable() = true` and `SynthComponent.setBypass()`. The `CanvasComponent` renders a bypass button in the header automatically when `isBypassable()` returns true — no explicit case in `createControls()` is needed (the absence of a case means no controls are added, which is correct for a no-parameter component).

The `updateAudioParameter` method must still be implemented (it is abstract in `SynthComponent`) but can be a no-op since there are no parameters.

---

## RT-006 — `componentLayout.ts` Port Count

**Decision**: 2 inputs (`audio-in`, `modulator`), 1 output (`output`). No controls (`ControlLayout = {}`).

**Rationale**: Port counts determine component height. The default `ControlLayout = {}` (no knobs, no dropdowns, no display) is used by `KEYBOARD_INPUT` and is the fallback case — the Ring Modulator uses the same fallback. With 2 inputs and 1 output, `maxPorts = 2`, driving component height correctly.

---

## RT-007 — Sidebar Icon

**Decision**: `'⊗'` (circled times / tensor product symbol)

**Rationale**: The `⊗` symbol visually represents multiplication (ring = multiplication of two signals) and is distinct from all icons already in use. Alternatives: `×` (too generic), `◎` (taken by Phaser), `∅` (wrong connotation).

---

## RT-008 — Test Strategy

**Decision**: Unit tests only, matching `Bitcrusher.test.ts` pattern.

**Rationale**: The component has no audio-rate DSP to test (the GainNode multiplication is a browser primitive). Tests cover:
1. Constructor: port creation, no parameters, `isBypassable() = true`
2. `createAudioNodes`: nodes registered, `getInputNode` routing, `getOutputNode`
3. `getInputNode('audio-in')` returns `carrierBypassGain`
4. `getInputNode('modulator')` returns `modulatorEntry`
5. Bypass enable/disable: state flags, connection assertions
6. Serialize: `isBypassed` included/excluded correctly

Mock: `createGain` only (no oscillators, no delay, no biquad needed).
