# Implementation Plan: Effect Bypass Toggle

**Branch**: `001-effect-bypass` | **Date**: 2025-10-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-effect-bypass/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add bypass functionality to effect and processor components in the modular synthesizer, allowing users to disable audio processing without disconnecting cables. The bypass toggle will be a clickable control in each component's header that passes audio through unprocessed when activated, while maintaining all connections and parameter settings.

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020 target
**Primary Dependencies**:
- Vite (6.0+) - Build tool and dev server
- Web Audio API - Browser-native audio processing
**Storage**: localStorage for patch persistence (existing)
**Testing**: [NEEDS CLARIFICATION: No test framework currently configured - should we add Jest/Vitest for this feature?]
**Target Platform**: Modern web browsers with Web Audio API support
**Project Type**: Single-page browser application with canvas-based UI
**Performance Goals**:
- Zero additional latency through bypassed components
- 60 FPS rendering for visual feedback
- Instant toggle response (< 16ms)
**Constraints**:
- Must work with existing Web Audio API graph structure
- Cannot introduce audio artifacts (clicks/pops) during bypass toggle
- Must maintain backward compatibility with existing patches
**Scale/Scope**: Modular synthesizer with 16 component types (generators, processors, effects, utilities, analyzers)

**Current Architecture**:
- Component-based with abstract `SynthComponent` base class
- Audio graph managed via Web Audio API nodes
- Canvas-based UI with custom controls (Knob, Slider, Dropdown, Button)
- Patch serialization/deserialization for save/load
- Event bus for component communication

**Relevant Files**:
- `src/components/base/SynthComponent.ts` - Base component class
- `src/canvas/CanvasComponent.ts` - Visual component representation
- `src/patch/PatchSerializer.ts` - Patch save/load logic
- `src/canvas/controls/Button.ts` - Existing button control (can be reference)
- `src/utils/constants.ts` - UI constants and dimensions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Version**: 1.0.0

Verify feature compliance with Constitution principles:

- [x] **Readability and Maintainability**: Feature follows existing patterns (canvas controls, component architecture). Clear separation between audio logic (SynthComponent) and visual logic (CanvasComponent). Bypass state is a simple boolean property.

- [x] **Code Organization**: Follows existing modular structure with clear separation of concerns. Changes localized to relevant files (components, canvas, patch serialization).

- [x] **Code Standards**: TypeScript strict mode already enabled. Will use existing constant patterns and naming conventions. No magic numbers.

- [x] **Testing Standards**: [DEFERRED] No testing framework currently exists. Bypass functionality can be manually tested. Recommend adding test framework in future but not blocking this feature.

- [x] **User Experience Consistency**: Follows existing UI patterns (button in header, visual feedback via dimming). Maintains 60 FPS requirement for canvas rendering.

- [x] **Performance Requirements**: Bypass toggle uses existing Web Audio API capabilities (connecting/disconnecting nodes). Zero additional latency as audio bypasses processing nodes entirely.

- [x] **Continuous Improvement**: Feature is additive and non-breaking. Uses established patterns that can be evolved.

**Gate Status**: ✅ PASSED - No violations. Testing framework absence is acknowledged but not blocking.

## Project Structure

### Documentation (this feature)

```text
specs/001-effect-bypass/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command - may be empty for this feature)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── base/
│   │   └── SynthComponent.ts           # Add isBypassed property and bypass logic
│   ├── processors/                      # Update all processor components
│   │   ├── Filter.ts                    # Add bypass support
│   │   ├── VCA.ts                       # Add bypass support
│   │   └── ADSREnvelope.ts              # Add bypass support
│   ├── effects/                         # Update all effect components
│   │   ├── Delay.ts                     # Add bypass support
│   │   └── Reverb.ts                    # Add bypass support
│   └── utilities/
│       ├── Mixer.ts                     # Add bypass support
│       └── StepSequencer.ts             # Determine if bypass applicable
├── canvas/
│   ├── CanvasComponent.ts               # Add bypass button rendering
│   ├── controls/
│   │   └── BypassButton.ts              # New: Bypass toggle control (or extend Button.ts)
│   └── Canvas.ts                        # Add bypass button click handling
├── patch/
│   ├── PatchSerializer.ts               # Include bypass state in serialization
│   └── PatchStorage.ts                  # Ensure bypass state is stored
├── utils/
│   └── constants.ts                     # Add bypass button constants
└── core/
    └── types.ts                         # Add bypass-related types if needed
```

**Structure Decision**: Browser-based synthesizer with canvas UI. Feature-based organization within existing modular architecture. Web Audio API for audio processing. No backend/frontend split - single codebase.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| No testing framework | Currently manual testing only | Adding test framework would delay delivery; feature is simple enough for manual verification; tests can be added in future refactor |

**Justification**: The absence of a testing framework is a pre-existing condition, not introduced by this feature. Adding a test framework (Jest/Vitest) would be valuable but significantly expands scope. Manual testing is sufficient for this feature given its straightforward nature (toggle button, boolean state, audio routing).
