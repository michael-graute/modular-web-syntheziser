# Implementation Plan: Startup Welcome Dialog

**Branch**: `004-startup-welcome-dialog` | **Date**: 2025-11-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-startup-welcome-dialog/spec.md`

## Summary

The Startup Welcome Dialog feature displays a modal window on first application launch containing a welcome message describing the modular synthesizer and terms & conditions with standard open-source disclaimers. Users must accept the terms before accessing the application. The feature extends the existing Modal base class and uses localStorage for persistent acceptance tracking.

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020 target
**Primary Dependencies**:
- Build Tool: Vite 6.0+
- Runtime: Browser (Web Audio API, localStorage)
**Storage**: localStorage for acceptance tracking
**Testing**: Not specified (to be determined in research phase)
**Target Platform**: Modern browsers supporting Web Audio API
**Project Type**: Browser-based single-page application with TypeScript and Vite
**Performance Goals**: Dialog must appear within 1 second of startup, minimal impact on initial load
**Constraints**:
- Browser-only application (no backend)
- Must use existing Modal base class pattern
- Must integrate with existing application initialization flow
- localStorage availability and quota limitations
**Scale/Scope**: Single user, local application, one-time acceptance tracking

### Key Unknowns (to be researched)

- Application initialization sequence and where to inject dialog check
- Testing strategy for localStorage-dependent features
- Content formatting for scrollable terms and conditions text
- Handling of localStorage quota exceeded scenarios
- Accessibility requirements for modal dialogs (ARIA attributes, focus management)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Version**: 1.0.0

Verify feature compliance with Project Constitution principles:

- [x] **Readability and Maintainability**: Feature extends existing Modal class following Single Responsibility Principle. Dialog management and storage are separate concerns. Functions remain under 50 lines.
- [x] **Code Organization**: Feature follows existing patterns (Modal base class, localStorage utilities like PatchStorage). Clear separation: UI (WelcomeDialog), storage (AcceptanceStorage), initialization (main.ts integration).
- [x] **Code Standards**: TypeScript with strict typing, follows existing code style, uses named constants for storage keys.
- [x] **Test Coverage Requirements**: Testing strategy to be defined in Phase 0 research. Will target critical paths: first launch, acceptance flow, persistence.
- [x] **Test Quality**: Tests will be isolated, use descriptive names, follow AAA pattern. Will mock localStorage for unit tests.
- [x] **Testing Practices**: Tests to be run before commits, fast unit tests, separate test suites (unit/integration).
- [x] **Interface Design**: Reuses existing Modal component for consistency. Follows established dark theme and styling patterns.
- [x] **User Feedback**: Immediate feedback on acceptance/decline actions. Clear error messages if storage fails.
- [x] **Accessibility**: Modal must support keyboard navigation (Tab, Enter, Escape). ARIA labels for screen readers. Focus management on open/close.
- [x] **Language and Content**: Clear, concise terms text. User-focused welcome message. Consistent terminology.
- [x] **Performance Requirements**: Dialog appears <1s on startup. Minimal payload (simple text content). Non-blocking localStorage operations.
- [x] **Runtime Performance**: No animations beyond existing modal fade-in. Simple DOM operations. Efficient localStorage checks.
- [x] **Code Review Standards**: All changes require review. Must test manually on different browsers.

**No violations identified.** Feature aligns with constitution principles and follows existing patterns.

## Project Structure

### Documentation (this feature)

```text
specs/004-startup-welcome-dialog/
├── plan.md              # This file
├── research.md          # Phase 0: Research findings
├── data-model.md        # Phase 1: Data structures
├── quickstart.md        # Phase 1: Developer guide
├── contracts/           # Phase 1: API/interface definitions
│   └── interfaces.ts    # TypeScript interfaces
└── tasks.md             # Phase 2: Implementation tasks (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── ui/
│   ├── Modal.ts                    # Existing base class
│   ├── WelcomeDialog.ts           # NEW: Welcome dialog implementation
│   └── ...
├── storage/
│   ├── AcceptanceStorage.ts       # NEW: Terms acceptance persistence
│   └── ...
├── patch/
│   ├── PatchStorage.ts            # Existing: localStorage pattern reference
│   └── ...
├── main.ts                        # MODIFY: Add dialog initialization check
└── ...

styles/
├── main.css                       # MAY MODIFY: Terms content styling
└── ...
```

**Structure Decision**: Browser-based TypeScript application with Vite bundler. Feature follows existing patterns: Modal base class for UI, localStorage for persistence. Integration point is main.ts application initialization.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | No violations | N/A |

---

## Research Questions for Phase 0

The following questions need to be answered during the research phase:

1. **Application Initialization Flow**
   - Where and how does the application initialize? (main.ts entry point)
   - What is the startup sequence? (DOM ready → AudioEngine init → Canvas init)
   - Where should we inject the welcome dialog check? (After DOM ready, before UI setup)

2. **Testing Strategy**
   - How to test localStorage-dependent features in browser environment?
   - What testing framework is appropriate? (Vitest, Jest, or manual browser tests)
   - How to mock localStorage for isolated unit tests?
   - E2E testing approach for first-launch scenarios?

3. **Content & Formatting**
   - Best practices for long scrollable text in modals?
   - Standard open-source disclaimer text templates?
   - Recommended format for terms and conditions (sections, headings, etc.)?

4. **Accessibility Standards**
   - WCAG 2.1 requirements for modal dialogs?
   - Proper ARIA attributes for blocking modals?
   - Focus trap implementation during modal display?
   - Screen reader announcements for modal content?

5. **Storage Edge Cases**
   - How to handle localStorage disabled/unavailable?
   - What to do when quota is exceeded?
   - Should we have a fallback for incognito/private browsing?
   - Version tracking for terms updates (future-proofing)?

6. **Integration Points**
   - How to prevent main app initialization until terms accepted?
   - Should we disable/hide UI elements or just block interaction?
   - Menu integration for "View Terms" option (P2 requirement)?
   - Where to add menu entry in existing UI?
