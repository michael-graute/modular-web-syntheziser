# Data Model: Envelope Follower

**Branch**: `030-envelope-follower` | **Date**: 2026-06-03

---

## Entities

### EnvelopeFollower (SynthComponent subclass)

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique component ID (inherited) |
| type | ComponentType.ENVELOPE_FOLLOWER | Constant enum value |
| position | Position | `{ x: number, y: number }` canvas world coords |
| inputs | Map<string, Port> | One port: `'input'` (SignalType.AUDIO) |
| outputs | Map<string, Port> | One port: `'cv'` (SignalType.CV) |
| parameters | Map<string, Parameter> | Three parameters: attack, release, gain |
| envelopeValue | number | Current tracked envelope (0–1), not persisted |

**Parameters**:

| Key | Display Name | Default | Min | Max | Step | Unit |
|-----|-------------|---------|-----|-----|------|------|
| attack | Attack | 10 | 1 | 500 | 1 | ms |
| release | Release | 100 | 5 | 2000 | 5 | ms |
| gain | Gain | 1.0 | 0.1 | 4.0 | 0.05 | × |

---

### Audio Nodes (runtime only, not persisted)

| Node | Type | Role |
|------|------|------|
| inputGain | GainNode | Receives patched audio input; gain fixed at 1.0 |
| analyser | AnalyserNode | fftSize=256, smoothingTimeConstant=0; reads RMS from inputGain |
| cvNode | ConstantSourceNode | Outputs current envelopeValue (0–1) as CV; .offset updated each frame |

**Audio graph**:
```
[Audio In] → inputGain → analyser
cvNode.offset = envelopeValue  →  [CV Out]
```

`inputGain` is disconnected from `cvNode` — the analyser reads the audio independently. The CV is synthesised from the computed envelope, not from the audio signal directly.

---

### EnvelopeFollowerDisplay (canvas display, runtime only)

| Field | Type | Description |
|-------|------|-------------|
| envelopeFollower | EnvelopeFollower \| null | Reference to component for reading envelopeValue |
| isFrozen | boolean | Stops rendering when true (component out of viewport) |
| baseX, baseY | number | World-coordinate top-left of display area |
| baseWidth, baseHeight | number | Display dimensions in canvas pixels |

---

### ComponentData (patch persistence shape)

Follows the project-standard `ComponentData` interface. Only `parameters` values are stored:

```typescript
{
  id: string,
  type: 'envelope-follower',
  position: { x: number, y: number },
  parameters: {
    attack: number,   // 1–500 ms
    release: number,  // 5–2000 ms
    gain: number,     // 0.1–4.0
  }
}
```

No new top-level `PatchData` fields required.

---

## State Transitions

### Envelope Value

```
envelopeValue state machine (per animation frame):

  rmsNow = computeRMS(analyserData)
  rmsNow = clamp(rmsNow * gainValue, 0, 1)

  if rmsNow >= envelopeValue:
    envelopeValue += attackCoeff * (rmsNow - envelopeValue)   // rising
  else:
    envelopeValue += releaseCoeff * (rmsNow - envelopeValue)  // falling

  cvNode.offset.value = envelopeValue
```

Coefficients derived from parameter values each frame:
```
dt = frame delta in seconds (~0.016)
attackCoeff  = 1 - exp(-dt / (attack_ms / 1000))
releaseCoeff = 1 - exp(-dt / (release_ms / 1000))
```

### Component Lifecycle

```
constructor()
  → addInput / addOutput / addParameter

createAudioNodes()
  → inputGain = createGain()
  → analyser = createAnalyser() [fftSize=256, smoothing=0]
  → inputGain.connect(analyser)
  → cvNode = createConstantSource()
  → cvNode.offset.value = 0
  → cvNode.start()
  → dataArray = new Float32Array(256)  [must equal fftSize; getFloatTimeDomainData fills fftSize samples]

getInputNode() → inputGain
getOutputNode() → cvNode

tick(dt) [called from EnvelopeFollowerDisplay.render()]
  → reads analyser data → computes RMS → applies IIR → updates cvNode.offset

dispose()
  → cvNode.stop()
  → audioNodes cleared (SynthComponent base handles)
```

---

## Validation Rules

- `attack`: integer, clamped to [1, 500]
- `release`: integer (multiple of 5), clamped to [5, 2000]
- `gain`: float, clamped to [0.1, 4.0], rounded to 2 decimal places
- `envelopeValue`: always clamped to [0.0, 1.0] before writing to `cvNode.offset`
- Patch deserialization: missing parameter values fall back to defaults (attack=10, release=100, gain=1.0)
