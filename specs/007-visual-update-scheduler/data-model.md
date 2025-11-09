# Data Model: Centralized Animation Loop Migration

**Feature**: 007-visual-update-scheduler
**Date**: 2025-11-09

## Overview

This feature involves behavioral/lifecycle entities rather than data persistence entities. The "data model" here describes the runtime object relationships and state machines for scheduler-component interaction.

## Core Entities

### 1. VisualUpdateScheduler (Singleton)

**Purpose**: Centralized manager for all animation frame callbacks

**State**:
```typescript
{
  isRunning: boolean,              // Is animation loop active?
  isPaused: boolean,               // Is scheduler paused (background tab)?
  callbacks: Map<number, SubscriptionMetadata>,
  pendingRemovals: Set<number>,
  nextCallbackId: number,
  lastFrameTime: number,
  currentFPS: number,
  isIterating: boolean             // Currently executing callbacks?
}
```

**State Transitions**:
```
CREATED → initialize() → INITIALIZED
INITIALIZED → start() → RUNNING
RUNNING → document.hidden → PAUSED
PAUSED → document.visible → RUNNING
RUNNING → stop() → STOPPED
```

**Lifecycle**:
- Created: Once at application startup (singleton)
- Initialized: Once with target FPS and interpolation settings
- Started: Once after initialization
- Paused/Resumed: Multiple times (tab visibility changes)
- Stopped: Never in normal operation (only on application shutdown)

**Relationships**:
- One-to-many with SubscriptionMetadata (1 scheduler : N subscriptions)
- Manages lifecycle of all component animation callbacks

---

### 2. SubscriptionMetadata (Internal to Scheduler)

**Purpose**: Tracks callback registration with optional component identification

**Structure**:
```typescript
{
  callback: FrameCallback,         // (deltaMs: number) => void
  componentId?: string             // Optional identifier for error logging
}
```

**Lifecycle**:
- Created: When component calls scheduler.onFrame()
- Active: While component is alive and rendering
- Removed: When component calls subscription.unsubscribe()

**Relationships**:
- Many-to-one with VisualUpdateScheduler (N subscriptions : 1 scheduler)
- One-to-one with Component instance

**Validation Rules**:
- callback must be a function
- componentId (if provided) should be non-empty string
- Each subscription has unique numeric ID (auto-incremented)

---

### 3. SubscriptionHandle (Returned to Components)

**Purpose**: Provides unsubscribe capability to component

**Structure**:
```typescript
{
  unsubscribe: () => void
}
```

**Lifecycle**:
- Created: Returned from scheduler.onFrame()
- Used: Stored in component instance
- Invoked: In component destroy() method

**Relationships**:
- One-to-one with SubscriptionMetadata (1 handle : 1 subscription)
- Held by one Component instance

**Validation Rules**:
- unsubscribe() must be called exactly once
- Calling unsubscribe() multiple times is safe (no-op after first call)
- Must be called before component is garbage collected (prevents memory leak)

---

### 4. Component (Canvas, OscilloscopeDisplay, etc.)

**Purpose**: Visual rendering component that subscribes to animation frames

**State**:
```typescript
{
  subscription: SubscriptionHandle | null,
  lastRenderTime: number,         // For throttling
  frameInterval: number,           // Target frame interval (ms)
  isFrozen: boolean,               // Pause rendering
  isVisible: boolean               // Viewport visibility
}
```

**State Transitions**:
```
CREATED → constructor() → subscribe() → SUBSCRIBED
SUBSCRIBED → destroy() → unsubscribe() → DESTROYED
```

**Lifecycle**:
1. **Construction**: Component created, subscribes to scheduler
2. **Active**: Receives frame callbacks, renders when not throttled/frozen/hidden
3. **Destruction**: Unsubscribes from scheduler, cleans up resources

**Relationships**:
- Many-to-one with VisualUpdateScheduler (N components : 1 scheduler)
- One-to-one with SubscriptionHandle (1 component : 1 subscription)

**Validation Rules**:
- Must subscribe in constructor or init method
- Must unsubscribe in destroy method
- Should check visibility before expensive render operations
- Should implement throttling if target FPS < 60

---

## Interaction Flows

### Flow 1: Component Registration

```
1. Component constructor called
2. Component calls scheduler.onFrame(callback, 'ComponentName')
3. Scheduler assigns unique ID, stores { callback, componentId }
4. Scheduler returns SubscriptionHandle with unsubscribe function
5. Component stores SubscriptionHandle in this.subscription
```

**Invariants**:
- Every active component has exactly one subscription
- Scheduler knows how to identify component for error logging

---

### Flow 2: Frame Execution (Normal Case)

```
1. Browser calls requestAnimationFrame(timestamp)
2. Scheduler calculates deltaMs
3. Scheduler sets isIterating = true
4. Scheduler iterates callbacks Map
5. For each callback:
   a. Check if in pendingRemovals (skip if yes)
   b. Try to execute callback(deltaMs)
   c. Catch errors, log with component ID
   d. Continue to next callback
6. Scheduler sets isIterating = false
7. Scheduler processes pendingRemovals
8. Scheduler schedules next frame
```

**Invariants**:
- Errors in one component don't affect others
- All callbacks receive same deltaMs value
- Frame rate maintained at ~60fps (browser permitting)

---

### Flow 3: Component Destruction

```
1. Component destroy() method called
2. Component checks if this.subscription exists
3. Component calls this.subscription.unsubscribe()
4. Scheduler checks if currently iterating
5. If iterating: Add to pendingRemovals
6. If not iterating: Delete from callbacks immediately
7. Component sets this.subscription = null
```

**Invariants**:
- Component never receives callbacks after unsubscribe
- No memory leaks (subscription fully cleaned up)
- Safe to destroy component during its own callback

---

### Flow 4: Background Tab Pause/Resume

```
Pause (tab hidden):
1. document.visibilitychange event fires
2. document.hidden === true
3. Scheduler calls pause()
4. Scheduler cancels pending animationFrameId
5. Callbacks stop firing

Resume (tab visible):
1. document.visibilitychange event fires
2. document.hidden === false
3. Scheduler calls resume()
4. Scheduler resets lastFrameTime
5. Scheduler schedules next frame
6. Callbacks resume firing
```

**Invariants**:
- No CPU usage while tab hidden
- Smooth resume when tab becomes visible
- Delta time calculated correctly after resume

---

## Validation Rules

### Runtime Validation

**SubscriptionMetadata**:
- Callback must be a function
- ComponentId (if provided) must be non-empty string

**Scheduler State**:
- isIterating must be false when entering onAnimationFrame
- isIterating must be true during callback execution
- isIterating must be false before processing pendingRemovals

**Component State**:
- subscription must be non-null after constructor
- subscription must be null after destroy
- destroy() must be idempotent (safe to call multiple times)

### Performance Validation

**Success Criteria**:
- Exactly 1 active requestAnimationFrame loop
- ~60 callbacks/second total (not per component)
- CPU usage: 15-30% on macOS Retina
- Memory: No leaks (callbacks cleared after unsubscribe)

---

## Migration Impact

### Before Migration

```
Component A: requestAnimationFrame → render (60fps)
Component B: requestAnimationFrame → render (60fps)
Component C: requestAnimationFrame → render (30fps, throttled)
Component D: requestAnimationFrame → render (30fps, throttled)

Total: 4 animation loops, ~180-240 callbacks/second
```

### After Migration

```
Scheduler: requestAnimationFrame (60fps)
  ├─ Component A callback → render
  ├─ Component B callback → render
  ├─ Component C callback → throttled render (30fps)
  └─ Component D callback → throttled render (30fps)

Total: 1 animation loop, ~60 callbacks/second
```

**CPU Reduction Mechanism**:
- 4 separate requestAnimationFrame calls → 1 call
- 4 separate timestamp calculations → 1 calculation
- 4 separate scheduling decisions → 1 decision
- 4× pixel calculations on Retina (due to independent loops) → 1× (shared timing)

---

## Type Definitions

See `/specs/007-visual-update-scheduler/contracts/types.ts` for full TypeScript definitions.

Key types:
- `FrameCallback = (deltaMs: number) => void`
- `SubscriptionHandle = { unsubscribe: () => void }`
- `SubscriptionMetadata = { callback: FrameCallback, componentId?: string }`

---

## Summary

This data model describes:
1. **Entities**: Scheduler, Subscriptions, Handles, Components
2. **Relationships**: Scheduler manages N subscriptions, each subscription serves 1 component
3. **State Machines**: Component lifecycle, Scheduler lifecycle, Pause/Resume
4. **Validation Rules**: Runtime checks, performance criteria
5. **Migration Impact**: 4 loops → 1 loop, 240 calls/sec → 60 calls/sec

All entities have clear lifecycles, validation rules, and interaction patterns defined.
