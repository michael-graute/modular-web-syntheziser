# Research: Effect Bypass Toggle

**Feature**: 001-effect-bypass
**Date**: 2025-10-29
**Status**: Complete

## Overview

This document captures research findings for implementing bypass functionality in the modular synthesizer. The research focuses on Web Audio API patterns for bypassing audio processing, UI implementation approaches, and patch serialization considerations.

## Research Questions

### 1. Testing Framework Decision

**Question**: Should we add Jest/Vitest for this feature given no test framework currently exists?

**Decision**: No - Defer testing framework to future refactor

**Rationale**:
- Current project has no testing framework in place
- Adding test infrastructure would significantly expand scope (setup, configuration, learning curve, test writing)
- Bypass feature is straightforward and can be manually tested
- Manual test plan is sufficient:
  - Visual: Click bypass button, verify visual state change (dim/highlight)
  - Audio: Play audio through effect, toggle bypass, verify audio passes through unprocessed
  - Persistence: Save patch with bypass enabled, reload, verify state restored
  - Edge cases: Test with chained effects, test parameter changes while bypassed
- Test framework addition should be planned separately as infrastructure improvement

**Alternatives Considered**:
- **Jest**: Industry standard for Node.js/TypeScript. Would require additional configuration for DOM/Canvas mocking.
- **Vitest**: Modern, Vite-native testing framework. Better integration with existing build tool but still significant setup.
- **Manual testing only** (chosen): Sufficient for current feature scope, can revisit when project matures.

---

### 2. Web Audio API Bypass Pattern

**Question**: What's the best pattern for bypassing audio processing in Web Audio API?

**Decision**: Direct connection bypass using GainNode pattern

**Rationale**:
- Web Audio API provides no built-in "bypass" capability
- Three common patterns exist:
  1. **Disconnect/reconnect nodes**: Remove processing nodes from graph entirely
  2. **Parallel path with gain nodes**: Keep both wet and dry paths, use gain to switch
  3. **Direct connection bypass**: Connect input directly to output when bypassed

- **Disconnect/reconnect** (chosen approach):
  - Pros: Zero processing overhead when bypassed, cleanest audio graph
  - Cons: Requires careful connection management, potential for clicks if not handled properly
  - Best for: Modular synth where connections are already managed explicitly

**Implementation Pattern**:
```typescript
// Active state: Input → AudioNode(s) → Output
input.connect(processingNode);
processingNode.connect(output);

// Bypassed state: Input → Output (direct)
input.disconnect();
processingNode.disconnect();
input.connect(output);

// Restoration: Re-establish processing chain
input.disconnect();
processingNode.disconnect();
input.connect(processingNode);
processingNode.connect(output);
```

**Key Considerations**:
- Must track all input/output connections before disconnecting
- Must preserve connection state for restoration
- AudioParam connections (for CV/Gate) should remain active during bypass
- Use `AudioContext.currentTime` for scheduling to avoid clicks

**Alternatives Considered**:
- **GainNode switching**: More complex, uses more resources, but smoother transitions
- **Parallel paths**: Wasteful for modular synth architecture
- **Direct connection** (chosen): Simplest, most efficient for our use case

---

### 3. UI Control Implementation

**Question**: Should we create a new BypassButton class or extend existing Button class?

**Decision**: Use existing Button class with state function

**Rationale**:
- Existing `Button` class already supports toggle state via optional `state` function parameter
- Button constructor: `Button(x, y, width, height, label, onClick, state?)`
- State function returns boolean indicating if button is "active" (in our case, NOT bypassed)
- Visual feedback already implemented (blue highlight when active)
- No need for new class; just instantiate with appropriate state function

**Implementation Approach**:
```typescript
// In CanvasComponent header rendering
const bypassButton = new Button(
  headerX,
  headerY,
  buttonWidth,
  buttonHeight,
  'Power', // Or use icon
  () => this.toggleBypass(),
  () => !this.synthComponent.isBypassed // Active when NOT bypassed
);
```

**Visual Feedback**:
- Active (not bypassed): Normal appearance, blue highlight on button
- Bypassed: Dimmed component, gray button, or distinct bypass indicator
- Button shows "active" state (blue) when effect is processing
- Button shows "inactive" state (gray) when effect is bypassed

**Alternatives Considered**:
- **New BypassButton class**: Unnecessary code duplication
- **Extend Button class**: Overkill for simple toggle behavior
- **Use existing Button** (chosen): Sufficient functionality already exists

---

### 4. Component Visual Feedback

**Question**: How should bypassed components be visually distinguished?

**Decision**: Multi-level visual feedback approach

**Rationale**:
User needs immediate visual indication without cluttering interface. Combine multiple subtle cues:

1. **Button State**: Bypass button shows clear on/off state (existing Button functionality)
2. **Component Dimming**: Reduce opacity of entire component to 0.5-0.6 when bypassed
3. **Border Color**: Optional - change border color to indicate bypass state
4. **Optional Icon**: Consider adding small "bypass" icon overlay in corner

**Implementation**:
```typescript
// In CanvasComponent.render()
if (synthComponent.isBypassed) {
  ctx.globalAlpha = 0.6; // Dim the component
  // ... render component ...
  ctx.globalAlpha = 1.0; // Restore
}
```

**Alternatives Considered**:
- **Opacity only**: Simple but may not be obvious enough
- **Border color only**: Good but less visible for small components
- **Strikethrough**: Too aggressive, suggests disabled
- **Multi-level feedback** (chosen): Most clear without being intrusive

---

### 5. Patch Serialization Strategy

**Question**: How should bypass state be stored in patch files?

**Decision**: Add `isBypassed` boolean to component data, default to false

**Rationale**:
- Existing patch format already serializes component properties
- Add `isBypassed` to `ComponentData` interface in `types.ts`
- Default to `false` for backward compatibility with existing patches
- Patch serializer already handles component properties, minimal changes needed

**Implementation**:
```typescript
// In types.ts
export interface ComponentData {
  id: string;
  type: ComponentType;
  position: Position;
  parameters: Record<string, number>;
  isBypassed?: boolean; // Optional for backward compatibility
}

// In PatchSerializer.ts
serializeComponent(component: SynthComponent): ComponentData {
  return {
    // ... existing fields ...
    isBypassed: component.isBypassed || false
  };
}

deserializeComponent(data: ComponentData): SynthComponent {
  // ... create component ...
  if (data.isBypassed) {
    component.setBypass(true);
  }
}
```

**Backward Compatibility**:
- Old patches without `isBypassed` property: Default to `false` (not bypassed)
- New patches with `isBypassed`: Restore bypass state
- No migration needed, graceful degradation

**Alternatives Considered**:
- **Separate bypass state file**: Overcomplicated
- **Per-parameter bypass**: Not relevant to this feature
- **Component data field** (chosen): Simplest, follows existing pattern

---

## Best Practices Summary

### Web Audio API
- Use disconnect/reconnect pattern for bypass
- Preserve AudioParam connections (CV/Gate paths)
- Schedule connection changes to avoid audio artifacts
- Track connection state for restoration

### UI/UX
- Use existing Button class with state function
- Multi-level visual feedback (dim + button state)
- Place bypass button prominently in header
- Ensure 60 FPS rendering performance

### Code Organization
- Add `isBypassed` property to SynthComponent base class
- Implement `setBypass(bypassed: boolean)` method in base class
- Each component type implements bypass logic based on its audio graph structure
- Update patch serialization to include bypass state

### Testing (Manual)
- Visual state transitions
- Audio routing verification
- Parameter persistence during bypass
- Patch save/load with bypass state
- Multiple components in chain

## References

- [Web Audio API Specification](https://www.w3.org/TR/webaudio/) - AudioNode connection patterns
- [MDN Web Audio API Guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) - Practical examples
- Hardware bypass reference: Guitar effect pedals use "true bypass" (direct signal path)

## Open Questions

None - all research questions resolved.

## Next Steps

Proceed to Phase 1: Design artifacts
- data-model.md: Define bypass state data model
- quickstart.md: Implementation guide for developers
- contracts/: Not applicable for this feature (no external APIs)
