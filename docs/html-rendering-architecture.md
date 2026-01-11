# HTML Rendering Architecture

This document explains how HTML element rendering is handled in the Modular Web Synthesizer application.

## Overview

This application uses a **hybrid canvas-centric rendering architecture** rather than traditional DOM manipulation. The synthesizer interface renders almost entirely on `<canvas>` elements for performance and real-time responsiveness.

---

## Core Architecture

### 1. Minimal HTML/DOM Layer

The HTML structure is mostly static and defined in `index.html`:

- **Static containers**: Single root `<div id="app">` with pre-created sections
- **Sidebar**: Component library with category containers (generators-list, processors-list, effects-list, utilities-list, analyzers-list)
- **Canvas elements**:
  - `#synth-canvas` - Main synthesizer patch editor
  - `#keyboard-canvas` - Piano keyboard visualization
- **UI controls**: Buttons for patch management (save, load, new, export, import, help)
- **Text inputs**: Patch name field

**Dynamic HTML Generation:**

The sidebar is populated dynamically via `src/ui/Sidebar.ts:39-72`:

```typescript
populate(): void {
  const components = componentRegistry.getAllRegistrations();

  components.forEach((registration) => {
    const item = this.createComponentItem({
      type: registration.type,
      name: registration.name,
      description: registration.description,
      category: registration.category,
    });

    // Append to appropriate category container
  });
}
```

**Component Item HTML Generation (`src/ui/Sidebar.ts:76-110`):**

```typescript
private createComponentItem(data: ComponentItem): HTMLElement {
  const item = document.createElement('div');
  item.className = 'component-item';
  item.draggable = true;

  // Icon
  const icon = document.createElement('div');
  icon.className = 'component-icon';
  icon.textContent = this.getComponentIcon(data.type);

  // Info container
  const info = document.createElement('div');
  info.className = 'component-info';

  // Name and description
  const name = document.createElement('div');
  name.className = 'component-name';
  name.textContent = data.name;

  const description = document.createElement('div');
  description.className = 'component-description';
  description.textContent = data.description;

  // Assemble
  info.appendChild(name);
  info.appendChild(description);
  item.appendChild(icon);
  item.appendChild(info);

  // Add drag event listeners
  item.addEventListener('dragstart', (e) => this.handleDragStart(e, data));
  item.addEventListener('dragend', (e) => this.handleDragEnd(e));

  return item;
}
```

### 2. Canvas-Based Primary Rendering

The synthesizer interface renders entirely on canvas elements for performance:

**Main Canvas Rendering (`src/canvas/Canvas.ts:609-682`):**

```typescript
start(): void {
  if (!this.isRunning) {
    this.isRunning = true;
    // Subscribe to centralized scheduler
    this.subscription = visualUpdateScheduler.onFrame(
      (_deltaMs) => this.render(),
      'Canvas'
    );
  }
}

private render = (): void => {
  if (!this.isRunning) return;

  // Clear canvas
  this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

  // Save context state
  this.ctx.save();

  // Apply viewport transformations (panning, zooming)
  this.viewport.applyTransform(this.ctx);

  // Render grid
  if (this.showGrid) {
    this.renderGrid();
  }

  // Render connections
  this.connectionManager.render(this.ctx);

  // Render components
  this.components.forEach((component) => component.render(this.ctx));

  // Render connection preview if connecting
  if (this.interactionMode === InteractionMode.CONNECTING) {
    this.renderConnectionPreview();
  }

  // Render dropdown menus on top (z-index)
  this.components.forEach((component) => component.renderDropdownMenus(this.ctx));

  // Restore context state
  this.ctx.restore();

  // Render UI overlay (HTML text updates)
  this.renderOverlay();
};
```

**Individual Component Rendering (`src/canvas/CanvasComponent.ts:1063-1125`):**

```typescript
render(ctx: CanvasRenderingContext2D): void {
  const { x, y } = this.position;

  ctx.save();

  // Apply bypass visual effect
  if (this.synthComponent?.isBypassed) {
    ctx.globalAlpha = COMPONENT.BYPASSED_OPACITY;
  }

  // Draw component background
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(x, y, this.width, this.height);

  // Draw border (blue if selected)
  ctx.strokeStyle = this.isSelected ? '#4a9eff' : '#505050';
  ctx.lineWidth = this.isSelected ? 3 : 2;
  ctx.strokeRect(x, y, this.width, this.height);

  // Draw header
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(x, y, this.width, COMPONENT.HEADER_HEIGHT);

  // Draw component name
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    this.getDisplayName(),
    x + 8,
    y + COMPONENT.HEADER_HEIGHT / 2
  );

  // Draw ports (input/output connections)
  if (this.synthComponent) {
    this.renderPorts(ctx);

    // Render controls (knobs, sliders, dropdowns)
    if (this.controls.length > 0) {
      this.renderControls(ctx);
    }
  }

  ctx.restore();
}

private renderControls(ctx: CanvasRenderingContext2D): void {
  this.controls.forEach(control => {
    control.render(ctx);  // Each control is also canvas-drawn
  });
}
```

**Keyboard Rendering (`src/keyboard/Keyboard.ts:322-371`):**

```typescript
private render(): void {
  // Clear canvas
  this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

  // Render white keys first
  this.keys
    .filter((key) => !key.isBlack)
    .forEach((key) => this.renderKey(key));

  // Render black keys on top (z-index)
  this.keys
    .filter((key) => key.isBlack)
    .forEach((key) => this.renderKey(key));
}

private renderKey(key: Key): void {
  const height = key.isBlack
    ? KEYBOARD.BLACK_KEY_HEIGHT
    : this.canvas.clientHeight;

  // Fill key
  if (key.isBlack) {
    this.ctx.fillStyle = key.isPressed ? '#4a9eff' : '#2a2a2a';
  } else {
    this.ctx.fillStyle = key.isPressed ? '#60a5fa' : '#ffffff';
  }
  this.ctx.fillRect(key.x, 0, key.width, height);

  // Draw border and label
  this.ctx.strokeStyle = key.isBlack ? '#1a1a1a' : '#505050';
  this.ctx.lineWidth = 1;
  this.ctx.strokeRect(key.x, 0, key.width, height);

  // Draw note name
  if (!key.isBlack) {
    this.ctx.fillStyle = key.isPressed ? '#ffffff' : '#808080';
    this.ctx.font = '10px -apple-system, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'bottom';
    this.ctx.fillText(
      key.name,
      key.x + key.width / 2,
      this.canvas.clientHeight - 5
    );
  }
}
```

### 3. Centralized Animation Scheduler

All rendering is coordinated through a single, centralized animation frame scheduler (`src/visualization/VisualUpdateScheduler.ts`):

```typescript
export class VisualUpdateScheduler implements IVisualUpdateScheduler {
  onFrame(callback: FrameCallback, componentId?: string): SubscriptionHandle {
    const id = this.nextCallbackId++;
    this.callbacks.set(id, { callback, componentId });

    return {
      unsubscribe: () => {
        if (this.isIterating) {
          this.pendingRemovals.add(id);
        } else {
          this.callbacks.delete(id);
        }
      },
    };
  }

  start(): void {
    this.isRunning = true;
    this.scheduleNextFrame();
  }

  private scheduleNextFrame(): void {
    this.animationFrameId = requestAnimationFrame((timestamp) => {
      this.onAnimationFrame(timestamp);
    });
  }

  private onAnimationFrame(timestamp: number): void {
    const deltaMs = timestamp - this.lastFrameTime;
    this.updateFPS(timestamp, deltaMs);

    this.isIterating = true;

    // Call all registered callbacks
    this.callbacks.forEach(({ callback, componentId }, id) => {
      if (this.pendingRemovals.has(id)) return;

      try {
        callback(deltaMs);  // Each subscriber renders their own content
      } catch (error) {
        console.error(`Error in frame callback [${componentId}]:`, error);
      }
    });

    this.isIterating = false;

    // Remove callbacks that unsubscribed during iteration
    this.pendingRemovals.forEach((id) => this.callbacks.delete(id));
    this.pendingRemovals.clear();

    // Schedule next frame
    this.scheduleNextFrame();
  }
}
```

**Initialization (`src/main.ts`):**

```typescript
visualUpdateScheduler.initialize(60, true);  // 60 FPS target
visualUpdateScheduler.start();

canvas.start();  // Subscribes Canvas to frame updates
```

---

## Initialization Flow

The main entry point (`src/main.ts:225-378`) follows this sequence:

```
1. Check browser compatibility (Web Audio API, localStorage)
2. Show welcome dialog (terms acceptance)
3. Load factory patches
4. Register all component types
5. Initialize Sidebar → populate() creates HTML elements
6. Initialize VisualUpdateScheduler → starts 60 FPS loop
7. Initialize AudioEngine
8. Initialize Canvas system → subscribes to scheduler
9. Initialize KeyboardController
10. Setup event listeners for patch management
```

---

## DOM Manipulation Patterns (Limited)

The application minimizes HTML/DOM manipulation to improve performance.

### Modal Dialogs

Modal dialogs are created on-demand using `src/ui/Modal.ts:43-56`:

```typescript
constructor(options: ModalOptions) {
  this.overlay = this.createOverlay();
  this.modal = this.createModal();
  this.header = this.createHeader();
  this.body = this.createBody();
  this.footer = this.createFooter();
  this.closeButton = this.createCloseButton();

  // Assemble modal
  this.header.appendChild(this.closeButton);
  this.modal.appendChild(this.header);
  this.modal.appendChild(this.body);
  this.modal.appendChild(this.footer);
  this.overlay.appendChild(this.modal);

  this.setupEventListeners();
}

private createOverlay(): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: none;
    z-index: 10000;
    backdrop-filter: blur(4px);
  `;
  return overlay;
}
```

### HTML Overlay Updates

Text overlays are updated via direct DOM manipulation (`src/canvas/Canvas.ts:778-787`):

```typescript
private renderOverlay(): void {
  const zoom = Math.round(this.viewport.getZoom() * 100);
  const pan = this.viewport.getPan();
  const snapStatus = this.snapToGridEnabled ? 'ON' : 'OFF';

  const info = document.getElementById('canvas-info');
  if (info) {
    info.textContent = `Zoom: ${zoom}% | Pan: ${Math.round(pan.x)}, ${Math.round(pan.y)} | Snap: ${snapStatus}`;
  }
}
```

### Dynamic File Input

Hidden file input for patch import (`src/main.ts:54-59`):

```typescript
const importFileInput = document.createElement('input');
importFileInput.type = 'file';
importFileInput.accept = '.json';
importFileInput.style.display = 'none';
document.body.appendChild(importFileInput);
```

---

## Canvas Integration with HTML

### Layout Structure

The HTML provides a flexbox-based layout container:

```html
<div id="app">
  <div class="top-bar"><!-- HTML buttons and controls --></div>
  <div class="main-content">
    <div class="sidebar"><!-- Component library --></div>
    <div class="canvas-container">
      <canvas id="synth-canvas"></canvas>
      <div class="canvas-info"><!-- Text overlay --></div>
    </div>
  </div>
  <div class="keyboard-section">
    <div id="keyboard-container">
      <canvas id="keyboard-canvas"></canvas>
    </div>
  </div>
</div>
```

### CSS Styling

Styling is defined in `src/styles/main.css`:

- Flexbox layout for top-level structure
- Canvas positioned absolutely within container
- Sidebar for component library (DOM-based)
- Keyboard section for piano visualization (canvas-based)

---

## Overall DOM Manipulation Approach

### Hybrid Model

**1. HTML/DOM Layer (Minimal):**
- Top navigation bar with buttons
- Sidebar with component library (drag-and-drop source)
- Modals for dialogs
- Text overlays for status information
- Piano keyboard HTML input handling

**2. Canvas Layer (Primary):**
- Main synthesizer patch editor (synth-canvas)
- All synthesizer components rendered on canvas
- All visual controls (knobs, sliders, buttons) rendered on canvas
- Connection lines between components rendered on canvas
- Piano keyboard visualization (keyboard-canvas)
- Oscilloscope and step sequencer displays rendered on canvas

**3. Rendering Architecture:**
- Centralized `VisualUpdateScheduler` using `requestAnimationFrame`
- 60 FPS target with FPS monitoring
- All visual updates flow through single scheduler
- Error isolation per callback
- Pause/resume on tab visibility (background tab optimization)

**4. Event Handling:**
- Canvas mouse events (mousedown, mousemove, mouseup, wheel)
- Keyboard input for QWERTY keyboard
- Drag-and-drop from sidebar to canvas
- Viewport pan/zoom via mouse and wheel
- Component selection and connection management

---

## Why Canvas Instead of DOM?

This canvas-centric approach provides several key advantages:

1. **Performance**: Canvas rendering is much faster than manipulating hundreds of DOM elements
2. **Real-time responsiveness**: Critical for audio synthesis applications where visual feedback must be instantaneous
3. **Custom controls**: Knobs and sliders can be rendered exactly as designed without CSS limitations
4. **Visual effects**: Easy smooth animations, transformations, and visual feedback
5. **Centralized rendering**: Single animation loop prevents layout thrashing and improves consistency
6. **Precise control**: Pixel-perfect rendering with full control over every visual element

---

## Summary

This application uses a **modern canvas-based architecture** where:

- **Minimal DOM manipulation** - The HTML structure is static and rarely modified
- **Canvas-centric rendering** - All synthesizer UI, components, and controls are rendered using Canvas 2D API
- **Centralized animation scheduling** - Single `requestAnimationFrame` loop manages all visual updates
- **Event-driven updates** - User interactions trigger changes that are reflected in the next render frame
- **High-performance design** - Canvas rendering enables real-time visual feedback for audio applications
- **Modular component system** - Each component has both an audio component (Web Audio API) and a visual component (Canvas rendering)

This approach is ideal for audio synthesis applications where responsive, real-time visual feedback is critical to the user experience.
