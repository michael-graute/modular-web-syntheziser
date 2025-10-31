# Tasks: Factory Patches

**Input**: Design documents from `/specs/003-factory-patches/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/factory-patch-format.ts

**Tests**: No automated tests (manual testing only - project has no test framework)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single-page application structure:
- Source: `src/`
- Public assets: `public/`
- Specs: `specs/003-factory-patches/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create folder structure for factory patches

- [ ] T001 Create factory patches directory at `/public/patches/factory/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T002 [P] Extend PatchData interface in `src/core/types.ts` to add optional `description?: string` field
- [ ] T003 [P] Create FactoryPatchMetadata interface in `src/core/types.ts` with fields: filename, source, patch, loadedAt
- [ ] T004 [P] Create PatchCategory type in `src/core/types.ts` as `'user' | 'factory'`
- [ ] T005 Create FactoryPatchLoader class in `src/patch/FactoryPatchLoader.ts` with loadAll(), loadPatch(), validatePatch(), getAll(), isReady() methods
- [ ] T006 Implement async loadAll() method in `src/patch/FactoryPatchLoader.ts` to fetch patches from `/patches/factory/` using known filenames array
- [ ] T007 Implement validatePatch() method in `src/patch/FactoryPatchLoader.ts` to validate PatchData schema (name, version, components, connections required; description optional)
- [ ] T008 Export singleton factoryPatchLoader instance from `src/patch/FactoryPatchLoader.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Load Factory Patch from Library (Priority: P1) 🎯 MVP

**Goal**: Users can open the Load modal, see a "Factory" category with at least 3 example patches, select one, load it onto the canvas, and play notes to hear the sound.

**Independent Test**: Open Load modal → Click "Factory" tab → See at least 3 patches listed → Select a factory patch → Click Load → Verify patch loads on canvas with all components and connections → Play keyboard → Hear audio

### Implementation for User Story 1

- [ ] T009 [US1] Add `currentCategory: 'user' | 'factory'` state property to LoadModal class in `src/ui/LoadModal.ts`
- [ ] T010 [P] [US1] Create createTabs() method in `src/ui/LoadModal.ts` to generate tab navigation UI with "My Patches" and "Factory" tabs
- [ ] T011 [P] [US1] Create createTab() helper method in `src/ui/LoadModal.ts` to generate individual tab button with active state styling
- [ ] T012 [US1] Create switchCategory() method in `src/ui/LoadModal.ts` to update currentCategory state and refresh patch list
- [ ] T013 [US1] Update setupContent() method in `src/ui/LoadModal.ts` to include tabs at top of modal body
- [ ] T014 [US1] Update refreshPatchList() method in `src/ui/LoadModal.ts` to handle both 'user' and 'factory' categories, fetching patches from factoryPatchLoader when category is 'factory'
- [ ] T015 [US1] Import factoryPatchLoader in `src/ui/LoadModal.ts`
- [ ] T016 [US1] Initialize factory patches on app startup in `src/main.ts` by calling factoryPatchLoader.loadAll() with try/catch for graceful degradation
- [ ] T017 [US1] Create basic-oscillator.json in `/public/patches/factory/` with simple Oscillator → Master Output patch (include name, version, created, modified, components, connections)
- [ ] T018 [P] [US1] Create bass-synth.json in `/public/patches/factory/` with Oscillator → Filter → Master Output patch (sawtooth oscillator, lowpass filter)
- [ ] T019 [P] [US1] Create pad-sound.json in `/public/patches/factory/` with multiple detuned oscillators and effects

**Manual Testing Checklist for US1**:
- [ ] Open application and verify console shows "Factory patches loaded" message
- [ ] Open Load modal and verify two tabs appear: "My Patches" and "Factory"
- [ ] Click "Factory" tab and verify it switches (active styling changes)
- [ ] Verify at least 3 factory patches are listed
- [ ] Select a factory patch and click Load
- [ ] Verify patch loads onto canvas with all components visible
- [ ] Verify connections are rendered correctly
- [ ] Play keyboard and verify audio is produced according to patch design

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently - users can load and play factory patches

---

## Phase 4: User Story 2 - Browse Factory Patch Details (Priority: P2)

**Goal**: Users browsing factory patches can see a brief description (1-2 sentences) for each patch explaining the sound type and components used.

**Independent Test**: Open Load modal → Click "Factory" tab → Verify each factory patch displays a description below the name → Read description and verify it explains the sound clearly

### Implementation for User Story 2

- [ ] T020 [US2] Add description field to basic-oscillator.json in `/public/patches/factory/` (e.g., "A simple sine wave oscillator connected to the master output. Perfect for testing audio routing.")
- [ ] T021 [P] [US2] Add description field to bass-synth.json in `/public/patches/factory/` (e.g., "A warm bass sound using a sawtooth oscillator and lowpass filter with moderate resonance.")
- [ ] T022 [P] [US2] Add description field to pad-sound.json in `/public/patches/factory/` (e.g., "Smooth pad sound using multiple detuned oscillators with chorus and reverb.")
- [ ] T023 [US2] Update createPatchItem() method in `src/ui/LoadModal.ts` to display patch description below patch name if description field exists
- [ ] T024 [US2] Style description text in createPatchItem() with secondary text color and smaller font size for visual hierarchy

**Manual Testing Checklist for US2**:
- [ ] Open Load modal and click "Factory" tab
- [ ] Verify each factory patch shows a description below the name
- [ ] Verify descriptions are styled differently from names (smaller, secondary color)
- [ ] Read each description and verify it clearly explains the sound type
- [ ] Verify descriptions mention key components used

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - factory patches have descriptions that help users understand them before loading

---

## Phase 5: User Story 3 - Developer Adds New Factory Patch (Priority: P3)

**Goal**: Developers can add new factory patches by placing JSON files in `/public/patches/factory/` folder, and patches appear automatically on next app load. Invalid patches are skipped gracefully.

**Independent Test**: Create a new valid JSON patch file → Place in `/public/patches/factory/` → Add filename to FactoryPatchLoader's patchFiles array → Refresh app → Verify new patch appears in Factory category. Then test with an invalid JSON file → Refresh app → Verify app doesn't crash and shows console warning.

### Implementation for User Story 3

- [ ] T025 [US3] Update loadAll() method in `src/patch/FactoryPatchLoader.ts` to use Promise.allSettled instead of Promise.all for resilient loading
- [ ] T026 [US3] Add console.warn() for each invalid patch in loadPatch() method in `src/patch/FactoryPatchLoader.ts` with filename and error details
- [ ] T027 [US3] Add console.error() in loadAll() catch block in `src/patch/FactoryPatchLoader.ts` for general loading failures
- [ ] T028 [US3] Update loadAll() method in `src/patch/FactoryPatchLoader.ts` to filter out failed promises and only return successfully loaded patches
- [ ] T029 [US3] Add error state handling in refreshPatchList() in `src/ui/LoadModal.ts` to display "No factory patches available" message when factoryPatchLoader returns empty array
- [ ] T030 [US3] Create test-invalid-patch.json in `/public/patches/factory/` with malformed JSON (for testing error handling during development - remove before production)

**Manual Testing Checklist for US3**:
- [ ] Create a new valid factory patch JSON file with all required fields (name, version, created, modified, components, connections) and optional description
- [ ] Add the new filename to the patchFiles array in `src/patch/FactoryPatchLoader.ts`
- [ ] Place the new file in `/public/patches/factory/`
- [ ] Refresh the application
- [ ] Verify the new patch appears in the Factory category of the Load modal
- [ ] Verify the new patch can be loaded and played successfully
- [ ] Create an invalid JSON file (missing required fields or malformed JSON syntax)
- [ ] Add the invalid filename to the patchFiles array
- [ ] Place the invalid file in `/public/patches/factory/`
- [ ] Refresh the application
- [ ] Verify console shows warning message for the invalid patch
- [ ] Verify other valid patches still load successfully
- [ ] Verify Load modal doesn't crash or show errors
- [ ] Remove test-invalid-patch.json before committing

**Checkpoint**: All user stories should now be independently functional - developers can extend factory patch library easily

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final cleanup

- [ ] T031 [P] Update createPatchItem() in `src/ui/LoadModal.ts` to hide delete button when currentCategory is 'factory' (read-only enforcement)
- [ ] T032 [P] Add keyboard navigation support for tab switching in LoadModal (Tab key to move between tabs, Enter to activate)
- [ ] T033 [P] Add ARIA labels to tab buttons in createTab() method in `src/ui/LoadModal.ts` for screen reader accessibility
- [ ] T034 [P] Update info text in setupContent() in `src/ui/LoadModal.ts` to show context-appropriate message based on currentCategory
- [ ] T035 [P] Add loading indicator in LoadModal during factory patch loading (optional - enhances UX but not critical)
- [ ] T036 Code cleanup: Remove any console.log statements used for debugging (keep only intentional logging)
- [ ] T037 Code cleanup: Ensure all TypeScript types are properly defined with no 'any' types
- [ ] T038 Verify all factory patch JSON files follow consistent formatting (2-space indentation, alphabetical field order)
- [ ] T039 Run manual verification checklist from quickstart.md Section "Verification Checklist"
- [ ] T040 Remove test-invalid-patch.json from `/public/patches/factory/` if present

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent of US1, but naturally extends it
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Extends US1 and US2 with error handling improvements

### Within Each User Story

- US1: T009 must complete before T010-T014 (state before UI methods)
- US1: T015-T016 depend on all previous US1 tasks (integration)
- US1: T017-T019 can run in parallel (separate JSON files)
- US2: T020-T022 can run in parallel (separate JSON files)
- US2: T023-T024 are sequential (display logic then styling)
- US3: T025-T029 modify existing code sequentially

### Parallel Opportunities

- All Setup tasks can run together (only T001 in this feature)
- All Foundational tasks marked [P] can run in parallel: T002, T003, T004
- Foundational tasks T005-T008 are sequential (class definition → methods → singleton)
- US1: T010 and T011 can run in parallel (separate methods)
- US1: T017, T018, T019 can run in parallel (separate files)
- US2: T020, T021, T022 can run in parallel (separate files)
- Phase 6: All tasks marked [P] can run in parallel (T031-T035, T038)

---

## Parallel Example: User Story 1

```bash
# Parallel batch 1 - Tab UI methods (after T009 complete):
Task: "Create createTabs() method in src/ui/LoadModal.ts..."
Task: "Create createTab() helper method in src/ui/LoadModal.ts..."

# Parallel batch 2 - Factory patch JSON files (after T016 complete):
Task: "Create basic-oscillator.json in /public/patches/factory/..."
Task: "Create bass-synth.json in /public/patches/factory/..."
Task: "Create pad-sound.json in /public/patches/factory/..."
```

## Parallel Example: User Story 2

```bash
# Parallel batch - Add descriptions to all patches:
Task: "Add description field to basic-oscillator.json..."
Task: "Add description field to bass-synth.json..."
Task: "Add description field to pad-sound.json..."
```

## Parallel Example: Phase 6 Polish

```bash
# Parallel batch - UI polish tasks:
Task: "Update createPatchItem() to hide delete button..."
Task: "Add keyboard navigation support for tabs..."
Task: "Add ARIA labels to tab buttons..."
Task: "Update info text based on currentCategory..."
Task: "Verify all JSON files follow consistent formatting..."
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002-T008) - CRITICAL
3. Complete Phase 3: User Story 1 (T009-T019)
4. **STOP and VALIDATE**: Manually test all US1 acceptance criteria
5. Deploy/demo if ready - users can now load and play 3 factory patches

**MVP Success Criteria**:
- ✅ Factory patches load on startup without errors
- ✅ LoadModal shows Factory tab
- ✅ At least 3 factory patches are listed
- ✅ Factory patches can be loaded and played
- ✅ Audio is produced correctly

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Manual test independently → Deploy/Demo (MVP!)
   - **Value**: New users can immediately explore 3 working examples
3. Add User Story 2 → Manual test independently → Deploy/Demo
   - **Value**: Users understand patches before loading (reduced trial and error)
4. Add User Story 3 → Manual test independently → Deploy/Demo
   - **Value**: Developers can extend library, app handles errors gracefully
5. Add Polish (Phase 6) → Final QA → Deploy
   - **Value**: Enhanced UX with proper accessibility and read-only enforcement

### Sequential Team Strategy (Single Developer)

1. Week 1: Complete Setup + Foundational (Phase 1-2)
2. Week 2: Complete User Story 1 → Test → Deploy MVP
3. Week 3: Complete User Story 2 → Test → Deploy enhancement
4. Week 4: Complete User Story 3 + Polish → Final test → Deploy complete feature

**Estimated Total Time**: 4-6 hours implementation + 2-3 hours testing = ~8 hours total

---

## Notes

- **[P] tasks** = different files, no dependencies - safe to run in parallel
- **[Story] label** maps task to specific user story for traceability and independent testing
- **Each user story should be independently completable and testable** - US2 doesn't break if US3 isn't done
- **Manual testing is required** - project has no automated test framework, so manual verification checklist is critical
- **Commit after each logical group** of tasks (e.g., after completing all Foundational tasks, after US1, etc.)
- **Stop at any checkpoint** to validate story independently before moving forward
- **Factory patches are read-only** - no save/update/delete operations, enforced in UI (T031)
- **Graceful degradation** - app continues to work even if factory patches fail to load (T016, T029)
- **Error handling is robust** - invalid patches don't crash the app, they're skipped with warnings (T025-T028)

---

## Success Validation

After completing all tasks, verify:

**User Story 1 (P1 - MVP)**:
- [ ] Factory patches load on application startup without errors
- [ ] LoadModal displays two tabs: "My Patches" and "Factory"
- [ ] Clicking "Factory" tab shows factory patches
- [ ] At least 3 factory patches are listed
- [ ] Selecting and loading a factory patch works correctly
- [ ] Loaded factory patch plays audio when keyboard is pressed
- [ ] User patches in localStorage still work normally

**User Story 2 (P2)**:
- [ ] Factory patches display description text (1-2 sentences)
- [ ] Descriptions clearly explain the sound type and components
- [ ] Description styling is visually distinct from patch name

**User Story 3 (P3)**:
- [ ] Invalid factory patch files are skipped gracefully
- [ ] Console shows appropriate warnings for invalid patches
- [ ] Missing factory patches folder doesn't crash the app
- [ ] Developers can add new patches by adding JSON files + updating patchFiles array

**Polish (Phase 6)**:
- [ ] No delete button appears for factory patches
- [ ] Tabs are keyboard navigable
- [ ] Tab buttons have appropriate ARIA labels
- [ ] All code is clean and type-safe (no 'any' types)
