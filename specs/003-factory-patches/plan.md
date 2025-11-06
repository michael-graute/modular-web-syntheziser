# Implementation Plan: Factory Patches

**Branch**: `003-factory-patches` | **Date**: 2025-10-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-factory-patches/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enable the modular synthesizer application to ship with pre-built example patches (factory patches) that users can load immediately. Factory patches are stored as JSON files in a public folder (`/public/patches/factory/`), displayed in a separate "Factory" category in the Load modal, and use the same format as user-saved patches. This reduces the learning curve for new users by providing working examples of bass, lead, and pad sounds.

**Technical Approach**: Extend existing PatchStorage and LoadModal to fetch factory patches from static JSON files at application startup, display them in a tabbed or categorized UI, and reuse existing patch loading infrastructure.

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020
**Primary Dependencies**:
- Build Tool: Vite 6.x
- Runtime: Browser Web Audio API
**Storage**:
- User patches: localStorage (existing)
- Factory patches: Static JSON files in `/public/patches/factory/`
**Testing**: Manual testing (no test framework currently in project)
**Target Platform**: Modern web browsers (Chrome, Firefox, Safari, Edge)
**Project Type**: Single-page application (client-side only, no backend)
**Performance Goals**:
- Factory patches load within 500ms on application startup
- No blocking of main UI during factory patch loading
**Constraints**:
- Client-side only (no server/API)
- Must work with existing patch JSON format
- Factory patches are read-only (cannot be modified or deleted)
- Must handle missing or corrupted factory patch files gracefully
**Scale/Scope**:
- Initial release: 3-5 factory patches
- Extensible architecture for adding more patches
- Each factory patch is ~5-50KB JSON file

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Version**: 1.0.0

Verify feature compliance with Project Constitution principles:

- [x] **Code Quality - Readability**: Are types self-documenting? Is new code clear and maintainable?
  - **Status**: PASS - Feature reuses existing PatchData type and follows established naming conventions
- [x] **Code Organization**: Is feature code properly organized within existing structure?
  - **Status**: PASS - Extends existing patch/ and ui/ modules, follows modular organization
- [x] **Testing Standards**: Is feature testable?
  - **Status**: PASS - Feature is manually testable through UI interactions (project has no automated test framework)
- [x] **UX Consistency**: Does UI maintain consistency with existing patterns?
  - **Status**: PASS - Extends existing LoadModal with category tabs, maintains visual consistency
- [x] **UX Feedback**: Are loading states and error handling included?
  - **Status**: PASS - Graceful error handling for missing/corrupted files, loading indicators planned
- [x] **Accessibility**: Is feature keyboard navigable and screen reader compatible?
  - **Status**: PASS - Modal already supports keyboard navigation, tab system will maintain accessibility
- [x] **Performance**: Does feature meet performance goals?
  - **Status**: PASS - Static file loading is fast, async loading prevents UI blocking
- [x] **Performance Optimization**: Are assets optimized?
  - **Status**: PASS - JSON files are small (<50KB), loaded only once at startup

**No constitution violations identified.** Feature aligns with existing architecture and patterns.

## Project Structure

### Documentation (this feature)

```text
specs/003-factory-patches/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── factory-patch-format.ts  # TypeScript interface for factory patch metadata
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── patch/
│   ├── PatchManager.ts          # Existing - no changes
│   ├── PatchSerializer.ts       # Existing - no changes
│   ├── PatchStorage.ts          # MODIFY - add factory patch loading
│   └── FactoryPatchLoader.ts    # NEW - fetch and parse factory patches
├── ui/
│   ├── LoadModal.ts             # MODIFY - add category tabs (Factory/My Patches)
│   └── Modal.ts                 # Existing - no changes
├── core/
│   └── types.ts                 # MODIFY - add FactoryPatchMetadata interface
└── main.ts                      # MODIFY - initialize factory patches on startup

public/
└── patches/
    └── factory/                 # NEW - factory patch JSON files
        ├── basic-oscillator.json
        ├── bass-synth.json
        └── pad-sound.json

specs/003-factory-patches/
└── contracts/
    └── factory-patch-format.ts  # TypeScript interface documentation
```

**Structure Decision**: Client-side only web application. Factory patches are static JSON files served from `/public/patches/factory/` and loaded via fetch API. Existing patch infrastructure is reused for loading, with minimal changes to LoadModal for category display.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations to track. Feature follows existing patterns and architecture.

---

## Phase 0: Research (COMPLETE)

**Status**: ✅ Complete
**Output**: `research.md`

### Key Research Findings

1. **Metadata Structure**: Optional `description` field added to PatchData (backward compatible)
2. **Loading Mechanism**: Async fetch from `/public` folder with graceful degradation
3. **UI Organization**: Tabbed interface (My Patches / Factory) for clear separation
4. **Error Handling**: Skip invalid patches with console warning (resilient)
5. **Versioning**: Semantic versioning with compatibility checks

All research questions resolved. No clarifications needed.

---

## Phase 1: Design & Contracts (COMPLETE)

**Status**: ✅ Complete
**Outputs**:
- `data-model.md` - Entity definitions and relationships
- `contracts/factory-patch-format.ts` - TypeScript interfaces
- `quickstart.md` - Developer implementation guide

### Data Model Summary

**New Entities**:
- `FactoryPatchMetadata` - Wrapper for factory patches with loading metadata
- `PatchCategory` - Type-safe discriminator ('user' | 'factory')

**Extended Entities**:
- `PatchData` - Added optional `description?: string` field

**No API contracts needed** (client-side only, no backend endpoints)

### Implementation Guide

The `quickstart.md` provides step-by-step instructions for:
1. Extending PatchData interface (10 mins)
2. Creating FactoryPatchLoader (45 mins)
3. Updating LoadModal UI with tabs (60 mins)
4. Creating factory patch JSON files (30 mins)
5. Initializing factory patches on startup (15 mins)
6. Handling read-only behavior (20 mins)

**Estimated total time**: 4-6 hours

---

## Constitution Check (POST-DESIGN RE-EVALUATION)

**Status**: ✅ PASS

All constitution principles still satisfied after design phase:
- Code quality maintained through clear interfaces and types
- Code organization follows existing modular structure
- UX consistency preserved with tabbed interface
- Performance goals met with async loading
- Accessibility maintained through keyboard navigation

No changes from initial evaluation. Feature ready for implementation.

---

## Next Steps

**Ready for**: `/speckit.tasks`

Run the tasks command to generate the implementation task breakdown:

```bash
/speckit.tasks
```

This will create `tasks.md` with dependency-ordered tasks based on the design artifacts produced in this planning phase.
