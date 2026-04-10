# Quickstart: Chord Finder Utility

**Feature**: 010-chord-finder  
**Branch**: `010-chord-finder`  
**Date**: 2026-04-10

---

## What This Feature Does

The Chord Finder is a synthesizer utility module that:
1. Displays all 7 diatonic chords for a selected musical key in a circular layout
2. Generates musically coherent chord progressions at the click of a button
3. Emits CV (1V/octave) and gate signals when a chord node is clicked, enabling connection to oscillators and envelopes

---

## Key Files to Create

| File | Purpose |
|---|---|
| `src/components/utilities/ChordFinder.ts` | Main SynthComponent — audio nodes, port management, state, serialization |
| `src/music/ChordTheory.ts` | Pure functions: diatonic chord derivation, chord naming, progression generation |
| `src/canvas/displays/ChordFinderDisplay.ts` | Canvas display — chord circle rendering, hit detection, press animation |
| `specs/010-chord-finder/contracts/types.ts` | Type contracts (already created) |
| `specs/010-chord-finder/contracts/validation.ts` | Validation + encode/decode helpers (already created) |

| File | Purpose (modify existing) |
|---|---|
| `src/core/types.ts` | Add `CHORD_FINDER = 'chord-finder'` to `ComponentType` enum |
| `src/canvas/CanvasComponent.ts` | Add `chordFinderDisplay` field; wire up in component factory |
| `src/components/ComponentRegistry.ts` | Register `ChordFinder` factory function |
| `src/components/registerComponents.ts` | Call registration |

---

## Architecture Overview

```
User clicks chord node
        │
        ▼
ChordFinderDisplay (canvas hit detection)
        │ pressChord(scaleDegree)
        ▼
ChordFinder.ts (SynthComponent)
        ├─ note1Output.offset → CV port 'note1' → Oscillator freq input
        ├─ note2Output.offset → CV port 'note2' → Oscillator freq input
        ├─ note3Output.offset → CV port 'note3' → Oscillator freq input
        └─ gateOutput.offset  → Gate port 'gate' → ADSR trigger
```

---

## ChordFinder Ports

| Port ID | Direction | Signal Type | Description |
|---|---|---|---|
| `note1` | Output | CV | Root note of chord (1V/oct) |
| `note2` | Output | CV | Third of chord (1V/oct) |
| `note3` | Output | CV | Fifth of chord (1V/oct) |
| `gate` | Output | GATE | Gate signal (0.0 off / 1.0 on) |

---

## ChordFinder Parameters

| Parameter ID | Range | Default | Description |
|---|---|---|---|
| `rootNote` | 0–11 | 0 (C) | Root note index |
| `scaleType` | 0–1 | 0 (Major) | 0=Major, 1=Natural Minor |
| `octave` | 2–6 | 4 | CV output octave (C4 = 0V ref) |
| `progression` | 0–127 | 0 | Progression bitmask (0 = none) |

---

## ChordTheory Module (Pure Functions)

```typescript
// Get the 7 diatonic chords for a key
getDiatonicChords(rootNote: Note, scaleType: ChordScaleType): DiatonicChord[]

// Generate a musically coherent progression
generateProgression(chords: DiatonicChord[]): number[]   // returns scale degree indices

// Get chord name string (e.g. "Am", "Bdim", "C")
getChordName(rootNote: Note, quality: ChordQuality): string

// Get roman numeral label (e.g. "I", "ii", "vii°")
getRomanNumeral(scaleDegree: number, quality: ChordQuality): string
```

---

## ChordFinderDisplay Responsibilities

- Render 7 chord nodes as arcs in a circle (clockwise, I at top)
- Center label shows root note + scale abbreviation (e.g. "C maj")
- Three visual states per node:
  - **Default**: neutral color (e.g. dark grey)
  - **In progression**: highlight color (e.g. accent blue/teal)
  - **Pressed**: active press color (e.g. bright white/yellow)
- `mousedown` → call `onChordPress(scaleDegree)`
- `mouseup` / `mouseleave` → call `onChordRelease()`
- DPR-aware canvas sizing (same as `ColliderDisplay`)
- Subscribe to `visualUpdateScheduler` for animated press feedback

---

## Progression Generation Rules

1. Start on degree 0 (tonic)
2. Pick next chord using weighted transitions:
   - Strong: I→IV, I→V, IV→V, V→I, ii→V, vi→IV, vi→ii
   - Diminished (degree 6): weight = 0.2× vs. others
3. Progression length: random integer in [4, 8]
4. End: prefer degree 0 (tonic) or a V→I cadence

---

## Testing Strategy

| Test File | What to Test |
|---|---|
| `tests/unit/music/ChordTheory.test.ts` | Diatonic chord derivation for C Major and A Minor; chord naming; roman numerals |
| `tests/unit/music/ProgressionGenerator.test.ts` | Progression contains only valid degrees; vii° frequency < 30%; length in [4,8]; consecutive runs differ |
| `tests/unit/components/ChordFinder.test.ts` | Port creation; CV value correctness after pressChord(); gate on/off; serialize/deserialize round-trip |
| `tests/persistence/ChordFinder.persistence.test.ts` | Save patch → reload → config matches; bitmask encode/decode |

---

## CV Voltage Quick Reference

Formula: `CV = (midiNote - 60) / 12 + (octave - 4)`

| Note | MIDI (oct 4) | CV (oct 4) |
|---|---|---|
| C | 60 | 0.000 |
| E | 64 | 0.333 |
| G | 67 | 0.583 |
| A | 69 | 0.750 |

Example — C Major chord, octave 4: note1=0.000V, note2=0.333V, note3=0.583V  
Example — C Major chord, octave 5: note1=1.000V, note2=1.333V, note3=1.583V
