# Feature Specification: Centralized Animation Loop Migration

**Feature Branch**: `007-visual-update-scheduler`
**Created**: 2025-11-09
**Status**: Draft
**Input**: User description: "Migrate all components to use VisualUpdateScheduler for centralized animation loop management to reduce CPU usage from multiple independent requestAnimationFrame loops"

## Clarifications

### Session 2025-11-09

- Q: Should the centralized animation scheduler pause when the browser tab is backgrounded? → A: Pause the scheduler entirely - no render callbacks fire when tab is backgrounded (resumes on tab focus)
- Q: When a component callback throws an error, should the scheduler log it for debugging? → A: Log to console - errors are logged with component identification for debugging
- Q: How should the scheduler handle a component being destroyed while its callback is actively executing? → A: Defer until frame ends - mark subscription for removal, let current callback complete, remove before next frame

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reduced CPU Usage on macOS (Priority: P1)

As a macOS user with a Retina display, I need the application to run efficiently without consuming excessive CPU resources, so that my computer remains responsive and doesn't overheat during extended use.

**Why this priority**: This is the critical performance issue affecting macOS users. The current implementation with 5-6 independent animation loops causes 80-98% CPU usage on macOS compared to 15-30% on Windows, making the application nearly unusable.

**Independent Test**: Can be fully tested by opening Activity Monitor on macOS, running the application with multiple components (2 oscilloscopes, 1 sequencer, 1 collider), and verifying CPU usage drops from 80-98% to 15-30%.

**Acceptance Scenarios**:

1. **Given** a macOS Retina display with the application running 2 oscilloscopes, 1 sequencer, and 1 collider, **When** all components are migrated to use the centralized scheduler, **Then** CPU usage is reduced from 80-98% to 15-30%
2. **Given** the application is running with only 1 component active, **When** monitoring CPU usage, **Then** CPU usage remains below 20%
3. **Given** the application is running with 5 or more components, **When** monitoring CPU usage, **Then** CPU usage scales linearly and stays below 40%

---

### User Story 2 - Consistent Animation Performance (Priority: P2)

As a user creating music with visual components, I need all visual displays to render smoothly and consistently, so that I can monitor my synthesizer's output in real-time without visual glitches or lag.

**Why this priority**: After reducing CPU usage, maintaining smooth and consistent visual feedback is essential for users to effectively use visual analysis tools like oscilloscopes and sequencers.

**Independent Test**: Can be fully tested by creating a patch with multiple visual components, playing a continuous tone, and verifying all displays update smoothly without stuttering or frame drops.

**Acceptance Scenarios**:

1. **Given** multiple visual components are active, **When** the centralized scheduler is running, **Then** all components render at a stable frame rate without stuttering
2. **Given** the application is running, **When** adding new visual components, **Then** existing components maintain their rendering quality without degradation
3. **Given** audio is being processed, **When** visual displays are updating, **Then** visual updates remain synchronized with audio without lag or drift

---

### User Story 3 - Memory Stability During Long Sessions (Priority: P3)

As a user working on long music production sessions, I need the application to maintain stable memory usage over time, so that I can work for hours without performance degradation or browser crashes.

**Why this priority**: Proper cleanup and lifecycle management of animation subscriptions prevents memory leaks that can accumulate during long sessions.

**Independent Test**: Can be fully tested by running the application for 2+ hours while periodically adding and removing components, and verifying memory usage remains stable in browser DevTools Memory profiler.

**Acceptance Scenarios**:

1. **Given** the application has been running for 2 hours, **When** checking memory usage in DevTools, **Then** memory usage has not increased by more than 10% from baseline
2. **Given** 10 visual components are added and removed, **When** components are destroyed, **Then** all animation subscriptions are properly cleaned up
3. **Given** the application is running, **When** monitoring the centralized scheduler, **Then** no orphaned callbacks remain registered after component removal

---

### Edge Cases

- When a component is destroyed while the scheduler is executing its callback, the subscription is marked for removal, the current callback completes, and the subscription is removed before the next frame
- When a component callback throws an error, the scheduler catches it, logs it to the console with component identification, and continues executing remaining callbacks
- When the browser tab is backgrounded or inactive, the scheduler pauses entirely and resumes when the tab regains focus
- How does the scheduler behave when system performance is degraded and frame budget is exceeded?
- What happens when components subscribe/unsubscribe during an active animation frame?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All visual components (Canvas, OscilloscopeDisplay, SequencerDisplay, Collider) MUST migrate from independent requestAnimationFrame loops to use the centralized VisualUpdateScheduler
- **FR-002**: The application MUST maintain exactly one active requestAnimationFrame loop at any time, managed by VisualUpdateScheduler
- **FR-003**: Components MUST be able to subscribe to the centralized animation loop and receive frame callbacks with delta time information
- **FR-004**: Components MUST be able to unsubscribe from the animation loop when destroyed, ensuring proper cleanup
- **FR-005**: The centralized scheduler MUST provide error isolation, where exceptions in one component's callback do not prevent other components from rendering
- **FR-006**: Components MUST maintain their existing throttling behavior (30fps for displays, 60fps for main canvas) within the centralized scheduler
- **FR-007**: Components MUST maintain their existing visibility check behavior (skip rendering when off-screen) within the centralized scheduler
- **FR-008**: The application MUST reduce total render calls from ~300 per second (5 loops × 60fps) to ~60 per second (1 loop × 60fps)
- **FR-009**: The VisualUpdateScheduler singleton MUST be initialized once at application startup and remain active throughout the session
- **FR-010**: Components MUST preserve their current visual behavior and rendering quality after migration
- **FR-011**: The scheduler MUST pause all render callbacks when the browser tab is backgrounded and resume when the tab regains focus
- **FR-012**: When a component callback throws an error, the scheduler MUST log the error to the console with component identification information and continue processing remaining callbacks
- **FR-013**: When a component unsubscribes while its callback is executing, the scheduler MUST mark the subscription for removal, allow the callback to complete, and remove the subscription before the next frame begins

### Key Entities

- **Animation Subscription**: Represents a component's registration with the centralized scheduler, including callback function, throttling parameters, and cleanup handle
- **Frame Callback**: A function executed by the scheduler on each animation frame, receiving delta time in milliseconds
- **Subscription Handle**: An object returned when subscribing that allows components to unsubscribe when destroyed

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: CPU usage on macOS Retina displays is reduced from 80-98% to 15-30% when running 5 visual components simultaneously
- **SC-002**: Application maintains stable 60fps frame rate when running multiple visual components
- **SC-003**: Total number of requestAnimationFrame loops is reduced from 5-6 to exactly 1
- **SC-004**: Total render calls per second are reduced from ~300 to ~60 (80% reduction)
- **SC-005**: Memory usage remains stable (no more than 10% increase) during 2+ hour sessions with component creation/destruction
- **SC-006**: No visual regressions occur - oscilloscopes, sequencers, and colliders render identically to pre-migration behavior
- **SC-007**: Component destruction properly cleans up all animation subscriptions with no memory leaks (verified via DevTools Memory profiler)
- **SC-008**: Error in one component's render callback does not prevent other components from rendering

## Scope *(mandatory)*

### In Scope

- Migration of Canvas.ts main render loop to VisualUpdateScheduler
- Migration of OscilloscopeDisplay.ts animation loop to VisualUpdateScheduler
- Migration of SequencerDisplay.ts animation loop to VisualUpdateScheduler
- Migration of Collider.ts animation loop to VisualUpdateScheduler
- Creation of singleton instance of VisualUpdateScheduler (scheduler.ts)
- Preservation of existing throttling behavior (30fps for displays)
- Preservation of existing visibility check behavior
- Error isolation and handling in centralized scheduler
- Proper subscription cleanup in component destroy methods
- Documentation of migration pattern for future components

### Out of Scope

- Implementation of frame budget system (Priority 4 from performance doc - future enhancement)
- Implementation of OffscreenCanvas for background rendering (Priority 5 - future enhancement)
- Changes to audio processing or audio worklet performance
- Modification of physics simulation update rates
- Changes to component rendering logic beyond scheduler integration
- Performance optimizations unrelated to animation loop consolidation
- Browser compatibility checks (assumes modern browser with requestAnimationFrame support)

## Assumptions *(mandatory)*

1. **Browser Support**: Target browsers support requestAnimationFrame (all modern browsers)
2. **VisualUpdateScheduler Exists**: The VisualUpdateScheduler class already exists at src/visualization/VisualUpdateScheduler.ts and provides the necessary API (onFrame, start, stop methods)
3. **Component Lifecycle**: All visual components already have proper destroy/cleanup methods or can have them added
4. **No Breaking API Changes**: The migration can be completed without changing public APIs of visual components
5. **Performance Metrics**: The documented CPU usage numbers (80-98% on macOS) are accurate and reproducible
6. **Testing Environment**: Testing can be performed on actual macOS devices with Retina displays to verify performance improvements
7. **Throttling Preserved**: Existing 30fps throttling for displays and 60fps for main canvas should be maintained after migration
8. **Singleton Pattern**: Using a singleton instance of VisualUpdateScheduler is acceptable for this application architecture

## Dependencies *(optional)*

### Technical Dependencies

- **VisualUpdateScheduler**: Must use existing class at src/visualization/VisualUpdateScheduler.ts
- **Component Destroy Methods**: All migrated components must implement proper cleanup in their destroy/cleanup methods

### External Dependencies

- None - this is an internal refactoring with no external dependencies

## Non-Functional Requirements *(optional)*

### Performance

- Startup time should not increase by more than 100ms due to scheduler initialization
- Component creation/destruction should complete within 16ms to avoid blocking UI
- Scheduler overhead should be negligible (< 1ms per frame)

### Reliability

- System must gracefully handle component callback errors without crashing
- Animation loop must continue running even if individual components fail
- No memory leaks over extended usage (2+ hours)

### Maintainability

- Migration pattern should be documented for future components
- Code should follow existing TypeScript conventions in the codebase
- Subscription/unsubscription API should be simple and intuitive
