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
  // Serialization
  // ---------------------------------------------------------------------------

  override serialize(): ComponentData {
    const base = super.serialize();
    if (shouldSerializeText(this._text)) {
      base.text = this._text;
    }
    return base;
  }

  override deserialize(data: ComponentData): void {
    super.deserialize(data);
    this._text = data.text ?? '';
  }
}
