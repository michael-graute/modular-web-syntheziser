# Feature Specification: 4-Voice Polyphony

**Feature Branch**: `032-polyphony`
**Created**: 2026-06-03
**Status**: Draft
**Input**: User description: "4-voice polyphony for the modular web synthesiser. Add a POLY_CV signal type, poly mode toggle on the Keyboard, and three new poly components: PolyOscillator, PolyADSR, PolyVCA. Existing mono components untouched."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Play a Chord from the Keyboard (Priority: P1)

A musician holds down three keys on the Keyboard while in poly mode. Three simultaneous notes sound — each with its own pitch, its own attack and release envelope, and its own amplitude gate. Releasing one key stops only that note while the others continue.

**Why this priority**: This is the entire motivation for the feature. Without it nothing else matters. A patch of Keyboard → PolyOscillator → PolyADSR → PolyVCA → Master Out must produce independent, simultaneous voices from held keys.

**Independent Test**: Place Keyboard (poly mode), PolyOscillator, PolyADSR, PolyVCA, Master Out. Connect them in sequence. Hold three keys — three notes must sound simultaneously. Release one key — only that note fades out. Release all keys — silence.

**Acceptance Scenarios**:

1. **Given** the Keyboard is in poly mode and three keys are held, **When** audio is monitored, **Then** three distinct pitches sound simultaneously.
2. **Given** three notes are sounding, **When** one key is released, **Then** only that voice enters its release phase; the other two voices continue unaffected.
3. **Given** all keys are released, **When** the ADSR release phase completes, **Then** the output is silent.
4. **Given** a 5th key is pressed while 4 voices are already active (voice stealing), **When** the new note arrives, **Then** the oldest active voice is reassigned to the new pitch without a crash or silence.

---

### User Story 2 — Switch Between Mono and Poly Mode (Priority: P2)

A musician toggles the Keyboard between mono and poly mode without rebuilding the patch. In mono mode the existing monophonic behaviour is fully restored — single notes, last-note priority, exactly as before this feature existed.

**Why this priority**: Backwards compatibility and workflow flexibility. A user should be able to use the same Keyboard for both monophonic leads (existing patch) and polyphonic chords (new patch) just by flipping a switch.

**Independent Test**: Start in poly mode, play chords. Flip to mono mode — only one note sounds at a time (last held key wins). Flip back to poly — chords return. Patch saves and restores the mode setting.

**Acceptance Scenarios**:

1. **Given** the Keyboard is in mono mode, **When** multiple keys are held, **Then** only the most recently pressed key's pitch sounds (same as existing behaviour).
2. **Given** the Keyboard is in poly mode, **When** the mode is switched to mono mid-performance, **Then** all active poly voices stop and the keyboard reverts to single-note output immediately.
3. **Given** a patch is saved with the Keyboard in poly mode, **When** the patch is reloaded, **Then** the Keyboard restores in poly mode.

---

### User Story 3 — Poly Voices Feed the Existing Effects Chain (Priority: P3)

A musician patches PolyVCA audio output into the existing mono effects chain — Filter, Reverb, Delay, Master Out — without any special poly-awareness required from those modules. The polyphonic signal arrives at the effects chain already mixed to mono.

**Why this priority**: This ensures polyphony integrates cleanly with the rest of the synthesiser. A musician should be able to add reverb or a filter to a poly patch using the exact same modules they already know.

**Independent Test**: Extend the poly patch: PolyVCA Audio Out → Filter → Reverb → Master Out. Play chords. All voices pass through the filter and reverb together as a mono mix.

**Acceptance Scenarios**:

1. **Given** PolyVCA is connected to a Filter's audio input, **When** chords are played, **Then** all voices pass through the filter and are affected by its cutoff setting.
2. **Given** any mono effect or processor is downstream of PolyVCA, **When** the patch is connected, **Then** the connection is accepted using the standard audio cable (no special poly cable required).
3. **Given** PolyVCA is patched into Master Out directly, **When** chords are played, **Then** the mixed output does not clip beyond what would be expected from a single voice at the same gain setting.

---

### Edge Cases

- What happens when the same key is pressed twice without releasing? The existing voice for that pitch is retriggered (same voice index reassigned) rather than allocating a new voice.
- What happens when a poly component (PolyOscillator) is accidentally patched to a mono CV input? The connection is rejected by the signal type system — POLY_CV is incompatible with CV inputs.
- What happens when PolyOscillator is placed without a PolyADSR/PolyVCA connected? Notes trigger and sustain indefinitely (no envelope) — same behaviour as Oscillator without an ADSR in mono mode.
- What happens when the Keyboard is in mono mode and a user tries to connect it to a PolyOscillator? The connection is rejected — the Keyboard's mono CV/Gate outputs are incompatible with POLY_CV inputs. The user must switch the Keyboard to poly mode to connect poly components.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST support a new POLY_CV signal type that carries 4 simultaneous voice slots (frequency + gate per slot) in a single bundled cable.
- **FR-001a**: The Keyboard MUST emit a single POLY_CV output port; both PolyOscillator and PolyADSR connect independently to this same port via separate cables. PolyOscillator reads only the frequency slots; PolyADSR reads only the gate slots — no explicit split component is required.
- **FR-002**: POLY_CV ports MUST only connect to other POLY_CV ports; the connection system MUST reject POLY_CV → CV and CV → POLY_CV pairings.
- **FR-003**: The Keyboard component MUST provide a mono/poly mode toggle that is visible and operable from the canvas without opening any modal.
- **FR-004**: In poly mode, the Keyboard MUST allocate up to 4 simultaneous voices and assign each held key to a voice slot (0–3).
- **FR-005**: In poly mode, the Keyboard MUST implement voice stealing: when all 4 slots are occupied and a new note arrives, the oldest active voice is reassigned.
- **FR-006**: In mono mode, the Keyboard MUST behave identically to its pre-feature behaviour — single voice, last-note priority, existing CV and Gate outputs unchanged.
- **FR-007**: The PolyOscillator MUST maintain 4 independent oscillator voices, each producing a waveform at its assigned voice frequency.
- **FR-008**: The PolyOscillator MUST support the same waveform selection (sine, square, sawtooth, triangle) applied to all 4 voices simultaneously.
- **FR-009**: The PolyADSR MUST maintain 4 independent envelope generators, each triggered and released independently per voice slot.
- **FR-010**: The PolyADSR MUST expose Attack, Decay, Sustain, and Release controls that apply uniformly to all 4 voice envelopes.
- **FR-011**: The PolyVCA MUST maintain 4 independent gain stages, each controlled by its corresponding PolyADSR voice envelope.
- **FR-012**: The PolyVCA MUST mix all 4 voice outputs into a single mono audio output.
- **FR-013**: The PolyVCA mono audio output MUST be connectable to any existing mono audio input (Filter, Effects, Master Out) using the standard audio cable.
- **FR-014**: All new components (PolyOscillator, PolyADSR, PolyVCA) and the Keyboard poly mode toggle MUST persist their state when the patch is saved and restore correctly on reload.
- **FR-015**: Existing mono components (Oscillator, ADSR, VCA) MUST remain completely unchanged in behaviour and appearance.

### Key Entities

- **Voice Slot**: One of 4 independent lanes (index 0–3), each carrying a frequency value and a gate state at any given moment.
- **POLY_CV Signal**: A single bundled connection type that carries all 4 voice slots (frequency + gate per slot) simultaneously. Multiple components can cable independently to the same POLY_CV source; each reads only the slots it needs.
- **Voice Allocator**: Logic inside the Keyboard that maps held keys to voice slots, handles note-on/off, and performs voice stealing.
- **PolyOscillator**: A generator component with 4 internal oscillator voices, each tuned to its slot's frequency.
- **PolyADSR**: A processor component with 4 independent envelope generators, each gated by its slot's gate state.
- **PolyVCA**: A processor component with 4 independent gain stages that sums to a mono audio output.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A musician can play a 4-note chord from the keyboard and hear all 4 notes simultaneously within the same latency as a single monophonic note.
- **SC-002**: Releasing individual keys stops only the corresponding voice — the other voices continue without any audible interruption or glitch.
- **SC-003**: Switching between mono and poly mode on the Keyboard takes effect within one audio buffer — no notes are left hanging after the switch.
- **SC-004**: A complete poly patch (Keyboard → PolyOscillator → PolyADSR → PolyVCA → Master Out) can be built in under 2 minutes by a user already familiar with the mono patch workflow.
- **SC-005**: Patch save and reload preserves Keyboard mode (mono/poly), all poly component parameters, and all cable connections with no loss.
- **SC-006**: The PolyVCA mono audio output integrates into an existing mono effects chain without requiring any changes to downstream components.
- **SC-007**: Existing monophonic patches are unaffected — they load, play, and save identically to before this feature was introduced.

## Clarifications

### Session 2026-06-03

- Q: Should POLY_CV be a single bundle or separate PolyFreq/PolyGate ports? → A: Single POLY_CV bundle — Keyboard emits one port; PolyOscillator and PolyADSR each cable to it independently and read their relevant slots internally.
- Q: Should CV → POLY_CV connections be allowed as a fallback (mono Keyboard → PolyOscillator)? → A: No — strict type system; POLY_CV and CV are always incompatible; the edge case is removed; users must switch the Keyboard to poly mode to use poly components.

## Assumptions

- 4 voices is the fixed voice count for this feature. A configurable voice count is out of scope.
- Voice stealing uses oldest-voice policy (simplest, most predictable). Last-note priority or loudness-based stealing are out of scope.
- All 4 voices within a poly component share the same parameter values (waveform, ADSR times, etc.). Per-voice parameter differences are out of scope.
- The POLY_CV signal carries frequency (Hz) and gate (0/1) per voice. Velocity per voice is out of scope for this feature.
- The Keyboard poly toggle is a UI button/switch on the component itself, consistent with existing controls like the bypass button.
- Poly components appear in the existing component menu under their respective categories (Generators, Processors) alongside their mono counterparts.
- The PolyOscillator does not need a detune spread control in this feature (all 4 voices play the held pitches exactly). Unison detune is a future enhancement.
