# Research: ChordFinder Poly CV Output

**Feature**: 033-chordfinder-poly-cv
**Date**: 2026-06-04

## Decision 1: VoiceSlot Gate Field Type

**Decision**: Use `gate: 0 | 1` (numeric), not `boolean`.

**Rationale**: The existing `VoiceSlot` interface in `src/components/utilities/VoiceAllocator.ts` defines `gate: 0 | 1`. PolyADSR reads `slot.gate === 1` / `slot.gate === 0` directly. ChordFinder must reuse the same `VoiceSlot` type to be compatible with the existing poly chain without any adaptation layer. The spec's clarification answer ("boolean") described the semantic intent; the implementation MUST use `0 | 1` to satisfy the existing type contract.

**Alternatives considered**: A separate `ChordVoiceSlot` with `active: boolean` — rejected because it would require PolyOscillator and PolyADSR to accept a new type, breaking the single getter contract that ConnectionManager relies on.

---

## Decision 2: PolyCVSource Contract (getVoiceSlots pattern)

**Decision**: ChordFinder exposes `getVoiceSlots(): Readonly<VoiceSlot[]>` as a plain method. ConnectionManager's `createConnection()` already duck-type checks `typeof src.getVoiceSlots === 'function'` at line 176 of `src/canvas/ConnectionManager.ts`. No interface registration or factory is needed — just the method.

**Rationale**: The existing duck-type check in ConnectionManager means ChordFinder automatically works as a POLY_CV source as long as it has `getVoiceSlots()`. Zero changes to ConnectionManager required.

**Alternatives considered**: Implementing a formal `PolyCvSource` interface from `specs/032-polyphony/contracts/types.ts` — this is equivalent but the duck-typing makes the formal interface optional for the runtime; it can be added as a type annotation for safety.

---

## Decision 3: VoiceAllocator Usage

**Decision**: Do NOT use `VoiceAllocator`. ChordFinder manages a private `VoiceSlot[]` array directly (4 slots, pre-allocated, never reallocated).

**Rationale**: `VoiceAllocator` implements note-on/note-off with MIDI note numbers and oldest-voice stealing — a dynamic allocation policy for keyboard input. ChordFinder's voice assignment is static: slot 0 = chord root, slot 1 = third, slot 2 = fifth, slot 3 = always inactive. No allocation logic is needed.

**Alternatives considered**: Using VoiceAllocator and calling `noteOn` with synthetic MIDI notes — rejected as unnecessary complexity and introduces dependency on MIDI note arithmetic that is already handled by the Hz conversion in `pressChord()`.

---

## Decision 4: Slot Gate Timing

**Decision**: Gate updates (`gate: 1` on press, `gate: 0` on release) are written synchronously in `pressChord()` / `releaseChord()` — no `setValueAtTime` is needed on the VoiceSlot struct itself, because VoiceSlot is a plain data object polled by PolyOscillator/PolyADSR on each RAF frame. The spec's SC-004 "setValueAtTime" language applies to the *mono ConstantSourceNode outputs*, not to the slot data struct.

**Rationale**: PolyADSR reads slot state via `voiceSlotsGetter()` on each animation frame (rAF loop). The slot's `gate` value is read directly from the plain JS object each frame — there is no Web Audio scheduling involved in the poly data path. `setValueAtTime` is only relevant for the existing mono `gateOutput` ConstantSourceNode.

**Alternatives considered**: Buffering gate changes — unnecessary; rAF frame granularity is sufficient for gate detection.

---

## Decision 5: Frequency Convention

**Decision**: Voice slot frequencies are set in Hz using the identical `midiToHz` formula already in `pressChord()`. The same octave shift applies.

**Rationale**: PolyOscillator reads `slot.frequency` and passes it directly to `osc.frequency.value`, expecting Hz. ChordFinder already computes Hz for its mono outputs — the same values go into the poly slots.

---

## Decision 6: note and timestamp Fields

**Decision**: Set `note: null` and `timestamp: 0` for all ChordFinder voice slots. These fields are used only by `VoiceAllocator`'s oldest-voice stealing logic, which ChordFinder does not use.

**Rationale**: VoiceSlot requires these fields (they are part of the interface), but PolyOscillator and PolyADSR never read `note` or `timestamp`. Setting them to null/0 is safe and explicit.

---

## Decision 7: Poly Output Port Audio Node

**Decision**: `getOutputNodeByPort('poly-cv')` returns `null`, matching KeyboardInput's implementation (`case 'poly-cv': return null`). The POLY_CV port carries no AudioNode — data flows exclusively via the `getVoiceSlots()` getter.

**Rationale**: ConnectionManager checks for `null` on poly ports and skips Web Audio connection. This is the established pattern for POLY_CV ports.

---

## Decision 8: No New Spec Contracts File Needed

**Decision**: ChordFinder's poly slot shape is fully described by the existing `VoiceSlot` interface in `src/components/utilities/VoiceAllocator.ts`. The `specs/033-chordfinder-poly-cv/contracts/` directory will contain a minimal types file documenting ChordFinder-specific constants (slot index mapping) and a validation helper.

**Rationale**: The data model is already standardised by 032-polyphony. Duplicating VoiceSlot would create drift risk. The contracts file serves as documentation and provides the slot-index constants needed by tests.
