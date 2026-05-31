# Memory Index

- [Use vitest run instead of npm test](feedback_test_command.md) — always use `vitest run`; bare `npm test` starts watch mode and never exits
- [Always wire up interactive parameter controls in CanvasComponent](feedback_canvas_controls.md) — every new component needs an explicit case in `CanvasComponent.createControls()`; `componentLayout.ts` only sizes the box, it does NOT create controls
- [CV port naming and knob animation](feedback_cv_port_naming.md) — CV port IDs must match parameter names (via `_cv` strip) or override `getCvParameterIdForPort()`; also call `linkAudioParam()` in `createAudioNodes()` — both required for knob animation
- [Guided Lessons — strategic direction](project_guided_lessons.md) — app is destined to be a synthesis learning platform; hybrid lesson sidebar + canvas overlay approach agreed; research doc at `docs/research/guided-lessons-feature.md`
