# Data Model: 4-Voice Polyphony

**Feature**: 032-polyphony
**Date**: 2026-06-03

## Core Entities

---

### VoiceSlot

Represents one of the 4 independent voice lanes tracked by the Keyboard's `VoiceAllocator`.

| Field | Type | Description |
|-------|------|-------------|
| `voiceIndex` | `0 \| 1 \| 2 \| 3` | Immutable lane index |
| `frequency` | `number` | Hz of the currently held note (default: 0) |
| `gate` | `0 \| 1` | 1 = note held, 0 = note released |
| `note` | `number \| null` | MIDI note number currently occupying this slot (null when idle) |
| `timestamp` | `number` | `performance.now()` of the last note-on; used for oldest-voice stealing |

**Invariants**:
- `voiceIndex` is always 0–3; the array is always length 4.
- When `gate === 0`, `frequency` may hold a stale value (not used by consumers).
- When `gate === 1`, `frequency` is always a positive Hz value.

**State transitions**:
```
Idle (gate=0, note=null)
  ──[noteOn(freq)]──▶  Active (gate=1, note=n, frequency=freq, timestamp=now)
Active
  ──[noteOff(note)]──▶  Idle (gate=0, note=null)
Active
  ──[noteOn(sameNote)]──▶  Active (gate=1, frequency=freq, timestamp=now)   // retrigger
Active (stolen)
  ──[noteOn(newNote, no idle slot)]──▶  Active (gate=1, note=newNote, frequency=newFreq, timestamp=now)
```

---

### VoiceAllocator

Embedded inside `KeyboardInput`. Not serialized; reconstructed from the parameter state on load.

| Method | Signature | Description |
|--------|-----------|-------------|
| `noteOn` | `(note: number, frequency: number): void` | Allocate/retrigger a voice |
| `noteOff` | `(note: number): void` | Release a voice |
| `releaseAll` | `(): void` | Zero all slots (used on mono→poly switch or keyboard destroy) |
| `getSlots` | `(): Readonly<VoiceSlot[]>` | Read-only snapshot of all 4 slots for poly consumer polling |

**Voice allocation algorithm** (noteOn):
1. If a slot already holds `note` → retrigger that slot (update frequency, timestamp, gate=1).
2. Else find first slot where `gate === 0` → assign to that slot.
3. Else (all 4 active) → steal the slot with the lowest `timestamp` (oldest-voice policy).

---

### PolyOscillator (SynthComponent)

4 independent `OscillatorNode` instances driven by voice slot frequencies.

| Field | Type | Description |
|-------|------|-------------|
| `oscillators` | `OscillatorNode[4]` | One per voice slot |
| `voiceGates` | `GainNode[4]` | Silence a voice when gate=0 (gain 0→1 transitions) |
| `outputMix` | `GainNode` | Sums all 4 voice gates; final audio output |
| `voiceSlotsGetter` | `(() => Readonly<VoiceSlot[]>) \| null` | Registered by ConnectionManager on connect |
| `rafHandle` | `number \| null` | requestAnimationFrame ID for polling loop |

**Parameters**:
| Param ID | Default | Min | Max | Step | Unit |
|----------|---------|-----|-----|------|------|
| `waveform` | 0 (sine) | 0 | 3 | 1 | — |

**Ports**:
| Port | Direction | Signal Type |
|------|-----------|-------------|
| `poly-cv` | Input | `POLY_CV` |
| `output` | Output | `AUDIO` |

**Polling loop** (RAF): On each frame, read `voiceSlotsGetter()`. For each slot i:
- Set `oscillators[i].frequency.value = slot.frequency` (if changed).
- Set `voiceGates[i].gain.value = slot.gate` (hard switch; envelope shaping is PolyADSR's job).

---

### PolyADSR (SynthComponent)

4 independent ADSR envelope generators, each gated by its voice slot.

| Field | Type | Description |
|-------|------|-------------|
| `envGains` | `GainNode[4]` | Envelope-shaped gain for each voice |
| `constantSources` | `ConstantSourceNode[4]` | Constant 1.0 source per voice |
| `outputGains` | `GainNode[4]` | Per-voice output (connects to PolyVCA CV inputs) |
| `previousGates` | `(0 \| 1)[4]` | Last polled gate value per slot (edge detection) |
| `voiceSlotsGetter` | `(() => Readonly<VoiceSlot[]>) \| null` | Registered by ConnectionManager |
| `rafHandle` | `number \| null` | RAF polling handle |

**Parameters** (shared across all 4 voices):
| Param ID | Default | Min | Max | Step | Unit |
|----------|---------|-----|-----|------|------|
| `attack` | 0.01 | 0.001 | 5.0 | 0.001 | s |
| `decay` | 0.1 | 0.001 | 5.0 | 0.001 | s |
| `sustain` | 0.7 | 0.0 | 1.0 | 0.01 | — |
| `release` | 0.3 | 0.001 | 5.0 | 0.001 | s |

**Ports**:
| Port | Direction | Signal Type |
|------|-----------|-------------|
| `poly-cv` | Input | `POLY_CV` |
| `env-0` | Output | `CV` |
| `env-1` | Output | `CV` |
| `env-2` | Output | `CV` |
| `env-3` | Output | `CV` |

**Polling loop** (RAF): For each slot i, compare `slot.gate` vs `previousGates[i]`:
- 0→1 transition → call `triggerGateOn(i)` (A-D-S phase on `envGains[i].gain`).
- 1→0 transition → call `triggerGateOff(i)` (R phase on `envGains[i].gain`).

---

### PolyVCA (SynthComponent)

4 independent gain stages controlled by PolyADSR envelopes, summing to a mono AUDIO output.

| Field | Type | Description |
|-------|------|-------------|
| `voiceInputs` | `GainNode[4]` | Audio input per voice (receives PolyOscillator voice audio) |
| `voiceGains` | `GainNode[4]` | CV-controlled gain per voice (driven by PolyADSR env-N outputs) |
| `sumGain` | `GainNode` | Final summing node (gain = 0.25 to prevent clipping) |

**Parameters**: None (gain is entirely CV-driven).

**Ports**:
| Port | Direction | Signal Type |
|------|-----------|-------------|
| `audio-0` | Input | `AUDIO` |
| `audio-1` | Input | `AUDIO` |
| `audio-2` | Input | `AUDIO` |
| `audio-3` | Input | `AUDIO` |
| `cv-0` | Input | `CV` |
| `cv-1` | Input | `CV` |
| `cv-2` | Input | `CV` |
| `cv-3` | Input | `CV` |
| `output` | Output | `AUDIO` |

**Audio graph per voice i**:
```
PolyOscillator voice[i] output ──▶ voiceInputs[i] ──▶ voiceGains[i] ──▶ sumGain ──▶ output
                                                            ▲
                                    PolyADSR env-i ─────────┘ (via AudioParam)
```

---

### Keyboard (KeyboardInput) — Modified

**New fields**:
| Field | Type | Description |
|-------|------|-------------|
| `voiceAllocator` | `VoiceAllocator` | Manages the 4-voice slot array |
| `polyConsumers` | `Set<() => void>` | Registered RAF loops of connected poly consumers (not needed; consumers poll via getter) |

**New parameter**:
| Param ID | Default | Min | Max | Step | Description |
|----------|---------|-----|-----|------|-------------|
| `polyMode` | 0 | 0 | 1 | 1 | 0=mono, 1=poly |

**New port** (always present, carries zeros in mono mode):
| Port | Direction | Signal Type | Description |
|------|-----------|-------------|-------------|
| `poly-cv` | Output | `POLY_CV` | Bundled 4-voice slot data (polled by getter) |

**Mode switch behaviour**:
- Switching mono→poly: `releaseAll()` on old mono state, reset `voiceAllocator`.
- Switching poly→mono: `voiceAllocator.releaseAll()`, restore mono `frequencyNode` / `gateNode` signals.

---

## Signal Type Extension

`SignalType` enum in `src/core/types.ts` gains one new member:

```typescript
export enum SignalType {
  AUDIO = 'audio',
  CV    = 'cv',
  GATE  = 'gate',
  POLY_CV = 'poly-cv',   // ← new
}
```

Compatibility rules in `areSignalTypesCompatible`:
- `POLY_CV → POLY_CV`: allowed.
- `POLY_CV → anything else`: rejected.
- `anything else → POLY_CV`: rejected.

---

## ComponentType Extension

`ComponentType` enum gains 3 new members:

```typescript
POLY_OSCILLATOR = 'poly-oscillator',
POLY_ADSR       = 'poly-adsr',
POLY_VCA        = 'poly-vca',
```

---

## Patch Serialization Impact

| Entity | Change | Backward compatible? |
|--------|--------|----------------------|
| `SignalType` | New enum value `poly-cv` | Yes — old patches never emit this value |
| `ComponentType` | 3 new enum values | Yes — old patches never contain these types |
| `ComponentData.parameters` | `polyMode` key on Keyboard | Yes — missing key → default 0 (mono) |
| `Connection.signalType` | `poly-cv` value possible | Yes — new patches only |
| `PatchData` | No new top-level fields | Fully backward compatible |

---

## CanvasComponent Layout

New entries required in `componentLayout.ts` for port counts and control layout:

| ComponentType | Inputs | Outputs | Controls |
|---------------|--------|---------|----------|
| `POLY_OSCILLATOR` | 1 (poly-cv) | 1 (audio) | 1 Dropdown (waveform) |
| `POLY_ADSR` | 1 (poly-cv) | 4 (env-0..3) | 4 Sliders (A/D/S/R) |
| `POLY_VCA` | 9 (audio-0..3, cv-0..3, output) | 1 (audio) | None |
| `KEYBOARD_INPUT` | 0 | 4 (freq, gate, velocity, poly-cv) | 1 Button (polyMode) |

> Note: PolyVCA input count is 8 (4 audio + 4 cv), output count is 1.

---

## State Transitions: Keyboard Mode Toggle

```
Mono Mode (polyMode=0)
  Outputs: frequency (CV), gate (GATE), velocity (CV) — active
  poly-cv port: present but carries zero-gate slots
  
  ──[toggle to poly]──▶
  
Poly Mode (polyMode=1)
  Outputs: frequency (CV) — frozen at last value (backward compat)
            gate (GATE) — always 0
            velocity (CV) — always 0
            poly-cv: carries live VoiceSlot[4]
```

The frozen mono outputs in poly mode mean a user cannot accidentally mix mono→poly signals — the gate stays 0, so any connected mono ADSR stays silent.
