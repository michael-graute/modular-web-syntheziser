/**
 * Canvas - Main canvas rendering and interaction system
 */

import { Viewport } from './Viewport';
import { CanvasComponent } from './CanvasComponent';
import { CanvasConnection } from './Connection';
import { SelectionManager } from './SelectionManager';
import { ConnectionManager } from './ConnectionManager';
import { eventBus } from '../core/EventBus';
import { stateManager } from '../core/StateManager';
import { EventType, Position } from '../core/types';
import { CANVAS, COLORS } from '../utils/constants';
import { snapToGrid } from '../utils/geometry';

enum InteractionMode {
  NONE = 'none',
  PANNING = 'panning',
  DRAGGING = 'dragging',
  CONNECTING = 'connecting',
}

/**
 * Canvas class for rendering and interaction
 */
export class Canvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private viewport: Viewport;
  private components: CanvasComponent[];
  private connections: CanvasConnection[];
  private selectionManager: SelectionManager;
  private connectionManager: ConnectionManager;

  private animationFrameId: number | null;
  private isRunning: boolean;

  // Interaction state
  private interactionMode: InteractionMode;
  private dragStartPos: Position | null;
  private lastMousePos: Position | null;
  private draggedComponents: string[];

  // Connection state
  private connectingFromComponent: string | null;
  private connectingFromPort: string | null;
  private connectingPreview: Position | null;

  // Grid rendering
  private showGrid: boolean;
  private snapToGridEnabled: boolean;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D context from canvas');
    }
    this.ctx = context;

    this.viewport = new Viewport();
    this.components = [];
    this.connections = [];
    this.selectionManager = new SelectionManager();
    this.connectionManager = new ConnectionManager();

    this.animationFrameId = null;
    this.isRunning = false;

    this.interactionMode = InteractionMode.NONE;
    this.dragStartPos = null;
    this.lastMousePos = null;
    this.draggedComponents = [];

    this.connectingFromComponent = null;
    this.connectingFromPort = null;
    this.connectingPreview = null;

    this.showGrid = true;
    this.snapToGridEnabled = true;

    this.setupCanvas();
    this.setupEventListeners();
  }

  /**
   * Setup canvas size and scaling
   */
  private setupCanvas(): void {
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  /**
   * Resize canvas to fill container
   */
  private resizeCanvas(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    this.ctx.scale(dpr, dpr);

    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
  }

  /**
   * Setup mouse and keyboard event listeners
   */
  private setupEventListeners(): void {
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), {
      passive: false,
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Drag and drop event listeners
    this.canvas.addEventListener('dragover', (e) => this.handleDragOver(e));
    this.canvas.addEventListener('drop', (e) => this.handleDrop(e));

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
  }

  /**
   * Handle keyboard shortcuts
   */
  private handleKeyDown(e: KeyboardEvent): void {
    // Ignore if typing in an input field
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    // Toggle snap-to-grid with '`' (backtick) key
    if (e.key === '`' || e.key === '~') {
      e.preventDefault();
      this.toggleSnapToGrid();
      console.log(`Snap to grid: ${this.snapToGridEnabled ? 'ON' : 'OFF'}`);
    }

    // Toggle grid visibility with 'Shift+`'
    if (e.key === '~') {
      e.preventDefault();
      this.toggleGrid();
      console.log(`Grid visibility: ${this.showGrid ? 'ON' : 'OFF'}`);
    }

    // Delete selected components with Delete or Backspace
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault(); // Prevent browser back navigation on Backspace
      this.deleteSelectedComponents();
    }
  }

  /**
   * Handle mouse down event
   */
  private handleMouseDown(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = this.viewport.screenToWorld(screenX, screenY);

    this.lastMousePos = { x: screenX, y: screenY };

    // Check if clicking on a connection for deletion
    const clickedConnectionId = this.connectionManager.getConnectionAt(
      worldPos.x,
      worldPos.y
    );
    if (clickedConnectionId && e.shiftKey) {
      // Delete connection with Shift+Click
      this.connectionManager.removeConnection(clickedConnectionId);
      console.log('Connection deleted');
      return;
    }

    // Check if clicking on a component
    const clickedComponent = this.findComponentAt(worldPos.x, worldPos.y);

    if (clickedComponent) {
      // Check if clicking on a control first
      if (clickedComponent.handleControlMouseDown(worldPos.x, worldPos.y)) {
        this.interactionMode = InteractionMode.DRAGGING; // Reuse DRAGGING mode for control interaction
        this.draggedComponents = [clickedComponent.id];
        this.dragStartPos = { ...worldPos }; // Set drag start so handleMouseMove works
        return;
      }

      // Check if clicking on a port
      const portInfo = clickedComponent.getPortAt(worldPos.x, worldPos.y);

      if (portInfo) {
        // Start connection from output port or complete connection to input port
        if (!portInfo.isInput) {
          // Starting a connection from output port
          this.interactionMode = InteractionMode.CONNECTING;
          this.connectingFromComponent = clickedComponent.id;
          this.connectingFromPort = portInfo.portId;
          this.connectingPreview = { ...worldPos };
          this.canvas.style.cursor = 'crosshair';
          console.log('🔌 Start connection from', clickedComponent.type, portInfo.portId);
        } else if (this.interactionMode === InteractionMode.CONNECTING) {
          // Complete connection to input port
          if (
            this.connectingFromComponent &&
            this.connectingFromPort
          ) {
            const result = this.connectionManager.createConnection(
              this.connectingFromComponent,
              this.connectingFromPort,
              clickedComponent.id,
              portInfo.portId
            );

            if (result.success) {
              console.log('✅ Connection created successfully');
            } else {
              console.warn('❌ Connection failed:', result.error);
            }

            // Reset connection state
            this.interactionMode = InteractionMode.NONE;
            this.connectingFromComponent = null;
            this.connectingFromPort = null;
            this.connectingPreview = null;
            this.canvas.style.cursor = 'grab';
          }
        }
        return;
      }

      // Not clicking on a port, start dragging component
      this.interactionMode = InteractionMode.DRAGGING;
      this.dragStartPos = { ...worldPos };

      // Handle selection
      if (e.ctrlKey || e.metaKey) {
        // Multi-select with Ctrl/Cmd
        this.selectionManager.toggle(clickedComponent.id);
      } else if (!this.selectionManager.isSelected(clickedComponent.id)) {
        // Single select
        this.selectionManager.clear();
        this.selectionManager.select(clickedComponent.id);
      }

      // Get all selected components for dragging
      this.draggedComponents = this.selectionManager.getSelectedIds();

      // Update visual state
      this.selectionManager.updateComponentsVisualState(this.components);

      // Emit event
      eventBus.emit(EventType.COMPONENT_SELECTED, {
        componentIds: this.draggedComponents,
      });
    } else {
      // Cancel connection if clicking on empty space
      if (this.interactionMode === InteractionMode.CONNECTING) {
        this.interactionMode = InteractionMode.NONE;
        this.connectingFromComponent = null;
        this.connectingFromPort = null;
        this.connectingPreview = null;
        this.canvas.style.cursor = 'grab';
        console.log('Connection cancelled');
        return;
      }

      // Start panning
      this.interactionMode = InteractionMode.PANNING;
      this.canvas.style.cursor = 'grabbing';

      // Clear selection if not holding Ctrl
      if (!e.ctrlKey && !e.metaKey) {
        this.selectionManager.clear();
        this.selectionManager.updateComponentsVisualState(this.components);
        eventBus.emit(EventType.COMPONENT_DESELECTED, {});
      }
    }
  }

  /**
   * Handle mouse move event
   */
  private handleMouseMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = this.viewport.screenToWorld(screenX, screenY);

    if (this.interactionMode === InteractionMode.PANNING && this.lastMousePos) {
      // Pan the viewport
      const dx = screenX - this.lastMousePos.x;
      const dy = screenY - this.lastMousePos.y;
      this.viewport.panBy(dx, dy);

      // Update state manager
      stateManager.setViewport(this.viewport.getState());

      // Update viewport transform for all components
      this.updateComponentViewportTransforms();
    } else if (
      this.interactionMode === InteractionMode.DRAGGING &&
      this.dragStartPos
    ) {
      // Check if we're dragging a control
      if (this.draggedComponents.length === 1) {
        const component = this.components.find((c) => c.id === this.draggedComponents[0]);
        if (component && component.handleControlMouseMove(worldPos.x, worldPos.y)) {
          // Control is being dragged, don't move the component
          this.lastMousePos = { x: screenX, y: screenY };
          return;
        }
      }

      // Drag selected components
      const dx = worldPos.x - this.dragStartPos.x;
      const dy = worldPos.y - this.dragStartPos.y;

      this.draggedComponents.forEach((componentId) => {
        const component = this.components.find((c) => c.id === componentId);
        if (component && this.dragStartPos) {
          component.moveBy(dx, dy);
        }
      });

      this.dragStartPos = { ...worldPos };

      // Update connection positions for moved components
      this.draggedComponents.forEach((componentId) => {
        this.connectionManager.updateConnectionPositions(componentId);
      });

      // Update viewport transform for moved components (important for oscilloscope displays)
      this.updateComponentViewportTransforms();

      // Emit event
      eventBus.emit(EventType.COMPONENT_MOVED, {
        componentIds: this.draggedComponents,
      });
    } else if (this.interactionMode === InteractionMode.CONNECTING) {
      // Update connection preview while dragging cable
      this.connectingPreview = { ...worldPos };
    } else {
      // Update hover state for connections
      this.updateConnectionHover(worldPos.x, worldPos.y);

      // Update cursor
      const component = this.findComponentAt(worldPos.x, worldPos.y);
      if (component) {
        const portInfo = component.getPortAt(worldPos.x, worldPos.y);
        this.canvas.style.cursor = portInfo ? 'crosshair' : 'pointer';
      } else {
        this.canvas.style.cursor = 'grab';
      }
    }

    this.lastMousePos = { x: screenX, y: screenY };
  }

  /**
   * Handle mouse up event
   */
  private handleMouseUp(_e: MouseEvent): void {
    if (this.interactionMode === InteractionMode.DRAGGING) {
      // Release all control mouse ups
      this.components.forEach(component => {
        component.handleControlMouseUp();
      });

      // Snap components to grid if enabled
      if (this.snapToGridEnabled) {
        this.draggedComponents.forEach((componentId) => {
          const component = this.components.find((c) => c.id === componentId);
          if (component) {
            const snappedX = snapToGrid(component.position.x, CANVAS.GRID_SIZE);
            const snappedY = snapToGrid(component.position.y, CANVAS.GRID_SIZE);
            component.moveTo(snappedX, snappedY);
          }
        });

        // Update viewport transform after snapping (important for oscilloscope displays)
        this.updateComponentViewportTransforms();

        // Emit event after snapping
        eventBus.emit(EventType.COMPONENT_MOVED, {
          componentIds: this.draggedComponents,
        });
      }

      // Finished dragging
      this.draggedComponents = [];
      this.dragStartPos = null;

      // Reset mode after dragging
      this.interactionMode = InteractionMode.NONE;
      this.canvas.style.cursor = 'grab';
    }

    // Don't reset mode if we're in CONNECTING mode - need to wait for second click
    if (this.interactionMode === InteractionMode.PANNING) {
      this.interactionMode = InteractionMode.NONE;
      this.canvas.style.cursor = 'grab';
    }
  }

  /**
   * Handle mouse wheel for zooming
   */
  private handleWheel(e: WheelEvent): void {
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const zoomDelta = e.deltaY > 0 ? -CANVAS.ZOOM_STEP : CANVAS.ZOOM_STEP;
    this.viewport.zoomAt(zoomDelta, screenX, screenY);

    // Update state manager
    stateManager.setViewport(this.viewport.getState());

    // Update viewport transform for all components
    this.updateComponentViewportTransforms();
  }

  /**
   * Find component at world coordinates
   */
  private findComponentAt(x: number, y: number): CanvasComponent | null {
    // Iterate in reverse to find topmost component
    for (let i = this.components.length - 1; i >= 0; i--) {
      if (this.components[i]?.containsPoint(x, y)) {
        return this.components[i] ?? null;
      }
    }
    return null;
  }

  /**
   * Update hover state for connections
   */
  private updateConnectionHover(x: number, y: number): void {
    let anyHovered = false;
    this.connections.forEach((connection) => {
      const wasHovered = connection.isHovered;
      connection.isHovered = connection.containsPoint(x, y);
      if (connection.isHovered) {
        anyHovered = true;
      }
      // Only mark as needing redraw if hover state changed
      if (wasHovered !== connection.isHovered) {
        // Could optimize by only redrawing changed connections
      }
    });

    if (anyHovered) {
      this.canvas.style.cursor = 'pointer';
    }
  }

  /**
   * Update viewport transform for all components with embedded displays
   */
  private updateComponentViewportTransforms(): void {
    const zoom = this.viewport.getZoom();
    const pan = this.viewport.getPan();
    this.components.forEach((component) => {
      component.updateViewportTransform(zoom, pan.x, pan.y);
    });
  }

  /**
   * Add a component to the canvas
   */
  addComponent(component: CanvasComponent): void {
    this.components.push(component);
    this.connectionManager.registerComponent(component);

    // Update viewport transform for the new component
    const zoom = this.viewport.getZoom();
    const pan = this.viewport.getPan();
    component.updateViewportTransform(zoom, pan.x, pan.y);
  }

  /**
   * Remove a component from the canvas
   */
  removeComponent(id: string): void {
    // Find component and cleanup before removing
    const component = this.components.find((c) => c.id === id);
    if (component) {
      component.cleanup();
    }

    this.components = this.components.filter((c) => c.id !== id);
    this.selectionManager.deselect(id);
    this.connectionManager.unregisterComponent(id);
  }

  /**
   * Delete selected components
   * Removes components, their connections, and cleans up audio nodes
   */
  deleteSelectedComponents(): void {
    const selectedIds = this.selectionManager.getSelectedIds();

    if (selectedIds.length === 0) {
      console.log('No components selected for deletion');
      return;
    }

    selectedIds.forEach((id) => {
      // Find the component
      const component = this.components.find((c) => c.id === id);
      if (!component) return;

      // Get component name for logging
      const synthComponent = component.getSynthComponent();
      const componentName = synthComponent?.name || 'Unknown';

      // Deactivate and cleanup audio nodes
      if (synthComponent) {
        synthComponent.deactivate();
      }

      // Remove the component from canvas (this also calls connectionManager.unregisterComponent
      // which removes all associated connections)
      this.removeComponent(id);

      console.log(`✓ Deleted component: ${componentName} (${id})`);
    });

    console.log(`Deleted ${selectedIds.length} component(s)`);
  }

  /**
   * Add a connection to the canvas
   */
  addConnection(connection: CanvasConnection): void {
    this.connections.push(connection);
  }

  /**
   * Remove a connection from the canvas
   */
  removeConnection(id: string): void {
    this.connections = this.connections.filter((c) => c.id !== id);
  }

  /**
   * Clear all components and connections
   */
  clear(): void {
    this.components = [];
    this.connections = [];
    this.selectionManager.clear();
    this.connectionManager.clear();
  }

  /**
   * Start the rendering loop
   */
  start(): void {
    if (!this.isRunning) {
      this.isRunning = true;
      this.render();
    }
  }

  /**
   * Stop the rendering loop
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Main render loop
   */
  private render = (): void => {
    if (!this.isRunning) {
      return;
    }

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Save context state
    this.ctx.save();

    // Apply viewport transformations
    this.viewport.applyTransform(this.ctx);

    // Render grid
    if (this.showGrid) {
      this.renderGrid();
    }

    // Render connections from ConnectionManager
    this.connectionManager.render(this.ctx);

    // Render components
    this.components.forEach((component) => component.render(this.ctx));

    // Render connection preview if connecting
    if (
      this.interactionMode === InteractionMode.CONNECTING &&
      this.connectingFromComponent &&
      this.connectingFromPort &&
      this.connectingPreview
    ) {
      this.renderConnectionPreview();
    }

    // Restore context state
    this.ctx.restore();

    // Render UI overlay (not affected by viewport transform)
    this.renderOverlay();

    // Schedule next frame
    this.animationFrameId = requestAnimationFrame(this.render);
  };

  /**
   * Render connection preview cable
   */
  private renderConnectionPreview(): void {
    if (
      !this.connectingFromComponent ||
      !this.connectingFromPort ||
      !this.connectingPreview
    ) {
      return;
    }

    const component = this.components.find(
      (c) => c.id === this.connectingFromComponent
    );
    if (!component) return;

    const startPos = component.getPortPosition(this.connectingFromPort, false);
    if (!startPos) return;

    // Get signal type for color
    const port = component.synthComponent?.outputs.get(this.connectingFromPort);
    const color = port ? this.getColorForSignalType(port.type) : COLORS.AUDIO;

    // Draw bezier curve
    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 3;
    this.ctx.globalAlpha = 0.6;

    const dx = this.connectingPreview.x - startPos.x;
    const controlPoint1X = startPos.x + Math.abs(dx) * 0.5;
    const controlPoint2X = this.connectingPreview.x - Math.abs(dx) * 0.5;

    this.ctx.beginPath();
    this.ctx.moveTo(startPos.x, startPos.y);
    this.ctx.bezierCurveTo(
      controlPoint1X,
      startPos.y,
      controlPoint2X,
      this.connectingPreview.y,
      this.connectingPreview.x,
      this.connectingPreview.y
    );
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * Get color for signal type
   */
  private getColorForSignalType(type: string): string {
    return type === 'audio' ? COLORS.AUDIO : type === 'cv' ? COLORS.CV : COLORS.GATE;
  }

  /**
   * Render grid
   */
  private renderGrid(): void {
    const bounds = this.viewport.getVisibleBounds(
      this.canvas.clientWidth,
      this.canvas.clientHeight
    );

    const gridSize = CANVAS.GRID_SIZE;
    const startX = Math.floor(bounds.x / gridSize) * gridSize;
    const startY = Math.floor(bounds.y / gridSize) * gridSize;
    const endX = Math.ceil((bounds.x + bounds.width) / gridSize) * gridSize;
    const endY = Math.ceil((bounds.y + bounds.height) / gridSize) * gridSize;

    this.ctx.strokeStyle = COLORS.GRID;
    this.ctx.lineWidth = 1 / this.viewport.getZoom();

    this.ctx.beginPath();

    // Vertical lines
    for (let x = startX; x <= endX; x += gridSize) {
      this.ctx.moveTo(x, startY);
      this.ctx.lineTo(x, endY);
    }

    // Horizontal lines
    for (let y = startY; y <= endY; y += gridSize) {
      this.ctx.moveTo(startX, y);
      this.ctx.lineTo(endX, y);
    }

    this.ctx.stroke();
  }

  /**
   * Render overlay information
   */
  private renderOverlay(): void {
    const zoom = Math.round(this.viewport.getZoom() * 100);
    const pan = this.viewport.getPan();
    const snapStatus = this.snapToGridEnabled ? 'ON' : 'OFF';

    const info = document.getElementById('canvas-info');
    if (info) {
      info.textContent = `Zoom: ${zoom}% | Pan: ${Math.round(pan.x)}, ${Math.round(pan.y)} | Snap: ${snapStatus}`;
    }
  }

  /**
   * Toggle grid visibility
   */
  toggleGrid(): void {
    this.showGrid = !this.showGrid;
  }

  /**
   * Toggle snap to grid
   */
  toggleSnapToGrid(): void {
    this.snapToGridEnabled = !this.snapToGridEnabled;
  }

  /**
   * Set snap to grid enabled state
   */
  setSnapToGrid(enabled: boolean): void {
    this.snapToGridEnabled = enabled;
  }

  /**
   * Check if snap to grid is enabled
   */
  isSnapToGridEnabled(): boolean {
    return this.snapToGridEnabled;
  }

  /**
   * Get viewport instance
   */
  getViewport(): Viewport {
    return this.viewport;
  }

  /**
   * Get selection manager instance
   */
  getSelectionManager(): SelectionManager {
    return this.selectionManager;
  }

  /**
   * Handle drag over event (for component drop)
   */
  private handleDragOver(e: DragEvent): void {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }

  /**
   * Handle drop event (create component on canvas)
   */
  private handleDrop(e: DragEvent): void {
    e.preventDefault();

    if (!e.dataTransfer) return;

    const componentType = e.dataTransfer.getData('application/x-component-type');
    if (!componentType) return;

    // Get drop position
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPos = this.viewport.screenToWorld(screenX, screenY);

    // Emit event to create component
    eventBus.emit(EventType.COMPONENT_ADD_REQUESTED, {
      componentType,
      position: worldPos,
    });

    console.log(`📦 Dropped component ${componentType} at (${Math.round(worldPos.x)}, ${Math.round(worldPos.y)})`);
  }

  /**
   * Get connection manager
   */
  getConnectionManager() {
    return this.connectionManager;
  }

  /**
   * Get all components on canvas
   */
  getComponents(): CanvasComponent[] {
    return this.components;
  }
}
