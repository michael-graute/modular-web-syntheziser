import { midiEngine } from '../midi/MidiEngine';
import { eventBus } from '../core/EventBus';
import { EventType } from '../core/types';
import type { MidiMapping } from '../core/types';

export class MidiMappingsModal {
  private overlay: HTMLDivElement;
  private tableBody: HTMLTableSectionElement;
  private emptyMsg: HTMLParagraphElement;
  private unsubMappingsChanged: (() => void) | null = null;
  private isOpen: boolean = false;
  private componentNameResolver: ((id: string) => string) | null = null;

  setComponentNameResolver(fn: (id: string) => string): void {
    this.componentNameResolver = fn;
  }

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'midi-mappings-overlay';
    this.overlay.style.display = 'none';

    const modal = document.createElement('div');
    modal.className = 'midi-mappings-modal';

    const header = document.createElement('div');
    header.className = 'midi-mappings-modal__header';

    const title = document.createElement('h2');
    title.textContent = 'MIDI Mappings';
    title.className = 'midi-mappings-modal__title';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'midi-mappings-modal__close';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', () => this.close());

    header.appendChild(title);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'midi-mappings-modal__body';

    this.emptyMsg = document.createElement('p');
    this.emptyMsg.className = 'midi-mappings-empty';
    this.emptyMsg.textContent = 'No MIDI mappings assigned yet. Use MIDI Learn to map CC knobs to parameters.';

    const table = document.createElement('table');
    table.className = 'midi-mappings-table';

    const thead = document.createElement('thead');
    thead.innerHTML = `<tr>
      <th>Component</th>
      <th>Parameter</th>
      <th>CC</th>
      <th>Channel</th>
      <th></th>
    </tr>`;

    this.tableBody = document.createElement('tbody');
    table.appendChild(thead);
    table.appendChild(this.tableBody);

    body.appendChild(this.emptyMsg);
    body.appendChild(table);

    const footer = document.createElement('div');
    footer.className = 'midi-mappings-modal__footer';

    const clearAllBtn = document.createElement('button');
    clearAllBtn.className = 'midi-mappings-btn midi-mappings-btn--danger';
    clearAllBtn.textContent = 'Clear All';
    clearAllBtn.addEventListener('click', () => {
      if (window.confirm('Remove all MIDI mappings?')) {
        midiEngine.clearAllMappings();
      }
    });

    const closeFooterBtn = document.createElement('button');
    closeFooterBtn.className = 'midi-mappings-btn midi-mappings-btn--secondary';
    closeFooterBtn.textContent = 'Close';
    closeFooterBtn.addEventListener('click', () => this.close());

    footer.appendChild(clearAllBtn);
    footer.appendChild(closeFooterBtn);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    this.overlay.appendChild(modal);

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });
  }

  open(): void {
    if (!this.overlay.parentElement) {
      document.body.appendChild(this.overlay);
    }
    this.overlay.style.display = 'flex';
    this.isOpen = true;
    this.renderTable();

    this.unsubMappingsChanged = eventBus.on(EventType.MIDI_MAPPINGS_CHANGED, () => {
      if (this.isOpen) this.renderTable();
    });
  }

  close(): void {
    this.overlay.style.display = 'none';
    this.isOpen = false;
    this.unsubMappingsChanged?.();
    this.unsubMappingsChanged = null;
  }

  private resolveComponentLabel(mappings: MidiMapping[]): Map<string, string> {
    const nameCount = new Map<string, number>();
    const idToName = new Map<string, string>();

    for (const m of mappings) {
      if (!idToName.has(m.componentId)) {
        const name = this.componentNameResolver
          ? this.componentNameResolver(m.componentId)
          : m.componentId;
        idToName.set(m.componentId, name);
        nameCount.set(name, (nameCount.get(name) ?? 0) + 1);
      }
    }

    // For names that appear more than once, append a per-name counter
    const nameIndex = new Map<string, number>();
    const labels = new Map<string, string>();
    for (const [id, name] of idToName) {
      if ((nameCount.get(name) ?? 1) > 1) {
        const idx = (nameIndex.get(name) ?? 0) + 1;
        nameIndex.set(name, idx);
        labels.set(id, `${name} (${idx})`);
      } else {
        labels.set(id, name);
      }
    }
    return labels;
  }

  private renderTable(): void {
    const mappings = midiEngine.getMappings();
    this.tableBody.innerHTML = '';

    if (mappings.length === 0) {
      this.emptyMsg.style.display = '';
      (this.tableBody.closest('table') as HTMLTableElement).style.display = 'none';
    } else {
      this.emptyMsg.style.display = 'none';
      (this.tableBody.closest('table') as HTMLTableElement).style.display = '';

      const componentLabels = this.resolveComponentLabel(mappings);

      mappings.forEach((m: MidiMapping) => {
        const row = document.createElement('tr');

        const channelLabel = m.channel === 0 ? 'Any' : String(m.channel);
        const componentLabel = componentLabels.get(m.componentId) ?? m.componentId;

        row.innerHTML = `
          <td>${this.escapeHtml(componentLabel)}</td>
          <td>${this.escapeHtml(m.parameterName)}</td>
          <td>${m.cc}</td>
          <td>${channelLabel}</td>
          <td></td>
        `;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'midi-mappings-btn midi-mappings-btn--danger midi-mappings-btn--small';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => {
          midiEngine.removeMapping(m.componentId, m.parameterName);
        });
        row.querySelector('td:last-child')!.appendChild(deleteBtn);

        this.tableBody.appendChild(row);
      });
    }
  }

  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
