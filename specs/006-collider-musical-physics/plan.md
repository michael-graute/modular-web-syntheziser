# Implementation Plan: Collider Musical Physics Utility

**Branch**: `006-collider-musical-physics` | **Date**: 2025-11-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-collider-musical-physics/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Create a Collider utility component for the modular synthesizer that simulates physics-based collision of musical notes. Users configure a scale, root note, number of colliders (1-20), speed preset, BPM (30-300), and gate size (note lengths). Colliders move within a boundary, bounce off walls and each other using realistic physics, and output CV frequency signals when collisions occur. The component provides visual feedback for collisions, uses weighted random note assignment (favoring tonic and fifth), and persists all configuration settings.

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020 target
**Primary Dependencies**:
- Frontend: Vite (build tool), Web Audio API (audio synthesis), HTML Canvas API (visualization)
- No backend required (browser-based application)
**Storage**: localStorage via existing PatchSerializer/PatchStorage pattern
**Testing**: [NEEDS CLARIFICATION: Test framework not yet configured - recommend Jest or Vitest]
**Target Platform**: Modern web browsers with Web Audio API support
**Project Type**: Browser-based modular synthesizer (single-page application)
**Performance Goals**:
- 30+ FPS rendering with up to 20 colliders
- <16ms collision detection and audio output latency
- Smooth visual updates at 60fps target
**Constraints**:
- Must use Web Audio API for CV frequency output
- Must integrate with existing component architecture (SynthComponent base class)
- Must use existing CanvasComponent for visualization
- Must follow existing PatchSerializer pattern for persistence
- Physics simulation must run in real-time without blocking UI
**Scale/Scope**: Single utility component with physics engine, musical scale system, and timing/gate duration control

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Version**: 1.0.0

Verify feature compliance with project constitution principles:

- [x] **Code Quality - Readability and Maintainability**: Component follows established patterns (SynthComponent base class). Physics logic will be separated into distinct modules. Complex collision math will have explanatory comments.
- [x] **Code Quality - Code Organization**: Feature organized into modules: ColliderComponent (main), PhysicsEngine (collision simulation), MusicalScaleSystem (note generation), TimingManager (BPM/gate calculations)
- [x] **Code Quality - Code Standards**: TypeScript with ES2020 target. Will use named constants for magic numbers (velocities, weights, limits)
- [x] **Testing Standards**: Will require unit tests for physics calculations, scale generation, and timing math. Integration tests for collision detection
- [x] **User Experience - Interface Design**: Follows existing CanvasComponent pattern with controls (dropdowns, inputs, buttons). Consistent with LFO and other utilities
- [x] **User Experience - User Feedback**: Visual collision feedback (flash/pulse), input validation with error messages, disabled controls during simulation
- [x] **User Experience - Language and Content**: Clear terminology consistent with synthesizer domain (CV, BPM, gate, etc.)
- [x] **Performance Requirements - Runtime Performance**: 60 FPS target for animation (requestAnimationFrame), <16ms collision detection, efficient collision algorithms (spatial partitioning if needed)
- [x] **Performance Requirements - Optimization**: Canvas rendering optimized (dirty regions if needed), collision detection optimized (broad-phase/narrow-phase if >10 colliders)

**Violations**: None. This feature aligns with existing architecture and performance requirements.

## Project Structure

### Documentation (this feature)

```text
specs/006-collider-musical-physics/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── components/
│   └── utilities/
│       └── Collider.ts                    # Main component (extends SynthComponent)
├── physics/
│   ├── PhysicsEngine.ts                   # Collision detection and response
│   ├── Vector2D.ts                        # 2D vector math utilities
│   └── CollisionResolver.ts               # Collision response calculations
├── music/
│   ├── MusicalScale.ts                    # Scale definitions and note generation
│   ├── ScaleTypes.ts                      # Scale type constants and formulas
│   └── WeightedRandomSelector.ts          # Weighted random note assignment
├── timing/
│   └── TimingCalculator.ts                # BPM to duration calculations
├── canvas/
│   └── ColliderRenderer.ts                # Visual rendering for colliders
├── patch/
│   └── PatchSerializer.ts                 # (existing - will be used for persistence)
└── tests/
    ├── unit/
    │   ├── physics/                       # Physics engine tests
    │   ├── music/                         # Scale and note generation tests
    │   └── timing/                        # Timing calculation tests
    └── integration/
        └── collider-component.test.ts     # Full component integration tests
```

**Structure Decision**: Browser-based modular synthesizer with feature-organized modules. The Collider component integrates with existing SynthComponent base class and CanvasComponent visualization system. Physics, music theory, and timing concerns are separated into dedicated modules for testability and reusability.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. Feature aligns with existing architecture.

## Phase 0: Research & Technical Decisions

### Research Tasks

1. **Collision Detection Algorithms**
   - Research: Broad-phase (spatial hashing/grid) vs. brute-force for N≤20 objects
   - Research: Circle-circle collision detection formulas
   - Research: Circle-rectangle (wall) collision detection
   - Decision needed: Performance vs. complexity tradeoff for collision detection

2. **Elastic Collision Physics**
   - Research: 2D elastic collision formulas (equal mass case)
   - Research: Wall reflection calculations (angle of incidence = angle of reflection)
   - Research: Collision response for simultaneous collisions
   - Decision needed: Handling edge cases (stuck colliders, simultaneous collisions)

3. **Musical Scale Systems**
   - Research: Scale formulas (Major, Harmonic Minor, Natural Minor, Lydian, Mixolydian)
   - Research: MIDI note number to Hz frequency conversion
   - Research: CV voltage standards (1V/octave typical in modular synths)
   - Decision needed: CV output voltage range and scaling

4. **Canvas Rendering Performance**
   - Research: requestAnimationFrame best practices
   - Research: Canvas optimization techniques (dirty rectangles, off-screen canvas)
   - Research: Visual feedback effects (flash/pulse implementations)
   - Decision needed: Rendering strategy for 20 simultaneous animated objects

5. **Web Audio API Gate/Envelope**
   - Research: AudioParam scheduling for gate on/off
   - Research: Creating timed CV signals with precise duration
   - Research: Preventing clicks/pops when starting/stopping tones
   - Decision needed: Gate implementation approach (constant source + gain scheduling)

6. **Weighted Random Distribution**
   - Research: Algorithms for weighted random selection
   - Research: Performance of different weighted selection approaches
   - Decision needed: Implementation strategy for 2x weighting on tonic/fifth

7. **State Management for Running Simulation**
   - Research: Managing animation loop lifecycle
   - Research: Handling component cleanup (stopping oscillators, canceling animation frames)
   - Research: Preventing memory leaks in long-running simulations
   - Decision needed: Simulation lifecycle management pattern

### Output

Research findings will be documented in `research.md` with:
- Decision: [chosen approach]
- Rationale: [why chosen]
- Alternatives considered: [what else was evaluated]
- Implementation notes: [key considerations]

## Phase 1: Design & Contracts

### Data Model

**Output**: `data-model.md`

Key entities:
1. **Collider**
   - id: string
   - position: Vector2D (x, y)
   - velocity: Vector2D (vx, vy)
   - assignedNote: number (MIDI note number)
   - radius: number
   - lastCollisionTime: number (for visual feedback timing)

2. **ColliderConfig**
   - scaleType: ScaleType enum
   - rootNote: Note enum
   - colliderCount: number (1-20)
   - speedPreset: SpeedPreset enum
   - bpm: number (30-300)
   - gateSize: GateSize enum

3. **MusicalScale**
   - type: ScaleType
   - rootNote: Note
   - notes: number[] (MIDI note numbers)

4. **CollisionBoundary**
   - width: number
   - height: number
   - walls: Wall[] (top, right, bottom, left)

5. **GateOutput**
   - frequency: number (Hz)
   - duration: number (ms)
   - startTime: number (audio context time)

### API Contracts

**Output**: `contracts/` directory

Since this is a client-side component with no backend, "contracts" are TypeScript interfaces:

1. **IPhysicsEngine** interface
   - `update(deltaTime: number): CollisionEvent[]`
   - `addCollider(collider: Collider): void`
   - `removeCollider(id: string): void`
   - `reset(): void`

2. **IMusicalScaleSystem** interface
   - `getScale(type: ScaleType, root: Note): number[]`
   - `assignNotes(count: number, scale: number[], weighted: boolean): number[]`

3. **ITimingCalculator** interface
   - `calculateGateDuration(bpm: number, gateSize: GateSize): number`
   - `bpmToMs(bpm: number): number`

4. **ICVOutput** interface
   - `triggerNote(frequency: number, duration: number): void`
   - `stop(): void`

5. **IColliderSerializer** (extends ComponentData from existing types)
   - Configuration fields for persistence

### Quickstart Guide

**Output**: `quickstart.md`

Developer guide covering:
1. Component architecture overview
2. How to add the Collider to the component registry
3. Configuration and parameter setup
4. Physics engine initialization
5. Audio output connection points
6. Testing approach
7. Common pitfalls and debugging tips

## Next Steps

After Phase 1 completion:
1. Run `.specify/scripts/bash/update-agent-context.sh claude` to update agent context
2. Re-run Constitution Check to verify design compliance
3. Use `/speckit.tasks` to generate implementation tasks from this plan

**Status**: Plan ready for Phase 0 research execution.
