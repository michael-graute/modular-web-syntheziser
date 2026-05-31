---
name: feedback_cv_port_naming
description: CV port IDs must match parameter names for ModulationVisualizer knob animation — or implement getCvParameterIdForPort()
metadata:
  type: feedback
---

CV port IDs must align with parameter names for knob visual modulation to work.

**Why:** `ModulationVisualizer.onConnectionCreated()` resolves tracked parameters by constructing `componentId:portId` and doing two lookups: exact match, then `_cv` suffix strip. If neither matches the parameter name stored as `componentId:paramName`, the visualizer silently skips visualization — audio works but knobs don't animate.

**How to apply:** Two options when adding a new component with CV inputs:

1. **Preferred — follow the convention**: name CV ports so the `_cv` strip produces the parameter name. E.g. port `gain_cv` → strips to `gain` ✓. Port `cutoff_cv` → strips to `cutoff` ✓.

2. **When hyphenated port IDs are needed** (e.g. `low-gain-cv`): override `getCvParameterIdForPort(portId)` in the component class to return the matching parameter name. The `ModulationVisualizer` has a third fallback that calls this method. Also call `linkAudioParam()` on each parameter in `createAudioNodes()` — both are required for the knob to animate.

Example from ParametricEQ (026):
- Ports: `low-gain-cv`, `mid-gain-cv`, `high-gain-cv`
- Parameters: `lowGain`, `midGain`, `highGain`
- Fix: override `getCvParameterIdForPort()` returning the mapping + call `linkAudioParam()` in `createAudioNodes()`

See [[feedback_canvas_controls]] for the related requirement to register knobs in `CanvasComponent.createControls()`.
