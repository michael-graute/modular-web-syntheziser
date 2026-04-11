# Research: Chord Finder Utility

**Phase**: 0 — Outline & Research  
**Date**: 2026-04-10  
**Branch**: `010-chord-finder`

---

## Decision 1: Component Base Class

**Decision**: Extend `SynthComponent` (same as `Collider`, `StepSequencer`, `KeyboardInput`)  
**Rationale**: All utility components follow this pattern. It provides port management, parameter management, serialize/deserialize, and audio node lifecycle hooks out of the box.  
**Alternatives considered**: Standalone class — rejected; would duplicate all infrastructure and not integrate with patch serialization or the connection system.

---

## Decision 2: ComponentType Registration

**Decision**: Add `CHORD_FINDER = 'chord-finder'` to the `ComponentType` enum in `src/core/types.ts` and register a factory in `src/components/ComponentRegistry.ts` and `src/components/registerComponents.ts`.  
**Rationale**: All existing components follow this pattern. Without registration the component cannot be instantiated from a saved patch.  
**Alternatives considered**: Dynamic component type — rejected; TypeScript enum provides type safety and prevents typos.

---

## Decision 3: CV Output Architecture

**Decision**: Three `ConstantSourceNode` outputs — one per note of a triad (root, third, fifth) — plus one shared gate `ConstantSourceNode`. Port IDs: `note1`, `note2`, `note3`, `gate`.  
**Rationale**: Matches `StepSequencer` and `Collider` patterns. `ConstantSourceNode.offset` is set via `setValueAtTime` for each CV value. 1V/octave: `CV = (MIDI - 60) / 12`. Gate: 0.0 = off, 1.0 = on.  
**Alternatives considered**: A single polyphonic output — not supported by the Web Audio API connection model used here. MIDI-only — spec requires CV parity with keyboard/sequencer.

---

## Decision 4: Chord Theory Data Model

**Decision**: Represent diatonic chords as a derived structure from `MusicalScale`. For a given key, compute 7 `DiatonicChord` objects, each containing:
- `scaleDegree` (0–6)
- `romanNumeral` (I, ii, iii, IV, V, vi, vii°)
- `quality` (major | minor | diminished)
- `rootMidi` (MIDI note number)
- `notes` (array of 3 MIDI notes — root, third, fifth)
- `cvVoltages` (array of 3 CV values)

Triad interval patterns: major = [0, 4, 7], minor = [0, 3, 7], diminished = [0, 3, 6].  
**Rationale**: Derives cleanly from the existing `MusicalScale` infrastructure. No new external library needed.  
**Alternatives considered**: Hardcoded chord lookup table — rejected; less maintainable and would not benefit from existing scale utilities.

---

## Decision 5: Scale Support

**Decision**: Support `ScaleType.MAJOR` and `ScaleType.NATURAL_MINOR` at launch. These are already defined in `src/music/ScaleTypes.ts`. Root note uses the existing `Note` enum (C, C#, D … B).  
**Rationale**: Matches spec assumption. Both scale types are already implemented in `MusicalScale`.  
**Alternatives considered**: All 5 existing ScaleTypes (MAJOR, HARMONIC_MINOR, NATURAL_MINOR, LYDIAN, MIXOLYDIAN) — deferred to a future iteration per spec.

---

## Decision 6: Progression Generation Algorithm

**Decision**: Use a weighted Markov-style chain with these rules:
1. Always start on degree 0 (tonic, I).
2. Choose next chord based on a transition weight table favoring common tonal movements (I→IV, I→V, IV→V, V→I, vi→IV, etc.).
3. Diminished chord (degree 6) has 0.2× weight on all transitions to and from it.
4. Progression length: randomly chosen between 4 and 8 chords.
5. End on degree 0 or degree 4 (V→I cadence preferred).

**Rationale**: Produces varied, coherent progressions without needing an external music theory library. Consistent with `WeightedRandomSelector` pattern already used in `Collider`.  
**Alternatives considered**: Fully random selection — rejected (spec SC-004 requires 80% coherence). External Tonal.js library — rejected (project has zero runtime dependencies).

---

## Decision 7: Chord Circle Rendering

**Decision**: Implement a dedicated `ChordFinderDisplay` class (in `src/canvas/displays/ChordFinderDisplay.ts`) that embeds an HTML5 Canvas, following the `ColliderDisplay` pattern. The `CanvasComponent` in `src/canvas/CanvasComponent.ts` will hold a `chordFinderDisplay` reference.  
**Rationale**: Chord circle is a custom visual that requires canvas-level control (arc geometry, per-node hit detection, pressed animation). A `ColliderDisplay`-style canvas display is the established pattern.  
**Alternatives considered**: CSS/HTML overlay — rejected; other custom visualizations use canvas and it integrates cleanly with the DPR scaling already in place.

---

## Decision 8: Click/Press Hit Detection

**Decision**: On `mousedown` over a chord node (circle arc segment): set pressed state, emit gate on. On `mouseup`/`mouseleave`: clear pressed state, emit gate off. Hit detection uses polar coordinate math against each chord node's angular range.  
**Rationale**: Matches keyboard utility gate-on/gate-off pattern. Provides immediate visual + audio feedback.  
**Alternatives considered**: Click-only (no hold) — rejected; spec requires gate-on for duration of press (US3, scenario 3).

---

## Decision 9: Octave Control

**Decision**: Add a parameter `octave` (range 2–6, step 1, default 4, representing C2–C6). CV output for each chord note is transposed: `midiWithOctave = rootMidi + (octave - 4) * 12`.  
**Rationale**: Directly addresses clarification Q3. Range C2–C6 covers practical synthesizer usage. Uses the existing `Parameter` infrastructure.  
**Alternatives considered**: Continuous pitch offset knob — rejected; octave-step control is more musically intuitive and matches keyboard/sequencer conventions.

---

## Decision 10: State Serialization

**Decision**: Serialize via the existing `ComponentData.parameters` record (numeric values only):
- `rootNote`: index 0–11 (maps to `Note` enum)
- `scaleType`: 0 = MAJOR, 1 = NATURAL_MINOR
- `octave`: 2–6
- `progressionChords`: encode as bitmask of 7 bits (bits 0–6 = scale degrees in progression) — stored as a single integer parameter

**Rationale**: `ComponentData.parameters` is `Record<string, number>`. Bitmask encoding fits the single-number constraint for progression storage.  
**Alternatives considered**: Custom serialization extension — rejected; would require changes to `PatchSerializer` and break the uniform restore pattern.

---

## Existing Infrastructure to Reuse

| Asset | Path | Usage |
|---|---|---|
| `MusicalScale` | `src/music/MusicalScale.ts` | CV voltage calculation, MIDI conversion |
| `ScaleTypes` / `Note` enum | `src/music/ScaleTypes.ts` | Scale intervals, root note enum |
| `WeightedRandomSelector` | `src/music/WeightedRandomSelector.ts` | Progression generation weights |
| `SynthComponent` | `src/components/base/SynthComponent.ts` | Base class |
| `ComponentType` enum | `src/core/types.ts` | Registration |
| `SignalType` enum | `src/core/types.ts` | Port types |
| `audioEngine` | `src/core/AudioEngine.ts` | AudioContext access |
| `ColliderDisplay` (pattern) | `src/canvas/displays/ColliderDisplay.ts` | Canvas display pattern |
| `CanvasComponent` | `src/canvas/CanvasComponent.ts` | Module card rendering |
| `visualUpdateScheduler` | `src/visualization/scheduler.ts` | Animation frame subscription |
| `PatchSerializer` | `src/patch/PatchSerializer.ts` | Already handles ComponentData |
| `MockAudioContext` | `tests/mocks/WebAudioAPI.mock.ts` | Test infrastructure |
| `MockLocalStorage` | `tests/mocks/LocalStorage.mock.ts` | Test infrastructure |

---

## No Unresolved NEEDS CLARIFICATION Items

All technical unknowns resolved above. Proceeding to Phase 1.
