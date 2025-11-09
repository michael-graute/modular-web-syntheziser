# Research: Centralized Animation Loop Migration

**Feature**: 007-visual-update-scheduler
**Date**: 2025-11-09
**Status**: Complete

## Research Questions

This research addresses the technical unknowns and best practices needed for migrating components to the centralized VisualUpdateScheduler.

## 1. Background Tab Pause/Resume Pattern

**Decision**: Use Page Visibility API with automatic pause/resume

**Rationale**:
- Modern browsers provide the Page Visibility API (`document.visibilitychange` event)
- Standard pattern: pause requestAnimationFrame when `document.hidden === true`
- Browsers already throttle background tabs, so explicit pausing aligns with browser behavior
- Prevents unnecessary CPU usage when user isn't viewing the tab
- Matches user expectation from clarification session (FR-011)

**Implementation Pattern**:
```typescript
// In VisualUpdateScheduler
private setupVisibilityHandling(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      this.pause();
    } else {
      this.resume();
    }
  });
}

private pause(): void {
  if (this.animationFrameId !== null) {
    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
  }
}

private resume(): void {
  if (this.isRunning && this.animationFrameId === null) {
    this.lastFrameTime = performance.now();
    this.scheduleNextFrame();
  }
}
```

**Alternatives Considered**:
- Continue running at full speed: Rejected - wastes CPU when tab hidden
- Throttle to 1fps: Rejected - adds complexity, minimal benefit over full pause
- Manual pause/resume API: Rejected - Page Visibility API is automatic and standard

**References**:
- [MDN: Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [requestAnimationFrame and background tabs](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame#notes)

---

## 2. Error Handling and Component Identification

**Decision**: Wrap callbacks in try-catch with component ID tracking

**Rationale**:
- Prevents one broken component from breaking all visual updates
- Console logging is essential for debugging visual issues in production
- Component identification helps developers pinpoint which component is failing
- Zero performance overhead in happy path, negligible overhead on error
- Matches clarification FR-012 requirement

**Implementation Pattern**:
```typescript
// Extend SubscriptionHandle to include optional component ID
interface SubscriptionMetadata {
  callback: FrameCallback;
  componentId?: string;
}

// Store metadata instead of just callbacks
private callbacks: Map<number, SubscriptionMetadata> = new Map();

onFrame(callback: FrameCallback, componentId?: string): SubscriptionHandle {
  const id = this.nextCallbackId++;
  this.callbacks.set(id, { callback, componentId });
  return {
    unsubscribe: () => this.callbacks.delete(id)
  };
}

// In animation frame handler
this.callbacks.forEach(({ callback, componentId }, id) => {
  try {
    callback(deltaMs);
  } catch (error) {
    const identifier = componentId || `callback-${id}`;
    console.error(`Error in frame callback [${identifier}]:`, error);
  }
});
```

**Alternatives Considered**:
- Silent suppression: Rejected - makes debugging impossible
- Throw after logging: Rejected - would still break other components
- External error service (Sentry): Deferred - can add later, console.error sufficient for now

**Best Practices**:
- Always include component class name or instance ID when subscribing
- Use structured logging format for easier filtering
- Consider adding error rate tracking (future enhancement)

---

## 3. Concurrent Subscription Lifecycle Management

**Decision**: Deferred removal pattern with pending queue

**Rationale**:
- Prevents concurrent modification of callback map during iteration
- Allows current callback to complete safely before removal
- Standard pattern used in event emitters and observable libraries
- Matches clarification FR-013 requirement
- Minimal performance overhead (only when unsubscribe during callback)

**Implementation Pattern**:
```typescript
private callbacks: Map<number, SubscriptionMetadata> = new Map();
private pendingRemovals: Set<number> = new Set();

unsubscribe(id: number): void {
  if (this.isIterating) {
    // Defer removal until after current frame
    this.pendingRemovals.add(id);
  } else {
    this.callbacks.delete(id);
  }
}

private onAnimationFrame(timestamp: number): void {
  this.isIterating = true;

  // Execute callbacks
  this.callbacks.forEach(({ callback, componentId }, id) => {
    if (this.pendingRemovals.has(id)) {
      return; // Skip already-removed callbacks
    }
    try {
      callback(deltaMs);
    } catch (error) {
      console.error(`Error in frame callback [${componentId || id}]:`, error);
    }
  });

  this.isIterating = false;

  // Process pending removals
  this.pendingRemovals.forEach(id => this.callbacks.delete(id));
  this.pendingRemovals.clear();

  this.scheduleNextFrame();
}
```

**Alternatives Considered**:
- Immediate removal: Rejected - causes concurrent modification errors
- Copy callbacks array before iteration: Rejected - higher memory overhead, still need deferred cleanup
- Lock/mutex pattern: Rejected - overkill for single-threaded JavaScript

**Edge Cases Handled**:
- Component destroyed during its own callback execution
- Multiple components destroyed in same frame
- Subscription added during frame iteration (safe - won't execute until next frame)

---

## 4. Throttling Strategy Within Centralized Scheduler

**Decision**: Component-level throttling using timestamp tracking

**Rationale**:
- Preserves existing 30fps throttling for displays without adding scheduler complexity
- Each component manages own throttle interval (allows different rates)
- No changes to VisualUpdateScheduler needed
- Zero overhead for non-throttled components

**Implementation Pattern**:
```typescript
// In each component (e.g., OscilloscopeDisplay)
export class OscilloscopeDisplay {
  private subscription: SubscriptionHandle | null = null;
  private lastRenderTime: number = 0;
  private frameInterval: number = 1000 / 30; // 30fps

  constructor(...) {
    this.subscription = visualUpdateScheduler.onFrame((deltaMs) => {
      const now = performance.now();

      // Component-level throttling
      if (now - this.lastRenderTime >= this.frameInterval) {
        // Visibility check (existing optimization)
        if (!this.isVisible()) return;

        if (!this.isFrozen) {
          this.render();
        }
        this.lastRenderTime = now;
      }
    }, 'OscilloscopeDisplay');
  }

  destroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }
}
```

**Alternatives Considered**:
- Scheduler-level throttling per callback: Rejected - adds complexity to scheduler
- Every-Nth-frame pattern: Rejected - components could become out of sync
- Separate scheduler instances for different rates: Rejected - defeats purpose of consolidation

**Benefits**:
- Simple and easy to understand
- Each component controls own update rate
- No breaking changes to component APIs
- Performance.now() is extremely fast (sub-microsecond)

---

## 5. Singleton Initialization and Lifecycle

**Decision**: Export singleton instance from `src/visualization/scheduler.ts`, initialize in `main.ts`

**Rationale**:
- Single source of truth for scheduler instance
- Explicit initialization at application startup
- Easy to import from any component: `import { visualUpdateScheduler } from '../visualization/scheduler'`
- Allows future configuration from central location
- Standard singleton pattern for infrastructure services

**Implementation**:
```typescript
// src/visualization/scheduler.ts (NEW FILE)
import { VisualUpdateScheduler } from './VisualUpdateScheduler';

/**
 * Singleton instance of VisualUpdateScheduler
 * Initialized at application startup in main.ts
 */
export const visualUpdateScheduler = new VisualUpdateScheduler();
```

```typescript
// src/main.ts (MODIFIED)
import { visualUpdateScheduler } from './visualization/scheduler';

// Initialize scheduler at application startup
visualUpdateScheduler.initialize(60, true);
visualUpdateScheduler.start();
console.log('✓ Centralized animation scheduler started');
```

**Alternatives Considered**:
- Lazy initialization: Rejected - harder to debug, unclear initialization order
- Dependency injection: Rejected - overkill for client-side application with single scheduler
- Global window object: Rejected - not TypeScript-friendly, pollutes global namespace

**Migration Pattern**:
1. Create singleton export file
2. Initialize in main.ts
3. Migrate components one at a time
4. Each component imports singleton and subscribes in constructor
5. Each component unsubscribes in destroy method

---

## 6. Performance Verification Strategy

**Decision**: Multi-tool measurement approach

**Tools Required**:
1. **Activity Monitor (macOS)** - Primary CPU usage verification
2. **Chrome DevTools Performance tab** - Detailed profiling
3. **VisualUpdateScheduler.getCurrentFPS()** - Runtime FPS monitoring
4. **Chrome DevTools Memory profiler** - Memory leak detection

**Measurement Protocol**:

**Before Migration (Baseline)**:
1. Open Activity Monitor, filter for browser process
2. Load application with 2 oscilloscopes, 1 sequencer, 1 collider
3. Record CPU usage over 60 seconds
4. Chrome DevTools: Record 10-second performance profile
5. Count requestAnimationFrame calls per second
6. Expected: 80-98% CPU, ~300 render calls/sec, 5-6 animation loops

**After Migration (Validation)**:
1. Same setup as baseline
2. Record CPU usage over 60 seconds
3. Chrome DevTools: Record 10-second performance profile
4. Verify exactly 1 requestAnimationFrame loop active
5. Count render calls per second (should be ~60)
6. Expected: 15-30% CPU, ~60 render calls/sec, 1 animation loop
7. Visual verification: No stuttering, smooth 60fps, no visual regressions

**Memory Leak Testing**:
1. Open DevTools Memory tab
2. Take heap snapshot (baseline)
3. Add 10 components, wait 5 seconds
4. Remove all 10 components
5. Force garbage collection
6. Take second heap snapshot
7. Compare: Should be within 10% of baseline
8. Check scheduler.getCallbackCount() === 0 after component removal

**Acceptance Criteria**:
- CPU usage: 15-30% (down from 80-98%) ✓
- FPS: Stable 60fps ✓
- Animation loops: Exactly 1 ✓
- Render calls: ~60/sec (down from ~300) ✓
- Memory: No leaks, callbacks properly cleaned up ✓
- Visual: No regressions in any component ✓

---

## 7. Migration Rollback Strategy

**Decision**: Feature flag with gradual rollout per component

**Rationale**:
- Allows testing each component independently
- Easy to rollback if issues discovered
- Can ship partial migration to production
- Reduces risk of breaking all visuals at once

**Implementation** (Optional - for production safety):
```typescript
// Feature flags (can use environment variable or config)
const MIGRATION_FLAGS = {
  useSchedulerForCanvas: true,
  useSchedulerForOscilloscope: true,
  useSchedulerForSequencer: true,
  useSchedulerForCollider: true,
};

// In component constructor
if (MIGRATION_FLAGS.useSchedulerForOscilloscope) {
  // New: Use centralized scheduler
  this.subscription = visualUpdateScheduler.onFrame(...);
} else {
  // Old: Use independent requestAnimationFrame
  this.startAnimation();
}
```

**Rollback Process**:
1. Set component flag to false
2. Reload application
3. Component reverts to independent animation loop
4. No code changes needed

**Alternatives Considered**:
- All-or-nothing migration: Acceptable for this project (low risk, easy to test)
- Git revert: Works but requires redeployment
- A/B testing: Overkill for performance refactoring

**Recommendation**: For this project, direct migration without feature flags is acceptable due to:
- Thorough specification and planning
- Clear success criteria
- Easy to verify with performance tools
- Small number of components (4)
- Can test locally before deployment

---

## Summary

All research questions resolved. Key decisions:

1. **Background tab handling**: Page Visibility API with automatic pause/resume
2. **Error handling**: Try-catch with component ID logging
3. **Concurrent lifecycle**: Deferred removal pattern
4. **Throttling**: Component-level timestamp tracking (no scheduler changes)
5. **Singleton**: Export from scheduler.ts, initialize in main.ts
6. **Verification**: Multi-tool approach (Activity Monitor + DevTools)
7. **Rollback**: Direct migration acceptable, feature flags optional

No blocking issues identified. Ready to proceed to Phase 1 (Design & Contracts).
