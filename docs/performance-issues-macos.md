# macOS High CPU Load Performance Issue

## Problem Summary

**Symptom**: CPU load on macOS (Chrome/Safari) reaches 80-98%, while Windows runs at 15-30%

**Root Cause**: Multiple independent `requestAnimationFrame` loops combined with Retina display pixel multiplication

**Severity**: HIGH - Makes application nearly unusable on macOS devices

---

## Technical Analysis

### 1. Multiple Animation Loops

The application currently runs **5-6 independent animation loops** simultaneously at 60fps:

| File | Loop Type | Impact Level |
|------|-----------|--------------|
| `src/canvas/Canvas.ts:673` | Main canvas render loop | HIGH |
| `src/canvas/displays/OscilloscopeDisplay.ts:66` | Per-oscilloscope loop | VERY HIGH |
| `src/canvas/displays/SequencerDisplay.ts:103` | Per-sequencer loop | MEDIUM |
| `src/components/utilities/Collider.ts:391` | Per-collider loop | MEDIUM |
| `src/visualization/VisualUpdateScheduler.ts:110` | Centralized scheduler (good!) | N/A |

**Example Scenario**:
- 1 main canvas
- 2 oscilloscopes
- 1 step sequencer
- 1 collider component

= **5 separate 60fps loops = 300 render calls/second**

### 2. Retina Display Multiplier

macOS Retina displays have `window.devicePixelRatio = 2`, which means:

```javascript
// Canvas setup in src/canvas/Canvas.ts:99-102
const dpr = window.devicePixelRatio || 1;
this.canvas.width = rect.width * dpr;   // 2x on macOS
this.canvas.height = rect.height * dpr;  // 2x on macOS
```

**Result**: 4x pixel count (2 × 2 = 4) per canvas on Retina displays

**Combined Impact**:
```
5 loops × 60fps × 4x pixels = ~1200 heavy render operations/second
```

### 3. Evidence in Codebase

#### Independent Animation Loops Found:

**Canvas.ts** (Main canvas):
```typescript
// Line 673
this.animationFrameId = requestAnimationFrame(this.render);
```

**OscilloscopeDisplay.ts** (Each oscilloscope):
```typescript
// Lines 61-68
private startAnimation(): void {
  const animate = () => {
    if (!this.isFrozen) {
      this.render();
    }
    this.animationFrame = requestAnimationFrame(animate);
  };
  animate();
}
```

**SequencerDisplay.ts** (Each sequencer):
```typescript
// Similar pattern to oscilloscope
this.animationFrame = requestAnimationFrame(animate);
```

**Collider.ts** (Each collider):
```typescript
// Line 391
this.animationFrameId = requestAnimationFrame(this.animate);
```

#### Existing Infrastructure (Not Used):

```typescript
// src/visualization/VisualUpdateScheduler.ts
// Centralized animation scheduler exists but is underutilized!
export class VisualUpdateScheduler {
  onFrame(callback: FrameCallback): SubscriptionHandle { ... }
  start(): void { ... }
  // Provides: FPS monitoring, single RAF loop, callback management
}
```

---

## Recommended Fixes

### Priority 1: QUICK WIN - Throttle Oscilloscope Rendering

**Impact**: 40-50% CPU reduction
**Effort**: LOW (15 minutes)
**Files**: `src/canvas/displays/OscilloscopeDisplay.ts`

**Change**:
```typescript
export class OscilloscopeDisplay {
  private lastRenderTime: number = 0;
  private targetFPS: number = 30; // Reduce from 60fps
  private frameInterval: number = 1000 / this.targetFPS;

  private startAnimation(): void {
    const animate = (timestamp: number) => {
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
}
```

**Rationale**: Visual analysis doesn't need 60fps; 30fps is sufficient and saves 50% render cycles

---

### Priority 2: MEDIUM WIN - Conditional Rendering

**Impact**: 30-40% CPU reduction (when applicable)
**Effort**: MEDIUM (1-2 hours)
**Files**: `src/canvas/displays/OscilloscopeDisplay.ts`, `SequencerDisplay.ts`

**Change**: Only render when component is visible in viewport

```typescript
export class OscilloscopeDisplay {
  private isVisible(): boolean {
    const rect = this.canvas.getBoundingClientRect();
    return (
      rect.top < window.innerHeight &&
      rect.bottom > 0 &&
      rect.left < window.innerWidth &&
      rect.right > 0
    );
  }

  private startAnimation(): void {
    const animate = (timestamp: number) => {
      // Skip rendering if not visible
      if (!this.isVisible()) {
        this.animationFrame = requestAnimationFrame(animate);
        return;
      }

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
}
```

---

### Priority 3: HIGH WIN - Consolidate to Single Animation Loop

**Impact**: 60-70% CPU reduction
**Effort**: HIGH (4-6 hours)
**Files**: All display and component files

**Change**: Migrate all components to use `VisualUpdateScheduler`

**Example for OscilloscopeDisplay.ts**:
```typescript
import { visualUpdateScheduler } from '../../visualization/scheduler'; // singleton

export class OscilloscopeDisplay {
  private subscription: SubscriptionHandle | null = null;
  private lastRenderTime: number = 0;
  private frameInterval: number = 1000 / 30;

  constructor(...) {
    // ... existing setup ...

    // Subscribe to centralized animation loop
    this.subscription = visualUpdateScheduler.onFrame((deltaMs) => {
      const now = performance.now();
      if (now - this.lastRenderTime >= this.frameInterval) {
        if (!this.isFrozen && this.isVisible()) {
          this.render();
        }
        this.lastRenderTime = now;
      }
    });
  }

  destroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }
}
```

**Files to modify**:
- `src/canvas/displays/OscilloscopeDisplay.ts`
- `src/canvas/displays/SequencerDisplay.ts`
- `src/components/utilities/Collider.ts`
- `src/canvas/Canvas.ts` (migrate to scheduler)

**Additional requirement**: Create singleton instance of VisualUpdateScheduler:
```typescript
// src/visualization/scheduler.ts (new file)
import { VisualUpdateScheduler } from './VisualUpdateScheduler';

export const visualUpdateScheduler = new VisualUpdateScheduler();
visualUpdateScheduler.initialize(60, true);
visualUpdateScheduler.start();
```

---

### Priority 4: OPTIMIZATION - Frame Budget System

**Impact**: 20-30% CPU reduction
**Effort**: MEDIUM (2-3 hours)
**Files**: `src/visualization/VisualUpdateScheduler.ts`

**Change**: Add priority-based rendering budget

```typescript
export class VisualUpdateScheduler {
  private frameBudgetMs: number = 16; // ~60fps budget

  private onAnimationFrame(timestamp: number): void {
    const frameStartTime = performance.now();
    const deltaMs = timestamp - this.lastFrameTime;
    this.lastFrameTime = timestamp;

    // Sort callbacks by priority (main canvas first, displays last)
    const sortedCallbacks = Array.from(this.callbacks.entries())
      .sort(([a], [b]) => (this.priorities.get(a) || 0) - (this.priorities.get(b) || 0));

    // Execute callbacks within frame budget
    for (const [id, callback] of sortedCallbacks) {
      const elapsed = performance.now() - frameStartTime;
      if (elapsed >= this.frameBudgetMs) {
        console.warn('Frame budget exceeded, skipping remaining callbacks');
        break;
      }

      try {
        callback(deltaMs);
      } catch (error) {
        console.error('Error in frame callback:', error);
      }
    }

    this.scheduleNextFrame();
  }
}
```

---

### Priority 5: ADVANCED - OffscreenCanvas for Background Rendering

**Impact**: 15-25% CPU reduction
**Effort**: HIGH (6-8 hours)
**Files**: Display components
**Note**: Requires Web Worker support

**Change**: Move oscilloscope/sequencer rendering to Web Worker with OffscreenCanvas

```typescript
// oscilloscope-worker.ts (new file)
const offscreenCanvas = new OffscreenCanvas(width, height);
const ctx = offscreenCanvas.getContext('2d');

self.onmessage = (e) => {
  const { waveformData, displayMode } = e.data;

  // Render in worker thread
  renderOscilloscope(ctx, waveformData, displayMode);

  // Transfer bitmap back to main thread
  const bitmap = offscreenCanvas.transferToImageBitmap();
  self.postMessage({ bitmap }, [bitmap]);
};
```

**Browser Support**: Check for `OffscreenCanvas` support (Safari 16.4+, Chrome 69+)

---

## Performance Profiling Commands

### Chrome DevTools

1. Open DevTools → Performance tab
2. Click Record
3. Interact with app for 5 seconds
4. Stop recording
5. Look for:
   - Long tasks (yellow/red bars)
   - Frequent `requestAnimationFrame` calls
   - Canvas rendering bottlenecks

### Safari Web Inspector

1. Develop → Show Web Inspector → Timelines
2. Enable: JavaScript & Events, Rendering Frames
3. Record for 5 seconds
4. Look for:
   - Frame rate drops
   - Time spent in scripting vs. painting

### Expected Results After Fixes

| Metric | Before (macOS) | After Priority 1 | After Priority 3 |
|--------|----------------|------------------|------------------|
| CPU % | 80-98% | 40-50% | 15-30% |
| FPS | Variable 30-60 | Stable 60 | Stable 60 |
| Active RAF loops | 5-6 | 5-6 | 1 |
| Render calls/sec | ~1200 | ~600 | ~60 |

---

## Testing Checklist

After implementing fixes, verify:

- [ ] CPU usage on macOS (Activity Monitor)
- [ ] CPU usage on Windows (Task Manager)
- [ ] Oscilloscope still renders smoothly
- [ ] Sequencer display updates correctly
- [ ] Collider physics simulation runs smoothly
- [ ] No visual glitches or lag
- [ ] Memory usage stable (no leaks)
- [ ] Multiple components can be added without severe performance degradation

---

## Implementation Order

1. **Week 1**: Priority 1 (Quick Win) - Throttle oscilloscope to 30fps
2. **Week 2**: Priority 2 - Add conditional visibility rendering
3. **Week 3-4**: Priority 3 - Consolidate to single animation loop (BREAKING CHANGE - test thoroughly)
4. **Week 5**: Priority 4 - Frame budget system (optional enhancement)
5. **Future**: Priority 5 - OffscreenCanvas (if needed)

---

## Additional Notes

### Why Windows is Less Affected

1. **Lower DPR**: Most Windows displays have `devicePixelRatio = 1` (not 2 like macOS Retina)
2. **GPU Acceleration**: Windows Chrome may have better GPU acceleration for canvas operations
3. **Pixel Count**: 4x fewer pixels to render compared to macOS Retina

### Monitoring

Add FPS counter to UI for debugging:

```typescript
// In VisualUpdateScheduler
getCurrentFPS(): number {
  return this.currentFPS;
}

// Display in UI overlay
ctx.fillStyle = 'white';
ctx.font = '12px monospace';
ctx.fillText(`FPS: ${visualUpdateScheduler.getCurrentFPS()}`, 10, 20);
```

---

## References

- [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame)
- [MDN: OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)
- [Chrome DevTools Performance Profiling](https://developer.chrome.com/docs/devtools/performance/)
- [Optimizing Canvas Performance](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)

---

**Last Updated**: 2025-11-08
**Reporter**: Development Team
**Status**: DOCUMENTED - Ready for Implementation
