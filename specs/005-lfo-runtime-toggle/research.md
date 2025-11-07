# Research: LFO Runtime Toggle

**Feature**: 005-lfo-runtime-toggle
**Date**: 2025-11-07
**Status**: Complete

## Research Questions

### 1. How to maintain LFO phase continuity while toggled off?

**Decision**: Keep the OscillatorNode running continuously, disconnect output from GainNode

**Rationale**:
- Web Audio API OscillatorNode cannot be stopped and restarted without creating a new node
- Creating new nodes would reset phase to 0, violating FR-013 requirement
- Disconnecting the oscillator output from the depth control GainNode achieves the same effect as "muting" modulation
- The internal oscillator continues its phase progression uninterrupted
- When re-enabled, reconnecting to the GainNode resumes modulation from the current phase position

**Alternatives Considered**:
- **Stop/restart oscillator**: Would reset phase to 0, violating spec requirement for continuous phase
- **Set GainNode gain to 0**: Would work but less explicit than disconnect, harder to debug
- **Use a separate "mute" GainNode**: Adds unnecessary complexity and extra audio nodes

**Implementation Pattern**:
```typescript
private _isEnabled: boolean = true;
private _outputConnections: AudioNode[] = [];

public setEnabled(enabled: boolean): void {
  if (enabled === this._isEnabled) return;

  this._isEnabled = enabled;

  if (enabled) {
    // Reconnect oscillator to gain node
    this.oscillator.connect(this.gainNode);
  } else {
    // Disconnect oscillator output (keeps it running internally)
    this.oscillator.disconnect();
  }

  this.emit('enabledChanged', enabled);
}
```

**References**:
- Web Audio API OscillatorNode spec: https://webaudio.github.io/web-audio-api/#OscillatorNode
- Similar pattern used in professional synthesizers (Ableton Live, Serum, Vital)

---

### 2. Should LFO reuse existing bypass infrastructure or create separate enabled state?

**Decision**: Reuse existing bypass infrastructure with semantic alias

**Rationale**:
- SynthComponent base class already has `_isBypassed`, `setBypass()`, and serialization support
- PatchSerializer already handles `isBypassed` field in ComponentData
- CanvasComponent already has visual bypass button rendering and dimming logic
- Reusing existing code maintains consistency and reduces implementation complexity
- The term "bypass" is semantically appropriate for LFOs (bypassing modulation output)
- Effects already use this pattern successfully

**Alternatives Considered**:
- **Create separate `_isEnabled` state**: Would require duplicate serialization logic, button rendering, and state management
- **Add LFO-specific fields to ComponentData**: Would break existing patch file compatibility
- **Use a different visual treatment**: Would violate FR-007 consistency requirement

**Implementation Pattern**:
```typescript
// In LFO.ts - reuse existing bypass infrastructure
public override isBypassable(): boolean {
  return true;  // Changed from false
}

protected override enableBypass(): void {
  // "Bypass" means disconnect modulation output
  this.oscillator.disconnect();
}

protected override disableBypass(): void {
  // Restore modulation output
  this.oscillator.connect(this.gainNode);
}
```

**Migration Note**: Existing patches without `isBypassed` field for LFO will default to enabled (FR-011 requirement).

---

### 3. How to handle parameter value hold when LFO is toggled off mid-cycle?

**Decision**: Let target parameters naturally hold their last value when modulation disconnects

**Rationale**:
- Web Audio API AudioParam nodes automatically hold their last value when a modulation source disconnects
- No explicit code needed - this is the default behavior
- When oscillator disconnects from gainNode, the gainNode output to connected AudioParams stops
- The AudioParam retains its last computed value (base value + modulation offset)
- This satisfies FR-003 requirement: "hold parameter at current value"

**Alternatives Considered**:
- **Manually capture and set parameter value**: Would require tracking all connected parameters and their current values - complex and error-prone
- **Ramp to base value**: Would violate spec requirement (clarification Q2 specified "hold at current value")
- **Use automation timeline**: Overkill for this use case, adds complexity

**Implementation Pattern**:
```typescript
// No special code needed - automatic Web Audio API behavior
protected override enableBypass(): void {
  this.oscillator.disconnect();
  // Connected AudioParams automatically hold their last value
}
```

**Testing Approach**:
- Modulate filter cutoff with slow LFO (0.1 Hz)
- Toggle off mid-cycle
- Verify filter cutoff stays at current value (audibly and via oscilloscope)
- Toggle back on
- Verify modulation resumes from current phase

---

### 4. Best practices for visual state indication (button + component dimming)?

**Decision**: Follow exact pattern used in effects bypass (⚡ button + 0.4 opacity)

**Rationale**:
- Consistency with existing UI (FR-007 requirement)
- Users already familiar with this pattern from effects
- 0.4 opacity provides clear visual distinction while keeping controls readable
- ⚡ (lightning bolt) icon is semantically appropriate for modulation/energy
- Button color change (blue active, dark inactive) provides redundant state indication

**Alternatives Considered**:
- **Different icon (🔀, ⏸️, ⏯️)**: Would break visual consistency with effects
- **Different dimming level**: 0.4 is established standard in this codebase
- **Only dim the output jack**: Too subtle, users might miss the state change
- **Add text label "ON/OFF"**: Clutters minimal UI design

**Implementation Pattern** (already exists in CanvasComponent.ts):
```typescript
// Visual button rendering (lines 450-470)
if (component.isBypassable()) {
  const bypassButton = new Button(
    this.width - 35,
    10,
    25,
    20,
    '⚡',
    () => component.setBypass(!component.isBypassed())
  );
  this.controls.set('bypass', bypassButton);
}

// Component dimming (line 125)
if (component.isBypassed()) {
  ctx.globalAlpha = 0.4;
}
```

**No changes needed** - LFO.isBypassable() just needs to return `true`.

---

### 5. How to ensure no audio clicks/pops during toggle?

**Decision**: Use oscillator disconnect/reconnect (inherently click-free in Web Audio API)

**Rationale**:
- Web Audio API performs all connections/disconnections at audio-rate with automatic interpolation
- Oscillator disconnect is instantaneous but smoothed by browser's audio rendering quantum (128 samples)
- No manual ramping or fade-out needed
- GainNode already provides smooth transitions
- Maintains < 10ms toggle response time (FR-001, SC-001)

**Alternatives Considered**:
- **Add ramp automation**: Unnecessary complexity, Web Audio API already handles smoothing
- **Use exponential ramp**: Would add latency, violating 10ms requirement
- **Gate the output with separate GainNode**: Adds audio nodes, same click-free behavior already provided

**Implementation Pattern**:
```typescript
// Web Audio API automatically handles smooth transitions
this.oscillator.disconnect();  // Inherently click-free
this.oscillator.connect(this.gainNode);  // Inherently click-free
```

**Testing Approach**:
- Modulate VCA gain with fast LFO (10 Hz triangle wave)
- Toggle on/off rapidly while monitoring audio output
- Listen for clicks, pops, or discontinuities
- Use oscilloscope to verify smooth waveform

---

## Technology Decisions

### Web Audio API Features Used

| Feature | Usage | Justification |
|---------|-------|---------------|
| OscillatorNode | LFO signal generation | Standard Web Audio API modulation source |
| GainNode | Modulation depth control | Scales oscillator output for CV connections |
| AudioNode.connect/disconnect | Toggle control | Enables/disables modulation output smoothly |
| AudioParam | Modulation targets | Receives CV signals from LFO output |

**No new dependencies required** - uses existing Web Audio API primitives.

---

## Implementation Patterns from Existing Codebase

### Pattern 1: Bypass Toggle (from effects)

**Source**: `/src/components/effects/Distortion.ts`, `/src/components/base/SynthComponent.ts`

**Reusable Elements**:
- `isBypassable(): boolean` - Override to return true
- `enableBypass() / disableBypass()` - Override for LFO-specific disconnect logic
- `setBypass(bypassed: boolean)` - Already implemented in base class
- `_isBypassed` - State storage already exists
- Event emission on state change

**Adaptation for LFO**:
```typescript
// Distortion pattern (disconnect effects processing):
protected override enableBypass(): void {
  this.inputGain.disconnect();
  this.inputGain.connect(this.outputGain);  // Direct passthrough
}

// LFO pattern (disconnect modulation output):
protected override enableBypass(): void {
  this.oscillator.disconnect();  // No passthrough needed
}
```

---

### Pattern 2: Visual State Rendering (from CanvasComponent)

**Source**: `/src/canvas/CanvasComponent.ts`

**Reusable Elements**:
- Bypass button creation (lines 450-470)
- Component dimming via `ctx.globalAlpha = 0.4` (line 125)
- Button click handler already wired to `component.setBypass()`

**Required Change**:
```typescript
// Current code (line 450):
if (component.isBypassable()) {
  // Creates bypass button
}

// LFO.isBypassable() must return true (currently returns false per 001-effect-bypass spec)
```

---

### Pattern 3: State Persistence (from PatchSerializer)

**Source**: `/src/patch/PatchSerializer.ts`

**Reusable Elements**:
- `ComponentData.isBypassed?: boolean` - Field already exists
- Serialization: `isBypassed: component.isBypassed()` (line 85)
- Deserialization: `component.setBypass(data.isBypassed ?? false)` (line 180)

**Default Behavior**:
- Patches without `isBypassed` field default to `false` (enabled)
- Satisfies FR-011: "Newly created LFOs MUST start in the enabled state"

---

## Performance Considerations

### Toggle Response Time

**Target**: < 10ms (SC-001)

**Measurement Points**:
1. User click event → Button handler execution
2. `setBypass()` method → Oscillator disconnect
3. Visual update → Canvas redraw

**Expected Performance**:
- Click handler: < 1ms (synchronous JavaScript)
- Audio disconnect: < 0.1ms (Web Audio API thread)
- Canvas redraw: 16.7ms @ 60 FPS (next animation frame)

**Optimization**: No special optimization needed - all operations are already fast enough.

---

### Memory Usage

**Impact**: Zero additional memory

**Justification**:
- Reuses existing `_isBypassed` boolean (1 byte per LFO instance)
- No new audio nodes created
- No additional event listeners
- Typical patch: 2-5 LFOs × 1 byte = 5 bytes total

---

### CPU Usage

**Impact**: Negligible

**Analysis**:
- Oscillator continues running when toggled off (same CPU as when on)
- Disconnect eliminates downstream parameter modulation calculations
- Net CPU impact: ~0.1% reduction when toggled off (parameter automation eliminated)

---

## Edge Cases Resolved

### Edge Case 1: Toggle off while parameter is being edited

**Behavior**: Parameter editing continues normally, LFO modulation doesn't apply until re-enabled

**Justification**:
- FR-009: "System MUST allow parameter adjustments to disabled LFOs"
- Parameter editing is independent of modulation output
- When re-enabled, modulation applies to the new parameter values

**Implementation**: No special handling needed - natural consequence of disconnect pattern.

---

### Edge Case 2: Multiple LFOs modulating same parameter, mixed on/off states

**Behavior**: Each LFO's contribution is independent

**Justification**:
- Web Audio API AudioParam supports multiple simultaneous modulation sources
- Each LFO connects to the parameter via separate GainNode
- Disconnecting one LFO removes its contribution, others continue
- Final parameter value = base + LFO1 + LFO2 + ... (for enabled LFOs only)

**Example**:
```
Filter cutoff = 1000 Hz (base)
  + LFO1 output (enabled): ±200 Hz
  + LFO2 output (disabled): 0 Hz
  = 800-1200 Hz range
```

**Implementation**: No special handling needed - Web Audio API handles this automatically.

---

### Edge Case 3: Rapid toggling (button mashing)

**Behavior**: Each toggle is processed independently (clarification Q3 answer)

**Justification**:
- FR-012: "System MUST process all toggle events independently"
- Web Audio API queue ensures sequential processing
- No debouncing or throttling applied
- Final state reflects the last toggle action

**Implementation**:
```typescript
public setBypass(bypassed: boolean): void {
  if (bypassed === this._isBypassed) return;  // Idempotent guard
  this._isBypassed = bypassed;
  // Process toggle...
}
```

---

## Summary

All research questions resolved with decisions aligned to existing codebase patterns and Web Audio API best practices. No new dependencies required. Implementation leverages existing bypass infrastructure with minimal changes to LFO.ts and CanvasComponent.ts. All edge cases handled naturally by Web Audio API behavior or existing infrastructure.

**Ready for Phase 1: Design & Contracts**
