# Research: Quantizer Module

**Branch**: `025-quantizer` | **Date**: 2026-05-30

## Decision Log

### 1. Pitch Table Construction Strategy

**Decision**: Pre-compute a full sorted lookup table of all valid MIDI note numbers for the active scale across the full C0–C8 range (MIDI 0–108). Rebuild the table only when root or scale type changes.

**Rationale**: At control-rate update frequency (~60–128 Hz), a linear scan of a sorted array of ~72 values (8 octaves × up to 12 notes) is O(n) and completes in microseconds. Pre-computation means zero per-sample work: the lookup is a single array traversal. This is the standard approach used in hardware and software quantizers (Buchla, Intellijel, VCV Rack).

**Alternatives considered**:
- Compute on-the-fly per sample — unnecessary for control-rate processing; no benefit over a pre-built table.
- Binary search on a sorted table — viable for very large tables; overkill for ≤96 entries per full range.

---

### 2. Reuse of Existing MusicalScale / ScaleTypes Infrastructure

**Decision**: Reuse `src/music/ScaleTypes.ts` (SCALE_INTERVALS) directly and introduce new scale types (Pentatonic Major, Pentatonic Minor, Chromatic) by extending `ScaleType` enum in the Quantizer's own contracts/types.ts, keeping the 006-collider types untouched.

**Rationale**: `src/music/MusicalScale.ts` is purpose-built for the Collider (weighted random degree selection, `cvVoltages` array for a single octave). The Quantizer needs a multi-octave sorted pitch table, not a single-octave weighted list — so it builds its own table from SCALE_INTERVALS. The SCALE_INTERVALS data is shared; the table-building logic is new.

**The new scales needed**:
- `PENTATONIC_MAJOR`: [0, 2, 4, 7, 9]
- `PENTATONIC_MINOR`: [0, 3, 5, 7, 10]
- `CHROMATIC`: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

**Alternatives considered**:
- Add new scale types to the 006 contracts — would couple the Quantizer to the Collider's type system and risk breaking existing tests.
- Duplicate SCALE_INTERVALS entirely — unnecessary duplication of the 5 existing scale definitions.

---

### 3. CV Signal Processing Architecture (Control-Rate Polling)

**Decision**: The Quantizer reads incoming CV via `ConstantSourceNode.offset.value` at control rate (each animation frame / visual update scheduler tick, ~60 Hz). It writes quantized output via a `ConstantSourceNode` whose `.offset` is set to the quantized MIDI-note CV value.

**Rationale**: All other CV-passing utilities in the project (LFO, ChordFinder, Collider) use `ConstantSourceNode` for CV output. Reading the input node's `.offset.value` in the visual update scheduler (used by all other components) keeps the Quantizer consistent with the existing pattern — no new ScriptProcessorNode or AudioWorklet is required.

**Alternatives considered**:
- AudioWorklet for true sample-accurate quantization — adds significant complexity; unnecessary given control-rate spec decision from clarifications.
- ScriptProcessorNode — deprecated, not used elsewhere in the project.

---

### 4. Trigger Detection

**Decision**: Detect rising edge of trigger gate by tracking the previous gate value in component state. On each control-rate tick, compare current gate value to previous. If previous < 0.5 and current ≥ 0.5 → rising edge → sample and quantize current CV input, update held pitch. Store the last held quantized CV and output it regardless of subsequent CV changes until the next rising edge.

**Rationale**: No scheduler or timer is needed. The same per-frame polling loop that reads CV also reads gate, making rising-edge detection a simple two-variable state machine. This matches how the ADSR Envelope detects gate in the existing codebase.

**Alternatives considered**:
- Web Audio `AudioParam` automation for trigger detection — not compatible with a pure CV output design; requires additional nodes.

---

### 5. Note Label Display

**Decision**: Render the current quantized note name (e.g. "A4") as a text label directly on the component canvas panel, updated each visual scheduler tick. Octave number derived from the MIDI note number (octave = Math.floor(midiNote / 12) - 1, so MIDI 69 = A4).

**Rationale**: No special display component is needed. Existing components (e.g. Oscilloscope) render text directly on the canvas. The label is a simple `ctx.fillText()` call in `CanvasComponent.createControls()` — no separate display class required.

---

### 6. Nearest-Pitch Tie-Breaking

**Decision**: Ties (equidistant between two valid pitches) resolve upward — the higher pitch wins. This matches the clarification recorded in the spec and is consistent with standard music theory rounding conventions.

**Implementation**: `Math.round()` on the continuous MIDI note value corresponds to rounding half-up, which selects the higher pitch on a tie.

---

### 7. ComponentType Enum Extension

**Decision**: Add `QUANTIZER = 'quantizer'` to the existing `ComponentType` enum in `src/core/types.ts`. This is the same pattern used for every existing component.

**No backward-compatibility issue**: Adding a new enum value does not break existing serialized patches, which never contain a `quantizer` type.

---

### 8. Scope of ScaleType Extension

**Decision**: Define a new `QuantizerScaleType` enum in the Quantizer's own contracts file. This enum includes all 5 existing scale types from the Collider (major, natural-minor, harmonic-minor, lydian, mixolydian) plus 3 new ones (pentatonic-major, pentatonic-minor, chromatic). The Quantizer uses only its own enum; the Collider is unchanged.

**Rationale**: The spec requires Pentatonic Major, Pentatonic Minor, and Chromatic — none of which exist in the current ScaleType enum. Creating a separate enum avoids modifying shared code and keeps each feature self-contained per the project constitution.
