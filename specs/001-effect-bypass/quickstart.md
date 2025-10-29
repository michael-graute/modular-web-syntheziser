# Quickstart Guide: Effect Bypass Toggle Implementation

**Feature**: 001-effect-bypass
**For**: Developers implementing this feature
**Last Updated**: 2025-10-29

## Overview

This guide provides step-by-step instructions for implementing the effect bypass toggle feature. Follow these steps in order to ensure proper integration with the existing codebase.

## Prerequisites

- Familiarity with TypeScript and Web Audio API
- Understanding of the existing component architecture
- Development environment set up (`npm install`, `npm run dev`)

## Implementation Steps

### Step 1: Update Core Types (5 minutes)

**File**: `src/core/types.ts`

**Action**: Add optional `isBypassed` field to `ComponentData` interface

```typescript
export interface ComponentData {
  id: string;
  type: ComponentType;
  position: Position;
  parameters: Record<string, number>;
  isBypassed?: boolean; // Add this line
}
```

**Why**: Enables bypass state to be stored in patches

**Test**: TypeScript compilation should succeed with no errors

---

### Step 2: Extend SynthComponent Base Class (30 minutes)

**File**: `src/components/base/SynthComponent.ts`

**Action 1**: Add bypass state properties

```typescript
export abstract class SynthComponent {
  // ... existing properties ...

  // Add these properties
  private _isBypassed: boolean = false;
  private _bypassConnections: Array<{
    from: AudioNode;
    to: AudioNode;
  }> = [];

  // Add getter
  get isBypassed(): boolean {
    return this._isBypassed;
  }
}
```

**Action 2**: Add `setBypass` method

```typescript
/**
 * Enable or disable bypass for this component
 */
setBypass(bypassed: boolean): void {
  if (this._isBypassed === bypassed) return; // No change

  this._isBypassed = bypassed;

  if (bypassed) {
    this.enableBypass();
  } else {
    this.disableBypass();
  }
}

/**
 * Check if this component type supports bypass
 */
isBypassable(): boolean {
  const bypassableTypes = [
    ComponentType.FILTER,
    ComponentType.VCA,
    ComponentType.ADSR_ENVELOPE,
    ComponentType.FILTER_ENVELOPE,
    ComponentType.DELAY,
    ComponentType.REVERB,
    ComponentType.DISTORTION,
    ComponentType.CHORUS,
    ComponentType.MIXER
  ];
  return bypassableTypes.includes(this.type);
}

/**
 * Enable bypass - to be implemented by subclasses
 * Default implementation provides basic disconnect/reconnect pattern
 */
protected enableBypass(): void {
  // Subclasses should override for component-specific logic
  console.warn(`Bypass not fully implemented for ${this.type}`);
}

/**
 * Disable bypass - to be implemented by subclasses
 */
protected disableBypass(): void {
  // Subclasses should override for component-specific logic
  console.warn(`Bypass restoration not fully implemented for ${this.type}`);
}
```

**Why**: Provides base functionality for all components

**Test**: TypeScript compilation succeeds, run app and verify no runtime errors

---

### Step 3: Implement Bypass for Each Component Type (2-4 hours)

Implement `enableBypass()` and `disableBypass()` for each bypassable component. Here's an example for the Delay effect:

**File**: `src/components/effects/Delay.ts`

```typescript
/**
 * Enable bypass - connect input directly to output
 */
protected enableBypass(): void {
  const audioIn = this.audioNodes.get('audioIn') as GainNode;
  const delayNode = this.audioNodes.get('delay') as DelayNode;
  const feedback = this.audioNodes.get('feedback') as GainNode;
  const mix = this.audioNodes.get('mix') as GainNode;
  const dryGain = this.audioNodes.get('dry') as GainNode;
  const wetGain = this.audioNodes.get('wet') as GainNode;
  const output = this.audioNodes.get('output') as GainNode;

  // Store original connections
  this._bypassConnections = [
    { from: audioIn, to: delayNode },
    { from: audioIn, to: dryGain },
    { from: delayNode, to: feedback },
    { from: feedback, to: delayNode },
    { from: delayNode, to: wetGain },
    { from: dryGain, to: mix },
    { from: wetGain, to: mix },
    { from: mix, to: output }
  ];

  // Disconnect all processing nodes
  audioIn.disconnect();
  delayNode.disconnect();
  feedback.disconnect();
  mix.disconnect();
  dryGain.disconnect();
  wetGain.disconnect();

  // Connect input directly to output
  audioIn.connect(output);
}

/**
 * Disable bypass - restore original audio graph
 */
protected disableBypass(): void {
  const audioIn = this.audioNodes.get('audioIn') as GainNode;
  const output = this.audioNodes.get('output') as GainNode;

  // Disconnect bypass path
  audioIn.disconnect();

  // Restore original connections
  this._bypassConnections.forEach(({ from, to }) => {
    from.connect(to);
  });

  // Clear stored connections
  this._bypassConnections = [];
}
```

**Repeat for**:
- `src/components/effects/Reverb.ts`
- `src/components/processors/Filter.ts`
- `src/components/processors/VCA.ts`
- `src/components/processors/ADSREnvelope.ts`
- `src/components/utilities/Mixer.ts`

**Pattern**:
1. Store current connections in `_bypassConnections`
2. Disconnect all processing nodes
3. Connect input directly to output
4. On disable: Disconnect bypass path, restore original connections

**Why**: Each component has different audio graph structure

**Test**: For each component, verify:
- Audio passes through when bypassed
- Audio is processed when not bypassed
- No clicks or pops on toggle
- Parameters are preserved

---

### Step 4: Add Bypass Button to Canvas Component (45 minutes)

**File**: `src/canvas/CanvasComponent.ts`

**Action 1**: Import Button control

```typescript
import { Button } from './controls/Button';
```

**Action 2**: Add bypass button to component header

```typescript
/**
 * Render the component on canvas
 */
render(ctx: CanvasRenderingContext2D): void {
  const { x, y } = this.position;

  // Save context state
  ctx.save();

  // Apply dimming if bypassed
  if (this.synthComponent?.isBypassed) {
    ctx.globalAlpha = 0.6;
  }

  // ... existing rendering code ...

  // Render bypass button in header (for bypassable components)
  if (this.synthComponent?.isBypassable()) {
    this.renderBypassButton(ctx);
  }

  // Restore context state
  ctx.restore();
}
```

**Action 3**: Implement bypass button rendering

```typescript
/**
 * Render bypass button in component header
 */
private renderBypassButton(ctx: CanvasRenderingContext2D): void {
  if (!this.synthComponent) return;

  const buttonSize = 20;
  const buttonX = this.position.x + this.width - buttonSize - 8;
  const buttonY = this.position.y + 6;

  // Create button if it doesn't exist
  if (!this.bypassButton) {
    this.bypassButton = new Button(
      buttonX,
      buttonY,
      buttonSize,
      buttonSize,
      '⚡', // Power icon or similar
      () => this.toggleBypass(),
      () => !this.synthComponent!.isBypassed // Active when NOT bypassed
    );
  }

  // Update button position (in case component moved)
  this.bypassButton.updatePosition(buttonX, buttonY);

  // Render button
  this.bypassButton.render(ctx);
}

/**
 * Toggle bypass state
 */
private toggleBypass(): void {
  if (!this.synthComponent) return;

  const newState = !this.synthComponent.isBypassed;
  this.synthComponent.setBypass(newState);

  console.log(`${this.synthComponent.type} bypass: ${newState}`);
}
```

**Action 4**: Add bypassButton property to class

```typescript
export class CanvasComponent {
  // ... existing properties ...
  private bypassButton?: Button;
}
```

**Action 5**: Handle bypass button clicks

```typescript
/**
 * Handle mouse down on controls
 */
handleControlMouseDown(x: number, y: number): boolean {
  // Check bypass button first
  if (this.bypassButton?.handleMouseDown(x, y)) {
    return true;
  }

  // ... existing control handling ...
}

/**
 * Handle mouse up on controls
 */
handleControlMouseUp(x: number, y: number): boolean {
  // Check bypass button first
  if (this.bypassButton?.handleMouseUp(x, y)) {
    return true;
  }

  // ... existing control handling ...
}
```

**Why**: Provides user interface for bypass toggle

**Test**:
- Click bypass button, verify visual change
- Verify audio toggles correctly
- Test with multiple components

---

### Step 5: Update Patch Serialization (30 minutes)

**File**: `src/patch/PatchSerializer.ts`

**Action 1**: Include bypass state in serialization

```typescript
/**
 * Serialize a component to ComponentData
 */
private serializeComponent(component: SynthComponent): ComponentData {
  return {
    id: component.id,
    type: component.type,
    position: component.position,
    parameters: this.serializeParameters(component),
    isBypassed: component.isBypassed || undefined // Only include if true
  };
}
```

**Action 2**: Restore bypass state on load

```typescript
/**
 * Deserialize component data and create component instance
 */
private deserializeComponent(data: ComponentData): SynthComponent {
  // ... create component ...

  // Restore parameters
  this.restoreParameters(component, data.parameters);

  // Restore bypass state if present
  if (data.isBypassed) {
    component.setBypass(true);
  }

  return component;
}
```

**Why**: Persists bypass state across sessions

**Test**:
- Create patch with bypassed effects
- Save patch
- Reload patch
- Verify bypass states are restored

---

### Step 6: Add Bypass Constants (10 minutes)

**File**: `src/utils/constants.ts`

```typescript
export const COMPONENT = {
  // ... existing constants ...

  // Bypass button
  BYPASS_BUTTON_SIZE: 20,
  BYPASS_BUTTON_MARGIN: 8,

  // Visual feedback
  BYPASSED_OPACITY: 0.6,
} as const;
```

**Why**: Centralizes magic numbers, easier to adjust

**Test**: Verify constants are used in CanvasComponent

---

## Testing Checklist

### Manual Testing

After implementation, verify:

- [ ] **Visual Feedback**
  - [ ] Bypass button appears in component header
  - [ ] Button shows active/inactive state correctly
  - [ ] Component appears dimmed when bypassed
  - [ ] Visual changes are smooth (60 FPS)

- [ ] **Audio Functionality**
  - [ ] Bypassed component passes audio unprocessed
  - [ ] Re-enabled component resumes processing
  - [ ] No clicks or pops during toggle
  - [ ] Multiple components can be bypassed simultaneously
  - [ ] Chained effects work correctly (e.g., Delay → Reverb → Filter)

- [ ] **Parameter Preservation**
  - [ ] Parameter changes while bypassed are saved
  - [ ] Parameters apply correctly when re-enabled
  - [ ] Knobs/sliders still work on bypassed components

- [ ] **Patch Persistence**
  - [ ] Save patch with bypassed components
  - [ ] Load patch, verify bypass states restored
  - [ ] Export/import patches preserve bypass states
  - [ ] Old patches load without errors (backward compatibility)

- [ ] **Edge Cases**
  - [ ] Toggle bypass rapidly (stress test)
  - [ ] Bypass all components in a chain
  - [ ] Bypass component in feedback loop
  - [ ] Bypass while audio is not playing
  - [ ] Bypass during active audio processing

### Browser Testing

Test in:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if available)

---

## Common Issues & Solutions

### Issue: Clicks/Pops on Bypass Toggle

**Cause**: Abrupt disconnection of audio nodes

**Solution**: Use gain ramping or AudioContext.currentTime scheduling

```typescript
// Instead of immediate disconnect
audioIn.disconnect();

// Use gain ramping
const gainNode = audioContext.createGain();
gainNode.gain.setValueAtTime(1, audioContext.currentTime);
gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.01);
// Then disconnect after ramp
```

### Issue: Bypass State Not Persisting

**Cause**: Forgot to serialize/deserialize bypass state

**Solution**: Verify `isBypassed` is included in ComponentData and restored in PatchSerializer

### Issue: Button Not Clickable

**Cause**: Z-index or event handling order issue

**Solution**: Check bypass button is checked BEFORE other controls in mouse event handlers

### Issue: Component Types Mixed Up

**Cause**: Forgot to add component type to `isBypassable()` check

**Solution**: Verify component type is in the bypassableTypes array

---

## Performance Tips

### Optimize Rendering
- Only update canvas when bypass state changes
- Use `requestAnimationFrame` for smooth transitions
- Cache button rendering if possible

### Optimize Audio Graph
- Minimize disconnect/reconnect operations
- Reuse gain nodes where possible
- Schedule changes during audio buffer gaps

---

## Next Steps

After implementing this feature:

1. **Testing**: Complete manual testing checklist above
2. **Documentation**: Update user documentation if needed
3. **Tasks**: Run `/speckit.tasks` to generate implementation tasks
4. **Review**: Request code review from team
5. **Future**: Consider adding keyboard shortcuts (e.g., 'B' key to toggle bypass)

---

## Support

If you encounter issues:
- Check the [research.md](./research.md) for design decisions
- Review [data-model.md](./data-model.md) for data structures
- Refer to existing Button control implementation
- Check Web Audio API documentation

---

## Estimated Time

- **Setup (Steps 1-2)**: 35 minutes
- **Component Implementation (Step 3)**: 2-4 hours (depends on number of components)
- **UI Integration (Step 4)**: 45 minutes
- **Persistence (Step 5)**: 30 minutes
- **Constants (Step 6)**: 10 minutes
- **Testing**: 1-2 hours

**Total**: 5-8 hours for complete implementation and testing
