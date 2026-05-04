# Data Model: LFO CV Adapter

**Feature**: 022-lfo-cv-adapter | **Date**: 2026-05-04

## Entities

### LFO (modified)

| Field | Type | Description |
|-------|------|-------------|
| `oscillator` | `OscillatorNode \| null` | Unchanged — generates ±1 waveform |
| `gainNode` | `GainNode \| null` | Unchanged — depth scaler (gain = depth/100) |
| `connectionScalers` | `Map<string, GainNode>` | NEW — one GainNode per active outgoing CV connection |

**Connection scaler key format**: `"${targetComponentId}:${targetPortId}"`
(e.g. `"lesson-13-filter:cutoff_cv"`)

**Scaler gain formula**: `(depth / 100) × (paramMax − paramMin) / 2`

**Lifecycle**:
- Created in `connectTo()` override when source port is `output` (CV) and target exposes an AudioParam
- Destroyed in `disconnectFrom()` override — `scaler.disconnect()` then removed from map
- All scalers updated (5 ms ramp) in `updateAudioParameter('depth', value)`
- All scalers destroyed in `destroyAudioNodes()` before clearing `gainNode`

---

### Filter (modified)

| Field | Type | Description |
|-------|------|-------------|
| `inputGain` | `GainNode \| null` | Unchanged |
| `filterNode` | `BiquadFilterNode \| null` | Unchanged |
| `outputGain` | `GainNode \| null` | Unchanged |
| `cvAmountGainNode` | `GainNode \| null` | NEW — replaces `cutoffCvScaler`; gain = cvAmount/100 × paramRange |
| ~~`cutoffCvScaler`~~ | ~~`GainNode \| null`~~ | REMOVED |

**New parameter**:

| ID | Name | Default | Min | Max | Step | Unit |
|----|------|---------|-----|-----|------|------|
| `cvAmount` | CV Amount | `50` | `0` | `100` | `1` | `%` |

**CV routing on Filter**:
- LFO connections: `filterNode.frequency` (AudioParam) — via `getAudioParamForInput('cutoff_cv')`. LFO's per-connection scaler has already scaled the signal to Hz range; cvAmountGainNode is bypassed.
- ADSR / other CV sources: `cvAmountGainNode` (AudioNode) — via `getInputNodeByPort('cutoff_cv')`. The gain node scales 0..1 signal to Hz range proportional to CV Amount.

**cvAmountGainNode gain formula**: `(cvAmount / 100) × (paramMax − paramMin)`
- At 50% CV Amount, gain = `0.5 × 20000 = 10000` — full ADSR (0..1) sweeps 0–10000 Hz above base cutoff
- At 0% CV Amount, gain = 0 — ADSR has no effect (FR-005 scenario 2)
- At 100% CV Amount, gain = 20000 — full ADSR sweeps 0–20000 Hz above base cutoff (FR-005 scenario 3)

**cvAmountGainNode update**: triggered by `updateAudioParameter('cvAmount', value)` — uses `setValueAtTime` (not ramp, since this is a user knob drag, not a modulation signal).

---

### SynthComponent (modified)

**New protected method** added to base class:

```typescript
protected getParameterRangeForInput(portId: string): { min: number; max: number } | null
```

Default implementation returns `null`. Subclasses override to expose CV input parameter ranges for use by the LFO adapter.

**Example override in Filter**:
```typescript
protected override getParameterRangeForInput(portId: string) {
  if (portId === 'cutoff_cv') return { min: AUDIO.MIN_FREQUENCY, max: AUDIO.MAX_FREQUENCY };
  if (portId === 'resonance_cv') return { min: AUDIO.MIN_Q, max: AUDIO.MAX_Q };
  return null;
}
```

**Example override in VCA**:
```typescript
protected override getParameterRangeForInput(portId: string) {
  if (portId === 'cv') return { min: AUDIO.MIN_GAIN, max: AUDIO.MAX_GAIN };
  return null;
}
```

**Example override in Oscillator** (for detune CV):
```typescript
protected override getParameterRangeForInput(portId: string) {
  if (portId === 'detune') return { min: AUDIO.MIN_DETUNE, max: AUDIO.MAX_DETUNE };
  if (portId === 'frequency') return { min: AUDIO.MIN_FREQUENCY, max: AUDIO.MAX_FREQUENCY };
  return null;
}
```

---

## State Transitions

### LFO connection lifecycle

```
[idle]
  │ connectTo() called, target has AudioParam for portId
  ▼
[scaler created]
  │ gainNode.connect(scaler) + scaler.connect(param)
  │ connectionScalers.set(key, scaler)
  ▼
[active — modulating target]
  │ updateAudioParameter('depth') → ramp all scalers
  │ (target receives correctly scaled CV signal)
  │
  │ disconnectFrom() called
  ▼
[scaler destroyed]
  │ scaler.disconnect()
  │ connectionScalers.delete(key)
  ▼
[idle]
```

### Filter CV Amount update

```
User moves cvAmount knob
  → setParameterValue('cvAmount', value)
  → updateAudioParameter('cvAmount', value)
  → cvAmountGainNode.gain.setValueAtTime(value/100 × paramRange, now)
```

---

## Serialisation

### PatchData (unchanged)

No changes to `PatchData`, `ComponentData`, or `ConnectionData` types. The `cvAmount` parameter serialises as a regular parameter value under `ComponentData.parameters['cvAmount']`.

### Backward compatibility

Existing patches without `cvAmount` in the Filter's parameters will deserialise with the default value `50` (set in the `Parameter` constructor). The `PatchSerializer` ignores unknown parameter keys and uses defaults for missing ones.

### LFO connection state

Per-connection GainNodes are **not serialised** — they are ephemeral audio graph nodes fully reconstructible from:
1. The saved connection list in `PatchData.connections`
2. The LFO's current `depth` parameter value
3. The target component's parameter range (read at connect time)

On patch load, `PatchManager` replays all connections, which triggers `LFO.connectTo()` for each LFO connection, reconstructing all scalers automatically.
