# Implementation Plan: Comprehensive Test Coverage

**Branch**: `008-test-coverage` | **Date**: 2026-01-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-test-coverage/spec.md`

## Summary

Implement comprehensive test suite for the modular web synthesizer to increase code coverage from current ~5% to minimum 60% overall, with 70%+ coverage for AudioEngine, 80%+ for PatchSerializer, and 50%+ for Canvas interactions. Tests will use Vitest with mocked Web Audio API and localStorage to enable fast, isolated testing without browser dependencies.

## Technical Context

**Language/Version**: TypeScript 5.6+ (ES2020 target, strict mode)
**Primary Dependencies**:
- Testing Framework: Vitest (already installed)
- DOM Mocking: happy-dom (resolved per research.md RT-001)
- Coverage: @vitest/coverage-v8
**Storage**: localStorage (mocked for tests)
**Testing**: Vitest (unit + integration), Web Audio API mocks, localStorage mocks
**Target Platform**: Browser (Chrome, Firefox, Safari) - tests run in Node.js with DOM mocking
**Project Type**: Web Audio application (single-page synthesizer)
**Performance Goals**: Test suite completes in < 10 seconds, individual test files < 2 seconds
**Constraints**:
- Cannot use real AudioContext in tests (must mock Web Audio API)
- Cannot test actual audio output quality (focus on connection logic)
- Existing 3 test files (MusicalScale, TimingCalculator, Vector2D) must remain unchanged
- No refactoring of production code for testability (separate concern)
**Scale/Scope**: Cover 4 critical modules (AudioEngine, PatchSerializer, PatchStorage, Canvas), 15+ functional requirements, 16 acceptance scenarios across 4 user stories

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Version**: Custom (modular-web-synthesizer)

Verify feature compliance with Project Constitution principles:

- [x] **Code Quality - Readability**: Tests will use descriptive names explaining scenario and expected outcome (follows AAA pattern)
- [x] **Code Quality - Organization**: Test files organized by module matching source structure (e.g., `tests/audio/AudioEngine.test.ts`)
- [x] **Code Quality - Standards**: Tests follow TypeScript strict mode, pass linting, use named constants for magic values
- [x] **Testing Standards - Coverage Requirements**: Feature explicitly targets 60% minimum coverage, 80% for critical paths (PatchSerializer)
- [x] **Testing Standards - Test Quality**: Tests will be isolated (mocked dependencies), use descriptive names, follow AAA pattern
- [x] **Testing Standards - Testing Practices**: Tests designed for < 10s total runtime, separate unit/integration suites, use test fixtures
- [x] **Performance - Runtime Performance**: Tests must complete quickly to maintain 60 FPS in actual application (no performance regression)
- [x] **Performance - Monitoring**: Code coverage reporting configured to track coverage metrics over time
- [x] **Code Review Standards**: Test implementation will follow standard review process with focus on test quality and coverage

**No constitution violations**: This feature directly implements and enforces constitutional principles for testing standards.

## Project Structure

### Documentation (this feature)

```text
specs/008-test-coverage/
├── plan.md              # This file
├── research.md          # Phase 0: Testing strategy, mocking patterns, Vitest configuration
├── data-model.md        # Phase 1: Test fixtures, mock objects structure
├── quickstart.md        # Phase 1: How to run tests, add new tests, interpret coverage
├── contracts/           # Phase 1: Test interfaces, mock contracts
└── tasks.md             # Phase 2: NOT created by this command
```

### Source Code (repository root)

```text
tests/
├── mocks/
│   ├── WebAudioAPI.mock.ts      # Mock AudioContext, OscillatorNode, GainNode, etc.
│   ├── LocalStorage.mock.ts     # Mock localStorage with in-memory Map
│   └── DOM.mock.ts              # Mock canvas, mouse events, touch events
├── fixtures/
│   ├── patches.fixture.ts       # Sample patch configurations
│   ├── components.fixture.ts    # Sample component configurations
│   └── connections.fixture.ts   # Sample connection patterns
├── audio/
│   ├── AudioEngine.test.ts      # AudioEngine initialization, connections, state transitions
│   └── AudioEngine.integration.test.ts  # Multi-component audio routing scenarios
├── persistence/
│   ├── PatchSerializer.test.ts  # Serialization/deserialization logic
│   └── PatchStorage.test.ts     # Save/load/delete with mocked localStorage
├── canvas/
│   ├── Canvas.drag.test.ts      # Component drag-and-drop interactions
│   ├── Canvas.connection.test.ts # Connection creation workflows
│   └── Canvas.viewport.test.ts  # Pan/zoom transformations
└── utils/
    ├── MusicalScale.test.ts     # Existing - unchanged
    ├── TimingCalculator.test.ts # Existing - unchanged
    └── Vector2D.test.ts         # Existing - unchanged

vitest.config.ts                 # Vitest configuration with coverage thresholds
package.json                     # Updated with coverage scripts
```

**Structure Decision**: Tests organized by module (audio, persistence, canvas, utils) with separate directories for mocks and fixtures. Integration tests colocated with unit tests using `.integration.test.ts` suffix for clarity.

## Complexity Tracking

> **No constitutional violations requiring justification**

This feature directly supports constitutional testing standards and introduces no additional complexity.

## Phase 0: Research & Technical Decisions

### Research Tasks

**RT-001: Web Audio API Mocking Strategy**
- **Question**: How to mock Web Audio API (AudioContext, AudioNode, AudioParam) for unit testing without browser?
- **Options**: Manual mocks, standardized-audio-context library, minimal stub objects
- **Decision Needed**: Which mocking approach provides best balance of accuracy and test simplicity?

**RT-002: DOM Event Simulation**
- **Question**: How to simulate mouse/touch events for Canvas interaction tests?
- **Options**: Testing Library (user-event), manual MouseEvent construction, Vitest's built-in event helpers
- **Decision Needed**: Which event simulation approach works best with happy-dom/jsdom?

**RT-003: Coverage Threshold Configuration**
- **Question**: How to configure Vitest to enforce coverage thresholds and fail CI/CD on violations?
- **Options**: vitest.config.ts coverage.thresholds, separate coverage script, pre-commit hooks
- **Decision Needed**: Best practice for enforcing 60% global, 70% AudioEngine, 80% PatchSerializer thresholds?

**RT-004: Test Fixture Organization**
- **Question**: How to structure reusable test fixtures for patches, components, and connections?
- **Options**: Factory pattern, builder pattern, plain objects, fixture functions
- **Decision Needed**: Which pattern provides best reusability and maintainability?

**RT-005: Integration Test Scope**
- **Question**: What constitutes "integration" test vs "unit" test for audio engine (multiple real objects vs all mocked)?
- **Options**: Real AudioEngine + mocked AudioContext, real PatchSerializer + mocked localStorage, full component graph
- **Decision Needed**: Where to draw line between unit and integration testing?

**RT-006: Async Testing Patterns**
- **Question**: How to test async AudioContext initialization and state transitions?
- **Options**: async/await in tests, done callbacks, Vitest's waitFor utility
- **Decision Needed**: Best practices for testing Promise-based audio initialization?

### Best Practices Research

**BP-001: Vitest Configuration**
- Research optimal Vitest config for TypeScript, coverage reporting, watch mode, UI visualization
- Find recommended setup for happy-dom vs jsdom (performance vs compatibility)

**BP-002: Test Organization**
- Research Vitest conventions for test file naming, directory structure, test suite organization
- Determine standard patterns for describe blocks, test grouping, setup/teardown

**BP-003: Mock Patterns**
- Research TypeScript patterns for type-safe mocks (Partial<T>, Mock<T>, stub objects)
- Find best practices for resetAllMocks, clearAllMocks between tests

**BP-004: Coverage Reporting**
- Research Vitest coverage reporters (text, html, lcov, json-summary)
- Find best practices for viewing coverage in CI/CD and locally

### Phase 0 Output

Generate [research.md](./research.md) containing:
1. **Decision Matrix**: For each RT-001 through RT-006, document chosen approach with rationale
2. **Best Practices Summary**: Consolidated findings from BP-001 through BP-004
3. **Technical Recommendations**: Specific Vitest configuration, mock patterns, fixture design
4. **Resolved Clarifications**: All "NEEDS CLARIFICATION" items from above resolved with concrete decisions

## Phase 1: Design & Contracts

**Prerequisites**: research.md complete with all decisions finalized

### Design Artifacts

**DA-001: Data Model** ([data-model.md](./data-model.md))
- **Test Fixtures**: Structure for sample patches, components, connections (based on RT-004 decision)
- **Mock Objects**: Schema for Web Audio API mocks, localStorage mocks, DOM mocks
- **Coverage Thresholds**: Numeric thresholds per module (global: 60%, AudioEngine: 70%, PatchSerializer: 80%, Canvas: 50%)

**DA-002: API Contracts** ([contracts/](./contracts/))
- **Test Interfaces**: TypeScript interfaces for test fixtures (IPatchFixture, IComponentFixture)
- **Mock Contracts**: TypeScript types for mocked Web Audio objects (MockAudioContext, MockOscillatorNode)
- **Assertion Helpers**: Reusable assertion functions for common test scenarios

**DA-003: Quickstart Guide** ([quickstart.md](./quickstart.md))
- **Running Tests**: Commands for running all tests, watch mode, coverage report, UI mode
- **Adding Tests**: Step-by-step guide for adding unit test, integration test, using fixtures
- **Interpreting Coverage**: How to read HTML coverage report, identify uncovered lines, meet thresholds
- **Debugging Tests**: Using Vitest UI, debugging in VS Code, common issues and solutions

### Agent Context Update

Run `.specify/scripts/bash/update-agent-context.sh claude` to update CLAUDE.md with:
- Vitest testing framework with coverage enabled
- happy-dom or jsdom for DOM mocking (based on research decision)
- Web Audio API mocking pattern
- Test organization conventions
- Coverage threshold requirements

### Phase 1 Output

Generate:
1. [data-model.md](./data-model.md) - Test fixtures and mock object schemas
2. [contracts/test-fixtures.ts](./contracts/test-fixtures.ts) - TypeScript fixture interfaces
3. [contracts/mock-contracts.ts](./contracts/mock-contracts.ts) - TypeScript mock types
4. [contracts/assertion-helpers.ts](./contracts/assertion-helpers.ts) - Reusable assertions
5. [quickstart.md](./quickstart.md) - Developer guide for testing
6. Updated [CLAUDE.md](../../CLAUDE.md) - Agent context with testing tech stack

## Phase 2: Task Generation

**OUT OF SCOPE**: Phase 2 (task breakdown) is handled by `/speckit.tasks` command, not this plan command.

Tasks will be generated based on:
- 15 functional requirements from spec.md
- 4 prioritized user stories
- Research decisions from research.md
- Design artifacts from Phase 1

## Gates & Validation

### Pre-Research Gates (Phase 0 Entry)
- [x] Constitution Check passed
- [x] Feature spec exists and is complete
- [x] Technical context defined with research questions identified

### Pre-Design Gates (Phase 1 Entry)
- [ ] All 6 research tasks (RT-001 through RT-006) resolved in research.md
- [ ] Best practices research (BP-001 through BP-004) documented
- [ ] No remaining "NEEDS CLARIFICATION" items

### Pre-Task Gates (Phase 2 Entry - verified by /speckit.tasks)
- [ ] data-model.md complete with fixture schemas and mock contracts
- [ ] contracts/ directory contains all TypeScript interfaces
- [ ] quickstart.md provides clear testing guidance
- [ ] Agent context updated with testing tech stack
- [ ] Constitution Check re-verified (no violations introduced)

## Success Metrics

**Completion Criteria for /speckit.plan command**:
1. research.md generated with all technical decisions documented
2. data-model.md generated with test fixture and mock schemas
3. contracts/ directory contains TypeScript interfaces for fixtures and mocks
4. quickstart.md generated with testing developer guide
5. CLAUDE.md updated with testing context
6. All Phase 0 and Phase 1 gates passed
7. Ready for /speckit.tasks command to generate implementation tasks

**Quality Metrics**:
- All research questions answered with rationale
- Design decisions traceable to functional requirements in spec.md
- Quickstart guide enables new developers to add tests independently
- No constitution violations introduced
- Technical context sufficient for implementation without ambiguity
