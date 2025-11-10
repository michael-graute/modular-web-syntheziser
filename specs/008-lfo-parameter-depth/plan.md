# Implementation Plan: Parameter-Aware LFO Depth

**Branch**: `008-lfo-parameter-depth` | **Date**: 2025-11-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-lfo-parameter-depth/spec.md`

**Note**: This plan focuses ONLY on depth calculation changes. The LFO component visual implementation is already complete and should NOT be modified.

## Summary

Implement parameter-aware depth calculation for LFO modulation. When an LFO is connected to a parameter, the depth percentage (0-100%) will be applied to the parameter's available range in each direction (min-to-base and base-to-max) independently. This ensures modulation always respects parameter bounds and provides intuitive, predictable behavior even when base values are near boundaries.

**Technical Approach**: Modify the existing modulation connection system to calculate depth-scaled modulation amounts based on target parameter constraints. The LFO component itself remains unchanged - only the connection/modulation application logic needs updating.

## Technical Context

**Language/Version**: TypeScript 5.6+, ES2020 target, Web Audio API
**Primary Dependencies**:
- Existing: Web Audio API (OscillatorNode, GainNode, AudioParam)
- Existing: LFO component (src/components/generators/LFO.ts)
- Existing: Parameter class (src/components/base/Parameter.ts)
- Existing: Connection system (src/core/types.ts Connection interface)
- Existing: PatchManager (src/patch/PatchManager.ts)

**Storage**: localStorage via existing PatchSerializer/PatchStorage pattern
**Testing**: Manual testing (no existing automated test infrastructure identified)
**Target Platform**: Browser (Web Audio API compatible)
**Project Type**: Audio synthesis application (modular synth)
**Performance Goals**: <1ms calculation latency per modulation connection (real-time audio requirement)
**Constraints**:
- Must work within existing LFO implementation (feature 005-lfo-runtime-toggle)
- Do NOT modify LFO component visual implementation
- Do NOT modify existing LFO audio node structure
- Must maintain backward compatibility with existing patches
- Real-time audio processing (no blocking operations)
- Block-based processing acceptable (SC-003 allows non-sample-accurate)

**Scale/Scope**: Single-developer audio application, modular synthesis focus, parameter-aware modulation

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Version**: 1.0.0

**Note**: Most constitution principles apply to web application development. This is an audio synthesis application with different concerns.

- [x] **I. Rapid Prototyping with Quality Foundation**: Feature uses existing TypeScript types and patterns. No new frameworks introduced. Changes are localized to modulation calculation logic.
- [N/A] **II. Monorepo Strategy with Modular Architecture**: This is a single audio application, not a monorepo. Feature is organized by audio component functionality.
- [N/A] **III. Multi-Tenancy is Non-Negotiable**: Audio synthesis application has no multi-tenancy requirements.
- [N/A] **IV. Observability and Audit Trail**: Audio parameter changes don't require audit logging. Console logging sufficient for debugging.
- [x] **V. Progressive Enhancement for UX Complexity**: Feature enhances existing parameter-aware behavior. UI feedback (P3) is optional enhancement.
- [N/A] **VI. Deferred DevOps Complexity**: Browser-based application, no deployment infrastructure changes needed.
- [N/A] **VII. Security by Default**: Audio synthesis application has no sensitive data or authentication requirements.

**Constitution Applicability**: 2/7 principles apply to this audio synthesis feature. No violations identified.

## Project Structure

### Documentation (this feature)

```text
specs/008-lfo-parameter-depth/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0: Research findings
├── data-model.md        # Phase 1: Data structures
├── quickstart.md        # Phase 1: Developer guide
├── contracts/           # Phase 1: TypeScript interfaces
│   ├── types.ts         # Modulation calculation types
│   └── validation.ts    # Runtime validation
└── tasks.md             # Phase 2: Implementation tasks (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── modulation/                        # NEW: Modulation calculation module
│   ├── ParameterAwareDepthCalculator.ts  # Core calculation logic
│   ├── ModulationConnectionManager.ts # Manages ModulationConnection instances and scaling GainNodes
│   ├── types.ts                       # Modulation-specific types (includes ModulationConnection interface)
│   └── validation.ts                  # Runtime validation functions
├── components/
│   ├── generators/
│   │   └── LFO.ts                     # UNCHANGED: Existing LFO component
│   └── base/
│       └── Parameter.ts               # MINIMAL CHANGES: Add modulation metadata
├── core/
│   └── types.ts                       # UPDATED: Connection type extensions (if needed)
├── patch/
│   ├── PatchManager.ts                # UPDATED: Apply parameter-aware modulation
│   └── PatchSerializer.ts             # UPDATED: Serialize modulation metadata (if needed)
└── canvas/
    └── [UI components]                # UNCHANGED: No visual changes per user request
```

**Structure Decision**: Create new `src/modulation/` module to encapsulate parameter-aware depth calculation logic. This keeps changes isolated from existing LFO and Parameter implementations, minimizing risk and maintaining separation of concerns.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

---

## Phase 0: Research & Unknowns

**Status**: To be completed by /speckit.plan command

### Research Questions

1. **Modulation Application Point**: Where in the current codebase is LFO modulation currently applied to parameters? Is it in audio processing loop, connection management, or parameter update methods?

2. **Connection Metadata Storage**: Does the existing Connection interface support additional metadata (like per-connection depth overrides), or is depth always global to the LFO?

3. **Parameter Update Frequency**: How often are parameter values recalculated in the current implementation? Is it per-audio-block, per-frame, or on-demand?

4. **Depth Scaling Current Behavior**: In LFO.ts line 67, depth is scaled by `(depthPercent / 100) * 100`. What is the intended output range, and how does this interact with connected parameters?

5. **Modulation Connection Lifecycle**: When/where are modulation connections established? Is there a central registry or manager that tracks which LFOs modulate which parameters?

### Technology Best Practices

1. **Web Audio API Modulation**: Best practices for applying LFO modulation to AudioParam values (direct connection vs computed values)

2. **Real-time Calculation Performance**: Optimization strategies for per-frame modulation calculation with minimal CPU overhead

3. **Asymmetric Range Calculation**: Efficient algorithms for computing independent upward/downward ranges

**Output**: research.md with all questions answered and decisions documented

---

## Phase 1: Design & Contracts

**Status**: To be completed by /speckit.plan command

### Data Model

**Entities**:

1. **ModulationConnection** (extends or replaces Connection)
   - sourceComponentId: string (LFO ID)
   - targetComponentId: string (Parameter owner component ID)
   - targetParameterId: string (Parameter ID)
   - calculatedRanges: {upward: number, downward: number} (cached calculation)

2. **ParameterModulationMetadata** (added to Parameter class)
   - connectedLFOId: string | null (enforces 1:0..1 cardinality)
   - baseValue: number (user-set center point)
   - modulatedValue: number (current value with modulation applied)

3. **DepthCalculationResult**
   - upwardRange: number (base to max, scaled by depth%)
   - downwardRange: number (min to base, scaled by depth%)
   - effectiveMin: number (base - downwardRange)
   - effectiveMax: number (base + upwardRange)

### API Contracts

**Core Calculation Interface**:

```typescript
interface ParameterAwareDepthCalculator {
  /**
   * Calculate parameter-aware modulation ranges
   * @param paramMin - Parameter minimum value
   * @param paramMax - Parameter maximum value
   * @param baseValue - Current parameter base value
   * @param depthPercent - LFO depth setting (0-100)
   * @returns Calculated ranges for upward/downward modulation
   */
  calculateModulationRanges(
    paramMin: number,
    paramMax: number,
    baseValue: number,
    depthPercent: number
  ): DepthCalculationResult;

  /**
   * Apply modulation to parameter value
   * @param baseValue - Parameter base value
   * @param lfoOutput - Normalized LFO output (-1 to +1)
   * @param ranges - Pre-calculated modulation ranges
   * @param paramMin - Parameter minimum (for clamping)
   * @param paramMax - Parameter maximum (for clamping)
   * @returns Final modulated value
   */
  applyModulation(
    baseValue: number,
    lfoOutput: number,
    ranges: DepthCalculationResult,
    paramMin: number,
    paramMax: number
  ): number;
}
```

**Validation Rules**:
- paramMin <= baseValue <= paramMax (enforced by Parameter class)
- 0 <= depthPercent <= 100 (enforced by LFO depth parameter)
- lfoOutput between -1 and +1 (guaranteed by Web Audio API OscillatorNode)
- Result always clamped to [paramMin, paramMax]

### Quickstart Guide

**Developer Setup**:
1. Checkout branch `008-lfo-parameter-depth`
2. No new dependencies required (uses existing Web Audio API)
3. Key files to understand:
   - `src/components/generators/LFO.ts` - Existing LFO implementation
   - `src/components/base/Parameter.ts` - Parameter class with min/max/baseValue
   - `src/core/types.ts` - Connection interface

**Testing Approach**:
1. Manual testing: Create LFO, connect to parameter, adjust depth
2. Verification: Check calculated ranges match spec examples
3. Edge cases: Test base value at min, max, and near boundaries

**Output**: data-model.md, /contracts/, quickstart.md

---

## Phase 2: Task Generation

**Status**: NOT executed by /speckit.plan - run /speckit.tasks separately

Tasks will be generated in dependency-ordered sequence covering:
1. Create ParameterAwareDepthCalculator with core calculation logic
2. Enhance ModulationConnection to store calculation metadata
3. Update Parameter class with modulation metadata
4. Integrate calculator into modulation application flow
5. Update PatchSerializer for modulation metadata persistence
6. Manual testing and edge case validation

---

## Notes

- **Critical Constraint**: Do NOT modify LFO component visual implementation (per user requirement)
- **Performance Target**: <1ms calculation per connection (SC-003)
- **Backward Compatibility**: Existing patches should continue to work (may need migration logic)
- **User Story Priority**: P1 (basic calculation) is MVP, P2 (asymmetric) and P3 (feedback) are enhancements
