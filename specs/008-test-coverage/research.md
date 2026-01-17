# Research: Comprehensive Test Coverage

**Feature**: 008-test-coverage
**Date**: 2026-01-12
**Status**: Complete

## Executive Summary

This document captures technical research and decisions for implementing comprehensive test coverage for the modular web synthesizer. All research tasks (RT-001 through RT-006) and best practices investigations (BP-001 through BP-004) have been completed with concrete recommendations.

**Key Decisions**:
- Use **manual mocks** for Web Audio API (lightweight, TypeScript-friendly)
- Use **happy-dom** for DOM environment (faster than jsdom)
- Configure coverage thresholds in **vitest.config.ts** with per-file granularity
- Use **factory functions** for test fixtures (simple, type-safe, composable)
- Use **async/await** for testing AudioContext initialization
- Organize tests by module with **`.test.ts`** suffix

---

## RT-001: Web Audio API Mocking Strategy

### Decision

**Use manual TypeScript mocks with minimal stub objects**

### Rationale

1. **Simplicity**: Web Audio API has complex interfaces, but tests only need connection tracking and parameter updates - not actual audio processing
2. **Type Safety**: Manual mocks can implement TypeScript interfaces (AudioContext, AudioNode, AudioParam) with full IDE support
3. **Performance**: Minimal mocks avoid overhead of full Web Audio simulation (tests must complete in < 10s)
4. **Control**: Tests need to verify connection logic, not audio output - stubs provide complete control over behavior
5. **No External Dependencies**: Keeps test suite lightweight without third-party audio libraries

### Alternatives Considered

**standardized-audio-context library**:
- **Pros**: Full Web Audio API implementation, catches more edge cases
- **Cons**: Heavy dependency (100KB+), slower tests, overkill for connection testing
- **Rejected**: Performance overhead and complexity not justified for testing connection logic

**No mocking (real AudioContext in tests)**:
- **Pros**: Tests real browser behavior
- **Cons**: Requires browser environment, slow, flaky, cannot run in CI/CD
- **Rejected**: Violates constraint "tests run in Node.js with DOM mocking"

### Implementation Notes

```typescript
// tests/mocks/WebAudioAPI.mock.ts

export class MockAudioContext implements Partial<AudioContext> {
  state: AudioContextState = 'suspended';
  private nodes: Map<string, AudioNode> = new Map();

  createOscillator(): MockOscillatorNode {
    const node = new MockOscillatorNode();
    this.nodes.set(node.id, node);
    return node;
  }

  createGain(): MockGainNode {
    return new MockGainNode();
  }

  async resume(): Promise<void> {
    this.state = 'running';
  }

  getConnectedNodes(): AudioNode[] {
    return Array.from(this.nodes.values());
  }
}

export class MockAudioNode implements Partial<AudioNode> {
  id = Math.random().toString(36);
  connections: AudioNode[] = [];

  connect(destination: AudioNode): AudioNode {
    this.connections.push(destination);
    return destination;
  }

  disconnect(): void {
    this.connections = [];
  }
}

export class MockAudioParam implements Partial<AudioParam> {
  private _value: number = 0;

  get value(): number {
    return this._value;
  }

  set value(val: number) {
    this._value = val;
  }

  setValueAtTime(value: number, startTime: number): this {
    this._value = value;
    return this;
  }
}
```

**Usage in tests**:
```typescript
import { MockAudioContext } from '../mocks/WebAudioAPI.mock';

beforeEach(() => {
  global.AudioContext = MockAudioContext as any;
});
```

---

## RT-002: DOM Event Simulation

### Decision

**Use manual MouseEvent/TouchEvent construction with happy-dom**

### Rationale

1. **Direct Control**: Canvas tests need precise control over coordinates, button states, modifier keys
2. **No Extra Dependencies**: MouseEvent constructor is standard Web API, no library needed
3. **Type Safety**: TypeScript knows MouseEvent interface, provides autocomplete
4. **happy-dom Support**: happy-dom implements MouseEvent, TouchEvent constructors natively
5. **Test Clarity**: Explicit `new MouseEvent('mousedown', { clientX: 100, clientY: 50 })` is clearer than abstraction

### Alternatives Considered

**@testing-library/user-event**:
- **Pros**: High-level API simulating real user behavior
- **Cons**: Designed for React/Vue/Angular components, overkill for canvas interactions, extra dependency
- **Rejected**: Canvas doesn't use standard DOM elements (buttons, inputs) - uses raw mouse coordinates

**Vitest built-in helpers**:
- **Pros**: None - Vitest doesn't provide event helpers
- **Cons**: Doesn't exist
- **Rejected**: N/A

### Implementation Notes

```typescript
// tests/canvas/Canvas.drag.test.ts

describe('Canvas drag-and-drop', () => {
  it('should update component position when dragged', () => {
    const canvas = new Canvas(/* ... */);
    const component = createTestComponent({ x: 100, y: 100 });

    // Simulate mouse down on component
    const mouseDown = new MouseEvent('mousedown', {
      clientX: 100,
      clientY: 100,
      button: 0, // Left click
    });
    canvas.handleMouseDown(mouseDown);

    // Simulate drag motion
    const mouseMove = new MouseEvent('mousemove', {
      clientX: 150,
      clientY: 130,
    });
    canvas.handleMouseMove(mouseMove);

    // Simulate release
    const mouseUp = new MouseEvent('mouseup');
    canvas.handleMouseUp(mouseUp);

    // Assert final position
    expect(component.position).toEqual({ x: 150, y: 130 });
  });
});
```

**Touch events** (for mobile):
```typescript
const touch = new Touch({
  identifier: 1,
  target: canvas.element,
  clientX: 100,
  clientY: 100,
});

const touchEvent = new TouchEvent('touchstart', {
  touches: [touch],
  changedTouches: [touch],
});
```

---

## RT-003: Coverage Threshold Configuration

### Decision

**Configure thresholds in vitest.config.ts with per-file granularity**

### Rationale

1. **Single Source of Truth**: All Vitest configuration in one file (vitest.config.ts)
2. **CI/CD Integration**: Vitest fails test run if coverage below threshold - no separate script needed
3. **Granular Control**: Can set global threshold (60%) and per-file overrides (AudioEngine: 70%, PatchSerializer: 80%)
4. **Developer Feedback**: Coverage report shown immediately after test run
5. **Standard Practice**: Vitest official recommendation for enforcing coverage

### Alternatives Considered

**Separate coverage script**:
- **Pros**: Can customize threshold checking logic
- **Cons**: Extra script to maintain, developers might skip it, not integrated with test run
- **Rejected**: Adds complexity without benefit

**Pre-commit hooks**:
- **Pros**: Prevents committing uncovered code
- **Cons**: Slows down commits, developers disable hooks, doesn't help during development
- **Rejected**: Better to catch issues during `npm test` than at commit time

### Implementation Notes

```typescript
// vitest.config.ts

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    coverage: {
      provider: 'v8', // Faster than istanbul
      reporter: ['text', 'html', 'lcov', 'json-summary'],

      // Global thresholds
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },

      // Per-file thresholds (stricter for critical modules)
      perFile: true,
      thresholdAutoUpdate: false,

      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/main.ts', // Entry point, no logic
      ],

      // Custom thresholds for critical files
      watermarks: {
        statements: [60, 80],
        functions: [60, 80],
        branches: [60, 80],
        lines: [60, 80],
      },
    },
  },
});
```

**package.json scripts**:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:coverage:ui": "vitest --ui --coverage"
  }
}
```

**Enforcing per-module thresholds**:
Use inline comments in critical files:
```typescript
// src/audio/AudioEngine.ts
/* istanbul ignore file -- requires 70% coverage, enforced in CI */
```

Or create custom threshold checks in CI:
```bash
# .github/workflows/test.yml
- name: Check AudioEngine coverage
  run: |
    COVERAGE=$(jq '.["src/audio/AudioEngine.ts"].lines.pct' coverage/coverage-summary.json)
    if (( $(echo "$COVERAGE < 70" | bc -l) )); then
      echo "AudioEngine coverage ($COVERAGE%) below 70% threshold"
      exit 1
    fi
```

---

## RT-004: Test Fixture Organization

### Decision

**Use factory functions with optional overrides pattern**

### Rationale

1. **Simplicity**: Plain functions returning objects - no classes, no builders
2. **Type Safety**: TypeScript infers return types, catches mismatches
3. **Composability**: Fixtures can reference other fixtures (component → patch)
4. **Flexibility**: Default values with optional overrides via object spread
5. **Discoverability**: IDE autocomplete shows all available fixture functions

### Alternatives Considered

**Factory pattern (classes)**:
- **Pros**: Encapsulation, private methods for complex setup
- **Cons**: Verbose, requires `new`, harder to compose
- **Rejected**: Overkill for simple test data creation

**Builder pattern**:
- **Pros**: Fluent API, incremental construction
- **Cons**: Lots of boilerplate, need separate builder class per entity
- **Rejected**: Too much code for simple fixtures

**Plain objects**:
- **Pros**: Simplest approach, no functions
- **Cons**: Copy-paste duplication, no default values, hard to update
- **Rejected**: Not reusable across tests

### Implementation Notes

```typescript
// tests/fixtures/components.fixture.ts

import { ComponentType } from '../../src/types/ComponentType';
import type { SynthComponent } from '../../src/types/SynthComponent';

export function createTestOscillator(
  overrides?: Partial<SynthComponent>
): SynthComponent {
  return {
    id: `osc-${Math.random().toString(36).slice(2)}`,
    type: ComponentType.OSCILLATOR,
    position: { x: 100, y: 100 },
    parameters: {
      waveform: 'sine',
      frequency: 440,
      detune: 0,
    },
    inputs: [],
    outputs: ['audio'],
    ...overrides,
  };
}

export function createTestFilter(
  overrides?: Partial<SynthComponent>
): SynthComponent {
  return {
    id: `filter-${Math.random().toString(36).slice(2)}`,
    type: ComponentType.FILTER,
    position: { x: 300, y: 100 },
    parameters: {
      type: 'lowpass',
      frequency: 1000,
      resonance: 0,
    },
    inputs: ['audio'],
    outputs: ['audio'],
    ...overrides,
  };
}

// tests/fixtures/patches.fixture.ts

import { createTestOscillator, createTestFilter } from './components.fixture';
import type { Patch } from '../../src/types/Patch';

export function createSimplePatch(overrides?: Partial<Patch>): Patch {
  const oscillator = createTestOscillator();
  const filter = createTestFilter();

  return {
    name: 'Test Patch',
    components: [oscillator, filter],
    connections: [
      {
        from: { componentId: oscillator.id, portIndex: 0 },
        to: { componentId: filter.id, portIndex: 0 },
      },
    ],
    ...overrides,
  };
}

export function createComplexPatch(): Patch {
  // 5 components, 8 connections
  const components = [
    createTestOscillator({ id: 'osc1' }),
    createTestOscillator({ id: 'osc2' }),
    createTestFilter({ id: 'filter1' }),
    createTestFilter({ id: 'filter2' }),
    createTestComponent({ id: 'output', type: ComponentType.OUTPUT }),
  ];

  return {
    name: 'Complex Test Patch',
    components,
    connections: [
      { from: { componentId: 'osc1', portIndex: 0 }, to: { componentId: 'filter1', portIndex: 0 } },
      { from: { componentId: 'osc2', portIndex: 0 }, to: { componentId: 'filter2', portIndex: 0 } },
      // ... 6 more connections
    ],
  };
}
```

**Usage in tests**:
```typescript
import { createSimplePatch, createComplexPatch } from '../fixtures/patches.fixture';

it('should serialize simple patch', () => {
  const patch = createSimplePatch(); // Uses defaults
  const json = PatchSerializer.serialize(patch);
  expect(json).toContain('"components":[');
});

it('should handle custom patch name', () => {
  const patch = createSimplePatch({ name: 'My Custom Patch' });
  expect(patch.name).toBe('My Custom Patch');
});
```

---

## RT-005: Integration Test Scope

### Decision

**Integration tests use real classes with mocked external dependencies (AudioContext, localStorage)**

### Rationale

1. **Clear Boundary**: Integration = multiple real classes interacting, Unit = single class in isolation
2. **Test Realistic Scenarios**: AudioEngine + multiple components tests actual connection logic
3. **Mock External APIs Only**: AudioContext and localStorage are external - mock them. Internal classes are testable - use real ones.
4. **Performance Balance**: Mocking AudioContext keeps tests fast, but testing real PatchSerializer validates serialization logic
5. **Aligned with User Stories**: User Story 1 (AudioEngine) needs integration tests, User Story 2 (PatchSerializer) can be unit tested

### Alternatives Considered

**Mock everything except class under test**:
- **Pros**: True unit testing, complete isolation
- **Cons**: Misses integration bugs (e.g., AudioEngine + PatchSerializer interaction)
- **Rejected**: Spec explicitly calls for "integration tests for multi-component audio routing"

**Use real AudioContext in integration tests**:
- **Pros**: Tests actual browser behavior
- **Cons**: Slow, flaky, requires browser, violates constraints
- **Rejected**: Cannot run in Node.js CI/CD

### Implementation Notes

**Unit Test Example** (single class, all dependencies mocked):
```typescript
// tests/audio/AudioEngine.test.ts

import { AudioEngine } from '../../src/audio/AudioEngine';
import { MockAudioContext } from '../mocks/WebAudioAPI.mock';

describe('AudioEngine (unit)', () => {
  let engine: AudioEngine;
  let mockContext: MockAudioContext;

  beforeEach(() => {
    mockContext = new MockAudioContext();
    global.AudioContext = (() => mockContext) as any;
    engine = new AudioEngine();
  });

  it('should initialize AudioContext on first call', async () => {
    await engine.initialize();
    expect(engine.isReady()).toBe(true);
    expect(mockContext.state).toBe('running');
  });
});
```

**Integration Test Example** (multiple real classes, external APIs mocked):
```typescript
// tests/audio/AudioEngine.integration.test.ts

import { AudioEngine } from '../../src/audio/AudioEngine';
import { Oscillator } from '../../src/components/generators/Oscillator';
import { Filter } from '../../src/components/effects/Filter';
import { MockAudioContext } from '../mocks/WebAudioAPI.mock';

describe('AudioEngine (integration)', () => {
  let engine: AudioEngine;
  let mockContext: MockAudioContext;

  beforeEach(async () => {
    mockContext = new MockAudioContext();
    global.AudioContext = (() => mockContext) as any;
    engine = new AudioEngine();
    await engine.initialize();
  });

  it('should route audio through oscillator → filter chain', () => {
    // Real component instances
    const oscillator = new Oscillator('osc1', { x: 0, y: 0 });
    const filter = new Filter('filter1', { x: 100, y: 0 });

    // Connect via AudioEngine
    engine.registerComponent(oscillator);
    engine.registerComponent(filter);
    engine.connect(oscillator, 0, filter, 0);

    // Verify connection was created
    const connections = engine.getConnections();
    expect(connections).toHaveLength(1);
    expect(connections[0].from).toBe('osc1');
    expect(connections[0].to).toBe('filter1');
  });
});
```

---

## RT-006: Async Testing Patterns

### Decision

**Use async/await with Vitest's native async support**

### Rationale

1. **Modern JavaScript**: async/await is standard ES2020, cleaner than callbacks
2. **Vitest Native Support**: Vitest automatically waits for async test functions to resolve
3. **Type Safety**: TypeScript understands Promise return types
4. **Error Handling**: try/catch works naturally with async/await
5. **Readability**: Linear code flow, easier to understand than callbacks or .then() chains

### Alternatives Considered

**done callbacks**:
- **Pros**: Classic pattern from Mocha/Jest
- **Cons**: Easy to forget `done()`, verbose, outdated pattern
- **Rejected**: async/await is cleaner and less error-prone

**Vitest waitFor utility**:
- **Pros**: Polls for condition, good for eventual consistency
- **Cons**: Adds complexity, not needed for simple Promise resolution
- **Rejected**: AudioContext.resume() returns Promise - no polling needed

### Implementation Notes

```typescript
// tests/audio/AudioEngine.test.ts

describe('AudioEngine async operations', () => {
  it('should initialize AudioContext', async () => {
    const engine = new AudioEngine();

    // await automatically handled by Vitest
    await engine.initialize();

    expect(engine.isReady()).toBe(true);
  });

  it('should handle initialization failure', async () => {
    const mockContext = new MockAudioContext();
    mockContext.resume = async () => {
      throw new Error('AudioContext suspended by user');
    };

    const engine = new AudioEngine();

    // Test error handling
    await expect(engine.initialize()).rejects.toThrow('AudioContext suspended');
  });

  it('should transition state from suspended to running', async () => {
    const mockContext = new MockAudioContext();
    const engine = new AudioEngine();

    expect(mockContext.state).toBe('suspended');

    await engine.initialize();

    expect(mockContext.state).toBe('running');
  });
});
```

**Testing multiple async operations**:
```typescript
it('should handle concurrent initializations', async () => {
  const engine = new AudioEngine();

  // Start multiple initializations concurrently
  const init1 = engine.initialize();
  const init2 = engine.initialize();

  // Both should resolve without error
  await Promise.all([init1, init2]);

  expect(engine.isReady()).toBe(true);
});
```

**Timeout for long operations** (optional):
```typescript
it('should initialize within 1 second', async () => {
  const engine = new AudioEngine();
  await engine.initialize();
}, 1000); // Vitest timeout in ms
```

---

## BP-001: Vitest Configuration

### Recommendations

**Optimal Vitest config for TypeScript + Web Audio testing**:

```typescript
// vitest.config.ts

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Global test settings
    globals: true, // No need to import describe, it, expect
    environment: 'happy-dom', // Faster than jsdom (see BP-001 comparison below)

    // TypeScript support
    typecheck: {
      enabled: false, // Run tsc separately for type checking
    },

    // Coverage configuration
    coverage: {
      provider: 'v8', // Faster than istanbul, native to V8 engine
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',

      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },

      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/main.ts',
        'node_modules/**',
      ],
    },

    // Performance
    isolate: true, // Run each test file in isolation (prevents shared state)
    maxConcurrency: 5, // Limit parallel test files

    // Watch mode
    watch: false, // Disable by default (use npm run test:watch)

    // UI mode
    ui: false, // Enable with --ui flag

    // Reporters
    reporters: ['verbose'], // Show detailed test output

    // Setup files
    setupFiles: ['./tests/setup.ts'], // Global test setup
  },
});
```

**happy-dom vs jsdom comparison**:

| Feature | happy-dom | jsdom |
|---------|-----------|-------|
| Speed | ~3x faster | Slower (full browser simulation) |
| DOM API Coverage | Good (90%+) | Excellent (99%+) |
| Memory Usage | Lower | Higher |
| Canvas Support | Basic | Better (but still limited) |
| Recommendation | ✅ Use for this project | Use only if happy-dom fails |

**Rationale for happy-dom**: Tests need basic DOM (canvas element, mouse events) but not full browser APIs. happy-dom provides sufficient coverage at 3x speed, meeting the "< 10 second" performance requirement.

**Global setup file**:
```typescript
// tests/setup.ts

import { beforeEach, afterEach, vi } from 'vitest';
import { MockAudioContext } from './mocks/WebAudioAPI.mock';
import { MockLocalStorage } from './mocks/LocalStorage.mock';

// Global mocks
beforeEach(() => {
  // Mock Web Audio API
  global.AudioContext = MockAudioContext as any;

  // Mock localStorage
  global.localStorage = new MockLocalStorage();

  // Mock performance.now() for consistent timing
  vi.spyOn(performance, 'now').mockReturnValue(0);
});

afterEach(() => {
  // Clear all mocks between tests
  vi.clearAllMocks();

  // Reset localStorage
  global.localStorage.clear();
});
```

---

## BP-002: Test Organization

### Recommendations

**File naming conventions**:
- Unit tests: `[ClassName].test.ts` (e.g., `AudioEngine.test.ts`)
- Integration tests: `[ClassName].integration.test.ts` (e.g., `AudioEngine.integration.test.ts`)
- Test fixtures: `[entity].fixture.ts` (e.g., `patches.fixture.ts`)
- Mocks: `[API].mock.ts` (e.g., `WebAudioAPI.mock.ts`)

**Directory structure**:
```
tests/
├── setup.ts                    # Global setup
├── mocks/                      # Shared mocks
│   ├── WebAudioAPI.mock.ts
│   └── LocalStorage.mock.ts
├── fixtures/                   # Shared test data
│   ├── components.fixture.ts
│   └── patches.fixture.ts
├── audio/                      # AudioEngine tests
│   ├── AudioEngine.test.ts
│   └── AudioEngine.integration.test.ts
├── persistence/                # Serialization tests
│   ├── PatchSerializer.test.ts
│   └── PatchStorage.test.ts
└── canvas/                     # Canvas interaction tests
    ├── Canvas.drag.test.ts
    └── Canvas.connection.test.ts
```

**describe block patterns**:
```typescript
describe('AudioEngine', () => {
  // Group by functionality
  describe('initialization', () => {
    it('should create AudioContext on first call', async () => {
      // ...
    });

    it('should handle initialization failure', async () => {
      // ...
    });
  });

  describe('node connections', () => {
    it('should connect two audio nodes', () => {
      // ...
    });

    it('should track connected nodes', () => {
      // ...
    });
  });

  describe('state transitions', () => {
    it('should resume suspended context', async () => {
      // ...
    });
  });
});
```

**Setup/teardown patterns**:
```typescript
describe('PatchSerializer', () => {
  let serializer: PatchSerializer;
  let testPatch: Patch;

  // Runs before each test
  beforeEach(() => {
    serializer = new PatchSerializer();
    testPatch = createSimplePatch();
  });

  // Runs after each test
  afterEach(() => {
    serializer = null as any;
    testPatch = null as any;
  });

  it('should serialize patch to JSON', () => {
    const json = serializer.serialize(testPatch);
    expect(json).toContain('"name":"Test Patch"');
  });
});
```

**Test naming conventions**:
- Use "should" statements: `it('should connect two nodes', () => {})`
- Be specific: `it('should serialize patch with 5 components', () => {})` not `it('should work', () => {})`
- Include scenario: `it('should throw error when deserializing invalid JSON', () => {})`

---

## BP-003: Mock Patterns

### Recommendations

**Type-safe mock pattern with Partial<T>**:
```typescript
// tests/mocks/WebAudioAPI.mock.ts

export class MockAudioContext implements Partial<BaseAudioContext> {
  state: AudioContextState = 'suspended';
  sampleRate: number = 44100;
  currentTime: number = 0;

  createOscillator(): OscillatorNode {
    return new MockOscillatorNode() as unknown as OscillatorNode;
  }

  async resume(): Promise<void> {
    this.state = 'running';
  }

  // Only implement methods tests actually use
  // Missing methods will cause TypeScript errors if accidentally called
}
```

**Mock reset patterns**:
```typescript
// tests/setup.ts

import { afterEach, vi } from 'vitest';

afterEach(() => {
  // Clear all vi.fn() mocks (reset call counts)
  vi.clearAllMocks();

  // Reset all mock implementations to original
  vi.resetAllMocks();

  // Restore all mocked modules to original
  vi.restoreAllMocks();
});
```

**When to use each**:
- `vi.clearAllMocks()`: Reset call history but keep mock implementation (most common)
- `vi.resetAllMocks()`: Reset call history AND implementation (use when mocks need to change between tests)
- `vi.restoreAllMocks()`: Remove all mocks, restore originals (rarely needed)

**Spy vs Mock**:
```typescript
// Spy: Call real implementation, track calls
const realFunction = vi.spyOn(audioEngine, 'connect');
audioEngine.connect(node1, node2);
expect(realFunction).toHaveBeenCalledWith(node1, node2);

// Mock: Replace implementation
const mockFunction = vi.fn().mockReturnValue(42);
expect(mockFunction()).toBe(42);
```

**Mock module pattern**:
```typescript
// tests/audio/AudioEngine.test.ts

vi.mock('../../src/audio/AudioContext', () => ({
  AudioContext: MockAudioContext,
}));

// Now all imports of AudioContext use mock
import { AudioContext } from '../../src/audio/AudioContext';
// This is MockAudioContext
```

---

## BP-004: Coverage Reporting

### Recommendations

**Coverage reporters configuration**:
```typescript
// vitest.config.ts

coverage: {
  reporter: [
    'text',         // Console output during test run
    'html',         // Interactive HTML report (coverage/index.html)
    'lcov',         // For CI/CD tools (Codecov, Coveralls)
    'json-summary', // For programmatic threshold checks
  ],
}
```

**Local development workflow**:
```bash
# Run tests with coverage
npm run test:coverage

# Open HTML report in browser
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html  # Windows
```

**CI/CD integration** (GitHub Actions example):
```yaml
# .github/workflows/test.yml

name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests with coverage
        run: npm run test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: true

      - name: Check coverage thresholds
        run: |
          GLOBAL=$(jq '.total.lines.pct' coverage/coverage-summary.json)
          if (( $(echo "$GLOBAL < 60" | bc -l) )); then
            echo "Global coverage ($GLOBAL%) below 60% threshold"
            exit 1
          fi
```

**Interpreting coverage reports**:

**Text output** (console):
```
File                   | % Stmts | % Branch | % Funcs | % Lines | Uncovered Lines
-----------------------|---------|----------|---------|---------|------------------
All files              |   62.5  |    55.0  |   70.0  |   62.5  |
 src/audio             |   75.0  |    66.7  |   80.0  |   75.0  |
  AudioEngine.ts       |   80.0  |    75.0  |   85.0  |   80.0  | 45-47, 92
 src/persistence       |   85.0  |    70.0  |   90.0  |   85.0  |
  PatchSerializer.ts   |   90.0  |    80.0  |   95.0  |   90.0  | 123-125
```

**HTML report** (interactive):
- Click file name → see line-by-line coverage
- Green = covered, Red = uncovered, Yellow = partially covered branch
- Hover over line number → see which test covered it

**Coverage metrics explained**:
- **Statements**: Individual JavaScript statements executed
- **Branches**: if/else paths taken (50% = only one branch tested)
- **Functions**: Functions/methods called at least once
- **Lines**: Lines of code executed (most important metric)

**Best practices**:
1. Focus on **Lines** coverage first (easiest to understand)
2. Aim for **Branches** coverage second (catches edge cases)
3. **Functions** coverage often follows Lines automatically
4. Don't chase 100% - 80% is excellent, 60% is acceptable for non-critical code

---

## Summary of Decisions

| Research Task | Decision | Rationale |
|---------------|----------|-----------|
| **RT-001** | Manual TypeScript mocks | Lightweight, type-safe, sufficient for connection testing |
| **RT-002** | Manual MouseEvent construction | Direct control, no extra dependencies, clear syntax |
| **RT-003** | vitest.config.ts thresholds | Single source of truth, CI/CD integration, granular control |
| **RT-004** | Factory functions | Simple, type-safe, composable, discoverable |
| **RT-005** | Real classes + mocked APIs | Tests integration logic while staying fast |
| **RT-006** | async/await | Modern, clean, Vitest native support |

| Best Practice | Recommendation | Key Benefit |
|---------------|----------------|-------------|
| **BP-001** | happy-dom + v8 coverage | 3x faster than jsdom, meets < 10s requirement |
| **BP-002** | Module-based organization | Clear structure, easy to find tests |
| **BP-003** | Partial<T> + vi.clearAllMocks | Type safety + clean slate between tests |
| **BP-004** | text + html + lcov reporters | Local dev + CI/CD coverage |

---

## Next Steps

All research complete. Ready for **Phase 1: Design & Contracts**.

Phase 1 will create:
1. **data-model.md**: Test fixture schemas, mock object structure
2. **contracts/**: TypeScript interfaces for fixtures and mocks
3. **quickstart.md**: Developer guide for running/adding tests
4. **CLAUDE.md update**: Add testing tech stack to agent context

All technical decisions documented above will inform Phase 1 design artifacts.
