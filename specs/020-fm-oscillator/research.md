# Research: FM Oscillator Component

**Feature**: 020-fm-oscillator
**Date**: 2026-05-02

## Decision 1: How to route audio signal to frequency AudioParam

**Decision**: Use an intermediate `GainNode` (the FM gain node) as the connection target. The FM audio input connects to this `GainNode`, which in turn connects to `OscillatorNode.frequency`. The `GainNode.gain` value = FM Depth in Hz.

**Rationale**: The Web Audio API does not allow connecting directly to an `AudioParam` as a port in the synthesizer's connection model; components expose `AudioNode` targets for `connectTo()`. An intermediate `GainNode` serves dual purpose: (1) it is an `AudioNode` that can receive connections, and (2) its `gain` parameter scales the modulation depth before passing through to `frequency`. This matches the pattern already used in the project (`SynthComponent.connectTo` routes audio output → `getInputNode()` which returns an `AudioNode`).

**Alternatives considered**:
- Connect audio directly to `OscillatorNode.frequency` without a gain stage → rejected: no depth control; the modulation amount would be 1:1 (full amplitude of the modulator in Hz deviation), which is uncontrollable.
- Expose `AudioParam` from `getAudioParamForInput()` and require the source to call `connect(audioParam)` → rejected: `SynthComponent.connectTo` only routes CV/Gate signals through `getAudioParamForInput`. An audio signal from another oscillator has `SignalType.AUDIO`, which takes the `getInputNode()` branch. Changing this routing would require invasive changes to `SynthComponent.connectTo`.

---

## Decision 2: Signal type validation for the FM input port

**Decision**: Declare the FM input port with `SignalType.AUDIO`. Update `areSignalTypesCompatible()` in `src/utils/validators.ts` to allow `AUDIO → AUDIO` connections unconditionally (it already does; the current rule is `sourceType === AUDIO → targetType must be AUDIO`). **No change to the validator is required.** The FM Input port is typed AUDIO, and connecting an oscillator's AUDIO output to it is already valid.

**Rationale**: The existing validator already permits `AUDIO → AUDIO`. The FM input port accepts an audio-rate signal just like any other audio input. The fact that it internally routes to an AudioParam is an implementation detail invisible to the connection system.

**Alternatives considered**:
- Add a new `SignalType.FM` — rejected: unnecessary new type that would break the clean three-type model and require UI changes for wire color, port label, etc.
- Allow `AUDIO → CV` as suggested in the research document — rejected: the FM input is typed AUDIO (not CV), so this rule is not needed. The research doc proposed this under the assumption that the FM input would be typed CV; with an AUDIO-typed FM port, the existing validator works as-is.

---

## Decision 3: FM Depth default and range

**Decision**: Default 100 Hz, range 0–1000 Hz, step 1 Hz. Matches the research document recommendation.

**Rationale**: 100 Hz default gives an audible but not extreme FM effect on a 440 Hz carrier. 1000 Hz maximum provides dramatic timbre changes without producing unstable or inaudible tones in normal musical contexts. Step of 1 Hz gives fine control without excessive knob sensitivity.

**Alternatives considered**:
- Default 0 Hz (no modulation on drop) → rejected: user gets no immediate sound change on first connection, making the feature less discoverable.
- Range 0–10000 Hz → rejected: above ~1000 Hz on a 440 Hz carrier the spectrum becomes very dense/harsh and musically unusable for most applications.

---

## Decision 4: Inheritance vs. composition

**Decision**: Extend `Oscillator` with `class FMOscillator extends Oscillator`.

**Rationale**: `Oscillator` has a clean interface (`createAudioNodes`, `destroyAudioNodes`, `updateAudioParameter`, `getAudioParamForInput`). All are either abstract or overrideable. `FMOscillator` only needs to: (1) call `super.createAudioNodes()`, (2) attach the FM gain stage, and (3) override `getInputNode(portId)` to return the `fmGain` node when `portId === 'fm'`. No code duplication; the oscillator engine runs unchanged.

**Alternatives considered**:
- Composition (wrap an `Oscillator` instance) → rejected: would require proxying all `SynthComponent` APIs, significantly more boilerplate with no gain.
- Modify `Oscillator` directly (Option 2 from research) → rejected: risks regressions in all existing patches; violates constitution principle of minimal blast radius.

---

## Decision 5: getInputNode vs. getAudioParamForInput for the FM port

**Decision**: Override `getInputNode(portId?: string)` in `FMOscillator` to return `fmGain` when `portId === 'fm'`. Do **not** use `getAudioParamForInput`.

**Rationale**: `SynthComponent.connectTo` uses `getAudioParamForInput` only when `outputPort.type === 'cv' || outputPort.type === 'gate'`. Since the FM port is `SignalType.AUDIO`, `connectTo` will call `target.getInputNode(inputId)` on the audio branch. Returning `fmGain` from `getInputNode('fm')` routes the audio source into the FM gain stage correctly.

**Alternatives considered**:
- Changing `connectTo` to also check `getAudioParamForInput` for AUDIO connections → rejected: more invasive, would change core base-class behavior.
