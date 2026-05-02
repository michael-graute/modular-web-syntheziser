# Guided Lessons Feature — Research & Sketch Spec

**Date**: 2026-05-02  
**Status**: Draft / Pre-specification  
**Context**: The modular web synthesizer is well-suited as a synthesis learning platform. Its visual, interactive, patch-based nature makes abstract audio concepts concrete in a way static tutorials cannot. This document captures the agreed direction and sketches a feature spec for a future `/speckit-specify` run.

---

## Vision

Turn the app into a guided synthesis learning experience for people with no prior audio knowledge. Users progress through structured lessons that load example patches, highlight relevant components, and invite hands-on experimentation — all without leaving the synthesizer canvas.

**Target audience**: Musicians, producers, or curious people who want to understand *how* synthesis works, not just use presets.

---

## Agreed Direction: Hybrid Lesson Sidebar

A **lesson sidebar** (separate from the existing component/patch sidebar) presents a curriculum of chapters. Each chapter:

1. Loads a pre-built factory patch onto the canvas
2. Highlights the relevant components with a visual overlay
3. Explains the concept in plain language with inline audio examples
4. Gives the user a task to complete (connect a cable, turn a knob, observe the result)
5. Validates completion and unlocks the next lesson

The free-patching canvas remains fully accessible — users can experiment at any point without leaving lesson mode.

---

## Curriculum Outline (Draft)

### Module 1 — Sound Basics
1. What is sound? (sine wave, frequency, amplitude)
2. The oscillator — your sound source
3. Waveform shapes and their timbres (sine / square / saw / triangle)

### Module 2 — Shaping Sound
4. Volume over time — the ADSR envelope
5. The VCA — gating your sound
6. Putting it together: oscillator + ADSR + VCA

### Module 3 — Filtering
7. What is a filter? (cutoff frequency, resonance)
8. Low-pass, high-pass, band-pass
9. Filter envelope — making sounds evolve

### Module 4 — Modulation
10. The LFO — slow oscillations as control signals
11. Vibrato and tremolo
12. FM synthesis — one oscillator modulating another

### Module 5 — Building Patches
13. The keyboard input and CV signals
14. Connecting multiple voices
15. Saving and sharing your patch

---

## Key UI Components Required

### `LessonSidebar`
- Replaces or extends the existing `HelpSidebar` in lesson mode
- Displays: current lesson title, progress indicator (e.g. "Lesson 3 of 15"), explanation text, task prompt, Next/Back navigation
- Persists progress to `localStorage`

### `LessonOverlay`
- Canvas overlay that highlights specific components with a glowing border or dimmed-background spotlight effect
- Dismissable so the user can freely interact

### `LessonTaskValidator`
- Listens to canvas events (connections made, parameter changes, patch state) to detect when a lesson task is complete
- Fires a "task complete" event that triggers a success animation and unlocks Next

### `LessonLoader`
- Loads lesson-specific factory patches (separate from the main factory patch list)
- Stores lesson metadata as JSON files under `public/lessons/`

---

## Data Model Sketch

```typescript
interface Lesson {
  id: string;                  // e.g. 'lesson-03-waveforms'
  module: number;
  index: number;               // position within module
  title: string;
  concept: string;             // plain-language explanation (markdown)
  patchFile: string;           // path to lesson patch JSON, e.g. '/lessons/03-waveforms.json'
  highlightComponents: string[]; // component types or IDs to spotlight
  task: LessonTask;
}

interface LessonTask {
  instruction: string;         // e.g. "Connect the oscillator output to the Master Output input"
  type: 'connect' | 'set-parameter' | 'observe' | 'free';
  // type-specific validation hints:
  connection?: { sourceType: ComponentType; targetType: ComponentType; targetPortId: string };
  parameter?: { componentType: ComponentType; parameterId: string; targetValue: number; tolerance: number };
}

interface LessonProgress {
  completedLessons: string[];  // lesson IDs
  currentLessonId: string | null;
}
```

---

## Integration with Existing Architecture

| Existing System | How Lessons Use It |
|---|---|
| `PatchSerializer` / `PatchStorage` | Load lesson patches the same way factory patches load |
| `FactoryPatchLoader` | Extend or mirror for a `LessonPatchLoader` |
| `HelpSidebar` | Lesson sidebar can share the panel slot; toggled by a new "Lessons" button in the toolbar |
| `CanvasComponent` | Add a `highlight(active: boolean)` method for the overlay effect |
| `ConnectionManager` | Emit events that `LessonTaskValidator` subscribes to |
| `SynthComponent` parameter system | Emit change events for `set-parameter` task validation |
| `localStorage` | Persist `LessonProgress` (same pattern as patch storage) |

---

## Open Questions for Specification Phase

1. **Entry point** — dedicated "Learn" mode button in the toolbar, or a panel tab alongside Help?
2. **Lesson authoring** — JSON-only, or a simple markdown+frontmatter format for lesson content?
3. **Progress reset** — can users replay lessons? Should completed lessons be visually distinct but re-enterable?
4. **Audio examples** — embedded `<audio>` clips per lesson, or rely entirely on the live synthesizer?
5. **Mobile** — lesson sidebar + canvas is tight on small screens; needs design consideration.
6. **Localisation** — English first, but lesson content strings should be externalised from the start.

---

## Recommended Next Steps

1. Run `/speckit-specify` with this document as input to produce a formal spec
2. Design the `LessonSidebar` UI (wireframe before implementation)
3. Author Module 1 lessons as the MVP — validate the architecture with 3 real lessons before building the full curriculum
4. Implement `LessonTaskValidator` for `connect` task type only (most common task) as the first milestone
