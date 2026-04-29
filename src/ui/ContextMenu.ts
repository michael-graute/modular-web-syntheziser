import { eventBus } from '../core/EventBus';
import { EventType } from '../core/types';

/**
 * Touch long-press context menu — shown by Canvas on COMPONENT_LONG_PRESS event.
 * Provides a "Delete" action for the component under the press point.
 */
export class ContextMenu {
  private el: HTMLDivElement | null = null;
  private dismissHandler: ((e: PointerEvent) => void) | null = null;

  constructor() {
    eventBus.on(EventType.COMPONENT_LONG_PRESS, (data: any) => {
      this.show(data.componentId as string, data.screenX as number, data.screenY as number);
    });
  }

  show(componentId: string, x: number, y: number): void {
    this.hide();

    const menu = document.createElement('div');
    menu.id = 'context-menu';
    menu.setAttribute('role', 'menu');

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'context-menu-item';
    deleteBtn.setAttribute('role', 'menuitem');
    deleteBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      eventBus.emit(EventType.COMPONENT_REMOVED, { componentId });
      this.hide();
    });

    menu.appendChild(deleteBtn);

    // Position within viewport bounds
    document.getElementById('app')?.appendChild(menu);
    this.el = menu;

    const menuRect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    menu.style.left = `${Math.min(x, vw - menuRect.width - 8)}px`;
    menu.style.top = `${Math.min(y, vh - menuRect.height - 8)}px`;

    // One-shot dismiss on outside tap
    this.dismissHandler = (e: PointerEvent) => {
      if (!this.el?.contains(e.target as Node)) {
        this.hide();
      }
    };
    // Defer so the current pointerdown doesn't immediately dismiss
    setTimeout(() => {
      document.addEventListener('pointerdown', this.dismissHandler!, { once: true });
    }, 0);
  }

  hide(): void {
    if (this.dismissHandler) {
      document.removeEventListener('pointerdown', this.dismissHandler);
      this.dismissHandler = null;
    }
    this.el?.remove();
    this.el = null;
  }
}
