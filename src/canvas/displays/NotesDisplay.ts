/**
 * NotesDisplay - Overlay <textarea> for the Notes component (feature 036)
 *
 * Unlike every other overlay display in this project, this wraps a native
 * HTMLTextAreaElement rather than a <canvas>. There is no render loop and
 * no 2D rendering context — native text editing (cursor, selection,
 * copy/paste, undo, IME) comes for free from the DOM.
 */

import { NOTES } from '../../../specs/036-notes-component/contracts/types';

export class NotesDisplay {
  private textarea: HTMLTextAreaElement;
  private baseX: number;
  private baseY: number;

  constructor(x: number, y: number, w: number, h: number) {
    this.baseX = x;
    this.baseY = y;

    this.textarea = document.createElement('textarea');
    this.textarea.placeholder = NOTES.PLACEHOLDER;
    this.textarea.maxLength = NOTES.MAX_TEXT_LENGTH;

    this.textarea.style.position = 'absolute';
    this.textarea.style.left = `${x}px`;
    this.textarea.style.top = `${y}px`;
    this.textarea.style.width = `${w}px`;
    this.textarea.style.height = `${h}px`;
    this.textarea.style.pointerEvents = 'auto';
    this.textarea.style.transformOrigin = '0 0';
    this.textarea.style.zIndex = '100';
    this.textarea.style.boxSizing = 'border-box';
    this.textarea.style.resize = 'none';
    this.textarea.style.background = '#1a1a1a';
    this.textarea.style.color = '#e0e0e0';
    this.textarea.style.border = '1px solid #333';
    this.textarea.style.borderRadius = '4px';
    this.textarea.style.padding = '8px';
    this.textarea.style.font = '13px -apple-system, sans-serif';
    this.textarea.style.outline = 'none';
  }

  getElement(): HTMLTextAreaElement {
    return this.textarea;
  }

  updatePosition(x: number, y: number): void {
    this.baseX = x;
    this.baseY = y;
    this.textarea.style.left = `${x}px`;
    this.textarea.style.top = `${y}px`;
  }

  updateViewportTransform(zoom: number, panX: number, panY: number): void {
    const screenX = this.baseX * zoom + panX;
    const screenY = this.baseY * zoom + panY;
    this.textarea.style.left = `${screenX}px`;
    this.textarea.style.top = `${screenY}px`;
    this.textarea.style.transform = `scale(${zoom})`;
  }

  setValue(text: string): void {
    this.textarea.value = text;
  }

  onInput(callback: (text: string) => void): void {
    this.textarea.addEventListener('input', () => {
      callback(this.textarea.value);
    });
  }

  destroy(): void {
    if (this.textarea.parentElement) {
      this.textarea.parentElement.removeChild(this.textarea);
    }
  }
}
