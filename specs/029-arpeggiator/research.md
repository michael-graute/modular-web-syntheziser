# Research: Arpeggiator

**Branch**: `029-arpeggiator` | **Date**: 2026-05-31

---

## Decision 1: Scheduling mechanism — `setInterval` (JS) vs Web Audio lookahead

**Decision**: Use `window.setInterval` at ~20 ms polling, with Web Audio API `setValueAtTime` for CV/Gate output precision — identical to `StepSequencer`.

**Rationale**: The Arpeggiator has no audio-rate DSP; its job is to set CV/Gate `ConstantSourceNode` offsets at step boundaries. The StepSequencer already demonstrates this pattern: a JS interval fires every ~20 ms and pre-schedules the next beat via `setValueAtTime`. This keeps audio-thread scheduling tight while keeping step logic in JS where it is easy to read and modify.

**Alternatives considered**:
- *Pure Web Audio lookahead scheduler (tone.js style)*: No framework available and would require significant new infrastructure.
- *`requestAnimationFrame`*: Tied to display rate (60 Hz), not suitable for precise audio scheduling at low BPM.

---

## Decision 2: Note sequence storage — JS array, not Web Audio graph

**Decision**: The latched note sequence is a plain `number[]` (CV pitch values) managed entirely in JS. No Web Audio nodes are used to "store" notes.

**Rationale**: Notes arrive one at a time via gate-high/gate-low polling (same mechanism as StepSequencer arp mode). The JS array is trivially small (max 8 entries), sorted by arrival order, and used only to compute the step cycle on each tick. No audio-rate manipulation is needed.

---

## Decision 3: CV/Gate output — `ConstantSourceNode.offset.setValueAtTime`

**Decision**: Two `ConstantSourceNode` instances (`cvOutputNode`, `gateOutputNode`) emit pitch and gate signals respectively, identical to `StepSequencer` and `Quantizer`.

**Rationale**: `ConstantSourceNode` is the standard CV/Gate output primitive in this codebase. All CV-emitting components (StepSequencer, ChordFinder, Collider, Quantizer) use it. The `.offset.setValueAtTime()` API gives sample-accurate scheduling inside the Web Audio scheduler thread.

---

## Decision 4: Gate input reading — JS-level getter via `AnalyserNode`

**Decision**: CV and Gate inputs are read using JS-level getter functions registered by the connection manager (identical to the StepSequencer arp-mode pattern: `arpGateGetter` / `arpFreqGetter`).

**Rationale**: The StepSequencer already solves the problem of reading a live gate/CV signal from JS: a getter function reads `.offset.value` directly from the upstream `ConstantSourceNode`. `setValueAtTime` schedules future values but `.offset.value` always reflects the current JS-committed value. This is already established and tested.

**Connection-manager integration**: The `Arpeggiator` will expose `setGateGetter(fn)` and `setCvGetter(fn)` methods (mirrors `setArpGateGetter`/`setArpFreqGetter` on StepSequencer), plus `clearGateGetter`/`clearCvGetter` on disconnect. The existing `ConnectionManager` / `SynthComponent.connectTo` already calls these on Sequencer — the Arpeggiator will follow the same contract so no ConnectionManager changes are needed; the component registers itself as a getter-style target.

---

## Decision 5: Step cycle computation — inline, no external music library

**Decision**: Step cycle is computed inline from `noteSequence × octaveRange` in the directions (Up, Down, Up-Down, Random) using simple array operations.

**Rationale**: The logic is trivial (sort, reverse, interleave, or shuffle). No external music library is needed. The existing `WeightedRandomSelector` in `src/music/` handles weighted random — the Arpeggiator needs unweighted random, so `Math.random()` suffices.

**Up-Down boundary rule**: Top and bottom notes are not repeated (A B C B A B C B…), matching the spec clarification.

---

## Decision 6: BPM sync — `eventBus.on(GLOBAL_BPM_CHANGED)` with unsubscribe in `deactivate()`

**Decision**: Identical to StepSequencer. Subscribe in `activate()`, store unsubscribe handle, call in `deactivate()`.

**Rationale**: `GLOBAL_BPM_CHANGED` is the canonical BPM change event. StepSequencer, Collider, and LFO all use this pattern. The `globalBpmController.getBpm()` is used to seed the current BPM on activation.

---

## Decision 7: Subdivision values as numeric constants (fraction of quarter note)

**Decision**: Subdivisions stored as numeric fractions: `1/4 = 1.0`, `1/8 = 0.5`, `1/16 = 0.25`, `1/32 = 0.125`. These map directly into `TimingCalculator.calculateGateDuration(bpm, subdivision)`.

**Rationale**: The `TimingCalculator.getAllGateDurations()` already uses this convention (whole=1.0, half=0.5, quarter=0.25, eighth=0.125, sixteenth=0.0625). Reusing the same fractions lets the Arpeggiator call `timingCalculator.calculateGateDuration(bpm, subdivision)` with no conversion.

**Step interval** = `timingCalculator.calculateGateDuration(bpm, subdivision)` ms.

---

## Decision 8: `ARPEGGIATOR` ComponentType value — `'arpeggiator'`

**Decision**: `ComponentType.ARPEGGIATOR = 'arpeggiator'`. Utilities category. No bypass.

---

## Decision 9: Gate length implementation — fraction of step interval

**Decision**: `short = 0.25`, `medium = 0.5`, `long = 0.75` × step interval. Stored as a parameter with enum-like integer values (1/2/3), converted to fractions internally.

**Rationale**: Matches spec assumption. Same pattern as StepSequencer `gateLength` parameter.
