# Data Model: FM Oscillator Component

**Feature**: 020-fm-oscillator
**Date**: 2026-05-02

## Entities

### FMOscillator (extends Oscillator)

Inherits all properties of `Oscillator` and adds:

| Field         | Type             | Description                                              |
|---------------|------------------|----------------------------------------------------------|
| `fmGain`      | `GainNode\|null` | Internal Web Audio node; scales FM signal before routing to `oscillator.frequency`. Null when component is inactive. |

**Lifecycle**: `fmGain` is created in `createAudioNodes()` (after `super.createAudioNodes()`), connected to the parent `OscillatorNode.frequency`, and set to null in `destroyAudioNodes()` (before `super.destroyAudioNodes()`).

---

### Ports (additional to Oscillator)

| Port ID | Direction | Signal Type | Description                        |
|---------|-----------|-------------|------------------------------------|
| `fm`    | Input     | AUDIO       | Receives audio-rate FM modulator signal |

---

### Parameters (additional to Oscillator)

| Parameter ID | Display Name | Default | Min | Max | Step | Unit | Description                              |
|--------------|-------------|---------|-----|-----|------|------|------------------------------------------|
| `fmDepth`    | FM Depth    | 100     | 0   | 1000 | 1   | Hz   | Maximum frequency deviation applied by the FM modulator signal |

The `fmDepth` parameter is linked to `fmGain.gain` via `Parameter.linkAudioParam()` so that CV modulation of FM Depth works automatically through the existing CV routing system.

---

### ComponentType enum entry

| Key              | Value             |
|------------------|-------------------|
| `FM_OSCILLATOR`  | `'fm-oscillator'` |

---

### ComponentData serialisation

`FMOscillator` uses the standard `SynthComponent.serialize()` / `deserialize()` pipeline. No new top-level fields are added to `ComponentData` or `PatchData`. The `fmDepth` parameter value is stored in `ComponentData.parameters['fmDepth']` alongside the inherited oscillator parameters.

---

## State Transitions

```
inactive ──activate()──► active
                              │
                          fmGain connected to oscillator.frequency
                          fmDepth linked to fmGain.gain
                          FM input port accepts audio connections
                              │
         deactivate() ◄───────┘
              │
          fmGain.disconnect() → null
          super.destroyAudioNodes()
```

---

## Audio Graph (when active with FM connection)

```
[Modulator OscillatorNode]
        │ (audio)
        ▼
[fmGain GainNode]   ◄── fmDepth parameter (0–1000 Hz)
        │
        ▼  connect(oscillator.frequency)
[Carrier OscillatorNode.frequency AudioParam]
        │
        ▼
[Carrier audio output]
```

Without an FM connection, `fmGain` exists but has no inputs — it passes silence to `oscillator.frequency`, resulting in no modulation (equivalent to the standard Oscillator).

---

## Validation Rules

| Rule | Condition | Action |
|------|-----------|--------|
| FM Depth range | `0 ≤ fmDepth ≤ 1000` | Clamped by Parameter min/max; UI knob enforces range |
| FM input port | Only accepts `SignalType.AUDIO` connections | Enforced by existing `areSignalTypesCompatible` |
| Audio node creation order | `fmGain` created after `super.createAudioNodes()` | `OscillatorNode` must exist before connecting `fmGain` to its frequency |
| Cleanup order | `fmGain` disconnected before `super.destroyAudioNodes()` | Prevents dangling AudioParam connections |
