# Research: VU Meter (027)

**Phase**: Phase 0 — Research  
**Date**: 2026-05-31

---

## Decision: Peak Amplitude Measurement via AnalyserNode

**Decision**: Use the Web Audio API `AnalyserNode` with `getFloatTimeDomainData()` to extract per-frame peak amplitude.

**Rationale**: The Oscilloscope already uses `AnalyserNode` for time-domain data; reusing that pattern avoids any new Web Audio primitives. `getFloatTimeDomainData()` returns normalised float samples in the range [-1, 1] per frame. The peak (max absolute value across all samples in the buffer) gives an instantaneous amplitude reading with zero latency. This is the canonical Web Audio approach for level metering.

**fftSize choice**: A small `fftSize` (e.g. 256 or 512) is sufficient for level metering — we only need the time-domain buffer, not spectral resolution. Smaller buffer = faster response at the cost of slightly less temporal averaging, which is desirable for a peak meter. Use 256.

**Alternatives considered**:
- ScriptProcessorNode / AudioWorklet: Adds significant complexity; unnecessary since AnalyserNode suffices.
- RMS instead of peak: RMS would require squaring and averaging samples each frame. Spec explicitly chose peak for fast transient response.

---

## Decision: Segmented Display Drawn on Main Canvas

**Decision**: `VuMeterDisplay` draws directly onto the main `CanvasRenderingContext2D` in the existing render pass, following the `OscilloscopeDisplay` pattern. No separate DOM canvas, no overlay element.

**Rationale**: The Oscilloscope, ChordFinder, and StepSequencer all use this pattern successfully. It avoids z-index/viewport-transform complications and keeps the component self-contained. The Collider and Looper use a separate DOM canvas specifically because they need pointer events on the canvas itself — the VU Meter display is purely read-only, so the simpler pattern applies.

**Segment layout**: Vertical column of N discrete blocks, illuminated from the bottom up. Green for the lower zone, yellow for the middle zone, red at the top. Spec says no exact segment count — 20 segments is conventional for VU meters and fits comfortably in a ~180px tall display area at a compact component width.

**Alternatives considered**:
- Continuous gradient bar: Harder to read at a glance than discrete segments; spec explicitly said segmented column.
- Separate DOM canvas overlay: Unnecessary complexity; the Oscilloscope pattern works for a passive read-only display.

---

## Decision: Peak Hold via Time-Based Decay in Display Renderer

**Decision**: Track `peakHoldLevel` and `peakHoldTimestamp` in `VuMeterDisplay`. On each `render()` call, check if `Date.now() - peakHoldTimestamp > PEAK_HOLD_DURATION_MS` (1500 ms); if so, decay `peakHoldLevel` at a fixed rate toward the current level. Draw a single bright horizontal segment at the hold position.

**Rationale**: The display already runs in the 60 FPS render loop. Storing the hold state in the display renderer (rather than in `VuMeter.ts`) keeps the audio component free of display concerns. The decay after hold avoids a frozen indicator when the peak hold timer expires.

**Alternatives considered**:
- Peak hold in VuMeter audio component: Couples display logic into the audio layer; violates separation of concerns.
- requestAnimationFrame decay loop in display: Unnecessary — the main canvas render loop already calls `render()` every frame.

---

## Decision: No Audio Output Port (Passive Tap)

**Decision**: `VuMeter` has one Audio-typed input port and zero output ports.

**Rationale**: Spec FR-006 is explicit: the meter must not alter the audio signal. The `AnalyserNode` has an output, but we do not expose it as a patch port. The GainNode input feeds only into the AnalyserNode; neither is connected to any downstream audio destination.

**Alternatives considered**:
- Pass-through with output port: Would match the Oscilloscope pattern but contradicts the spec requirement and creates unnecessary routing complexity.

---

## Decision: ComponentType.VU_METER, Category "Analyzers"

**Decision**: Add `VU_METER = 'vu-meter'` to the `ComponentType` enum. Register the component under the "Analyzers" category (alongside Oscilloscope).

**Rationale**: The VU Meter is a signal analysis/monitoring tool, not a generator, processor, or utility. "Analyzers" is the correct semantic bucket.

---

## Decision: Component Dimensions — 160×320

**Decision**: Width 160 px, height calculated via `calculateComponentHeight` using the new case.

**Rationale**: The meter only has one input port (1 port row) and no knobs/sliders/dropdowns. The tile height = header (32) + port row (20+4) + small gap (10) + VU display area (200) + bottom padding (10) ≈ 276 px. Width 160 px provides enough space for a vertical meter bar with labels. The `calculateComponentWidth` and `calculateComponentHeight` functions need a new `VU_METER` case.

---

## Decision: Test Strategy — VuMeter unit tests only

**Decision**: Write unit tests for `VuMeter.ts` covering: constructor (port count, no parameters), `createAudioNodes` / `destroyAudioNodes`, `getPeakLevel()` return value. Use the existing `MockAnalyserNode` and `MockGainNode`. No tests for `VuMeterDisplay.ts` (pure canvas rendering — tested manually via the dev server).

**Rationale**: Mirrors the existing pattern — there are no unit tests for `OscilloscopeDisplay.ts`. Canvas rendering tests would require jsdom canvas mocking, which is not set up in this project's test stack.

---

## Decision: Patch Persistence — No New Fields

**Decision**: `VuMeter` has no user-configurable parameters, so `serialize()` emits an empty `parameters: {}`. `deserialize()` is a no-op beyond position restoration. No changes to `PatchData` schema.

**Rationale**: The base `SynthComponent.serialize()` / `deserialize()` already handle this correctly for parameter-free components. Backward compatibility is automatic — legacy patches without a VU Meter simply don't include it.
