/**
 * Notes - Free-text documentation component (feature 036)
 *
 * The first component with no ports, no parameters, and no audio nodes.
 * All audio lifecycle methods are no-ops; text state is edited via a
 * native <textarea> overlay (NotesDisplay) and persisted with the patch.
 */

import { SynthComponent } from '../base/SynthComponent';
import { ComponentType, Position, ComponentData } from '../../core/types';
import { clampText, shouldSerializeText } from '../../../specs/036-notes-component/contracts/validation';

export class Notes extends SynthComponent {
  private _text: string = '';
  private _width: number | undefined;
  private _height: number | undefined;

  constructor(id: string, position: Position) {
    super(id, ComponentType.NOTES, 'Notes', position);
    // No addInput / addOutput / addParameter calls — Notes has none.
  }

  // ---------------------------------------------------------------------------
  // SynthComponent abstract methods — no audio role
  // ---------------------------------------------------------------------------

  createAudioNodes(): void {
    // no-op — Notes has no audio role
  }

  destroyAudioNodes(): void {
    // no-op — Notes has no audio role
  }

  updateAudioParameter(): void {
    // no-op — Notes has no parameters
  }

  getInputNode(): AudioNode | null {
    return null;
  }

  getOutputNode(): AudioNode | null {
    return null;
  }

  // ---------------------------------------------------------------------------
  // Text state
  // ---------------------------------------------------------------------------

  setText(text: string): void {
    this._text = clampText(text);
  }

  getText(): string {
    return this._text;
  }

  // ---------------------------------------------------------------------------
  // Size state (feature 037)
  // ---------------------------------------------------------------------------

  setSize(width: number, height: number): void {
    this._width = width;
    this._height = height;
  }

  getSize(): { width: number; height: number } | null {
    if (this._width === undefined || this._height === undefined) return null;
    return { width: this._width, height: this._height };
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  override serialize(): ComponentData {
    const base = super.serialize();
    if (shouldSerializeText(this._text)) {
      base.text = this._text;
    }
    if (this._width !== undefined && this._height !== undefined) {
      base.width = this._width;
      base.height = this._height;
    }
    return base;
  }

  override deserialize(data: ComponentData): void {
    super.deserialize(data);
    this._text = data.text ?? '';
    if (data.width !== undefined && data.height !== undefined) {
      this.setSize(data.width, data.height);
    }
  }
}
