# Implementation Plan: LFO Runtime Toggle

**Branch**: `005-lfo-runtime-toggle` | **Date**: 2025-11-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-lfo-runtime-toggle/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add runtime on/off toggle capability to LFO components, allowing users to enable/disable modulation without removing LFO configuration. The toggle button will be placed in the LFO component header (consistent with existing effects bypass pattern), and will provide clear visual feedback through button state and component dimming. The feature preserves all LFO settings during toggle, maintains continuous phase progression, and persists the on/off state in saved patches.

## Technical Context

**Language/Version**: TypeScript 5.6+ (ES2020 target)
**Build System**: Vite 6.0
**Audio API**: Web Audio API (native browser)
**Primary Dependencies**:
- Canvas 2D API (UI rendering)
- localStorage (patch persistence)
**Storage**: localStorage with JSON serialization (PatchStorage.ts, PatchSerializer.ts)
**Testing**: Manual testing via browser (npm test && npm run lint)
**Target Platform**: Modern web browsers with Web Audio API support
**Project Type**: Browser-based modular synthesizer (vanilla TypeScript, no frameworks)
**Performance Goals**:
- Toggle response < 10ms
- No audio clicks/pops during state transitions
- Smooth visual transitions (60 FPS)
**Constraints**:
- Must maintain LFO phase continuity (internal clock keeps running when toggled off)
- Must follow existing effects bypass pattern for consistency
- Single developer
- No external dependencies allowed (pure Web Audio API)
**Scale/Scope**: Single-user browser application, client-side only, ~20 synthesizer component types

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Version**: 1.0.0

Verify feature compliance with Project Constitution principles:

- [x] **Readability and Maintainability**: Feature uses clear naming (isEnabled, toggleEnabled), follows SRP (single toggle responsibility), and reuses existing bypass pattern. Max function length < 50 lines maintained.
- [x] **Code Organization**: Feature extends existing LFO component in modular fashion, follows component-based architecture, maintains separation of concerns (audio logic in LFO.ts, visual in CanvasComponent.ts).
- [x] **Code Standards**: TypeScript static typing enforced, follows existing codebase conventions, no magic numbers (uses named constants for opacity values).
- [x] **Test Coverage Requirements**: Manual testing sufficient for audio feature (listen tests required). Regression tests for save/load state persistence.
- [x] **Test Quality**: Testing isolated to LFO component, no external dependencies to mock (pure Web Audio API).
- [x] **Interface Design**: Maintains consistency with existing effects bypass button pattern, uses established visual language (⚡ icon, 0.4 opacity dimming).
- [x] **User Feedback**: Immediate visual feedback on toggle (button state + component dimming), no loading states needed (< 10ms response).
- [x] **Accessibility**: Button is keyboard navigable (existing control framework), clear visual state indication meets contrast requirements.
- [x] **Performance Requirements**: Toggle response < 10ms (meets < 200ms API standard), 60 FPS animation maintained, no memory leaks (reuses existing audio nodes).
- [x] **Code Review Standards**: Single-file changes to LFO.ts and CanvasComponent.ts, testable via browser, follows established patterns.

**Result**: ✅ PASS - Feature adheres to all applicable constitution principles. Not applicable: Multi-tenancy (client-side app), DevOps (browser app), Security (no backend/auth).

## Project Structure

### Documentation (this feature)

```text
specs/005-lfo-runtime-toggle/
├── spec.md              # Feature specification (input)
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
│   ├── base/
│   │   └── SynthComponent.ts         # Abstract base class with bypass support
│   ├── generators/
│   │   └── LFO.ts                    # ⚡ MODIFIED: Add isEnabled flag, toggle methods
│   └── ComponentRegistry.ts
├── canvas/
│   ├── CanvasComponent.ts            # ⚡ MODIFIED: Add bypass button for LFO, dimming logic
│   ├── controls/
│   │   └── Button.ts                 # Existing control (reused)
│   └── Connection.ts
├── core/
│   ├── AudioEngine.ts
│   ├── StateManager.ts
│   └── types.ts                      # ⚡ MODIFIED: ComponentData interface (isBypassed field already exists)
├── patch/
│   ├── PatchSerializer.ts            # No changes needed (already serializes isBypassed)
│   └── PatchStorage.ts               # No changes needed
└── main.ts

tests/
└── manual/                           # Manual testing procedures
    └── lfo-toggle-test.md            # Test checklist for LFO toggle feature
```

**Structure Decision**: Browser-based modular synthesizer using vanilla TypeScript. Component-based architecture with clear separation between audio logic (Web Audio API nodes in components/) and visual rendering (Canvas 2D in canvas/). No backend/frontend split - purely client-side application.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
