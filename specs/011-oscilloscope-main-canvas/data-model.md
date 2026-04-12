# Data Model: Oscilloscope Display — Main Canvas Migration

**Feature**: 011-oscilloscope-main-canvas
**Date**: 2026-04-11

---

## OscilloscopeDisplay (refactored)

The display class holds layout state and rendering logic. It owns **no DOM element**.

| Property | Type | Description |
|----------|------|-------------|
| `baseX` | `number` | World-space X origin of the display area |
| `baseY` | `number` | World-space Y origin of the display area |
| `baseWidth` | `number` | Display area width in world units |
| `baseHeight` | `number` | Display area height in world units |
| `oscilloscope` | `Oscilloscope` | Reference to the audio component for data pull |
| `isFrozen` | `boolean` | When true, `render()` skips drawing (freeze mode) |
| `lastRenderTime` | `number` | `performance.now()` timestamp of last drawn frame |
| `frameInterval` | `number` | Minimum ms between draws (≈33 ms for 30 FPS) |

### Methods (public)

| Method | Signature | Description |
|--------|-----------|-------------|
| `render` | `(ctx: CanvasRenderingContext2D) → void` | Draw display onto main canvas at world coordinates. Throttles to ~30 FPS internally. No-ops when frozen. |
| `updatePosition` | `(x: number, y: number) → void` | Update world-space origin when component moves |
| `updateSize` | `(width: number, height: number) → void` | Update display dimensions (e.g. component resize) |
| `setFrozen` | `(frozen: boolean) → void` | Enable/disable freeze mode |
| `destroy` | `() → void` | Release `oscilloscope` reference; no DOM removal needed |

### Methods removed vs. current implementation

| Removed Method | Reason |
|----------------|--------|
| `getCanvas()` | No overlay canvas element exists |
| `updateViewportTransform(zoom, panX, panY)` | Main canvas applies viewport transform; CSS sync not needed |
| `isVisible()` | `getBoundingClientRect()` not available without DOM element |

---

## Display State (read from Oscilloscope each frame)

The display pulls its data snapshot from the `Oscilloscope` component reference on each `render()` call. No separate state object is allocated.

| Data | Source method | Type |
|------|--------------|------|
| Display mode | `oscilloscope.getParameter('displayMode').getValue()` | `0` = waveform, `1` = spectrum, `2` = both |
| Gain | `oscilloscope.getParameter('gain').getValue()` | `number` (multiplier) |
| Waveform buffer | `oscilloscope.getWaveformData()` | `Float32Array \| null` |
| Spectrum buffer | `oscilloscope.getSpectrumData()` | `Uint8Array \| null` |

---

## CanvasComponent changes

| Property | Change |
|----------|--------|
| `oscilloscopeDisplay: OscilloscopeDisplay \| null` | **Retained** — same field, same lifecycle |
| `createControls()` | Remove `appendChild(display.getCanvas())` call |
| `render(ctx)` | Add `oscilloscopeDisplay.render(ctx)` call after `renderControls()` |
| `updateViewportTransform(...)` | Remove oscilloscope branch |
| `destroy()` | `oscilloscopeDisplay.destroy()` still called — no change needed |

---

## Canvas.ts changes

| Location | Change |
|----------|--------|
| Lines 607, 621 (`component.updateViewportTransform(...)`) | Remove — oscilloscope no longer needs it; other displays (Collider, Sequencer) still receive the call |
| Line 466, 520 (comments about oscilloscope) | Update comments to reflect new architecture |
