# Test Coverage Quickstart Guide

**Feature**: 008-test-coverage
**Date**: 2026-01-12
**Audience**: Developers adding or running tests

## Table of Contents

1. [Running Tests](#running-tests)
2. [Adding New Tests](#adding-new-tests)
3. [Using Test Fixtures](#using-test-fixtures)
4. [Interpreting Coverage Reports](#interpreting-coverage-reports)
5. [Debugging Failed Tests](#debugging-failed-tests)
6. [Best Practices](#best-practices)

---

## Running Tests

### Basic Commands

```bash
# Run all tests once
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with interactive UI
npm run test:ui

# Run tests with coverage + UI
npm run test:coverage:ui

# Run specific test file
npm test -- AudioEngine.test.ts

# Run tests matching pattern
npm test -- --grep "should initialize"
```

### Expected Output

**Successful test run**:
```
✓ tests/audio/AudioEngine.test.ts (12 tests) 487ms
✓ tests/persistence/PatchSerializer.test.ts (10 tests) 312ms
✓ tests/canvas/Canvas.drag.test.ts (6 tests) 589ms

Test Files  3 passed (3)
     Tests  28 passed (28)
  Start at  10:23:45
  Duration  1.42s
```

**Test run with coverage**:
```
 % Coverage report from v8
------------|---------|----------|---------|---------|
File        | % Stmts | % Branch | % Funcs | % Lines |
------------|---------|----------|---------|---------|
All files   |   64.5  |    58.2  |   72.1  |   64.5  |
 audio      |   75.3  |    68.9  |   82.4  |   75.3  |
  AudioEngine.ts |   78.1  |    72.5  |   85.0  |   78.1  |
 persistence|   83.2  |    75.6  |   88.9  |   83.2  |
  PatchSerializer.ts |   87.4  |    80.2  |   92.3  |   87.4  |
------------|---------|----------|---------|---------|
```

### Quick Checks

```bash
# Check if tests pass (exit code 0 = pass, 1 = fail)
npm test && echo "Tests passed!" || echo "Tests failed!"

# Run tests without coverage (faster)
npm test

# Generate HTML coverage report
npm run test:coverage
open coverage/index.html  # macOS
```

---

## Adding New Tests

### Step 1: Create Test File

**File naming convention**: `[ModuleName].test.ts` or `[ModuleName].integration.test.ts`

**Location**: Place test files in `tests/` directory, organized by module

```
tests/
├── audio/
│   └── AudioEngine.test.ts          ← Unit test
│   └── AudioEngine.integration.test.ts  ← Integration test
├── persistence/
│   └── PatchSerializer.test.ts
└── canvas/
    └── Canvas.drag.test.ts
```

### Step 2: Write Test Structure

**Basic template**:

```typescript
// tests/audio/AudioEngine.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { MockAudioContext } from '../mocks/WebAudioAPI.mock';

describe('AudioEngine', () => {
  let engine: AudioEngine;
  let mockContext: MockAudioContext;

  // Setup before each test
  beforeEach(() => {
    mockContext = new MockAudioContext();
    global.AudioContext = (() => mockContext) as any;
    engine = new AudioEngine();
  });

  // Cleanup after each test
  afterEach(() => {
    engine = null as any;
    mockContext = null as any;
  });

  // Group related tests
  describe('initialization', () => {
    it('should create AudioContext on first call', async () => {
      // Arrange
      expect(engine.isReady()).toBe(false);

      // Act
      await engine.initialize();

      // Assert
      expect(engine.isReady()).toBe(true);
      expect(mockContext.state).toBe('running');
    });

    it('should handle initialization failure', async () => {
      // Arrange
      mockContext.resume = async () => {
        throw new Error('AudioContext suspended');
      };

      // Act & Assert
      await expect(engine.initialize()).rejects.toThrow('AudioContext suspended');
    });
  });

  describe('node connections', () => {
    it('should connect two audio nodes', async () => {
      // Arrange
      await engine.initialize();
      const node1 = mockContext.createOscillator();
      const node2 = mockContext.createGain();

      // Act
      engine.connect(node1, node2);

      // Assert
      expect(node1.connections).toContain(node2);
    });
  });
});
```

### Step 3: Follow AAA Pattern

**Arrange-Act-Assert** structure for clear tests:

```typescript
it('should update parameter value', () => {
  // Arrange: Set up test data and preconditions
  const component = createTestOscillator();
  const newFrequency = 880;

  // Act: Execute the functionality being tested
  component.setParameter('frequency', newFrequency);

  // Assert: Verify the outcome
  expect(component.parameters.frequency).toBe(newFrequency);
});
```

### Step 4: Add Test to Suite

No additional configuration needed - Vitest auto-discovers `*.test.ts` files.

Run tests to verify:
```bash
npm test -- YourNewTest.test.ts
```

---

## Using Test Fixtures

Test fixtures provide reusable test data to avoid duplication.

### Component Fixtures

```typescript
import { createTestOscillator, createTestFilter } from '../fixtures/components.fixture';

it('should serialize oscillator component', () => {
  // Use default fixture
  const oscillator = createTestOscillator();
  expect(oscillator.type).toBe(ComponentType.OSCILLATOR);

  // Customize with overrides
  const customOsc = createTestOscillator({
    parameters: { frequency: 880 },
    position: { x: 200, y: 100 }
  });
  expect(customOsc.parameters.frequency).toBe(880);
});
```

### Patch Fixtures

```typescript
import { createSimplePatch, createComplexPatch } from '../fixtures/patches.fixture';

it('should save simple patch to localStorage', () => {
  const patch = createSimplePatch();
  // patch contains 2 components, 1 connection

  patchStorage.save('test-patch', patch);
  expect(patchStorage.list()).toContain('test-patch');
});

it('should handle complex patch with many connections', () => {
  const patch = createComplexPatch();
  // patch contains 5 components, 8 connections

  const json = PatchSerializer.serialize(patch);
  const restored = PatchSerializer.deserialize(json);

  expect(restored.components.length).toBe(5);
  expect(restored.connections.length).toBe(8);
});
```

### Available Fixtures

**Component Fixtures**:
- `createTestOscillator(overrides?)` - Sine wave oscillator at 440Hz
- `createTestFilter(overrides?)` - Lowpass filter at 1kHz
- `createTestEnvelope(overrides?)` - ADSR envelope
- `createTestLFO(overrides?)` - Sine LFO at 1Hz
- `createTestVCA(overrides?)` - Voltage controlled amplifier
- `createTestOutput(overrides?)` - Audio output node
- `createTestKeyboard(overrides?)` - MIDI-style keyboard
- `createTestSequencer(overrides?)` - 16-step sequencer at 120 BPM

**Patch Fixtures**:
- `createEmptyPatch(overrides?)` - Empty patch (0 components)
- `createSimplePatch(overrides?)` - Oscillator → Filter (2 components, 1 connection)
- `createComplexPatch()` - Multi-oscillator routing (5 components, 8 connections)
- `createSubtractivePatch()` - Classic subtractive synthesis (6 components, 7 connections)
- `createFMPatch()` - Frequency modulation setup (4 components, 4 connections)

### Creating New Fixtures

Add to `tests/fixtures/[entity].fixture.ts`:

```typescript
// tests/fixtures/components.fixture.ts

export function createTestReverb(overrides?: Partial<SynthComponent>): SynthComponent {
  return {
    id: `reverb-${Math.random().toString(36).slice(2)}`,
    type: ComponentType.REVERB,
    position: { x: 400, y: 100 },
    parameters: {
      roomSize: 0.5,
      damping: 0.3,
      wetDry: 0.4,
    },
    inputs: ['audio'],
    outputs: ['audio'],
    ...overrides,
  };
}
```

---

## Interpreting Coverage Reports

### Text Report (Console)

```
File                   | % Stmts | % Branch | % Funcs | % Lines | Uncovered Lines
-----------------------|---------|----------|---------|---------|------------------
src/audio/AudioEngine.ts |   78.1  |    72.5  |   85.0  |   78.1  | 45-47, 92
```

**Metrics explained**:
- **% Stmts** (Statements): Individual JavaScript statements executed
- **% Branch** (Branches): Percentage of if/else paths taken
- **% Funcs** (Functions): Functions called at least once
- **% Lines**: Lines of code executed (most important)

**Uncovered Lines**: Line numbers not executed by any test (e.g., `45-47, 92`)

### HTML Report (Interactive)

**Open HTML report**:
```bash
npm run test:coverage
open coverage/index.html
```

**Features**:
- **File list**: Click any file to see line-by-line coverage
- **Color coding**:
  - 🟢 Green = covered
  - 🔴 Red = uncovered
  - 🟡 Yellow = partially covered branch
- **Hover**: See which test covered each line
- **Filter**: Filter by coverage percentage
- **Drill-down**: Navigate from summary → file → function

**How to use**:
1. Open `coverage/index.html` in browser
2. Click file with low coverage (e.g., 45%)
3. Scroll to red lines (uncovered code)
4. Write tests to cover those lines
5. Re-run `npm run test:coverage`
6. Verify coverage improved

### Coverage Thresholds

**Global thresholds** (must meet for CI/CD to pass):
- Lines: 60%
- Functions: 60%
- Branches: 60%
- Statements: 60%

**Module-specific thresholds**:
- AudioEngine: 70% lines
- PatchSerializer: 80% lines
- PatchStorage: 75% lines
- Canvas: 50% lines

**How to check thresholds**:
```bash
# Run coverage - will fail if below threshold
npm run test:coverage

# Check specific file coverage
cat coverage/coverage-summary.json | jq '.["src/audio/AudioEngine.ts"].lines.pct'
```

---

## Debugging Failed Tests

### Using Vitest UI

**Best for visual debugging**:

```bash
npm run test:ui
```

Then:
1. Open browser UI at http://localhost:51204
2. Click failing test
3. See error message, stack trace, and code context
4. Click "Rerun" to test fixes in real-time

### Using VS Code Debugger

1. **Install Vitest extension** for VS Code
2. **Set breakpoint** in test file (click left margin)
3. **Debug test**: Click "Debug" above test in editor
4. **Step through code**: Use F10 (step over), F11 (step into)

**Launch config** (`.vscode/launch.json`):
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Vitest Tests",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "test"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Console Logging

**Temporary debugging**:

```typescript
it('should do something', () => {
  const result = doSomething();

  console.log('Result:', result); // Visible in test output
  console.log('Type:', typeof result);
  console.dir(result, { depth: null }); // Full object inspection

  expect(result).toBe(expected);
});
```

**Remove console.log before committing** (ESLint will warn).

### Common Errors

**Error: "Cannot read properties of undefined"**
```typescript
// Problem: mock not initialized
it('should work', () => {
  const result = audioEngine.initialize(); // audioEngine is undefined!
});

// Solution: use beforeEach
beforeEach(() => {
  audioEngine = new AudioEngine();
});
```

**Error: "AudioContext is not a constructor"**
```typescript
// Problem: mock not registered
beforeEach(() => {
  global.AudioContext = MockAudioContext as any; // ✅ Correct
});
```

**Error: "Timeout of 5000ms exceeded"**
```typescript
// Problem: async test not awaited
it('should initialize', () => {
  engine.initialize(); // ❌ Missing await
  expect(engine.isReady()).toBe(true); // Runs before initialization completes
});

// Solution: use async/await
it('should initialize', async () => {
  await engine.initialize(); // ✅ Correct
  expect(engine.isReady()).toBe(true);
});
```

---

## Best Practices

### Test Naming

✅ **Good** (specific, describes scenario and expected outcome):
```typescript
it('should serialize patch with 5 components without data loss', () => {});
it('should throw error when deserializing invalid JSON', () => {});
it('should connect oscillator to filter', () => {});
```

❌ **Bad** (vague, doesn't explain what's being tested):
```typescript
it('should work', () => {});
it('test 1', () => {});
it('serialization', () => {});
```

### Test Isolation

✅ **Good** (each test independent):
```typescript
beforeEach(() => {
  // Fresh state for each test
  engine = new AudioEngine();
});

it('test 1', () => {
  engine.initialize();
  // test logic
});

it('test 2', () => {
  // Starts with uninitialized engine (clean slate)
});
```

❌ **Bad** (tests depend on each other):
```typescript
let engine = new AudioEngine();

it('test 1', () => {
  engine.initialize(); // Modifies shared state
});

it('test 2', () => {
  // Assumes engine is already initialized from test 1 (flaky!)
});
```

### Test Speed

✅ **Good** (fast, focused):
```typescript
it('should parse JSON', () => {
  const json = '{"name":"patch"}';
  const patch = JSON.parse(json);
  expect(patch.name).toBe('patch');
}); // < 1ms
```

❌ **Bad** (slow, unnecessary delays):
```typescript
it('should parse JSON', async () => {
  await sleep(1000); // ❌ Unnecessary delay
  const json = '{"name":"patch"}';
  const patch = JSON.parse(json);
  expect(patch.name).toBe('patch');
}); // 1000ms
```

### Assertion Clarity

✅ **Good** (clear failure messages):
```typescript
expect(patch.components).toHaveLength(5); // "Expected 5 but got 3"
expect(connection.from.componentId).toBe('osc1'); // "Expected 'osc1' but got 'osc2'"
```

❌ **Bad** (unclear failure messages):
```typescript
expect(patch.components.length === 5).toBe(true); // "Expected true but got false" (what's wrong?)
```

### Mock Usage

✅ **Good** (mock external APIs only):
```typescript
// Mock Web Audio API (external)
global.AudioContext = MockAudioContext as any;

// Use real PatchSerializer (internal, should be tested)
const serializer = new PatchSerializer();
```

❌ **Bad** (mock everything):
```typescript
// Mocking internal classes defeats the purpose of integration tests
const mockSerializer = { serialize: vi.fn(), deserialize: vi.fn() };
// Now we're just testing mocks, not real code!
```

### Coverage Goals

✅ **Good** (focus on critical paths):
```typescript
// Test happy path
it('should serialize valid patch', () => {});

// Test error handling
it('should throw on invalid patch', () => {});

// Test edge cases
it('should handle empty patch', () => {});
it('should handle patch with max components', () => {});
```

❌ **Bad** (chasing 100% without value):
```typescript
// Testing getters/setters (trivial)
it('should get name', () => {
  patch.name = 'test';
  expect(patch.getName()).toBe('test'); // No logic, just returns field
});

// Testing type definitions (no runtime logic)
it('should have ComponentType enum', () => {
  expect(ComponentType.OSCILLATOR).toBeDefined(); // TypeScript handles this
});
```

---

## Quick Reference

### Essential Commands
```bash
npm test                    # Run all tests
npm run test:watch          # Auto-rerun on changes
npm run test:coverage       # Generate coverage report
npm run test:ui             # Interactive UI
```

### File Locations
```
tests/
├── mocks/                  # Mock objects (Web Audio API, localStorage)
├── fixtures/               # Test data factories
├── audio/                  # AudioEngine tests
├── persistence/            # Serialization tests
└── canvas/                 # Canvas interaction tests
```

### Coverage Targets
- Global: 60% lines
- AudioEngine: 70% lines
- PatchSerializer: 80% lines
- Canvas: 50% lines

### Need Help?
- **Vitest docs**: https://vitest.dev
- **Project issues**: See [spec.md](./spec.md) for edge cases
- **Research decisions**: See [research.md](./research.md) for technical rationale

---

**Ready to contribute?** Start by running `npm test` to verify your environment, then pick a module from [spec.md](./spec.md) User Stories and add tests!
