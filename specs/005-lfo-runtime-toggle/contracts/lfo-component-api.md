# LFO Component API Contract

**Feature**: 005-lfo-runtime-toggle
**Date**: 2025-11-07
**Contract Version**: 1.0.0

## Overview

This document defines the public API contract for the LFO component with runtime toggle functionality. The API is implemented as TypeScript methods and events on the `LFO` class, which extends `SynthComponent`.

**Note**: This is NOT a REST API or HTTP endpoint - this is a browser-based application with in-memory component APIs.

---

## Component API

### Class: `LFO extends SynthComponent`

**Location**: `/src/components/generators/LFO.ts`

---

### Public Methods

#### `setBypass(bypassed: boolean): void`

Enable or disable LFO modulation output.

**Parameters**:
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `bypassed` | `boolean` | Yes | - | `true` to disable modulation, `false` to enable |

**Behavior**:
- If `bypassed === true`: Disconnects oscillator output, modulation stops, target parameters hold current value
- If `bypassed === false`: Reconnects oscillator output, modulation resumes from current phase
- If `bypassed === this._isBypassed`: No operation (idempotent)

**Side Effects**:
- Emits `bypassChanged` event with new state
- Updates visual representation (button state, component opacity)
- Oscillator continues running internally regardless of bypass state

**Example**:
```typescript
const lfo = new LFO();
lfo.setBypass(true);   // Disable modulation
lfo.setBypass(false);  // Re-enable modulation
```

**Performance**: < 1 ms execution time

---

#### `isBypassed(): boolean`

Get current bypass state.

**Returns**: `boolean` - `true` if modulation is disabled, `false` if enabled

**Example**:
```typescript
const lfo = new LFO();
console.log(lfo.isBypassed());  // false (default)
lfo.setBypass(true);
console.log(lfo.isBypassed());  // true
```

---

#### `isBypassable(): boolean`

Check if component supports bypass (always `true` for LFO post-feature).

**Returns**: `boolean` - Always `true`

**Example**:
```typescript
const lfo = new LFO();
console.log(lfo.isBypassable());  // true
```

---

### Protected Methods (Implementation Details)

#### `enableBypass(): void`

**Internal use only** - Called by `setBypass(true)`

**Behavior**:
- Disconnects `this.oscillator` from `this.gainNode`
- Keeps oscillator running (phase continuity)
- Connected AudioParams hold their last value

---

#### `disableBypass(): void`

**Internal use only** - Called by `setBypass(false)`

**Behavior**:
- Reconnects `this.oscillator` to `this.gainNode`
- Modulation resumes from current phase position

---

### Events

#### `bypassChanged`

Emitted when bypass state changes.

**Payload**:
```typescript
{
  bypassed: boolean  // New bypass state
}
```

**Example**:
```typescript
lfo.on('bypassChanged', (bypassed) => {
  console.log(`LFO modulation ${bypassed ? 'disabled' : 'enabled'}`);
});
```

---

## Parameter API

### Existing Parameters (Unchanged)

| Parameter | Type | Range | Default | Description |
|-----------|------|-------|---------|-------------|
| `rate` | `number` | 0.01 - 20 Hz | 1.0 | LFO frequency |
| `depth` | `number` | 0 - 100% | 50 | Modulation depth |
| `waveform` | `number` | 0 - 3 | 0 | Waveform: 0=Sine, 1=Square, 2=Saw, 3=Triangle |

**Note**: All parameters remain editable when bypassed (FR-009). Changes take effect when re-enabled.

**Example**:
```typescript
const lfo = new LFO();
lfo.setBypass(true);            // Disable modulation
lfo.setParameter('rate', 5.0);  // Change rate (not applied yet)
lfo.setBypass(false);           // Re-enable - new rate takes effect
```

---

## Serialization Contract

### `serialize(): ComponentData`

Export LFO state for patch saving.

**Returns**:
```typescript
{
  id: string;
  type: 'LFO';
  position: { x: number; y: number };
  parameters: {
    rate: number;
    depth: number;
    waveform: number;
  };
  isBypassed: boolean;  // ✅ NEW in this feature
}
```

**Example**:
```typescript
const lfo = new LFO();
lfo.setBypass(true);
const data = lfo.serialize();
console.log(data.isBypassed);  // true
```

---

### `deserialize(data: ComponentData): void`

Restore LFO state from patch loading.

**Parameters**:
```typescript
{
  id: string;
  type: 'LFO';
  position: { x: number; y: number };
  parameters: {
    rate: number;
    depth: number;
    waveform: number;
  };
  isBypassed?: boolean;  // Optional for backward compatibility
}
```

**Behavior**:
- If `isBypassed` is `undefined`: Defaults to `false` (enabled)
- If `isBypassed` is `true`: Sets LFO to disabled state
- If `isBypassed` is `false`: Sets LFO to enabled state

**Example**:
```typescript
const lfo = new LFO();
lfo.deserialize({
  id: 'lfo-001',
  type: 'LFO',
  position: { x: 100, y: 200 },
  parameters: { rate: 2.5, depth: 75, waveform: 0 },
  isBypassed: true
});
console.log(lfo.isBypassed());  // true
```

---

## Visual API (CanvasComponent)

### Class: `CanvasComponent`

**Location**: `/src/canvas/CanvasComponent.ts`

---

### Bypass Button

**Rendering** (automatic for `isBypassable()` components):
- **Position**: Top-right corner of component header (x: width - 35, y: 10)
- **Size**: 25×20 pixels
- **Label**: ⚡ (lightning bolt)
- **States**:
  - Enabled (not bypassed): Blue background, white text
  - Disabled (bypassed): Dark background, dim text

**Click Handler**:
```typescript
bypassButton.onClick = () => {
  component.setBypass(!component.isBypassed());
};
```

---

### Component Dimming

**Opacity States**:
- Enabled: `ctx.globalAlpha = 1.0` (full opacity)
- Disabled: `ctx.globalAlpha = 0.4` (dimmed, but readable)

**Rendering**:
```typescript
render(ctx: CanvasRenderingContext2D): void {
  if (this.component.isBypassed()) {
    ctx.globalAlpha = 0.4;
  }
  // ... render component
  ctx.globalAlpha = 1.0;  // Reset
}
```

---

## State Machine

### States

```
┌─────────────┐
│  ENABLED    │  (isBypassed = false)
│             │  - Oscillator connected to gainNode
│             │  - Modulation active
│             │  - Full opacity
└──────┬──────┘
       │
       │ setBypass(true)
       │
       ▼
┌─────────────┐
│  DISABLED   │  (isBypassed = true)
│             │  - Oscillator disconnected
│             │  - Modulation muted
│             │  - 0.4 opacity
└──────┬──────┘
       │
       │ setBypass(false)
       │
       ▼
    (back to ENABLED)
```

---

### Transition Contract

| From | Method Call | To | Audio Effect | Visual Effect | Event |
|------|-------------|----|--------------|--------------| ------|
| ENABLED | `setBypass(true)` | DISABLED | Disconnect oscillator | Dim to 0.4, darken button | `bypassChanged(true)` |
| DISABLED | `setBypass(false)` | ENABLED | Reconnect oscillator | Full opacity, brighten button | `bypassChanged(false)` |
| ENABLED | `setBypass(false)` | ENABLED | No change | No change | None (idempotent) |
| DISABLED | `setBypass(true)` | DISABLED | No change | No change | None (idempotent) |

---

## Error Handling

### Invalid State Errors

| Error Condition | Thrown By | Message | Recovery |
|-----------------|-----------|---------|----------|
| Audio nodes not initialized | `enableBypass()` | `"Cannot bypass LFO: audio nodes not initialized"` | Re-create component |
| Invalid bypassed type | `deserialize()` | None (coerces to boolean) | Defaults to `false` |

### Error Contract

```typescript
class LFO extends SynthComponent {
  protected override enableBypass(): void {
    if (!this.oscillator || !this.gainNode) {
      throw new Error('Cannot bypass LFO: audio nodes not initialized');
    }
    this.oscillator.disconnect();
  }
}
```

---

## Performance Contract

### Timing Guarantees

| Operation | Max Time | Typical Time | Measurement Point |
|-----------|----------|--------------|-------------------|
| `setBypass()` call | 10 ms | < 1 ms | User click → method return |
| Audio disconnect/connect | 1 ms | < 0.1 ms | Web Audio API thread |
| Visual update | 16.7 ms | 16.7 ms | Next animation frame (60 FPS) |
| Serialize to JSON | 1 ms | < 0.1 ms | `serialize()` method |
| Deserialize from JSON | 1 ms | < 0.1 ms | `deserialize()` method |

### Audio Quality Contract

| Metric | Requirement | Measurement Method |
|--------|-------------|-------------------|
| No clicks/pops on toggle | 0 audible artifacts | Listen test + oscilloscope |
| Phase continuity | Oscillator phase never resets | Phase measurement @ toggle |
| Parameter hold accuracy | ±0.01% of last value | Parameter value comparison |

---

## Testing Contract

### Unit Test Cases

```typescript
describe('LFO Toggle Feature', () => {
  test('setBypass(true) disables modulation', () => {
    const lfo = new LFO();
    lfo.setBypass(true);
    expect(lfo.isBypassed()).toBe(true);
    // Audio: oscillator should be disconnected
  });

  test('setBypass(false) enables modulation', () => {
    const lfo = new LFO();
    lfo.setBypass(true);
    lfo.setBypass(false);
    expect(lfo.isBypassed()).toBe(false);
    // Audio: oscillator should be connected
  });

  test('isBypassable() returns true', () => {
    const lfo = new LFO();
    expect(lfo.isBypassable()).toBe(true);
  });

  test('serializes isBypassed state', () => {
    const lfo = new LFO();
    lfo.setBypass(true);
    const data = lfo.serialize();
    expect(data.isBypassed).toBe(true);
  });

  test('deserializes isBypassed state', () => {
    const lfo = new LFO();
    lfo.deserialize({
      id: 'test',
      type: 'LFO',
      position: { x: 0, y: 0 },
      parameters: { rate: 1, depth: 50, waveform: 0 },
      isBypassed: true
    });
    expect(lfo.isBypassed()).toBe(true);
  });

  test('defaults to enabled when isBypassed missing', () => {
    const lfo = new LFO();
    lfo.deserialize({
      id: 'test',
      type: 'LFO',
      position: { x: 0, y: 0 },
      parameters: { rate: 1, depth: 50, waveform: 0 }
      // isBypassed omitted
    });
    expect(lfo.isBypassed()).toBe(false);
  });

  test('emits bypassChanged event', () => {
    const lfo = new LFO();
    const handler = jest.fn();
    lfo.on('bypassChanged', handler);
    lfo.setBypass(true);
    expect(handler).toHaveBeenCalledWith(true);
  });

  test('preserves parameters when bypassed', () => {
    const lfo = new LFO();
    lfo.setParameter('rate', 5.0);
    lfo.setBypass(true);
    expect(lfo.getParameter('rate')).toBe(5.0);
  });
});
```

---

## Backward Compatibility Contract

### Pre-Feature Patches

**Guarantee**: Patches created before this feature will load correctly with LFOs in enabled state.

**Contract**:
```typescript
// Old patch JSON (no isBypassed field):
{
  "id": "lfo-001",
  "type": "LFO",
  "parameters": { "rate": 2.5, "depth": 75, "waveform": 0 }
  // isBypassed field missing
}

// Deserialization behavior:
lfo.deserialize(data);
assert(lfo.isBypassed() === false);  // Defaults to enabled
```

**No Migration Required**: Existing deserialization logic handles this via `isBypassed ?? false`.

---

## Summary

This contract defines:

1. **Public API**: `setBypass()`, `isBypassed()`, `isBypassable()`
2. **Serialization API**: `isBypassed` field in ComponentData
3. **Visual API**: Bypass button + component dimming
4. **Event API**: `bypassChanged` event
5. **Performance guarantees**: < 10ms toggle, no audio artifacts
6. **Error handling**: Graceful degradation for invalid states
7. **Backward compatibility**: Old patches default to enabled state

All contracts are testable and verifiable. Ready for implementation.
