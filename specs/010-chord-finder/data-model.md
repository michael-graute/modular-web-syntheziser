# Data Model: Chord Finder Utility

**Phase**: 1 — Design & Contracts  
**Date**: 2026-04-10  
**Branch**: `010-chord-finder`

---

## Entities

### ChordFinderConfig

Runtime configuration held by the `ChordFinder` component instance.

| Field | Type | Range / Values | Description |
|---|---|---|---|
| `rootNote` | `Note` (enum) | C, C#, D, D#, E, F, F#, G, G#, A, A#, B | Selected root note of the key |
| `scaleType` | `ChordScaleType` (enum) | MAJOR, NATURAL_MINOR | Selected scale / mode |
| `octave` | `number` | 2–6 (integer) | Octave transposition for CV output; C4 = 4 |
| `progression` | `number[]` | Array of scale degrees 0–6, length 4–8 | Currently active progression (empty = none generated) |

**Validation rules**:
- `rootNote` must be a member of the `Note` enum
- `scaleType` must be MAJOR or NATURAL_MINOR
- `octave` must be an integer in [2, 6]
- `progression` elements must be integers in [0, 6]; length must be 0 or in [4, 8]

---

### DiatonicChord

Derived (not stored) — computed from `ChordFinderConfig` whenever key or scale changes.

| Field | Type | Description |
|---|---|---|
| `scaleDegree` | `number` (0–6) | Index within the diatonic scale (0 = tonic) |
| `romanNumeral` | `string` | Display label: I, ii, iii, IV, V, vi, vii° |
| `quality` | `ChordQuality` (enum) | MAJOR, MINOR, DIMINISHED |
| `name` | `string` | Display name, e.g. "Am", "Bdim", "C" |
| `notes` | `[number, number, number]` | MIDI note numbers for [root, third, fifth] |
| `cvVoltages` | `[number, number, number]` | 1V/octave CV values for [root, third, fifth] at octave 4 |

**Derivation rules**:
- Root note MIDI = `C4 (60) + NOTE_TO_OFFSET[rootNote] + interval[scaleDegree]`
- Third: root + (quality === MAJOR ? 4 : 3) semitones
- Fifth: root + (quality === DIMINISHED ? 6 : 7) semitones
- CV voltages at octave 4: `(midiNote - 60) / 12`
- CV with octave offset: `cvVoltages[i] + (octave - 4)`

---

### ChordFinderState

Full runtime state, combining config + derived chords + UI state.

| Field | Type | Description |
|---|---|---|
| `config` | `ChordFinderConfig` | Current configuration |
| `diatonicChords` | `DiatonicChord[]` | 7 chords computed from config (index 0–6) |
| `pressedDegree` | `number \| null` | Scale degree currently pressed (gate active), or null |
| `isAnyPressed` | `boolean` | Convenience flag: gate is currently open |

---

### Serialized Form (ComponentData.parameters)

Stored as `Record<string, number>` within the standard `ComponentData` envelope.

| Parameter Key | Type | Encoding |
|---|---|---|
| `rootNote` | `number` | 0–11 (index into NOTE_TO_OFFSET, C=0 … B=11) |
| `scaleType` | `number` | 0 = MAJOR, 1 = NATURAL_MINOR |
| `octave` | `number` | 2–6 |
| `progression` | `number` | 7-bit integer bitmask; bit N set → scale degree N is in the progression |

**Bitmask encoding example**: progression [0, 3, 4, 5] → `0b0111001` = 57

**Restore procedure**:
1. Read `rootNote` index → map to `Note` enum
2. Read `scaleType` index → map to `ChordScaleType`
3. Read `octave` directly
4. Decode `progression` bitmask → array of set bit indices in ascending order

---

## Enumerations

### ChordScaleType

Subset of `ScaleType` supported by Chord Finder at launch.

```typescript
enum ChordScaleType {
  MAJOR = 'major',
  NATURAL_MINOR = 'natural_minor',
}
```

Maps to existing `ScaleType.MAJOR` and `ScaleType.NATURAL_MINOR` from `src/music/ScaleTypes.ts`.

---

### ChordQuality

```typescript
enum ChordQuality {
  MAJOR = 'major',
  MINOR = 'minor',
  DIMINISHED = 'diminished',
}
```

**Derivation from scale degree**:

| Scale Degree | Major Key Quality | Natural Minor Key Quality |
|---|---|---|
| 0 (I / i) | MAJOR | MINOR |
| 1 (ii / ii°) | MINOR | DIMINISHED |
| 2 (iii / III) | MINOR | MAJOR |
| 3 (IV / iv) | MAJOR | MINOR |
| 4 (V / V) | MAJOR | MAJOR |
| 5 (vi / VI) | MINOR | MAJOR |
| 6 (vii° / VII) | DIMINISHED | MAJOR |

---

## State Transitions

```
[No Key Selected]
       │
       ▼ selectKey(rootNote, scaleType)
[Key Selected, No Progression]
       │                    │
       │ generateProgression()   │ clickChord(degree)
       ▼                    ▼
[Key + Progression Active]  [Gate On]
       │                    │
       │ changeKey()         │ releaseChord()
       ▼                    ▼
[Key Selected, No Progression] [Gate Off]
```

**Rules**:
- Changing key always clears the current progression (FR-011)
- Gate can be active simultaneously with any progression state
- Only one chord gate can be active at a time (monophonic gate)

---

## Audio Node Layout

```
ChordFinder (SynthComponent)
├── note1Output: ConstantSourceNode  → output port 'note1' (CV, SignalType.CV)
├── note2Output: ConstantSourceNode  → output port 'note2' (CV, SignalType.CV)
├── note3Output: ConstantSourceNode  → output port 'note3' (CV, SignalType.CV)
└── gateOutput:  ConstantSourceNode  → output port 'gate'  (SignalType.GATE)
```

On chord press:
- `note1Output.offset.setValueAtTime(cv[0] + octaveOffset, audioContext.currentTime)`
- `note2Output.offset.setValueAtTime(cv[1] + octaveOffset, audioContext.currentTime)`
- `note3Output.offset.setValueAtTime(cv[2] + octaveOffset, audioContext.currentTime)`
- `gateOutput.offset.setValueAtTime(1.0, audioContext.currentTime)`
- Call `triggerGateOn()` on all registered gate targets

On chord release:
- `gateOutput.offset.setValueAtTime(0.0, audioContext.currentTime)`
- Call `triggerGateOff()` on all registered gate targets

CV voltage formula: `(midiNote - 60) / 12 + (octave - 4)`
