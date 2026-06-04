# Feature Specification: ChordFinder Poly CV Output

**Feature Branch**: `033-chordfinder-poly-cv`
**Created**: 2026-06-04
**Status**: Draft
**Input**: User description: "Add polyphonic POLY_CV output to ChordFinder (src/components/utilities/ChordFinder.ts). The ChordFinder already generates 3 simultaneous notes per chord (triad). Add a POLY_CV output port so it can connect to PolyOscillator → PolyADSR → PolyVCA chain. The implementation should follow the same VoiceSlotsGetter pattern used by the Keyboard component in poly mode (specs/032-polyphony). ChordFinder produces 3 notes per chord (triad), so it emits 4 voice slots (slots 0-2 = chord notes, slot 3 = silent/inactive). Existing mono note1/note2/note3/gate outputs stay unchanged for backwards compatibility. No new UI controls needed — existing key/scale/octave controls are unchanged."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — ChordFinder Drives a Poly Voice Chain (Priority: P1)

A musician connects ChordFinder's new poly output to a PolyOscillator, then to PolyADSR, then to PolyVCA. When a chord button is pressed, three simultaneous enveloped voices sound — one per chord note — each with its own attack and release. Releasing the chord button stops all three voices through their release phases.

**Why this priority**: This is the core motivation for the feature. Without it the poly output has no audible use. A patch of ChordFinder (poly out) → PolyOscillator → PolyADSR → PolyVCA → Master Out must produce three independent, simultaneous enveloped voices from a single chord button press.

**Independent Test**: Place ChordFinder, PolyOscillator, PolyADSR, PolyVCA, Master Out. Connect ChordFinder's poly-cv output to PolyOscillator's poly-cv input (and separately to PolyADSR's poly-cv input). Press any chord button — three distinct pitches must sound simultaneously with attack/release shaping. Release the button — all three voices fade out.

**Acceptance Scenarios**:

1. **Given** ChordFinder is connected to PolyOscillator via the poly-cv port, **When** a chord button is pressed, **Then** three distinct pitches corresponding to the triad notes sound simultaneously.
2. **Given** three voices are sounding, **When** the chord button is released, **Then** all three voices enter their release phase and fade out.
3. **Given** the patch is connected, **When** a different chord button is pressed while the first is held, **Then** the three voices update to the new triad's pitches without silence or crash.
4. **Given** ChordFinder is connected to PolyADSR via the poly-cv port, **When** a chord is pressed and released, **Then** each voice's gate opens and closes independently at the correct times.

---

### User Story 2 — Existing Mono Outputs Remain Functional (Priority: P2)

A musician with an existing patch using ChordFinder's mono note1/note2/note3/gate outputs opens their saved patch after the update. Everything works exactly as before — no connections are broken, no behaviour changes. The poly-cv port is simply an additional output they may or may not use.

**Why this priority**: Backwards compatibility is non-negotiable. Existing patches must not be invalidated by this feature. The poly output is purely additive.

**Independent Test**: Load an existing ChordFinder patch that uses note1/note2/note3/gate outputs. Verify all connections are intact and the component behaves identically to before this feature was added.

**Acceptance Scenarios**:

1. **Given** an existing patch with ChordFinder mono outputs wired, **When** the patch is loaded, **Then** all note1/note2/note3/gate connections are restored without error.
2. **Given** a ChordFinder with both mono and poly outputs connected, **When** a chord button is pressed, **Then** both the mono CV outputs and the poly-cv output emit the correct values simultaneously.
3. **Given** a ChordFinder with only mono outputs connected (no poly cable), **When** chord buttons are pressed, **Then** behaviour is identical to before this feature existed.

---

### User Story 3 — Poly ChordFinder Feeds Existing Mono Effects Chain (Priority: P3)

A musician patches PolyVCA's mixed audio output into a Filter, then Reverb, then Master Out. All three chord voices pass through the effects chain together as a mono mix, with no special poly-awareness required from the Filter or Reverb.

**Why this priority**: This confirms integration with the rest of the synthesiser. Polyphonic chords should work naturally with the existing mono effects modules downstream of PolyVCA.

**Independent Test**: Extend the poly chord patch: PolyVCA Audio Out → Filter → Master Out. Play chords. All three voices pass through the filter and are affected by cutoff changes.

**Acceptance Scenarios**:

1. **Given** PolyVCA is connected to a Filter's audio input, **When** chords are played, **Then** all three chord voices pass through the filter and are affected by its settings.
2. **Given** PolyVCA is patched into Master Out directly, **When** chords are played, **Then** the mixed output does not clip beyond what a single voice at the same gain would produce.

---

### Edge Cases

- What happens when a chord button is pressed while no poly cable is connected? The existing mono outputs emit as normal; the poly slot state is maintained internally but has no consumer.
- What happens when the key or octave is changed while a chord is held? The held chord's voices update to the new pitches immediately, same behaviour as the existing mono outputs.
- What happens with slot 3 (the unused 4th voice)? Slot 3 is permanently inactive (`gate: 0`, frequency = 0) — PolyOscillator's 4th oscillator remains silent.
- What happens when a POLY_CV cable is attempted to connect from ChordFinder's poly-cv output to a mono CV input? The connection is rejected by the signal type system — POLY_CV is incompatible with CV inputs.
- What happens when ChordFinder is serialized/deserialized (patch save/load)? The poly-cv port is registered on component creation; no extra serialization is needed. The port appears automatically on load.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: ChordFinder MUST expose a new output port labelled `poly-cv` carrying the POLY_CV signal type.
- **FR-002**: When a chord button is pressed, the poly-cv port MUST publish 4 voice slots: slots 0–2 set to the triad note frequencies (in Hz, same convention as the existing mono outputs) with `gate: 1`, and slot 3 permanently inactive (`gate: 0`, frequency = 0).
- **FR-003**: When a chord button is released, slots 0–2 MUST set `gate: 0` and MUST retain their last frequency value; frequencies MUST NOT be reset to zero on release (gate-off alone triggers envelope release — resetting frequency would cut off the PolyADSR release tail).
- **FR-004**: The poly-cv output MUST implement the same `VoiceSlotsGetter` / `PolyCVSource` contract used by the Keyboard component in poly mode (specs/032-polyphony), so the ConnectionManager can register and unregister the getter without modification.
- **FR-005**: The existing mono output ports (`note1`, `note2`, `note3`, `gate`) MUST remain fully functional and unchanged in behaviour.
- **FR-006**: The POLY_CV port MUST only connect to other POLY_CV input ports; connections to mono CV inputs MUST be rejected by the existing signal type compatibility system (no new connection logic required).
- **FR-007**: No new UI controls, parameters, or serialized fields are required — the poly-cv port is always present and always active.
- **FR-008**: The octave setting applied to mono outputs MUST equally be applied to the voice slot frequencies on the poly-cv output.

### Key Entities

- **VoiceSlot**: Represents one of 4 voice channels; carries a frequency (Hz) and a gate state (`gate: 0 | 1`, where 1 = active, 0 = inactive). This matches the canonical type in `VoiceAllocator.ts` used by all poly components. Slots 0–2 map to chord root, third, and fifth. Slot 3 is always inactive (`gate: 0`).
- **PolyCVSource contract**: The interface ChordFinder must satisfy so that ConnectionManager can wire poly cables — exposes a `getVoiceSlots(): Readonly<VoiceSlot[]>` getter registration method and a clear method.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A patch of ChordFinder → PolyOscillator → PolyADSR → PolyVCA → Master Out produces three audibly distinct simultaneous pitches when any chord button is pressed.
- **SC-002**: All existing ChordFinder patches (using mono outputs) load and operate without modification or error after the feature is introduced.
- **SC-003**: Pressing a chord button triggers exactly 3 active voice slots (slots 0–2) and 1 permanently inactive slot (slot 3) on the poly-cv output — verifiable via unit test inspection of the published slot state.
- **SC-004**: Releasing a chord button sets `gate: 0` on slots 0–2 in the same call frame as `releaseChord()` (plain object mutation; the poly data path has no Web Audio scheduling) — verifiable via unit test.
- **SC-005**: The poly-cv port correctly rejects connection attempts to mono CV inputs, consistent with the existing POLY_CV signal type compatibility rules.

## Clarifications

### Session 2026-06-04

- Q: What should the gate field type be in the VoiceSlot data structure? → A: `gate: 0 | 1` (numeric), matching the existing `VoiceSlot` interface in `VoiceAllocator.ts`. The clarification originally said `boolean` (semantic intent), but research confirmed the canonical type is numeric for compatibility with PolyOscillator and PolyADSR.
- Q: How should poly slot gate updates be timed on press/release? → A: Synchronous plain-object mutation in the same call frame as `pressChord()` / `releaseChord()`. No Web Audio scheduling (`setValueAtTime`) is involved on the poly data path — that applies only to the mono `gateOutput` ConstantSourceNode.
- Q: Should slot frequencies be retained or reset on chord release? → A: MUST retain — frequencies never reset on release; gate-off alone triggers envelope release.

## Assumptions

- The `VoiceAllocator` is not used; ChordFinder assigns voice slots directly (no dynamic allocation needed — chord degrees have fixed 3-note structure).
- Voice slot frequencies are expressed in Hz, matching the existing mono `note1/2/3` ConstantSourceNode convention.
- The 4-voice-slot structure (matching PolyOscillator's `VOICE_COUNT = 4`) is fixed; no variable voice count is introduced.
- No visual indication of "poly active" state is needed in the ChordFinderDisplay; the existing chord button highlighting is sufficient.
- Patch serialization requires no changes — the poly-cv port is structural (registered in the constructor) and not a serialized parameter.
