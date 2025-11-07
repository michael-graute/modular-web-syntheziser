# Data Model: LFO Runtime Toggle

**Feature**: 005-lfo-runtime-toggle
**Date**: 2025-11-07
**Status**: Complete

## Overview

This feature extends the existing LFO component data model to support runtime toggle state. The data model is minimal and reuses existing infrastructure from the bypass feature (001-effect-bypass).

**Key Principle**: Reuse existing `ComponentData.isBypassed` field rather than introducing LFO-specific fields. This maintains backward compatibility and leverages existing serialization infrastructure.

---

## Entity: LFO Component

### Runtime State

| Property | Type | Default | Persistence | Description |
|----------|------|---------|-------------|-------------|
| `_isBypassed` | `boolean` | `false` | Yes | Inherited from SynthComponent base class. When `true`, LFO modulation output is disconnected. |
| `rate` | `number` | `1.0` | Yes | LFO frequency in Hz (0.01 - 20 Hz). Not affected by toggle state. |
| `depth` | `number` | `50` | Yes | Modulation depth percentage (0 - 100%). Not affected by toggle state. |
| `waveform` | `number` | `0` | Yes | Waveform type: 0=Sine, 1=Square, 2=Sawtooth, 3=Triangle. Not affected by toggle state. |

**Notes**:
- All existing parameters (`rate`, `depth`, `waveform`) are preserved when toggling on/off
- The `_isBypassed` field is the ONLY new state for this feature
- Oscillator continues running internally when `_isBypassed = true` (phase continuity requirement)

---

### Audio Graph

**Enabled State (`_isBypassed = false`)**:
```
OscillatorNode → GainNode (depth) → Output Port (CV)
                                        ↓
                                   Target AudioParam
```

**Disabled State (`_isBypassed = true`)**:
```
OscillatorNode (running) ✗ GainNode (depth) → Output Port (CV)
                                                    ↓
                                               Target AudioParam
                                               (holds last value)
```

**State Transition**:
- Enable → Disable: `oscillator.disconnect()`
- Disable → Enable: `oscillator.connect(gainNode)`

---

## Serialization Format

### ComponentData Interface

**Location**: `/src/core/types.ts`

**Existing Interface** (no changes needed):
```typescript
interface ComponentData {
  id: string;                          // Unique component identifier
  type: ComponentType;                 // 'LFO'
  position: { x: number; y: number };  // Canvas position
  parameters: {                        // Parameter values
    rate: number;                      // 0.01 - 20 Hz
    depth: number;                     // 0 - 100%
    waveform: number;                  // 0-3 (sine/square/saw/tri)
  };
  isBypassed?: boolean;                // ✅ REUSED from bypass feature
}
```

**Serialization Example**:
```json
{
  "id": "lfo-001",
  "type": "LFO",
  "position": { "x": 100, "y": 200 },
  "parameters": {
    "rate": 2.5,
    "depth": 75,
    "waveform": 0
  },
  "isBypassed": true
}
```

---

### Default Values

| Scenario | `isBypassed` Value | Behavior |
|----------|-------------------|----------|
| New LFO created | `false` | Enabled by default (FR-011) |
| Patch loaded without `isBypassed` field | `false` | Defaults to enabled (backward compatibility) |
| Patch loaded with `isBypassed: true` | `true` | Respects saved state |
| Patch loaded with `isBypassed: false` | `false` | Respects saved state |

**Backward Compatibility**: Existing patches (pre-feature) will load LFOs in enabled state, which matches the original behavior.

---

## State Transitions

### State Diagram

```
┌─────────────────┐
│   LFO Created   │
│ (isBypassed=F)  │
└────────┬────────┘
         │
         ▼
    ┌────────┐         setBypass(true)         ┌─────────┐
    │        │ ────────────────────────────────▶│         │
    │ ENABLED│                                   │DISABLED │
    │        │◀──────────────────────────────── │         │
    └────────┘         setBypass(false)         └─────────┘
         │                                            │
         │                                            │
         ▼                                            ▼
  Modulation Active                         Modulation Muted
  (Oscillator → Gain)                      (Oscillator running,
                                            output disconnected)
```

### Transition Rules

| From State | Action | To State | Audio Effect | Visual Effect |
|------------|--------|----------|--------------|---------------|
| ENABLED | `setBypass(true)` | DISABLED | Oscillator disconnects, parameter holds value | Button darkens, component dims to 0.4 opacity |
| DISABLED | `setBypass(false)` | ENABLED | Oscillator reconnects, modulation resumes from current phase | Button brightens, component full opacity |
| ENABLED | `setBypass(true)` (repeated) | ENABLED | No change (idempotent) | No change |
| DISABLED | `setBypass(false)` (repeated) | DISABLED | No change (idempotent) | No change |

---

## Validation Rules

### Runtime Validation

| Rule | Validation | Error Handling |
|------|------------|----------------|
| `isBypassed` must be boolean | Type check on deserialization | Default to `false` if invalid |
| Parameters preserved during toggle | No validation needed (passive behavior) | N/A |
| Oscillator must exist before disconnect | Check in `enableBypass()` | Throw error if audio nodes not created |

**Implementation**:
```typescript
protected override enableBypass(): void {
  if (!this.oscillator) {
    throw new Error('Cannot bypass LFO: audio nodes not initialized');
  }
  this.oscillator.disconnect();
}
```

---

## Persistence Layer

### PatchSerializer

**Location**: `/src/patch/PatchSerializer.ts`

**Serialization** (existing code, no changes):
```typescript
// Line ~85
const componentData: ComponentData = {
  id: component.id,
  type: component.type,
  position: canvasComponent.position,
  parameters: component.getParameters(),
  isBypassed: component.isBypassed()  // ✅ Already implemented
};
```

**Deserialization** (existing code, no changes):
```typescript
// Line ~180
component.setBypass(data.isBypassed ?? false);  // ✅ Already implemented
```

---

### localStorage Schema

**Key**: `modular-synth-patch:{patchName}`

**Value**: JSON PatchData object

**Example**:
```json
{
  "name": "My Patch",
  "version": "1.0.0",
  "created": "2025-11-07T10:30:00Z",
  "modified": "2025-11-07T11:45:00Z",
  "components": [
    {
      "id": "lfo-001",
      "type": "LFO",
      "position": { "x": 100, "y": 200 },
      "parameters": { "rate": 2.5, "depth": 75, "waveform": 0 },
      "isBypassed": true
    },
    {
      "id": "filter-001",
      "type": "Filter",
      "position": { "x": 300, "y": 200 },
      "parameters": { "frequency": 1000, "resonance": 5, "type": 0 },
      "isBypassed": false
    }
  ],
  "connections": [
    {
      "from": { "componentId": "lfo-001", "port": "output" },
      "to": { "componentId": "filter-001", "port": "frequency" },
      "type": "CV"
    }
  ]
}
```

**Storage Limits**:
- localStorage quota: ~5MB per domain
- Typical patch size: ~5-50 KB
- Boolean field overhead: +5 bytes per LFO (negligible)

---

## Migration Strategy

### Existing Patches (Pre-Feature)

**Scenario**: User loads a patch created before LFO toggle feature

**Behavior**:
1. Patch JSON does not contain `isBypassed` field for LFO components
2. Deserializer defaults to `isBypassed = false`
3. LFO starts in enabled state (original behavior)
4. No migration script needed

**Code**:
```typescript
// Existing deserialization logic handles this automatically
component.setBypass(data.isBypassed ?? false);
```

---

### New Patches (Post-Feature)

**Scenario**: User creates a new patch or modifies existing patch

**Behavior**:
1. LFO created with `isBypassed = false` (FR-011)
2. User toggles state via button
3. Serializer includes `isBypassed` field in saved JSON
4. Future loads respect saved state

---

## Data Integrity

### Consistency Checks

| Check | When | Action |
|-------|------|--------|
| `isBypassed` type validation | On deserialization | Coerce to boolean or default to `false` |
| Audio node existence | Before disconnect/connect | Throw error if missing |
| Parameter preservation | After toggle | No action needed (passive) |

### Error Recovery

| Error | Recovery Strategy |
|-------|-------------------|
| Invalid `isBypassed` value in patch | Default to `false` (enabled), log warning |
| Audio node missing during toggle | Throw error, prevent toggle, log to console |
| localStorage quota exceeded | Display warning, prevent save, suggest export to file |

---

## Performance Characteristics

### Memory Footprint

| Component | Size | Per LFO | Total (5 LFOs) |
|-----------|------|---------|----------------|
| `_isBypassed` boolean | 1 byte | 1 byte | 5 bytes |
| JSON serialization overhead | ~20 bytes | 20 bytes | 100 bytes |
| **Total** | | **21 bytes** | **105 bytes** |

**Impact**: Negligible (< 0.001% of typical 5 MB localStorage quota)

---

### Serialization Performance

| Operation | Time (Estimated) | Frequency |
|-----------|------------------|-----------|
| Serialize single LFO | < 0.1 ms | On patch save |
| Deserialize single LFO | < 0.1 ms | On patch load |
| Serialize full patch (20 components) | < 2 ms | On patch save |
| Deserialize full patch (20 components) | < 5 ms | On patch load |

**Impact**: Negligible (well under 100ms success criteria)

---

## Testing Checklist

### Unit Tests (Data Model)

- [ ] LFO serializes `isBypassed` correctly when `true`
- [ ] LFO serializes `isBypassed` correctly when `false`
- [ ] LFO deserializes with `isBypassed` missing (defaults to `false`)
- [ ] LFO deserializes with `isBypassed: true`
- [ ] LFO deserializes with `isBypassed: false`
- [ ] Invalid `isBypassed` value coerces to boolean or defaults safely

### Integration Tests (State Transitions)

- [ ] Toggle LFO off → `isBypassed` becomes `true`
- [ ] Toggle LFO on → `isBypassed` becomes `false`
- [ ] Rapid toggle preserves final state correctly
- [ ] Parameters (`rate`, `depth`, `waveform`) unchanged after toggle
- [ ] Oscillator continues running when `isBypassed = true`

### Persistence Tests

- [ ] Save patch with LFO enabled → load → LFO is enabled
- [ ] Save patch with LFO disabled → load → LFO is disabled
- [ ] Save patch with multiple LFOs in mixed states → load → states preserved
- [ ] Load old patch (no `isBypassed` field) → LFO defaults to enabled
- [ ] Export patch to file → import → state preserved

---

## Summary

The data model for LFO runtime toggle is intentionally minimal:

1. **Single new state**: `_isBypassed` boolean (reused from bypass feature)
2. **Zero new fields**: Reuses existing `ComponentData.isBypassed` field
3. **Backward compatible**: Old patches load correctly with default enabled state
4. **Negligible overhead**: 1 byte runtime, 20 bytes serialized per LFO
5. **No migration needed**: Existing deserialization logic handles defaults

All validation, persistence, and state management leverages existing infrastructure. Ready for Phase 1: Contracts.
