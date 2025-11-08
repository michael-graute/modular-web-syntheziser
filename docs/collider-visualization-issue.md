# Collider Visualization Issue

**Status**: UNRESOLVED
**Date**: 2025-11-08
**Severity**: HIGH - Component functionality is complete but visualization is not visible

---

## Problem Summary

The Collider component's physics simulation is **running correctly** (confirmed by console logs), but the **canvas visualization is not visible** to the user.

### Symptoms

1. ✅ Simulation starts successfully (console confirms)
2. ✅ Canvas element exists in DOM
3. ✅ Canvas has correct position and z-index
4. ✅ Rendering code executes (console confirms drawing operations)
5. ✅ Green border around canvas is visible
6. ❌ **Canvas content (circles, boundary, test graphics) is NOT visible**

---

## What We Know Works

### Simulation Engine ✅

The physics simulation is running correctly:

```
Console Output:
- Starting simulation... {hasCanvas: true, hasCtx: true, canvasSize: '260x200'}
- Boundary created: {left: 10, top: 10, right: 250, bottom: 190, width: 240, height: 180}
- Renderer created
- Colliders initialized: 3
- Collider added: {id: 'collider-0', position: {...}, velocity: {...}, ...}
- Animation loop started
- Simulation started successfully
```

### DOM Integration ✅

Canvas is properly added to the DOM:

```
Console Output:
- ✅ Collider display canvas added to DOM
- Parent: <div class="canvas-container">...</div>
- Canvas in DOM: true
- Canvas rect: DOMRect {x: 650, y: 360, width: 270, height: 210, top: 360, ...}
```

### Rendering Execution ✅

Render methods are being called:

```
Console Output:
- === First Render Frame ===
- ColliderRenderer.render() called with 3 colliders
- Canvas dimensions: 260 x 200
- === Clearing Canvas: 260x200 ===
- === Drawing Boundary ===
- Boundary rect: left=10, top=10, width=240, height=180
- === Drawing Circles ===
- Drawing circle: id=collider-0, x=116.8, y=152.8, r=15, color=#BB8FCE
- Drawing circle: id=collider-1, x=30.0, y=116.1, r=15, color=#FFA07A
- Drawing circle: id=collider-2, x=71.4, y=67.1, r=15, color=#98D8C8
- DEBUG: Drew persistent red rectangle and yellow text
```

### Z-Index Layering ✅

Proper stacking order established:

```css
#synth-canvas { z-index: 1; }  /* Main canvas */
.collider-display { z-index: 100; }  /* Collider display */
.canvas-info { z-index: 200; }  /* Info overlay */
```

---

## What We Tried (Unsuccessful)

### Attempt 1: Increased Z-Index
- Changed from `z-index: 10` to `z-index: 100`
- Added CSS rule for all embedded canvases
- **Result**: Green border visible, content still invisible

### Attempt 2: Removed Canvas Dimension Reset
- Identified that `updateViewportTransform()` was resetting canvas dimensions
- Removed `canvas.width = baseWidth; canvas.height = baseHeight;` (clears canvas)
- **Result**: No change - content still invisible

### Attempt 3: Added Persistent Debug Graphics
- Drew semi-transparent magenta background fill
- Drew persistent red 100x100 rectangle at (50, 50)
- Drew yellow "COLLIDER TEST" text
- **Result**: Green border visible, but no debug graphics visible inside

### Attempt 4: CSS Hard Refresh
- Multiple hard refreshes (Ctrl+Shift+R / Cmd+Shift+R)
- Cleared browser cache
- **Result**: No change

---

## Technical Details

### Canvas Setup

**File**: `src/canvas/displays/ColliderDisplay.ts`

```typescript
constructor(x: number, y: number, width: number, height: number, collider: Collider) {
  this.canvas = document.createElement('canvas');
  this.canvas.width = width;  // 260
  this.canvas.height = height; // 200
  this.canvas.style.position = 'absolute';
  this.canvas.style.left = `${x}px`;
  this.canvas.style.top = `${y}px`;
  this.canvas.style.border = '5px solid lime'; // DEBUG: Visible
  this.canvas.style.backgroundColor = '#1a1a1a';
  this.canvas.style.pointerEvents = 'none';
  this.canvas.style.transformOrigin = '0 0';
  this.canvas.style.zIndex = '100';

  // Initialize collider with canvas
  this.collider.setCanvas(this.canvas);
}
```

### Rendering Code

**File**: `src/canvas/ColliderRenderer.ts`

```typescript
render(colliders: Collider[], boundary: CollisionBoundary): void {
  this.clear();

  // Fill entire canvas with magenta (DEBUG)
  this.ctx.fillStyle = 'rgba(255, 0, 255, 0.3)';
  this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

  this.drawBounds(boundary);
  this.drawCircles(colliders);
  this.drawFlash();

  // Draw red test rectangle (DEBUG)
  this.ctx.fillStyle = 'red';
  this.ctx.fillRect(50, 50, 100, 100);

  // Draw yellow text (DEBUG)
  this.ctx.fillStyle = 'yellow';
  this.ctx.font = '20px Arial';
  this.ctx.fillText('COLLIDER TEST', 60, 90);
}
```

### Animation Loop

**File**: `src/components/utilities/Collider.ts`

```typescript
private animate = (): void => {
  if (!this.isRunning) return;

  const currentTime = performance.now();
  const deltaTime = currentTime - this.lastUpdateTime;
  this.lastUpdateTime = currentTime;

  // Update physics
  const collisionEvents = this.physicsEngine!.update(deltaTime / 1000);

  // Process collision events
  this.processCollisionEvents(collisionEvents);

  // Render scene
  if (this.renderer && this.boundary) {
    this.renderer.render(this.colliders, this.boundary);
  }

  // Continue animation loop
  this.animationFrameId = requestAnimationFrame(this.animate);
};
```

---

## Possible Causes (To Investigate)

### 1. Canvas Context State Issue
The 2D context might be in an invalid state or transformed incorrectly.

**Test**: Add context save/restore and reset transform before drawing
```typescript
render() {
  this.ctx.save();
  this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
  // ... drawing code ...
  this.ctx.restore();
}
```

### 2. Canvas Being Cleared Externally
Something else might be clearing the canvas after rendering.

**Test**: Add a timestamp to verify canvas isn't being cleared between frames
```typescript
render() {
  // Draw timestamp in corner
  this.ctx.fillStyle = 'white';
  this.ctx.font = '12px monospace';
  this.ctx.fillText(`Frame: ${Date.now()}`, 5, 15);
}
```

### 3. CSS Opacity/Visibility Issue
The canvas might have opacity: 0 or visibility: hidden set somewhere.

**Test**: Check computed styles in browser DevTools
```javascript
const canvas = document.querySelector('canvas[style*="lime"]');
console.log(window.getComputedStyle(canvas));
```

### 4. Clipping/Overflow Issue
The canvas content might be clipped by a parent element.

**Test**: Check parent overflow settings
```javascript
const canvas = document.querySelector('canvas[style*="lime"]');
let parent = canvas.parentElement;
while (parent) {
  console.log(parent.tagName, window.getComputedStyle(parent).overflow);
  parent = parent.parentElement;
}
```

### 5. Device Pixel Ratio Scaling
The canvas might need devicePixelRatio scaling.

**Test**: Apply DPR scaling
```typescript
const dpr = window.devicePixelRatio || 1;
this.canvas.width = width * dpr;
this.canvas.height = height * dpr;
this.canvas.style.width = `${width}px`;
this.canvas.style.height = `${height}px`;
this.ctx.scale(dpr, dpr);
```

### 6. Main Canvas Overdraw
The main canvas might be drawing over the collider display despite z-index.

**Test**: Temporarily hide main canvas
```javascript
document.getElementById('synth-canvas').style.display = 'none';
```

### 7. Canvas Rendering Before DOM Attachment
The canvas might be rendering before it's properly attached to the DOM.

**Test**: Delay first render until DOM attachment is confirmed
```typescript
constructor() {
  // ... setup ...
  requestAnimationFrame(() => {
    // Verify in DOM before first render
    if (document.body.contains(this.canvas)) {
      this.collider.setCanvas(this.canvas);
    }
  });
}
```

---

## Files Modified

### Core Implementation
- `src/components/utilities/Collider.ts` - Physics simulation (WORKING)
- `src/canvas/ColliderRenderer.ts` - Rendering logic (EXECUTING but not visible)
- `src/canvas/displays/ColliderDisplay.ts` - Display wrapper (CREATED correctly)

### Integration
- `src/canvas/CanvasComponent.ts` - Component integration (WORKING)
- `src/utils/componentLayout.ts` - Sizing calculations (WORKING)

### Styling
- `src/styles/canvas.css` - Z-index layering (CORRECT)

---

## Debug Commands

### Check all canvases
```javascript
document.querySelectorAll('canvas').forEach(c => {
  console.log(c.id || 'unnamed', {
    width: c.width,
    height: c.height,
    styleWidth: c.style.width,
    styleHeight: c.style.height,
    zIndex: c.style.zIndex,
    visible: c.offsetParent !== null
  });
});
```

### Find collider canvas
```javascript
const colliderCanvas = document.querySelector('canvas[style*="lime"]');
console.log('Collider canvas:', colliderCanvas);
console.log('Computed styles:', window.getComputedStyle(colliderCanvas));
console.log('Bounding rect:', colliderCanvas.getBoundingClientRect());
```

### Check if canvas has pixels
```javascript
const colliderCanvas = document.querySelector('canvas[style*="lime"]');
const ctx = colliderCanvas.getContext('2d');
const imageData = ctx.getImageData(0, 0, colliderCanvas.width, colliderCanvas.height);
const hasNonZero = imageData.data.some(byte => byte !== 0);
console.log('Canvas has pixel data:', hasNonZero);
```

### Force redraw
```javascript
const colliderCanvas = document.querySelector('canvas[style*="lime"]');
const ctx = colliderCanvas.getContext('2d');
ctx.fillStyle = 'red';
ctx.fillRect(0, 0, 200, 200);
console.log('Manually drew red rectangle - visible?');
```

---

## Next Steps

1. **Run debug commands** in browser console to gather more data
2. **Test each possible cause** systematically
3. **Compare with working OscilloscopeDisplay** implementation
4. **Check if issue is macOS/browser specific** (test on different platform)
5. **Inspect canvas with browser DevTools** 3D view to see layering

---

## Working Reference: OscilloscopeDisplay

The OscilloscopeDisplay uses a similar pattern and **WORKS CORRECTLY**:

**File**: `src/canvas/displays/OscilloscopeDisplay.ts`

Key differences to investigate:
- Has its own animation loop (requestAnimationFrame)
- Directly calls render() in its own loop
- Does NOT rely on external component to render
- Updates viewport transform WITHOUT resetting dimensions

**Comparison**:
```typescript
// OscilloscopeDisplay: Self-contained rendering
private startAnimation(): void {
  const animate = () => {
    if (!this.isFrozen) {
      this.render(); // Renders directly
    }
    this.animationFrame = requestAnimationFrame(animate);
  };
  animate();
}

// ColliderDisplay: Delegates rendering to Collider component
constructor() {
  // ...
  this.collider.setCanvas(this.canvas); // Collider handles rendering
}
```

**Possible Solution**: Make ColliderDisplay self-contained like OscilloscopeDisplay?

---

## Workaround Options

### Option A: Self-Contained Rendering
Make ColliderDisplay handle its own rendering instead of delegating to Collider component.

### Option B: Render to Main Canvas
Render collider visualization directly on the main canvas instead of separate canvas element.

### Option C: Use OffscreenCanvas
Try using OffscreenCanvas API if browser supports it.

---

## Console Output Template

When debugging, capture this information:

```
=== Collider Visualization Debug Info ===
Browser: [Chrome/Safari/Firefox] [version]
OS: [macOS/Windows/Linux]
Device Pixel Ratio: [1/2/other]

Canvas Info:
- Canvas exists: [yes/no]
- Canvas in DOM: [yes/no]
- Canvas dimensions: [width]x[height]
- Canvas position: [x, y]
- Canvas z-index: [value]
- Green border visible: [yes/no]

Rendering:
- Render method called: [yes/no]
- Frame count: [number]
- Debug graphics drawn: [yes/no]
- Debug graphics visible: [yes/no]

Computed Styles:
- opacity: [value]
- visibility: [value]
- display: [value]
- overflow (parent): [value]

Manual Test Results:
- Can draw red rectangle manually: [yes/no]
- Manual drawing visible: [yes/no]
- ImageData has pixels: [yes/no]
```

---

**Last Updated**: 2025-11-08
**Reporter**: Development Team
**Status**: DOCUMENTED - Ready for Investigation
