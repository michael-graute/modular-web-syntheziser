# Quickstart Guide: Centralized Animation Loop Migration

**Feature**: 007-visual-update-scheduler
**For**: Developers implementing or reviewing this migration

## Overview

This guide provides step-by-step instructions for migrating a visual component from independent `requestAnimationFrame` loops to the centralized `VisualUpdateScheduler`.

## Prerequisites

- Understand the component's current animation loop implementation
- Have access to `src/visualization/scheduler.ts` (singleton instance)
- Know the component's target frame rate (30fps or 60fps)

## Migration Steps

### Step 1: Create Scheduler Singleton (ONE TIME ONLY)

**File**: `src/visualization/scheduler.ts` (NEW)

```typescript
import { VisualUpdateScheduler } from './VisualUpdateScheduler';

/**
 * Singleton instance of VisualUpdateScheduler
 * Initialized at application startup in main.ts
 */
export const visualUpdateScheduler = new VisualUpdateScheduler();
```

### Step 2: Initialize Scheduler at Startup (ONE TIME ONLY)

**File**: `src/main.ts` (MODIFIED)

```typescript
import { visualUpdateScheduler } from './visualization/scheduler';

// ... existing imports ...

// Initialize scheduler at application startup
visualUpdateScheduler.initialize(60, true);
visualUpdateScheduler.start();
console.log('✓ Centralized animation scheduler started');

// ... rest of main.ts ...
```

### Step 3: Migrate Individual Component

For each component (Canvas, OscilloscopeDisplay, SequencerDisplay, Collider):

#### 3.1 Update Imports

**Before**:
```typescript
// No scheduler import
```

**After**:
```typescript
import { visualUpdateScheduler } from '../../visualization/scheduler';
import type { SubscriptionHandle } from '../../visualization/types';
```

#### 3.2 Update Class Properties

**Before**:
```typescript
export class OscilloscopeDisplay {
  private animationFrame: number | null;
  private lastRenderTime: number = 0;
  private targetFPS: number = 30;
  private frameInterval: number = 1000 / this.targetFPS;

  // ... other properties ...
}
```

**After**:
```typescript
export class OscilloscopeDisplay {
  private subscription: SubscriptionHandle | null;  // CHANGED
  private lastRenderTime: number = 0;
  private targetFPS: number = 30;
  private frameInterval: number = 1000 / this.targetFPS;

  // ... other properties ...
}
```

#### 3.3 Update Constructor - Remove Old Animation Loop

**Before**:
```typescript
constructor(...) {
  // ... existing setup ...

  this.animationFrame = null;

  // Start animation loop
  this.startAnimation();
}

private startAnimation(): void {
  const animate = (timestamp: number) => {
    // Skip rendering if not visible
    if (!this.isVisible()) {
      this.animationFrame = requestAnimationFrame(animate);
      return;
    }

    // Throttle to 30fps
    if (timestamp - this.lastRenderTime >= this.frameInterval) {
      if (!this.isFrozen) {
        this.render();
      }
      this.lastRenderTime = timestamp;
    }

    this.animationFrame = requestAnimationFrame(animate);
  };
  animate(performance.now());
}
```

**After**:
```typescript
constructor(...) {
  // ... existing setup ...

  this.subscription = null;

  // Subscribe to centralized scheduler
  this.subscription = visualUpdateScheduler.onFrame(
    (deltaMs) => {
      const now = performance.now();

      // Throttle to 30fps (component-level)
      if (now - this.lastRenderTime >= this.frameInterval) {
        // Skip rendering if not visible
        if (!this.isVisible()) return;

        if (!this.isFrozen) {
          this.render();
        }
        this.lastRenderTime = now;
      }
    },
    'OscilloscopeDisplay'  // Component ID for error logging
  );
}

// DELETE the old startAnimation() method entirely
```

#### 3.4 Update Destroy Method

**Before**:
```typescript
destroy(): void {
  if (this.animationFrame !== null) {
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
  }

  // ... other cleanup ...
}
```

**After**:
```typescript
destroy(): void {
  if (this.subscription) {
    this.subscription.unsubscribe();
    this.subscription = null;
  }

  // ... other cleanup ...
}
```

### Step 4: Test the Migration

#### 4.1 Visual Verification

1. Run the application
2. Create instances of the migrated component
3. Verify rendering looks identical to before migration
4. Check for:
   - No stuttering or lag
   - Smooth animations
   - Correct frame rate
   - No visual glitches

#### 4.2 Performance Verification

**Chrome DevTools Performance Tab**:
1. Open DevTools → Performance
2. Click Record
3. Interact with app for 10 seconds
4. Stop recording
5. Search for "requestAnimationFrame" in call tree
6. Verify exactly ONE animation loop active (not multiple)

**macOS Activity Monitor**:
1. Open Activity Monitor
2. Filter for browser process
3. Create 2 oscilloscopes + 1 sequencer + 1 collider
4. Record CPU usage over 60 seconds
5. Verify CPU significantly lower than before

#### 4.3 Memory Leak Check

1. Open DevTools → Memory
2. Take heap snapshot (baseline)
3. Add 10 instances of migrated component
4. Remove all 10 instances
5. Force garbage collection (trash can icon)
6. Take second heap snapshot
7. Compare: Should be within 10% of baseline
8. Check `visualUpdateScheduler.getCallbackCount()` returns 0

### Step 5: Verify Success Criteria

After migrating ALL components, verify:

- [ ] CPU usage on macOS: 15-30% (down from 80-98%)
- [ ] Exactly 1 requestAnimationFrame loop active
- [ ] Render calls: ~60/sec (down from ~300/sec)
- [ ] FPS: Stable 60fps
- [ ] No visual regressions in any component
- [ ] No memory leaks (callbacks cleaned up on destroy)
- [ ] Errors logged with component ID (test by throwing error in callback)

## Common Patterns

### Pattern 1: Component with Throttling (30fps)

```typescript
constructor() {
  this.subscription = visualUpdateScheduler.onFrame((deltaMs) => {
    const now = performance.now();
    if (now - this.lastRenderTime >= this.frameInterval) {
      this.render();
      this.lastRenderTime = now;
    }
  }, 'MyComponent');
}
```

### Pattern 2: Component without Throttling (60fps)

```typescript
constructor() {
  this.subscription = visualUpdateScheduler.onFrame((deltaMs) => {
    this.render();
  }, 'MyComponent');
}
```

### Pattern 3: Component with Visibility Check

```typescript
constructor() {
  this.subscription = visualUpdateScheduler.onFrame((deltaMs) => {
    if (!this.isVisible()) return;

    const now = performance.now();
    if (now - this.lastRenderTime >= this.frameInterval) {
      this.render();
      this.lastRenderTime = now;
    }
  }, 'MyComponent');
}
```

### Pattern 4: Component with Frozen/Paused State

```typescript
constructor() {
  this.subscription = visualUpdateScheduler.onFrame((deltaMs) => {
    if (this.isFrozen) return;

    const now = performance.now();
    if (now - this.lastRenderTime >= this.frameInterval) {
      this.render();
      this.lastRenderTime = now;
    }
  }, 'MyComponent');
}
```

## Troubleshooting

### Issue: Component Not Rendering

**Symptoms**: Component appears frozen, no visual updates

**Checks**:
1. Verify scheduler is started: `visualUpdateScheduler.isActive()` → should be `true`
2. Verify subscription created: `this.subscription !== null`
3. Check callback is firing: Add `console.log('callback fired')` inside onFrame
4. Check throttling logic: Ensure `lastRenderTime` is being updated

### Issue: Memory Leak

**Symptoms**: Callback count keeps growing, memory usage increases

**Checks**:
1. Verify destroy() is called when component removed
2. Verify destroy() calls `this.subscription.unsubscribe()`
3. Check `visualUpdateScheduler.getCallbackCount()` after component removal
4. Use Chrome DevTools Memory profiler to find retained objects

### Issue: Errors Not Logged

**Symptoms**: Silent failures, no error messages

**Checks**:
1. Verify componentId provided: `onFrame(callback, 'ComponentName')`
2. Check console filter settings (show all levels)
3. Verify FR-012 implementation in VisualUpdateScheduler (try-catch with logging)

### Issue: Background Tab Still Using CPU

**Symptoms**: CPU usage high when tab hidden

**Checks**:
1. Verify FR-011 implementation (Page Visibility API)
2. Check `visualUpdateScheduler.isPaused()` when tab hidden → should be `true`
3. Use Chrome Task Manager to verify CPU usage drops when tab backgrounded

## Migration Checklist

For each component:

- [ ] Step 1: Import scheduler singleton and types
- [ ] Step 2: Change `animationFrame` property to `subscription`
- [ ] Step 3: Replace `startAnimation()` with `onFrame()` subscription
- [ ] Step 4: Update `destroy()` to call `unsubscribe()`
- [ ] Step 5: Delete old `startAnimation()` method
- [ ] Step 6: Test visual behavior (no regressions)
- [ ] Step 7: Test performance (CPU usage, frame rate)
- [ ] Step 8: Test memory cleanup (no leaks)
- [ ] Step 9: Commit changes with clear message

After ALL components migrated:

- [ ] Verify CPU usage: 15-30% on macOS
- [ ] Verify single animation loop (DevTools Performance)
- [ ] Verify ~60 render calls/sec (not ~300)
- [ ] Run full application test suite
- [ ] Document migration in CLAUDE.md

## Next Steps

After completing migration:
1. Update `docs/performance-issues-macos.md` with results
2. Run `/speckit.tasks` to generate implementation tasks
3. Implement enhancements (FR-011, FR-012, FR-013) in VisualUpdateScheduler
4. Document migration pattern for future components

## Support

- **Spec**: [spec.md](./spec.md)
- **Research**: [research.md](./research.md)
- **Data Model**: [data-model.md](./data-model.md)
- **Type Contracts**: [contracts/types.ts](./contracts/types.ts)
- **Validation**: [contracts/validation.ts](./contracts/validation.ts)
