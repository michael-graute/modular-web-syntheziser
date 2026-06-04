# Research: 4-Voice Polyphony

**Feature**: 032-polyphony
**Date**: 2026-06-03

## Decision Log

---

### 1. POLY_CV Signal Architecture

**Decision**: Add `POLY_CV` as a fourth `SignalType` enum member in `src/core/types.ts`. The Keyboard emits a single `poly-cv` output port; PolyOscillator and PolyADSR each cable to it independently. Each poly component reads the full voice slot array and extracts what it needs (frequencies for PolyOscillator, gates for PolyADSR).

**Rationale**: A single bundled cable is cleaner than PolyFreq/PolyGate split cables. The spec explicitly resolved this: "Single POLY_CV bundle — Keyboard emits one port; PolyOscillator and PolyADSR each cable to it independently." Adding a new enum member is the minimal, backward-compatible change — it does not alter any existing SignalType values.

**Alternatives considered**:
- Separate PolyFreq + PolyGate ports — rejected by spec; introduces unnecessary wiring complexity.
- Reusing `CV` with a metadata flag — would break the existing type-safety and connection validation without touching the enum.

---

### 2. POLY_CV Transport at Runtime

**Decision**: POLY_CV does **not** use Web Audio API nodes for signal transport between components. Instead, the Keyboard holds a `VoiceSlot[]` array (4 slots) in JS memory, and PolyOscillator/PolyADSR poll it via getter functions registered through `ConnectionManager`, exactly like the existing `getGateValue` / `getCurrentFrequency` getter pattern used by `StepSequencer` and `Arpeggiator`.

**Rationale**: Web Audio only processes scalar or buffer values, not structured voice slot objects. The existing project already has a getter-function pattern for out-of-band data flow (StepSequencer sets `setArpGateGetter`, Arpeggiator sets `setCvGetter`). This approach:
- Avoids adding a parallel non-Web-Audio bus abstraction.
- Keeps the connection system unchanged except for registering getters in `ConnectionManager.createConnection`.
- PolyOscillator/PolyADSR drive the Web Audio graph internally, one oscillator/envelope per voice slot.

**Alternatives considered**:
- 4 parallel CV cables — rejected by spec.
- A shared singleton VoiceAllocator service — over-engineering; multiple Keyboards would share the same allocator, breaking independence. Getter-per-connection is simpler.

---

### 3. Connection Validation for POLY_CV

**Decision**: Update `areSignalTypesCompatible` in `src/utils/validators.ts` so that `POLY_CV` only connects to `POLY_CV`. Add `POLY_CV` to `CanvasConnection.getColor()` with a distinct visual color (purple `#c084fc`).

**Rationale**: FR-002 requires strict type isolation. The validator is the single enforcement point. A new cable color gives instant visual feedback to the user that a poly cable is in use.

**Alternatives considered**:
- Allowing CV → POLY_CV as a fallback — explicitly rejected in the spec clarifications session.

---

### 3a. Bundled Inter-Component Signal Types: POLY_AUDIO and POLY_ENV *(post-implementation revision)*

**Decision**: Replace the 4 individual `voice-N` (AUDIO) outputs on PolyOscillator and 4 `env-N` (CV) outputs on PolyADSR with two new bundled signal types:
- `POLY_AUDIO` (`'poly-audio'`): carries all 4 voice audio GainNode references in a single cable (PolyOscillator → PolyVCA).
- `POLY_ENV` (`'poly-env'`): carries all 4 envelope GainNode references in a single cable (PolyADSR → PolyVCA).

Both types use the same purple `#c084fc` color as `POLY_CV` and follow the same strict self-compatibility rule (POLY_AUDIO only connects to POLY_AUDIO, etc.).

ConnectionManager intercepts these cables in `createConnection` and directly wires the 4 internal GainNodes between the source and target components — the user sees one cable, the audio graph gets 4 node connections internally.

**Rationale**: The original design exposed 4 Voice output ports on PolyOscillator and 4 Env ports on PolyADSR, requiring 8 cables just to connect two components that are conceptually a single unit. The voice-per-voice fan-out is an internal implementation detail that adds no user value — a musician can never usefully route Voice 0 audio to a different VCA than Voice 1. Collapsing these to single bundled cables reduces the standard poly patch from 11 cables to 5 and makes the signal flow immediately readable.

**Implementation**: `PolyOscillator.registerPolyAudioConsumer(connect, disconnect)` and `PolyADSR.registerPolyEnvConsumer(connect, disconnect)` allow ConnectionManager to register connect/disconnect callbacks. `PolyVCA.connectPolyAudio(voiceOutputs[])` and `connectPolyEnv(outputGains[])` perform the actual 4-way GainNode wiring. Each component also exposes a dummy `GainNode` as the port's AudioNode so the existing port/connection data model continues to function unchanged.

**Alternatives considered**:
- Keeping 4 explicit ports — working but cluttered; the patch canvas becomes unreadable with a 4+4 cable fan between every poly component pair.
- A single `POLY_AUDIO` type shared with `POLY_CV` — rejected; keeping them distinct prevents accidentally connecting a Keyboard Poly CV output to a Poly VCA audio input.

---

### 4. Voice Allocator Design

**Decision**: `VoiceAllocator` is a plain JS class (not a SynthComponent) embedded in `KeyboardInput`. It maintains 4 `VoiceSlot` objects (`{ voiceIndex, frequency, gate, timestamp }`). On `noteOn`:
1. Find an idle slot (gate=0).
2. If none, steal the slot with the oldest `timestamp` (oldest-voice policy, FR-005).
3. Set slot.frequency, slot.gate = 1, slot.timestamp = performance.now().
On `noteOff`:
1. Find the slot matching the note's frequency.
2. Set slot.gate = 0.

The full slot array is returned by `getVoiceSlots(): VoiceSlot[]` — this is what poly components poll via getter.

**Rationale**: Simplest structure that satisfies all FR-004/FR-005 requirements. Oldest-voice stealing is deterministic and predictable (spec assumption). A local embedded class avoids a shared singleton that would couple multiple Keyboards.

**Alternatives considered**:
- Last-note priority stealing — ruled out by spec assumptions.
- Separate `VoiceAllocator.ts` module — acceptable but unnecessary; it is not shared across components, so embedding it avoids an extra import surface.

---

### 5. PolyOscillator Audio Graph

**Decision**: PolyOscillator creates 4 `OscillatorNode` instances (one per voice slot). Each oscillator connects to a per-voice `GainNode` (`voiceOutputs[i]`) that acts as a voice gate (gain 0 when slot.gate=0, gain 1 when slot.gate=1). The component exposes a single `poly-audio` output port (POLY_AUDIO type); ConnectionManager wires the 4 `voiceOutputs` GainNodes directly into PolyVCA's voice inputs when this cable is connected. A dummy summing GainNode (`polyAudioOut`) is registered as the port's AudioNode to satisfy the port/connection data model. The component polls the Keyboard's voice slots via `requestAnimationFrame`.

**Rationale**: RAF polling at 60 FPS is fast enough for musical gate tracking. The single `poly-audio` output port replaces the original 4 `voice-N` ports (see decision 3a). The dummy GainNode approach avoids changes to the connection system's port registration logic.

**Alternatives considered**:
- `AudioWorkletProcessor` for per-sample gate switching — overkill; gate switching at 60 FPS is imperceptible for ADSR-shaped envelopes.
- Single OscillatorNode + ChannelSplitter — Web Audio API does not support polyphonic OscillatorNodes.
- 4 separate `voice-N` AUDIO output ports — implemented initially but replaced by the single `poly-audio` port for UX clarity (see decision 3a).

---

### 6. PolyADSR Audio Graph

**Decision**: PolyADSR creates 4 independent ADSR gain envelopes (one per voice slot), using the same attack/decay/sustain/release parameters shared across all voices. Gate transitions (0→1 = note on, 1→0 = note off) are detected by comparing the polled `gate` value against the stored previous gate state per slot. The component exposes a single `poly-env` output port (POLY_ENV type); ConnectionManager wires the 4 `outputGains` GainNodes directly into PolyVCA's voice gain AudioParams when this cable is connected. A dummy `polyEnvOut` GainNode is registered as the port's AudioNode to satisfy the port/connection data model.

**Rationale**: Mirrors mono ADSREnvelope exactly (ConstantSource → GainNode envelope → output GainNode) but replicated ×4. Parameter sharing matches the spec assumption. The single `poly-env` port replaces the original 4 `env-N` CV ports (see decision 3a).

**Alternatives considered**:
- Receiving gate directly from PolyOscillator — violates the independent-cable-to-POLY_CV architecture; PolyADSR must cable directly to the Keyboard's poly-cv port.
- 4 separate `env-N` CV output ports — implemented initially but replaced by the single `poly-env` port for UX clarity (see decision 3a).

---

### 7. PolyVCA Audio Graph

**Decision**: PolyVCA creates 4 voice input GainNodes and 4 voice gain GainNodes, all summing into a single `sumGain` GainNode (gain = 0.25) that is the mono AUDIO output. Rather than exposing 8 individual ports, PolyVCA exposes two bundled input ports: `poly-audio` (POLY_AUDIO) and `poly-env` (POLY_ENV). `connectPolyAudio(voiceOutputs[])` wires the 4 source voice GainNodes into the 4 `voiceInputs`; `connectPolyEnv(outputGains[])` connects the 4 envelope GainNodes to the 4 `voiceGains[i].gain` AudioParams.

**Rationale**: Standard summing mixer approach. 0.25 gain per voice prevents clipping. The two bundled ports replace the original 8 individual ports (4 `audio-N` + 4 `cv-N`), collapsing 8 cables into 2 (see decision 3a). FR-012 and FR-013 are still satisfied: single mono AUDIO output, compatible with any downstream mono module.

**Alternatives considered**:
- DynamicsCompressorNode on output — over-engineering; a fixed 0.25 gain is sufficient and predictable.
- 8 individual input ports — implemented initially; replaced by 2 bundled ports for UX clarity.

---

### 8. Keyboard Poly/Mono Toggle Persistence

**Decision**: Store `polyMode` as a numeric parameter (`0` = mono, `1` = poly) using the existing `addParameter` mechanism so it serializes automatically via `SynthComponent.serialize()` → `PatchSerializer`. No changes to `PatchData`, `ComponentData`, or `PatchSerializer` are needed.

**Rationale**: All component parameters already round-trip through the patch save/load pipeline. Piggybacking on this avoids adding a new `ComponentData` field. A numeric parameter (not boolean) follows the existing pattern (e.g. waveform=0..3).

**Alternatives considered**:
- A new `polyMode?: boolean` field in `ComponentData` — unnecessary; parameters already handle arbitrary component state.
- EventBus event for mode change — still needed for immediate UI feedback, but persistence uses parameters.

---

### 9. CanvasComponent Controls for Poly Components

**Decision**:
- **Keyboard**: Add a `polyMode` Button control (toggle) in `CanvasComponent.createControls()`. Button label shows "MONO" / "POLY" depending on current state.
- **PolyOscillator**: Add a waveform Dropdown (same options as Oscillator).
- **PolyADSR**: Add 4 Sliders (attack, decay, sustain, release) — same layout as ADSREnvelope.
- **PolyVCA**: No user controls (gain is fully controlled by PolyADSR CV).

`componentLayout.ts` gets new entries for `POLY_OSCILLATOR`, `POLY_ADSR`, `POLY_VCA` with appropriate port counts and control layouts. `KEYBOARD_INPUT` port count updates from 3 outputs to 4 (adds poly-cv out) but only when poly mode is active — handled by making the poly-cv port always present on the component; it just carries zeros in mono mode.

**Rationale**: Consistent with existing component UI patterns. The mono/poly toggle is visible at a glance (FR-003 requirement: "visible and operable from the canvas without opening any modal").

---

### 10. ComponentType and ComponentRegistry

**Decision**: Add 3 new `ComponentType` enum members: `POLY_OSCILLATOR`, `POLY_ADSR`, `POLY_VCA`. Register them in `registerComponents.ts` under "Generators" (PolyOscillator) and "Processors" (PolyADSR, PolyVCA).

**Rationale**: Follows the exact same pattern as all existing components. No structural changes required.

---

### 11. Backward Compatibility

**Decision**: Mono Keyboard (no `polyMode` parameter in saved patch) loads correctly because `SynthComponent.deserialize` silently ignores unknown parameter IDs. If `polyMode` is absent, it defaults to `0` (mono) — the parameter's `defaultValue`. Existing mono patches with `keyboard-input` components continue to work identically.

**Rationale**: The spec requires (SC-007) that "existing monophonic patches are unaffected." The `addParameter('polyMode', ...)` default of `0` (mono) ensures this without any migration logic.

---

### 12. Test Strategy

**Decision**: Unit tests for `VoiceAllocator` (allocation, note-off, voice stealing, retrigger). Unit tests for connection validation (POLY_CV → POLY_CV allowed, POLY_CV → CV rejected, CV → POLY_CV rejected). Integration tests for the full poly chain (Keyboard → PolyOscillator → PolyADSR → PolyVCA) using the existing audio mock infrastructure. No browser-level E2E tests (outside scope of this feature's test budget).

**Rationale**: Voice allocation and type validation are the highest-risk correctness surfaces. The existing Vitest + jsdom + Web Audio mock setup is sufficient.
