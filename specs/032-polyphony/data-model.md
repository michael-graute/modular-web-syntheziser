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
| `voiceOutputs` | `GainNode[4]` | Per-voice gate GainNode (gain 0→1); wired into PolyVCA by ConnectionManager |
| `polyAudioOut` | `GainNode` | Dummy node registered as the `poly-audio` port's AudioNode |
| `voiceSlotsGetter` | `(() => Readonly<VoiceSlot[]>) \| null` | Registered by ConnectionManager on connect |
| `rafHandle` | `number \| null` | requestAnimationFrame ID for polling loop |

**Parameters**:
| Param ID | Default | Min | Max | Step | Unit |
|----------|---------|-----|-----|------|------|
| `waveform` | 0 (sine) | 0 | 3 | 1 | — |

**Ports**:
| Port | Direction | Signal Type | Description |
|------|-----------|-------------|-------------|
| `poly-cv` | Input | `POLY_CV` | Voice slot data from Keyboard |
| `poly-audio` | Output | `POLY_AUDIO` | Bundled 4-voice audio; ConnectionManager wires all 4 `voiceOutputs` into PolyVCA |

**Polling loop** (RAF): On each frame, read `voiceSlotsGetter()`. For each slot i:
- Set `oscillators[i].frequency.value = slot.frequency` (if changed).
- Set `voiceOutputs[i].gain.value = slot.gate` (hard switch; envelope shaping is PolyADSR's job).

---

### PolyADSR (SynthComponent)

4 independent ADSR envelope generators, each gated by its voice slot.

| Field | Type | Description |
|-------|------|-------------|
| `envGains` | `GainNode[4]` | Envelope-shaped gain for each voice |
| `constantSources` | `ConstantSourceNode[4]` | Constant 1.0 source per voice |
| `outputGains` | `GainNode[4]` | Per-voice envelope output; wired into PolyVCA gain AudioParams by ConnectionManager |
| `polyEnvOut` | `GainNode` | Dummy node registered as the `poly-env` port's AudioNode |
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
| Port | Direction | Signal Type | Description |
|------|-----------|-------------|-------------|
| `poly-cv` | Input | `POLY_CV` | Voice slot data from Keyboard |
| `poly-env` | Output | `POLY_ENV` | Bundled 4-voice envelopes; ConnectionManager wires all 4 `outputGains` into PolyVCA |

**Polling loop** (RAF): For each slot i, compare `slot.gate` vs `previousGates[i]`:
- 0→1 transition → call `triggerGateOn(i)` (A-D-S phase on `envGains[i].gain`).
- 1→0 transition → call `triggerGateOff(i)` (R phase on `envGains[i].gain`).

---

### PolyVCA (SynthComponent)

4 independent gain stages controlled by PolyADSR envelopes, summing to a mono AUDIO output.

| Field | Type | Description |
|-------|------|-------------|
| `voiceInputs` | `GainNode[4]` | Audio input per voice; wired by `connectPolyAudio()` when poly-audio cable is connected |
| `voiceGains` | `GainNode[4]` | CV-controlled gain per voice; wired by `connectPolyEnv()` when poly-env cable is connected |
| `sumGain` | `GainNode` | Final summing node (gain = 0.25 to prevent clipping) |

**Parameters**: None (gain is entirely driven by the connected PolyADSR).

**Ports**:
| Port | Direction | Signal Type | Description |
|------|-----------|-------------|-------------|
| `poly-audio` | Input | `POLY_AUDIO` | Bundled 4-voice audio from PolyOscillator |
| `poly-env` | Input | `POLY_ENV` | Bundled 4-voice envelopes from PolyADSR |
| `output` | Output | `AUDIO` | Mixed mono audio; connects to any standard downstream module |

**Audio graph per voice i** (wired internally by ConnectionManager):
```
PolyOscillator voiceOutputs[i] ──▶ voiceInputs[i] ──▶ voiceGains[i] ──▶ sumGain (×0.25) ──▶ output
                                                              ▲
                               PolyADSR outputGains[i] ───────┘ (via AudioParam)
```

**Connection API**:
- `connectPolyAudio(voiceOutputs: GainNode[])` — wires 4 source GainNodes into `voiceInputs`
- `disconnectPolyAudio(voiceOutputs: GainNode[])` — unwires them
- `connectPolyEnv(outputGains: GainNode[])` — wires 4 envelope GainNodes into `voiceGains[i].gain`
- `disconnectPolyEnv(outputGains: GainNode[])` — unwires them

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
  AUDIO     = 'audio',
  CV        = 'cv',
  GATE      = 'gate',
  POLY_CV   = 'poly-cv',    // ← new: Keyboard → PolyOscillator / PolyADSR
  POLY_AUDIO = 'poly-audio', // ← new: PolyOscillator → PolyVCA (bundled voice audio)
  POLY_ENV  = 'poly-env',   // ← new: PolyADSR → PolyVCA (bundled voice envelopes)
}
```

Compatibility rules in `areSignalTypesCompatible` — each poly type is strictly self-compatible only:
- `POLY_CV → POLY_CV`: allowed.
- `POLY_AUDIO → POLY_AUDIO`: allowed.
- `POLY_ENV → POLY_ENV`: allowed.
- Any poly type → any different type: rejected.
- Any non-poly type → any poly type: rejected.

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
| `SignalType` | 3 new values: `poly-cv`, `poly-audio`, `poly-env` | Yes — old patches never emit these |
| `ComponentType` | 3 new enum values | Yes — old patches never contain these types |
| `ComponentData.parameters` | `polyMode` key on Keyboard | Yes — missing key → default 0 (mono) |
| `Connection.signalType` | `poly-cv`, `poly-audio`, `poly-env` values possible | Yes — new patches only |
| `PatchData` | No new top-level fields | Fully backward compatible |

---

## CanvasComponent Layout

New entries required in `componentLayout.ts` for port counts and control layout:

| ComponentType | Inputs | Outputs | Controls |
|---------------|--------|---------|----------|
| `POLY_OSCILLATOR` | 1 (poly-cv) | 1 (poly-audio) | 1 Dropdown (waveform) |
| `POLY_ADSR` | 1 (poly-cv) | 1 (poly-env) | 4 Sliders (A/D/S/R) |
| `POLY_VCA` | 2 (poly-audio, poly-env) | 1 (audio) | None |
| `KEYBOARD_INPUT` | 0 | 4 (freq, gate, velocity, poly-cv) | 1 Button (polyMode) |

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
