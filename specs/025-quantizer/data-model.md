# Data Model: Quantizer

**Branch**: `025-quantizer` | **Date**: 2026-05-30

## Entities

### QuantizerScaleType (enum)

Extends the existing scale vocabulary with Pentatonic and Chromatic types needed by the Quantizer.

| Value | String key | Semitone intervals |
|-------|-----------|-------------------|
| MAJOR | `'major'` | [0, 2, 4, 5, 7, 9, 11] |
| NATURAL_MINOR | `'natural-minor'` | [0, 2, 3, 5, 7, 8, 10] |
| HARMONIC_MINOR | `'harmonic-minor'` | [0, 2, 3, 5, 7, 8, 11] |
| LYDIAN | `'lydian'` | [0, 2, 4, 6, 7, 9, 11] |
| MIXOLYDIAN | `'mixolydian'` | [0, 2, 4, 5, 7, 9, 10] |
| PENTATONIC_MAJOR | `'pentatonic-major'` | [0, 2, 4, 7, 9] |
| PENTATONIC_MINOR | `'pentatonic-minor'` | [0, 3, 5, 7, 10] |
| CHROMATIC | `'chromatic'` | [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] |

---

### QuantizerNote (type alias / enum)

12 chromatic root notes. Mirrors existing `Note` enum from 006 contracts — redeclared here to keep the Quantizer self-contained.

```
C | C# | D | D# | E | F | F# | G | G# | A | A# | B
```

---

### QuantizerConfig

Runtime configuration stored as component parameters (serialized as numeric indices for patch persistence).

| Field | Type | Range / Values | Default | Serialized as |
|-------|------|----------------|---------|---------------|
| `rootNote` | `QuantizerNote` | C … B | `'C'` | numeric 0–11 |
| `scaleType` | `QuantizerScaleType` | 8 scale types | `'major'` | numeric 0–7 |

---

### QuantizerState (runtime, not persisted)

Internal state maintained between control-rate ticks.

| Field | Type | Description |
|-------|------|-------------|
| `pitchTable` | `readonly number[]` | Sorted array of all valid MIDI note numbers for active scale × C0–C8 range. Rebuilt when root or scale changes. |
| `heldCv` | `number` | Last quantized CV output value. Held between trigger pulses when trigger mode is active. |
| `lastGateValue` | `number` | Previous gate signal value (0.0–1.0). Used for rising-edge detection. |
| `currentNoteLabel` | `string` | Human-readable note name for display (e.g. `'A4'`). Updated each control-rate tick. |
| `triggerConnected` | `boolean` | True when a gate/trigger input is wired. Determines continuous vs. trigger-gated mode. |

---

### Ports

| Port ID | Direction | Signal type | Description |
|---------|-----------|------------|-------------|
| `cv-in` | Input | CV (green) | Continuously varying pitch CV (1V/octave, C4 = 0V) |
| `trigger-in` | Input | Gate (red) | Optional gate/trigger — rising edge locks pitch update |
| `cv-out` | Output | CV (green) | Quantized pitch CV (1V/octave) |

---

### Pitch Table Construction

The pitch table is rebuilt whenever `rootNote` or `scaleType` changes:

```
MIDI range: 0 (C-1) to 108 (C8) — clamped output range C0 (MIDI 12) to C8 (MIDI 108)
For each octave O from 0 to 8:
  rootMidi = NOTE_TO_SEMITONE[rootNote] + (O + 4) × 12  // C4 = MIDI 60
  For each interval I in SCALE_INTERVALS[scaleType]:
    midi = rootMidi + I
    if midi >= 12 and midi <= 108: append to table
Sort table, deduplicate, freeze.
```

The table is a pre-sorted `readonly number[]` of MIDI note numbers. At quantization time, find the index of the nearest entry using linear scan (table ≤ 96 entries).

---

### CV Conventions (1V/octave)

Consistent with the rest of the project:

```
CV = (MIDI - 60) / 12
MIDI = 60 + CV × 12

C4 → MIDI 60 → CV 0.0
A4 → MIDI 69 → CV 0.75
C5 → MIDI 72 → CV 1.0
C0 → MIDI 12 → CV -4.0   (clamp lower bound)
C8 → MIDI 108 → CV 4.0   (clamp upper bound)
```

---

### Serialization Format

Parameters stored in `ComponentData.parameters` (all numeric):

```json
{
  "rootNote": 0,
  "scaleType": 0
}
```

- `rootNote`: 0–11 (C=0 … B=11)
- `scaleType`: 0–7 (index into QuantizerScaleType values)

Note label and trigger state are runtime-only and are NOT serialized.

---

### State Transitions

```
INIT → pitchTable built from default config (C Major)
       heldCv = 0.0 (C4)
       currentNoteLabel = 'C4'

CONFIG_CHANGE (root or scale) → rebuild pitchTable
                               → re-quantize heldCv immediately (trigger-free mode)
                               → update currentNoteLabel

CONTROL_RATE_TICK (trigger-free mode):
  inputCv = read cvInputNode.offset.value
  quantizedMidi = nearestInTable(cvToMidi(inputCv))
  heldCv = midiToCv(quantizedMidi)
  currentNoteLabel = midiToNoteName(quantizedMidi)

CONTROL_RATE_TICK (trigger mode, no rising edge):
  read gateValue, no pitch change
  output remains heldCv

CONTROL_RATE_TICK (trigger mode, rising edge detected):
  inputCv = read cvInputNode.offset.value
  quantizedMidi = nearestInTable(cvToMidi(inputCv))
  heldCv = midiToCv(quantizedMidi)
  currentNoteLabel = midiToNoteName(quantizedMidi)

CV_OUT_OF_RANGE:
  if inputCv < -4.0 → clamp to MIDI 12 (C0)
  if inputCv > 4.0  → clamp to MIDI 108 (C8)
```
