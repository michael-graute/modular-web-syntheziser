# Implementation Plan: Realtime CV Parameter Visualization

**Branch**: `002-realtime-cv-visualization` | **Date**: 2025-10-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-realtime-cv-visualization/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement realtime visual feedback for parameter controls when CV modulation is active. When a CV source (LFO, envelope, etc.) modulates a parameter, the associated UI control (knob, slider, button) will animate in realtime to reflect the current modulated value. This requires bridging the audio processing layer with the UI rendering layer through an efficient event system that maintains 20+ updates per second without impacting audio performance.

**Primary Technical Approach**: Implement a modulation visualization layer that samples CV-modulated parameter values at 20Hz from the audio thread and propagates updates to UI controls via a throttled event bus. UI controls will smooth-transition between values using requestAnimationFrame for 60 FPS visual updates while receiving 20 Hz data updates.

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020 target
**Primary Dependencies**:
- Frontend: Vite 6.0+, Canvas API (built-in)
- Audio: Web Audio API (built-in)
**Storage**: LocalStorage for patch state (existing)
**Testing**: None currently configured - NEEDS CLARIFICATION: Should tests be added for this feature?
**Target Platform**: Modern browsers with Web Audio API support
**Project Type**: Browser-based modular synthesizer (single-page application)
**Performance Goals**:
- 20 Hz minimum update rate for parameter visualization
- 50ms maximum latency from CV change to visual update
- 60 FPS UI rendering without audio glitches
- Support 10+ simultaneously modulated parameters
**Constraints**:
- Audio processing runs on separate Web Audio API thread
- Canvas rendering is synchronous on main thread
- No UI framework (vanilla TS + Canvas)
- Existing codebase has Parameter, Port, Connection, and Knob/Slider/Button control classes
**Scale/Scope**: Modular synthesizer with CV routing, existing parameter controls, and canvas-based UI

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Version**: Project Constitution (from `.specify/memory/constitution.md`)

**Note**: This project is a browser-based modular synthesizer, not the web application described in the template constitution. The constitution principles have been adapted where applicable:

✓ **Code Quality Principles**:
- [x] Readability: Use clear naming for ModulationVisualizer, ParameterValueSampler classes
- [x] Organization: Feature grouped in `src/visualization/` directory
- [x] Standards: Follow existing TypeScript conventions, pass linting

✓ **Testing Standards**:
- [ ] DEFERRED: No testing infrastructure exists; adding tests is out of scope for this feature
- Note: Manual testing will verify 20Hz update rate and smooth visuals

✓ **User Experience Consistency**:
- [x] Consistent with existing canvas-based UI controls
- [x] 50ms feedback requirement aligns with immediate feedback principle
- [x] Smooth animations at 60 FPS maintain visual quality

✓ **Performance Requirements**:
- [x] 20Hz update rate maps to runtime performance requirements
- [x] 60 FPS rendering requirement explicitly stated
- [x] No memory leaks: Use proper cleanup of intervals and event listeners

✗ **Multi-Tenancy, Observability, Security** - NOT APPLICABLE to single-user browser app

## Project Structure

### Documentation (this feature)

```text
specs/002-realtime-cv-visualization/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── ModulationVisualizationAPI.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── visualization/                      # NEW: Modulation visualization feature
│   ├── ModulationVisualizer.ts         # Coordinates CV sampling and UI updates
│   ├── ParameterValueSampler.ts        # Samples parameter values at 20Hz
│   ├── VisualUpdateScheduler.ts        # Schedules UI updates at 60 FPS
│   └── types.ts                        # Types for modulation visualization
├── canvas/
│   ├── controls/
│   │   ├── Knob.ts                     # MODIFY: Add setVisualValue() method
│   │   ├── Slider.ts                   # MODIFY: Add setVisualValue() method
│   │   └── Button.ts                   # MODIFY: Add setVisualValue() method
│   └── Canvas.ts                       # MODIFY: Integrate ModulationVisualizer
├── components/base/
│   ├── Parameter.ts                    # MODIFY: Add CV modulation tracking
│   └── SynthComponent.ts               # MODIFY: Notify parameter changes
├── core/
│   ├── Connection.ts                   # EXISTING: Connection data model
│   ├── EventBus.ts                     # MODIFY: Add modulation events
│   └── StateManager.ts                 # MODIFY: Track CV connections
└── main.ts                             # MODIFY: Initialize ModulationVisualizer
```

**Structure Decision**: Browser-based TypeScript application with canvas-based UI. Feature organized in dedicated `visualization/` directory to maintain separation from audio processing (components/) and UI rendering (canvas/). The ModulationVisualizer acts as coordinator between audio parameter changes and visual control updates.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| No testing infrastructure | Feature delivers user value without tests; manual testing sufficient for MVP | Adding full test setup (Jest, test infrastructure) would double implementation time and is deferred to future work |
