# Implementation Plan: VU Meter

**Branch**: `027-vu-meter` | **Date**: 2026-05-31 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/027-vu-meter/spec.md`

## Summary

A passive VU Meter monitoring component with a single Audio-typed input port, no audio output, and a real-time segmented peak-level display rendered directly onto the main canvas. Uses `AnalyserNode.getFloatTimeDomainData()` for peak amplitude measurement at 60 FPS, with a 1.5-second peak hold indicator. Follows the `OscilloscopeDisplay` main-canvas pattern exactly.

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020 target, strict mode  
**Primary Dependencies**: Web Audio API (AnalyserNode, GainNode), DOM — zero runtime dependencies  
**Storage**: `localStorage` via existing `PatchSerializer` / `PatchStorage` pattern (no new fields needed)  
**Testing**: Vitest (run via `vitest run`)  
**Target Platform**: Browser (Vite dev server / static build)  
**Project Type**: Single-page modular synthesizer app (`src/` flat structure)  
**Performance Goals**: 60 FPS canvas rendering; peak measurement per render frame (~16ms resolution)  
**Constraints**:
- Zero new runtime dependencies — Web Audio API + DOM only
- TypeScript strict mode enforced
- No audio output port — purely passive monitoring tap
- Patch format backward-compatible (no new `PatchData` top-level fields)

## Constitution Check

**Constitution Version**: 1.0

- [x] **Readability & Maintainability**: Named constants for all magic numbers (SEGMENT_COUNT, GREEN_SEGMENTS, PEAK_HOLD_DURATION_MS, etc.). All functions < 50 lines. No nesting > 3 levels.
- [x] **Code Organization**: Component → `src/components/analyzers/`, Display → `src/canvas/displays/`. Mirrors Oscilloscope layout exactly.
- [x] **Code Standards**: Strict mode, no magic numbers, no linting warnings. `@ts-ignore` avoided — `getFloatTimeDomainData` is typed correctly with Float32Array.
- [x] **Test Coverage**: `VuMeter.ts` unit tests cover constructor, audio node lifecycle, and `getPeakLevel()` (critical business logic ≥ 80%). `VuMeterDisplay.ts` rendering is not unit-tested (no canvas mock setup in this project — consistent with existing Oscilloscope/ChordFinder display pattern).
- [x] **Test Quality**: Tests follow AAA pattern, isolated (vi.mock per file), descriptive names.
- [x] **UI Consistency**: Main-canvas display pattern (no DOM overlay), no new design tokens, follows existing segment colour palette.
- [x] **User Feedback**: Level display updates every render frame — effectively instantaneous.
- [x] **Performance**: No new RAF loop; drawn in existing render pass. `AnalyserNode` buffer read is O(N) where N=256 (negligible).

## Project Structure

### Documentation (this feature)

```text
specs/027-vu-meter/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── types.ts         # TypeScript type contracts
│   └── validation.ts    # Validation helpers
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (affected files)

```text
src/
├── core/types.ts                          MODIFY — add VU_METER to ComponentType enum
├── components/analyzers/VuMeter.ts        CREATE — audio component (AnalyserNode tap)
├── canvas/displays/VuMeterDisplay.ts      CREATE — segmented peak display renderer
├── canvas/CanvasComponent.ts              MODIFY — vuMeterDisplay field, createControls case, render, cleanup, getDisplayName
├── components/registerComponents.ts       MODIFY — register VuMeter in Analyzers category
└── utils/componentLayout.ts              MODIFY — add VU_METER cases

tests/
└── components/VuMeter.test.ts             CREATE — unit tests for audio component
```

## Complexity Tracking

> No constitution violations.

## Key Design Decisions (from research.md)

| Question | Decision | Rationale |
|----------|----------|-----------|
| Measurement method | Peak via `getFloatTimeDomainData` | Fast transient response; no extra Web Audio primitives |
| Display pattern | Main-canvas draw (OscilloscopeDisplay pattern) | No pointer events needed; simpler than DOM overlay |
| Peak hold location | State in VuMeterDisplay, not VuMeter | Keeps display concerns out of the audio component |
| Output port | None | Spec FR-006: passive tap only |
| Category | Analyzers | Semantic match alongside Oscilloscope |
| Dimensions | 160 × ~280 px | 1 port row + 200px display area |
| Patch persistence | No new PatchData fields | Zero parameters → no serialization changes needed |
| Test scope | VuMeter unit tests only | No canvas mock in test stack; consistent with Oscilloscope pattern |

## Display Segment Layout

```
Segments 17–19 (top 3)   → red    (#ef4444)
Segments 12–16 (middle 5) → yellow (#eab308)
Segments  0–11 (bottom 12) → green  (#22c55e)
Peak hold marker: white horizontal stripe at highest recent segment
Inactive segment background: #2a2a2a
```

## Audio Graph

```
[Connected source AudioNode]
         │
         ▼
    inputGain (GainNode, gain=1.0)
         │
         ▼
    analyser (AnalyserNode, fftSize=256, smoothingTimeConstant=0)
         │
    [no downstream connection — passive tap]
```

`getPeakLevel()` calls `analyser.getFloatTimeDomainData(dataArray)` and returns `max(|sample|)` clamped to [0, 1].
