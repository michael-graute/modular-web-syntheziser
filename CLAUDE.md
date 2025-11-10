# ai-testing Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-29

## Active Technologies
- localStorage for acceptance tracking (004-startup-welcome-dialog)
- TypeScript 5.6+ (ES2020 target) (005-lfo-runtime-toggle)
- localStorage with JSON serialization (PatchStorage.ts, PatchSerializer.ts) (005-lfo-runtime-toggle)
- localStorage via existing PatchSerializer/PatchStorage pattern (006-collider-musical-physics)
- TypeScript 5.6+, ES2020 target, Web Audio API (008-lfo-parameter-depth)

- TypeScript 5.6+, ES2020 target (001-effect-bypass)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.6+, ES2020 target: Follow standard conventions

## Recent Changes
- 008-lfo-parameter-depth: Added TypeScript 5.6+, ES2020 target, Web Audio API
- 007-visual-update-scheduler: Added TypeScript 5.6+, ES2020 targe
- 006-collider-musical-physics: ✅ COMPLETE - Musical physics simulation component implemented


## Completed Features
- **006-collider-musical-physics** (2025-11-09): Collider component generates CV/Gate signals from 2D physics collisions
  - Core files:
    - src/components/utilities/Collider.ts - Main component with physics simulation
    - src/physics/PhysicsEngine.ts, src/physics/CollisionResolver.ts - Physics engine
    - src/music/MusicalScale.ts, src/music/WeightedRandomSelector.ts - Musical mapping
    - src/canvas/ColliderRenderer.ts - Visualization rendering
    - src/canvas/displays/ColliderDisplay.ts - Embedded canvas display
    - src/timing/TimingCalculator.ts - BPM and gate duration calculations
  - Features:
    - Bouncing ball physics with elastic collisions
    - Musical scale mapping (Major, Harmonic Minor, Natural Minor, Lydian, Mixolydian)
    - Weighted random note assignment (2x weight for tonic and fifth)
    - Configurable collider count (1-20), speed presets (slow/medium/fast)
    - BPM control (30-300) and gate size (whole/half/quarter/eighth/sixteenth)
    - Real-time visual feedback with collision flash effects
    - CV/Gate audio output (1V/octave standard, 0-5V gate envelope)
    - Configuration persistence via PatchSerializer
    - Device pixel ratio (DPR) scaling for high-DPI displays
  - Type definitions: specs/006-collider-musical-physics/contracts/types.ts
  - Validation: specs/006-collider-musical-physics/contracts/validation.ts
  - Documentation: Fixed canvas rendering issues (docs/collider-visualization-issue.md)

- **005-lfo-runtime-toggle** (2025-11-07): LFO components now support runtime on/off toggle
  - Modified: src/components/generators/LFO.ts
  - Added bypass methods: isBypassable(), enableBypass(), disableBypass()
  - Automatic visual feedback via existing CanvasComponent
  - Automatic state persistence via existing PatchSerializer
  - Phase continuity maintained (oscillator continues running when toggled off)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
