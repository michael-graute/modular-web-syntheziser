# ai-testing Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-29

## Active Technologies
- localStorage for acceptance tracking (004-startup-welcome-dialog)
- TypeScript 5.6+ (ES2020 target) (005-lfo-runtime-toggle)
- localStorage with JSON serialization (PatchStorage.ts, PatchSerializer.ts) (005-lfo-runtime-toggle)
- localStorage via existing PatchSerializer/PatchStorage pattern (006-collider-musical-physics)

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
- 006-collider-musical-physics: Added TypeScript 5.6+, ES2020 target
- 005-lfo-runtime-toggle: ✅ COMPLETE - LFO runtime toggle implemented with bypass pattern
- 004-startup-welcome-dialog: Added TypeScript 5.6+, ES2020 targe


## Completed Features
- **005-lfo-runtime-toggle** (2025-11-07): LFO components now support runtime on/off toggle
  - Modified: src/components/generators/LFO.ts
  - Added bypass methods: isBypassable(), enableBypass(), disableBypass()
  - Automatic visual feedback via existing CanvasComponent
  - Automatic state persistence via existing PatchSerializer
  - Phase continuity maintained (oscillator continues running when toggled off)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
