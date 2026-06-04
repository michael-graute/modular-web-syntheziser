# Data Model: ChordFinder Poly CV Output

**Feature**: 033-chordfinder-poly-cv
**Date**: 2026-06-04

## Entities

### VoiceSlot (reused from 032-polyphony, no new fields)

Source of truth: `src/components/utilities/VoiceAllocator.ts`

| Field | Type | ChordFinder usage |
|---|---|---|
| `voiceIndex` | `0 \| 1 \| 2 \| 3` | Fixed: 0=root, 1=third, 2=fifth, 3=inactive |
| `frequency` | `number` (Hz) | Set on press via midiToHz; retained on release (MUST NOT reset) |
| `gate` | `0 \| 1` | 1 on chord press, 0 on chord release |
| `note` | `number \| null` | Always `null` (not used by ChordFinder) |
| `timestamp` | `number` | Always `0` (not used by ChordFinder) |

### ChordFinder (modified)

New internal state added to existing class:

| Field | Type | Description |
|---|---|---|
| `polySlots` | `VoiceSlot[]` (length 4) | Pre-allocated, persistent across chords |

No new serialised fields. No new parameters.

## Slot Index Mapping

| Slot index | Chord note | Notes |
|---|---|---|
| 0 | Root (chord.notes[0]) | Always active when chord pressed |
| 1 | Third (chord.notes[1]) | Always active when chord pressed |
| 2 | Fifth (chord.notes[2]) | Always active when chord pressed |
| 3 | (inactive) | `gate: 0`, `frequency: 0` permanently |

## State Transitions

```
Initial state: all 4 slots gate=0, frequency=0

pressChord(degree):
  → slot[0].frequency = midiToHz(chord.notes[0] + octaveShift)
  → slot[0].gate = 1
  → slot[1].frequency = midiToHz(chord.notes[1] + octaveShift)
  → slot[1].gate = 1
  → slot[2].frequency = midiToHz(chord.notes[2] + octaveShift)
  → slot[2].gate = 1
  → slot[3] unchanged (gate=0, frequency=0)

releaseChord():
  → slot[0].gate = 0  (frequency retained)
  → slot[1].gate = 0  (frequency retained)
  → slot[2].gate = 0  (frequency retained)
  → slot[3] unchanged

selectKey() / setOctave() while chord held:
  → pressChord(pressedDegree) called again with updated values
  → slot frequencies update immediately
```

## Validation Rules

- `polySlots` length is always exactly 4 (invariant, never changes)
- `polySlots[3].gate` is always `0` (slot 3 is permanently inactive)
- `polySlots[3].frequency` is always `0`
- `polySlots[i].voiceIndex === i` for all i (identity invariant)
- Frequencies in slots 0–2 are always ≥ 0; they retain their last pressed value when gate=0
- `note` and `timestamp` fields are always `null` / `0` — ChordFinder does not use voice stealing

## Serialization Impact

None. The `polySlots` array is runtime state only. The `poly-cv` port is registered in the constructor and does not require any new serialised parameter. Existing `serialize()` / `deserialize()` methods in ChordFinder are unchanged.
