# Tasks: Collider Musical Physics Component

**Input**: Design documents from `/specs/006-collider-musical-physics/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Test tasks ARE included per project constitution requirements (§Testing Standards: 80% code coverage for critical logic, 100% for utilities). Phase 2.5 contains 11 test tasks covering all core modules.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project with `src/` and `tests/` at repository root
- Component files in `src/components/utilities/`
- Module files organized by domain (physics, music, timing, canvas)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Add ComponentType.COLLIDER enum value to src/core/types.ts
- [X] T002 [P] Create directory structure: src/physics/, src/music/, src/timing/
- [X] T003 [P] Create contracts directory: specs/006-collider-musical-physics/contracts/
- [X] T004 [P] Create TypeScript type definitions in specs/006-collider-musical-physics/contracts/types.ts
- [X] T005 [P] Configure test framework (Jest or Vitest) with TypeScript 5.6+ support in package.json and jest.config.js or vitest.config.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T006 [P] Create Vector2D utility class in src/physics/Vector2D.ts with add, subtract, magnitude, normalize methods
- [X] T007 [P] Create ScaleTypes constants in src/music/ScaleTypes.ts with interval definitions for Major, Harmonic Minor, Natural Minor, Lydian, Mixolydian
- [X] T008 [P] Create MusicalScale class in src/music/MusicalScale.ts with scale generation, CV voltage calculation (1V/octave), and MIDI-to-Hz conversion
- [X] T009 [P] Create WeightedRandomSelector utility in src/music/WeightedRandomSelector.ts with 2x weighting for tonic (index 0) and fifth (index 4)
- [X] T010 [P] Create TimingCalculator class in src/timing/TimingCalculator.ts with BPM to millisecond duration conversion
- [X] T011 [P] Create validation functions in specs/006-collider-musical-physics/contracts/validation.ts for ColliderConfig (collider count 1-20, BPM 30-300, enum validations)
- [X] T012 Create PhysicsEngine class in src/physics/PhysicsEngine.ts with update(), addCollider(), removeCollider(), reset() methods and collision detection (brute-force O(n²))
- [X] T013 Create CollisionResolver class in src/physics/CollisionResolver.ts with elastic collision physics (equal mass) and wall reflection (angle of incidence = angle of reflection)
- [X] T014 Create ColliderRenderer class in src/canvas/ColliderRenderer.ts with canvas rendering, visual flash effects (300ms decay), and boundary visualization

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 2.5: Core Module Testing (Constitution Requirement)

**Purpose**: Test coverage for utility modules per constitution §Testing Standards (80% critical logic, 100% utilities)

**⚠️ CONSTITUTION MANDATE**: Tests MUST be written before or alongside implementation

### Physics Module Tests

- [X] T015 [P] [TEST] Create Vector2D unit tests in tests/unit/physics/Vector2D.test.ts: test add, subtract, magnitude, normalize, dot product methods with edge cases (zero vectors, normalization of zero)
- [X] T016 [P] [TEST] Create PhysicsEngine collision detection tests in tests/unit/physics/PhysicsEngine.test.ts: test wall collision detection for all 4 walls, circle-circle collision with various separations (touching, overlapping, separated)
- [X] T017 [P] [TEST] Create PhysicsEngine collision response tests in tests/unit/physics/PhysicsEngine.test.ts: test elastic collision velocity exchange (equal mass), position correction prevents overlap, wall reflection accuracy within 2 degrees
- [X] T018 [P] [TEST] Create CollisionResolver unit tests in tests/unit/physics/CollisionResolver.test.ts: test resolveWallCollision() position clamping, resolveCircleCollision() with simultaneous impacts, edge case of zero velocity

### Music Module Tests

- [X] T019 [P] [TEST] Create MusicalScale unit tests in tests/unit/music/MusicalScale.test.ts: test MIDI-to-Hz conversion (A4=440Hz), CV voltage calculation (1V/octave, C4=0V), scale interval generation for all 5 scale types (Major, Harmonic Minor, Natural Minor, Lydian, Mixolydian)
- [X] T020 [P] [TEST] Create WeightedRandomSelector unit tests in tests/unit/music/WeightedRandomSelector.test.ts: test weighted distribution with 1000 samples, verify tonic and fifth appear ~2x more frequently than other degrees (statistical validation with chi-squared test or similar)
- [X] T021 [P] [TEST] Create ScaleTypes unit tests in tests/unit/music/ScaleTypes.test.ts: validate SCALE_INTERVALS constants match music theory (check semitone patterns), validate all 5 required scales present

### Timing Module Tests

- [X] T022 [P] [TEST] Create TimingCalculator unit tests in tests/unit/timing/TimingCalculator.test.ts: test calculateGateDuration() for all gate sizes (1, 1/2, 1/4, 1/8, 1/16) at BPM boundaries (30, 120, 300), validate quarter note at 120 BPM = 500ms

### Integration Tests

- [X] T023 [TEST] Create Collider component lifecycle integration tests in tests/integration/collider-lifecycle.test.ts: test startSimulation() initializes correct number of colliders, stopSimulation() cleans up animation frame and audio nodes, configuration changes blocked during simulation (FR-018)
- [X] T024 [TEST] Create audio output integration tests in tests/integration/audio-output.test.ts: test CV/Gate node creation and connection, triggerNote() schedules AudioParam changes correctly, gate envelope timing matches calculated duration, verify no audio clicks (smooth ramps)
- [X] T025 [TEST] Create collision event integration tests in tests/integration/collision-events.test.ts: test wall collision triggers CollisionEvent with correct wallSide, collider-collider collision triggers events for both colliders, collision events trigger audio output and visual flash

**Checkpoint**: Constitution testing requirements satisfied - proceed to user story implementation

---

## Phase 3: User Story 1 - Basic Collider Setup and Playback (Priority: P1) 🎯 MVP

**Goal**: Enable users to place a Collider component, configure scale/collider count, start simulation, and hear collision-triggered notes

**Independent Test**: Place component on canvas, select C Major scale, set 3 colliders, click start, verify CV frequency output on collisions

### Implementation for User Story 1

- [X] T026 [P] [US1] Create Collider component class in src/components/utilities/Collider.ts extending SynthComponent with constructor, base properties (id, type, position)
- [X] T027 [P] [US1] Add ColliderConfig interface to contracts/types.ts with scaleType, rootNote, colliderCount, speedPreset, bpm, gateSize fields
- [X] T028 [US1] Implement configuration management in Collider.ts: setConfiguration(), getConfiguration() methods with validation and immutability during simulation (FR-018)
- [X] T029 [US1] Implement audio node creation in Collider.ts: createAudioNodes() with ConstantSourceNode for CV output and Gate output (1V/octave standard, 0-5V gate envelope)
- [X] T030 [US1] Implement collider initialization in Collider.ts: createCollider() method generating random non-overlapping positions (FR-005), random velocities based on speed preset, weighted random note assignment
- [X] T031 [US1] Implement startSimulation() in Collider.ts: initialize physics engine, create colliders, start animation loop using requestAnimationFrame
- [X] T032 [US1] Implement simulation loop in Collider.ts: animate() method calling physicsEngine.update(), processing collision events, triggering audio output
- [X] T033 [US1] Implement audio triggering in Collider.ts: triggerNote() method scheduling CV voltage changes (exponential ramp to prevent clicks) and gate envelopes (0V→5V→0V with calculated duration)
- [X] T034 [US1] Implement wall collision detection and response in PhysicsEngine: checkWallCollision(), resolveWallCollision() with position clamping and velocity reflection
- [X] T035 [US1] Implement collider-collider collision detection and response in PhysicsEngine: checkCircleCollision() using circle-circle distance check, resolveCircleCollision() with elastic collision formulas and position correction
- [X] T036 [US1] Implement collision event generation in PhysicsEngine: return CollisionEvent array with type ('wall' or 'collider'), timestamp, colliderId, optional wallSide or otherColliderId
- [X] T037 [US1] Implement stopSimulation() in Collider.ts: cancel animation frame, clear physics engine state, reset CV/Gate outputs to 0V
- [X] T038 [US1] Register Collider component in component registry with ComponentType.COLLIDER and factory function
- [X] T039 [US1] Add start/stop button controls to Collider component UI following existing component patterns

**Checkpoint**: At this point, User Story 1 should be fully functional - users can configure and run a basic collider simulation with audio output

---

## Phase 4: User Story 2 - Scale and Root Note Configuration (Priority: P2)

**Goal**: Enable users to experiment with different musical scales and root notes for varied melodic patterns

**Independent Test**: Configure component with different scales (Lydian, Mixolydian) and root notes (D, F#), verify output CV frequencies match expected notes

### Implementation for User Story 2

- [X] T040 [P] [US2] Add scale type dropdown UI control in Collider component with options: Major, Harmonic Minor, Natural Minor, Lydian, Mixolydian
- [X] T041 [P] [US2] Add root note selector UI control in Collider component with all 12 chromatic notes (C, C#, D, D#, E, F, F#, G, G#, A, A#, B)
- [X] T042 [US2] Implement scale update logic in Collider.ts: updateScale() method recreating MusicalScale instance when scaleType or rootNote changes
- [X] T043 [US2] Implement configuration change prevention during simulation in Collider.ts: guard checks in setConfiguration() and updateAudioParameter() throwing errors if isRunning === true (FR-018)
- [X] T044 [US2] Add validation for scale type and root note in validation.ts: ensure enum values are valid ScaleType and Note values
- [X] T045 [US2] Add UI feedback for disabled configuration controls when simulation is running: gray out dropdowns, show tooltip requiring stop first

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - users can configure any scale/root combination and hear the musical differences

---

## Phase 5: User Story 3 - Collider Count Control (Priority: P3)

**Goal**: Enable users to adjust collision density and complexity by controlling the number of active colliders

**Independent Test**: Set different collider counts (1, 5, 10, 20), verify correct number appears and all function properly regardless of density

### Implementation for User Story 3

- [X] T046 [P] [US3] Add collider count input field UI control in Collider component with numeric input validation (1-20 range)
- [X] T047 [US3] Implement collider count validation in validation.ts: check integer constraint, minimum 1, maximum 20, add descriptive error messages (FR-020)
- [X] T048 [US3] Update collider initialization in Collider.ts to create exactly config.colliderCount colliders with non-overlapping position validation
- [X] T049 [US3] Implement position generation retry logic in validation.ts: generateNonOverlappingPosition() with maxAttempts (100) and error if boundary too small
- [X] T050 [US3] Add UI validation feedback for collider count input: display error messages for out-of-range values, prevent non-integer input

**Checkpoint**: All basic configuration options are now available - users can control collider count, scale, and root note

---

## Phase 6: User Story 4 - Visual Physics Simulation (Priority: P1)

**Goal**: Enable users to see colliders moving and bouncing visually to understand the physics driving the musical output

**Independent Test**: Start simulation, observe colliders are visible, move continuously, and bounce behavior matches pool ball physics

### Implementation for User Story 4

- [X] T051 [P] [US4] Implement collision boundary rendering in ColliderRenderer.ts: drawBounds() method rendering rectangular boundary with padding
- [X] T052 [P] [US4] Implement collider rendering in ColliderRenderer.ts: drawCircles() method with arc drawing, fill color, stroke (2px white outline)
- [X] T053 [US4] Implement visual flash effect in ColliderRenderer.ts: flashCollider() method setting flashOpacity for specific collider ID, drawFlash() with opacity decay (0.05 per frame, ~300ms duration)
- [X] T054 [US4] Integrate ColliderRenderer with Collider component: call renderer.render() in animation loop passing ctx, colliders array, and boundary
- [X] T055 [US4] Implement collision event handling for visual feedback in Collider.ts: call renderer.flashCollider() when collision events occur (FR-014a)
- [X] T056 [US4] Create boundary from canvas dimensions in Collider.ts: createBoundaryFromCanvas() method with proportional sizing and padding (FR-019)
- [X] T057 [US4] Implement continuous position updates in PhysicsEngine: updatePositions() method integrating velocity * deltaTime for smooth motion
- [X] T058 [US4] Implement canvas resize handling in Collider.ts: add resize event listener to canvas element, recalculate boundary via createBoundaryFromCanvas() on resize, clamp collider positions to new boundary (FR-019)
- [X] T059 [US4] Add color generation for colliders in Collider.ts: generateColorForDegree() assigning distinct colors based on scale degree for visual differentiation

**Checkpoint**: Visual feedback is now complete - users can see and understand the physics simulation driving the musical output

---

## Phase 7: User Story 5 - Speed Preset Control (Priority: P3)

**Goal**: Enable users to control the tempo and pacing of musical output by adjusting collider movement speed

**Independent Test**: Set speed to slow, medium, and fast presets, verify colliders move at noticeably different speeds and collision frequency changes accordingly

### Implementation for User Story 5

- [X] T060 [P] [US5] Add speed preset selector UI control in Collider component with three options: Slow, Medium, Fast
- [X] T061 [P] [US5] Create SPEED_PRESET_VELOCITIES constant in ScaleTypes.ts mapping SpeedPreset enum to pixel/second values (Slow: 40, Medium: 85, Fast: 135)
- [X] T062 [US5] Implement random velocity generation in Collider.ts: getRandomVelocity() method creating random direction with magnitude from speed preset
- [X] T063 [US5] Update collider initialization to use speed preset when setting initial velocities in createCollider() method
- [X] T064 [US5] Implement configuration change prevention for speed preset during simulation: add guard check in setConfiguration() (FR-018)

**Checkpoint**: Users can now control the pace of the simulation - slow for sparse/meditative patterns, fast for dense/energetic patterns

---

## Phase 8: User Story 6 - Timing and Note Duration Control (Priority: P2)

**Goal**: Enable users to control the rhythmic character of musical output by setting tempo (BPM) and note duration (gate size)

**Independent Test**: Configure different BPM values (60, 120, 180) and gate sizes (1/16, 1/4, 1), measure output gate durations match calculated values

### Implementation for User Story 6

- [ ] T065 [P] [US6] Add BPM input field UI control in Collider component with numeric validation (30-300 range, default 120)
- [ ] T066 [P] [US6] Add gate size selector UI control in Collider component with options: 1 (whole), 1/2 (half), 1/4 (quarter), 1/8 (eighth), 1/16 (sixteenth) note
- [ ] T067 [US6] Implement BPM validation in validation.ts: check finite number constraint, minimum 30, maximum 300, add descriptive error messages (FR-020a)
- [ ] T068 [US6] Implement gate duration calculation in Collider.ts: getGateDurationMs() method calling timingCalculator.calculateGateDuration() with current config.bpm and config.gateSize
- [ ] T069 [US6] Update audio triggering in Collider.ts: pass calculated gate duration to triggerNote() method for accurate envelope scheduling
- [ ] T070 [US6] Implement gate size validation in validation.ts: ensure value is valid GateSize enum member (FR-004c)
- [ ] T071 [US6] Add UI validation feedback for BPM input: display error messages for out-of-range values, prevent non-numeric input

**Checkpoint**: Timing controls are now complete - users can create rhythmically coherent patterns that integrate with other musical components

---

## Phase 9: User Story 7 - Configuration Persistence (Priority: P2)

**Goal**: Enable automatic saving and restoration of Collider component configuration when saving/reopening projects

**Independent Test**: Configure component with specific settings (Lydian scale, F# root, 15 colliders, fast speed, 140 BPM, 1/8 gate), save project, close and reopen, verify all settings restored exactly

### Implementation for User Story 7

- [ ] T072 [P] [US7] Create DEFAULT_COLLIDER_CONFIG constant in contracts/types.ts with default values: Major scale, C root, 5 colliders, Medium speed, 120 BPM, 1/4 gate (FR-021)
- [ ] T073 [P] [US7] Implement serialize() method in Collider.ts: convert ColliderConfig to ComponentData.parameters using enum indices for type-safe serialization
- [ ] T074 [P] [US7] Implement deserialize() method in Collider.ts: restore ColliderConfig from ComponentData.parameters converting enum indices back to enum values
- [ ] T075 [US7] Add deserialization validation in Collider.ts: call validateColliderConfig() after deserializing, fall back to DEFAULT_COLLIDER_CONFIG if validation fails
- [ ] T076 [US7] Integrate serialization with PatchSerializer: ensure Collider.serialize() follows existing ComponentData pattern from LFO.ts
- [ ] T077 [US7] Add deserialization to component factory: register static deserialize() method in component registry for Collider type restoration

**Checkpoint**: Configuration persistence is complete - users can save and restore their work without reconfiguring settings

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T078 [P] Add comprehensive error handling: wrap simulation lifecycle methods in try-catch blocks, display user-friendly error messages
- [ ] T079 [P] Add logging for debugging: console.log statements for simulation start/stop, configuration changes, collision events
- [ ] T080 [P] Optimize collision detection performance: profile with 20 colliders, add spatial partitioning if frame rate drops below 30fps
- [ ] T081 [P] Code cleanup: remove commented code, add JSDoc comments for public methods, ensure consistent naming conventions
- [ ] T082 [P] Refactor: extract magic numbers to named constants (collision epsilon, flash duration, ramp times), improve readability
- [ ] T083 [P] Add edge case handling: simultaneous collisions (corner cases), colliders stuck overlapping, division by zero in collision math
- [ ] T084 Update CLAUDE.md with completed feature information: add to "Completed Features" section with modified files list and key features
- [ ] T085 Run quickstart.md validation: manually test all steps in quickstart guide, verify component setup, configuration, lifecycle management
- [ ] T086 [P] Performance testing: verify 60fps target with 20 colliders, measure collision detection latency (<16ms), test audio scheduling accuracy
- [ ] T087 [P] Implement keyboard navigation for simulation controls: spacebar or Enter key to start/stop simulation, Tab navigation through all configuration controls, Escape key to stop simulation
- [ ] T088 [P] Add ARIA labels and roles to Collider component: aria-label for all dropdowns ("Scale type selector", "Root note selector", etc.), role="region" for canvas area, aria-live="polite" for collision count announcements
- [ ] T089 [P] Validate color contrast ratios for visual elements: ensure collider colors against canvas background meet WCAG AA 4.5:1 ratio, test with browser contrast checker or automated tool (axe DevTools)
- [ ] T090 Add screen reader announcements: announce simulation state changes ("Simulation started with 5 colliders", "Simulation stopped"), announce configuration changes when simulation is stopped
- [ ] T091 Conduct accessibility testing: test with VoiceOver (macOS) or NVDA (Windows), verify all controls reachable via keyboard, validate with WAVE or axe accessibility checker browser extension

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 (Basic Setup & Playback) - P1: Can start after Phase 2, independent of other stories
  - US2 (Scale Configuration) - P2: Can start after Phase 2, may integrate with US1 but independently testable
  - US3 (Collider Count) - P3: Can start after Phase 2, independent of other stories
  - US4 (Visual Simulation) - P1: Can start after Phase 2, integrates with US1 but independently testable
  - US5 (Speed Control) - P3: Can start after Phase 2, independent of other stories
  - US6 (Timing Control) - P2: Can start after Phase 2, integrates with US1 but independently testable
  - US7 (Persistence) - P2: Can start after US1 is complete (needs base component to serialize)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories - THIS IS THE MVP
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Enhances US1 configuration but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Enhances US1 configuration but independently testable
- **User Story 4 (P1)**: Can start after Foundational (Phase 2) - Adds visual feedback to US1 but independently testable
- **User Story 5 (P3)**: Can start after Foundational (Phase 2) - Enhances US1 configuration but independently testable
- **User Story 6 (P2)**: Can start after Foundational (Phase 2) - Enhances US1 timing control but independently testable
- **User Story 7 (P2)**: Depends on US1 completion - Serializes existing configuration

### Within Each User Story

- Models/utilities before main component implementation
- Configuration management before simulation logic
- Audio node creation before audio triggering
- Core implementation before UI integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks (T001-T004) can run in parallel
- All Foundational tasks marked [P] can run in parallel (T005-T010 before T011-T013)
- Once Foundational phase completes:
  - US1 + US2 + US3 + US4 + US5 + US6 can all start in parallel (US7 needs US1 done first)
- Within each user story, tasks marked [P] can run in parallel
- Polish tasks (T065-T074) can mostly run in parallel after user stories complete

---

## Parallel Example: User Story 1

```bash
# Launch foundational modules together:
Task: "Create Vector2D utility in src/physics/Vector2D.ts"
Task: "Create ScaleTypes constants in src/music/ScaleTypes.ts"
Task: "Create MusicalScale class in src/music/MusicalScale.ts"
Task: "Create WeightedRandomSelector in src/music/WeightedRandomSelector.ts"
Task: "Create TimingCalculator in src/timing/TimingCalculator.ts"
Task: "Create validation functions in contracts/validation.ts"

# Then launch component files together:
Task: "Create Collider component class in src/components/utilities/Collider.ts"
Task: "Add ColliderConfig interface to contracts/types.ts"

# Finally sequential integration:
Task: "Implement configuration management"
Task: "Implement audio node creation"
Task: "Implement collider initialization"
Task: "Implement simulation lifecycle"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 4 Only)

User Stories 1 and 4 are both P1 priority and together form the minimum viable product:

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Basic Setup & Playback)
4. Complete Phase 6: User Story 4 (Visual Simulation)
5. **STOP and VALIDATE**: Test that users can place component, configure scale, start simulation, see colliders moving, and hear collision-triggered notes
6. Deploy/demo if ready

**Rationale**: US1 provides core functionality (audio output on collisions). US4 provides essential visual feedback to understand the system. Together they form a complete, usable musical instrument.

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add US1 + US4 → Test independently → Deploy/Demo (MVP!)
3. Add US2 (Scale Config) → Test independently → Deploy/Demo
4. Add US6 (Timing Control) → Test independently → Deploy/Demo
5. Add US3 (Collider Count) + US5 (Speed Control) → Test independently → Deploy/Demo
6. Add US7 (Persistence) → Test independently → Deploy/Demo
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Core simulation)
   - Developer B: User Story 4 (Visual rendering)
   - Developer C: User Story 2 (Scale configuration UI)
3. US1 + US4 integrate for MVP
4. US2, US3, US5, US6 can be added in parallel
5. US7 (Persistence) completes after US1 is stable

---

## Summary

**Total Tasks**: 91 tasks
**Tasks by Phase**:
- Setup: 5 tasks (added test framework setup)
- Foundational: 9 tasks
- Core Module Testing: 11 tasks (NEW - constitution requirement)
- User Story 1 (P1): 14 tasks
- User Story 2 (P2): 6 tasks
- User Story 3 (P3): 5 tasks
- User Story 4 (P1): 9 tasks (added canvas resize handling)
- User Story 5 (P3): 5 tasks
- User Story 6 (P2): 7 tasks
- User Story 7 (P2): 6 tasks
- Polish: 14 tasks (added 5 accessibility tasks)

**Parallel Opportunities**: 52 tasks marked [P] can run in parallel within their respective phases

**Independent Test Criteria**:
- US1: Place component, configure, start, verify audio output on collisions
- US2: Configure different scales/roots, verify correct notes output
- US3: Set different collider counts (1, 5, 10, 20), verify correct number appears
- US4: Start simulation, observe smooth visual movement and bounce physics
- US5: Test slow/medium/fast presets, verify speed differences
- US6: Configure different BPM/gate sizes, measure gate durations match calculations
- US7: Save project, close/reopen, verify settings restored

**Suggested MVP Scope**: User Story 1 + User Story 4 (48 tasks including Setup + Foundational + Core Module Testing)
- Provides complete basic functionality: configuration, simulation, audio output, visual feedback
- Includes constitution-mandated test coverage for all utility modules
- Users can immediately create music with physics-based collision triggering
- Remaining stories add configuration flexibility and polish

**Format Validation**: ✅ All tasks follow the checklist format with checkbox, ID, [P] marker (if applicable), [Story] label (for user story tasks or [TEST] for test tasks), and description with file paths

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests are OPTIONAL and not included (not requested in spec)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- MVP = US1 + US4 (basic functionality + visual feedback)
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
