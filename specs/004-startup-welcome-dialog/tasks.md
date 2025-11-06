# Tasks: Startup Welcome Dialog

**Input**: Design documents from `/specs/004-startup-welcome-dialog/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are OPTIONAL for this feature. Manual browser testing will be used for validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

This is a browser-based single-page application with TypeScript and Vite:
- Source code: `src/` at repository root
- Styles: `styles/` at repository root
- Main HTML: `index.html` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create storage directory and validate environment

- [x] T001 Create `src/storage/` directory for AcceptanceStorage utility
- [x] T002 Verify existing Modal base class in `src/ui/Modal.ts` is accessible
- [x] T003 Verify `isLocalStorageAvailable()` utility exists in `src/utils/validators.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core storage and dialog components that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 [P] Create AcceptanceStorage utility in `src/storage/AcceptanceStorage.ts` with all methods (getAcceptance, saveAcceptance, hasValidAcceptance, clearAcceptance)
- [x] T005 [P] Create WelcomeDialog component in `src/ui/WelcomeDialog.ts` extending Modal base class with basic structure
- [x] T006 [US1] Add welcome content HTML with sectioned structure (welcome message + terms sections) in WelcomeDialog.setupContent()
- [x] T007 [US1] Add terms and conditions text with 4 sections (No Warranty, Limitation of Liability, Open Source License, User Responsibility) in WelcomeDialog.setupContent()

**Checkpoint**: Foundation ready - AcceptanceStorage can persist data, WelcomeDialog can display content

---

## Phase 3: User Story 1 - First-Time User Onboarding (Priority: P1) 🎯 MVP

**Goal**: Display welcome dialog on first launch, block access until terms accepted, persist acceptance status

**Independent Test**: Clear localStorage, refresh browser, verify dialog appears with correct content, accept terms, verify app initializes, refresh browser, verify dialog does NOT appear

### Implementation for User Story 1

- [x] T008 [US1] Implement button setup in WelcomeDialog with Accept and Decline buttons for first-time mode
- [x] T009 [US1] Implement accept handler in WelcomeDialog.handleAccept() that triggers callback and closes dialog
- [x] T010 [US1] Implement decline handler in WelcomeDialog.handleDecline() that triggers callback and closes dialog
- [x] T011 [US1] Add callback registration methods onAccept() and onDecline() in WelcomeDialog
- [x] T012 [US1] Create checkAndShowWelcomeDialog() helper function in `src/main.ts` using Promise-based flow
- [x] T013 [US1] Implement acceptance check logic in checkAndShowWelcomeDialog() using AcceptanceStorage.hasValidAcceptance()
- [x] T014 [US1] Implement dialog display logic with Promise resolution on Accept/Decline in checkAndShowWelcomeDialog()
- [x] T015 [US1] Add acceptance/rejection persistence in checkAndShowWelcomeDialog() using AcceptanceStorage.saveAcceptance()
- [x] T016 [US1] Integrate checkAndShowWelcomeDialog() at top of init() function in `src/main.ts` before browser checks
- [x] T017 [US1] Add error handling for declined terms - show error message and halt initialization using showError()
- [x] T018 [US1] Add import statements for AcceptanceStorage and WelcomeDialog at top of `src/main.ts`

**Manual Testing Checklist for US1**:
- Clear localStorage: `localStorage.clear()`
- Refresh page → Welcome dialog should appear
- Dialog content visible: welcome message + terms and conditions
- Click "Accept" → Dialog closes, app initializes
- Refresh page → Dialog should NOT appear (acceptance persisted)
- Clear localStorage again
- Refresh page → Dialog appears
- Click "Decline" → Error message shown, app does not initialize
- Refresh page → Dialog appears again (rejection recorded but re-prompted)

**Checkpoint**: At this point, User Story 1 should be fully functional - first launch flow works end-to-end

---

## Phase 4: User Story 2 - Terms Review Access (Priority: P2)

**Goal**: Allow users to review welcome message and terms after initial acceptance via menu button

**Independent Test**: After accepting terms (US1), click "Terms" button in top bar, verify dialog opens in non-blocking review mode, verify can close with Close button or Escape key, verify app continues normal operation

### Implementation for User Story 2

- [ ] T019 [US2] Add "Terms" button to top bar in `index.html` after Help button with id="btn-terms"
- [ ] T020 [US2] Implement review mode support in WelcomeDialog constructor - modify options based on reviewMode flag
- [ ] T021 [US2] Update button setup in WelcomeDialog to show only "Close" button when reviewMode is true
- [ ] T022 [US2] Add review mode dialog opening logic in setupPatchManagement() in `src/main.ts`
- [ ] T023 [US2] Wire "Terms" button click event to open WelcomeDialog with reviewMode: true

**Manual Testing Checklist for US2**:
- Accept terms on first launch (US1 must be complete)
- App should initialize normally
- Click "Terms" button in top bar
- Dialog opens showing same welcome + terms content
- No Accept/Decline buttons (only Close button)
- Can close dialog with Close button → App continues
- Click "Terms" button again
- Can close dialog with Escape key → App continues
- Can close dialog by clicking overlay → App continues

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Declining Terms Handling (Priority: P3)

**Goal**: Gracefully handle declined terms with clear messaging and appropriate behavior

**Independent Test**: Clear localStorage, launch app, click "Decline" button, verify error message displayed, verify app does not initialize, verify dialog reappears on next launch

### Implementation for User Story 3

- [ ] T024 [US3] Enhance decline handler to record rejection in AcceptanceStorage (already implemented in T010, verify behavior)
- [ ] T025 [US3] Verify error message clarity in showError() when terms are declined
- [ ] T026 [US3] Test app behavior when user closes browser/tab after declining (verify rejection persisted)
- [ ] T027 [US3] Verify dialog reappears correctly on subsequent launches after rejection

**Manual Testing Checklist for US3**:
- Clear localStorage
- Launch app → Dialog appears
- Click "Decline" → Error message: "You must accept the terms to use this application."
- Verify app does NOT initialize (no canvas, no audio, no UI functionality)
- Close browser/refresh page
- Dialog appears again (rejection recorded but must re-accept)
- Click "Decline" again → Same error behavior
- Close dialog with close button (×) without clicking Accept/Decline
- Should behave same as Decline (per closeOnOverlayClick: false)

**Checkpoint**: All three user stories should now be independently functional and testable

---

## Phase 6: Accessibility & Edge Cases

**Purpose**: Ensure WCAG 2.1 Level AA compliance and handle edge cases gracefully

- [ ] T028 [P] Add ARIA attributes to WelcomeDialog modal (role="dialog", aria-modal="true", aria-labelledby, aria-describedby)
- [ ] T029 [P] Add ID attributes to title and description elements for ARIA references
- [ ] T030 Implement focus management in WelcomeDialog.open() - store previous focus, focus first interactive element
- [ ] T031 Implement focus restoration in WelcomeDialog.close() - restore focus to previously focused element
- [ ] T032 Test keyboard navigation: Tab through buttons, Enter to activate, verify close button behavior
- [ ] T033 [P] Add localStorage unavailable handling in AcceptanceStorage - verify session memory fallback works
- [ ] T034 [P] Add warning log when using session memory fallback in AcceptanceStorage.saveAcceptance()
- [ ] T035 Verify version checking works in AcceptanceStorage.getAcceptance() - outdated versions re-prompt dialog
- [ ] T036 [P] Add data validation in AcceptanceStorage.isValid() for corrupted records
- [ ] T037 Test edge case: corrupted localStorage data (invalid JSON) - verify shows dialog
- [ ] T038 Test edge case: missing fields in acceptance record - verify shows dialog
- [ ] T039 Test edge case: invalid timestamp format - verify shows dialog

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T040 [P] Add console logging for acceptance/rejection events for debugging
- [ ] T041 [P] Verify dialog styling matches existing Modal dark theme
- [ ] T042 Add CSS for terms content typography if needed (line-height: 1.6, section spacing)
- [ ] T043 Verify dialog appears within 1 second of startup (performance requirement SC-003)
- [ ] T044 Test on multiple browsers (Chrome, Firefox, Safari, Edge)
- [ ] T045 Test on different screen resolutions (1024x768 to 4K) - verify dialog readable
- [ ] T046 [P] Code cleanup: remove any console.logs not needed for production
- [ ] T047 [P] Add JSDoc comments to AcceptanceStorage public methods
- [ ] T048 [P] Add JSDoc comments to WelcomeDialog public methods
- [ ] T049 Run full quickstart.md validation checklist
- [ ] T050 Final manual test of all three user stories end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User Story 1 (P1) should be completed first (MVP)
  - User Story 2 (P2) can start after US1 is complete (builds on acceptance flow)
  - User Story 3 (P3) can start after US1 is complete (tests decline behavior)
- **Accessibility (Phase 6)**: Can start after any user story is functional
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after US1 complete - Reuses WelcomeDialog with reviewMode flag
- **User Story 3 (P3)**: Can start after US1 complete - Tests decline path of same dialog

### Within Each User Story

**User Story 1 Flow**:
1. T008-T011: Dialog button setup and handlers (can run in parallel within WelcomeDialog.ts)
2. T012-T015: Integration logic in main.ts (sequential - Promise flow)
3. T016-T018: Wire into init() function (sequential - depends on T012-T015)

**User Story 2 Flow**:
1. T019: HTML button (independent)
2. T020-T021: Review mode support in WelcomeDialog (sequential)
3. T022-T023: Wire button event (sequential)

**User Story 3 Flow**:
1. T024-T027: Verification and testing tasks (mostly sequential testing)

### Parallel Opportunities

- **Setup (Phase 1)**: All 3 tasks can run in parallel (different verification steps)
- **Foundational (Phase 2)**: T004 and T005 can run in parallel (different files)
- **User Story 1**: T008-T011 can be worked on in parallel (same class, different methods)
- **Accessibility (Phase 6)**: T028-T029, T033-T034, T036 can run in parallel (independent additions)
- **Polish (Phase 7)**: T040-T041, T046-T048 can run in parallel (different concerns)

---

## Parallel Example: Foundational Phase

```bash
# Launch in parallel (different files):
Task: "Create AcceptanceStorage utility in src/storage/AcceptanceStorage.ts"
Task: "Create WelcomeDialog component in src/ui/WelcomeDialog.ts"

# Then sequentially:
Task: "Add welcome content HTML in WelcomeDialog.setupContent()"
Task: "Add terms and conditions text in WelcomeDialog.setupContent()"
```

---

## Parallel Example: User Story 1 Implementation

```bash
# Launch in parallel (different methods in WelcomeDialog):
Task: "Implement button setup with Accept and Decline buttons"
Task: "Implement accept handler in WelcomeDialog.handleAccept()"
Task: "Implement decline handler in WelcomeDialog.handleDecline()"
Task: "Add callback registration methods onAccept() and onDecline()"

# Then sequentially in main.ts:
Task: "Create checkAndShowWelcomeDialog() helper function"
Task: "Implement acceptance check logic"
Task: "Implement dialog display logic with Promise"
Task: "Add acceptance/rejection persistence"
Task: "Integrate checkAndShowWelcomeDialog() at top of init()"
Task: "Add error handling for declined terms"
Task: "Add import statements"
```

---

## Parallel Example: Accessibility Phase

```bash
# Launch in parallel (independent additions):
Task: "Add ARIA attributes to WelcomeDialog modal"
Task: "Add ID attributes to title and description elements"
Task: "Add localStorage unavailable handling"
Task: "Add warning log when using session memory fallback"
Task: "Add data validation for corrupted records"

# Then sequentially (testing):
Task: "Implement focus management in WelcomeDialog.open()"
Task: "Implement focus restoration in WelcomeDialog.close()"
Task: "Test keyboard navigation"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (Tasks T001-T003)
2. Complete Phase 2: Foundational (Tasks T004-T007) - CRITICAL foundation
3. Complete Phase 3: User Story 1 (Tasks T008-T018)
4. **STOP and VALIDATE**: Manual test User Story 1 independently
   - First launch flow
   - Acceptance persistence
   - Decline handling
5. Deploy/demo if ready - **This is a functional MVP**

**At this point**: Users can see welcome dialog, accept terms, and use the app. This satisfies the core legal/compliance requirement.

### Incremental Delivery

1. **Foundation** (Phases 1-2) → Storage + Dialog components ready
2. **Add User Story 1** (Phase 3) → Test independently → **Deploy/Demo MVP**
   - First-time users see welcome dialog
   - Terms must be accepted
   - Acceptance persists across sessions
3. **Add User Story 2** (Phase 4) → Test independently → **Deploy/Demo Enhanced**
   - Users can review terms after acceptance
   - Transparency and legal compliance enhanced
4. **Add User Story 3** (Phase 5) → Test independently → **Deploy/Demo Complete**
   - Decline handling polished
   - Clear messaging for non-acceptance
5. **Add Accessibility** (Phase 6) → Test independently → **Deploy/Demo WCAG Compliant**
   - Keyboard navigation works
   - Screen reader support
   - Edge cases handled
6. **Polish** (Phase 7) → Final validation → **Production Ready**

Each increment adds value without breaking previous functionality.

### Parallel Team Strategy

With multiple developers:

1. **Everyone**: Complete Setup + Foundational together (small, quick tasks)
2. **Once Foundational is done**:
   - **Developer A**: User Story 1 (core acceptance flow) - Priority 1
   - **Developer B**: User Story 2 (review mode) - Priority 2
   - **Developer C**: Accessibility enhancements (Phase 6) - Can start after US1
3. **Integration**: US2 and US3 integrate cleanly with US1 (same WelcomeDialog component)
4. **Polish**: Everyone contributes to final polish tasks

---

## Task Summary

**Total Tasks**: 50
- Phase 1 (Setup): 3 tasks
- Phase 2 (Foundational): 4 tasks
- Phase 3 (User Story 1 - P1 MVP): 11 tasks
- Phase 4 (User Story 2 - P2): 5 tasks
- Phase 5 (User Story 3 - P3): 4 tasks
- Phase 6 (Accessibility): 12 tasks
- Phase 7 (Polish): 11 tasks

**Parallel Opportunities**: 21 tasks marked [P] can run in parallel

**MVP Scope** (Recommended first delivery):
- Phases 1-3 only (18 tasks)
- Delivers fully functional first-time acceptance flow
- Satisfies core legal/compliance requirement
- Estimated effort: 4-6 hours for experienced developer

**Full Feature Scope**:
- All 50 tasks
- Delivers all 3 user stories + accessibility + polish
- Production-ready with WCAG compliance
- Estimated effort: 10-14 hours for experienced developer

---

## Notes

- **[P] tasks**: Different files or independent additions, no dependencies
- **[Story] labels**: US1 (First-Time Onboarding), US2 (Terms Review), US3 (Decline Handling)
- **Each user story is independently testable**: Can validate US1 without US2/US3
- **Manual testing only**: No automated test suite requested in specification
- **Focus on browser testing**: Test across Chrome, Firefox, Safari, Edge
- **Accessibility is critical**: WCAG 2.1 Level AA compliance is a constitution requirement
- **Version tracking**: Built into AcceptanceStorage for future terms updates
- **Storage fallback**: Gracefully handles localStorage disabled scenarios

**Commit strategy**: Commit after each task or logical group (e.g., all T008-T011 together as "Implement WelcomeDialog button handlers")

**Stop at any checkpoint**: Validate story independently before proceeding to next priority

**Avoid**:
- Implementing tests that weren't requested
- Skipping accessibility phase (constitution requirement)
- Breaking user story independence
- Modifying base Modal class unnecessarily
