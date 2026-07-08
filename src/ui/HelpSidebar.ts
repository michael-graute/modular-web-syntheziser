/**
 * HelpSidebar - Resizable sidebar for displaying help and user manual
 */

/**
 * Sidebar for displaying help documentation
 */
export class HelpSidebar {
  private container: HTMLDivElement;
  private resizeHandle: HTMLDivElement;
  private navContainer: HTMLDivElement;
  private contentContainer: HTMLDivElement;
  private closeButton: HTMLButtonElement;
  private currentSection: string;
  private isVisible: boolean;
  private isResizing: boolean;
  private startX: number;
  private startWidth: number;

  constructor() {
    this.currentSection = 'quickstart';
    this.isVisible = false;
    this.isResizing = false;
    this.startX = 0;
    this.startWidth = 0;

    this.container = this.createContainer();
    this.resizeHandle = this.createResizeHandle();
    this.navContainer = this.createNavigation();
    this.contentContainer = this.createContentArea();
    this.closeButton = this.createCloseButton();

    this.setupStructure();
    this.setupEventListeners();
  }

  /**
   * Create main container
   */
  private createContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'help-sidebar';
    container.style.cssText = `
      position: fixed;
      top: 0;
      right: -600px;
      width: 600px;
      height: 100vh;
      background: var(--bg-primary, #2a2a2a);
      border-left: 1px solid var(--border-color, #444);
      display: flex;
      flex-direction: column;
      z-index: 9999;
      transition: right 0.3s ease;
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
    `;
    return container;
  }

  /**
   * Create resize handle
   */
  private createResizeHandle(): HTMLDivElement {
    const handle = document.createElement('div');
    handle.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 5px;
      height: 100%;
      cursor: ew-resize;
      background: transparent;
      z-index: 10;
    `;

    handle.addEventListener('mouseenter', () => {
      handle.style.background = 'var(--accent-color, #0066cc)';
    });

    handle.addEventListener('mouseleave', () => {
      if (!this.isResizing) {
        handle.style.background = 'transparent';
      }
    });

    return handle;
  }

  /**
   * Create close button
   */
  private createCloseButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.innerHTML = '&times;';
    button.setAttribute('aria-label', 'Close');
    button.style.cssText = `
      position: absolute;
      top: 16px;
      right: 16px;
      background: none;
      border: none;
      color: var(--text-secondary, #aaa);
      font-size: 2rem;
      line-height: 1;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: all 0.2s;
      z-index: 11;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.background = 'var(--bg-hover, #3a3a3a)';
      button.style.color = 'var(--text-primary, #ffffff)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = 'none';
      button.style.color = 'var(--text-secondary, #aaa)';
    });

    button.addEventListener('click', () => this.close());

    return button;
  }

  /**
   * Setup sidebar structure
   */
  private setupStructure(): void {
    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 20px;
      border-bottom: 1px solid var(--border-color, #444);
      flex-shrink: 0;
      position: relative;
    `;

    const title = document.createElement('h2');
    title.textContent = 'Help & User Manual';
    title.style.cssText = `
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-primary, #ffffff);
    `;

    header.appendChild(title);
    header.appendChild(this.closeButton);

    // Create body with navigation and content
    const body = document.createElement('div');
    body.style.cssText = `
      display: flex;
      flex: 1;
      overflow: hidden;
    `;

    body.appendChild(this.navContainer);
    body.appendChild(this.contentContainer);

    // Assemble
    this.container.appendChild(this.resizeHandle);
    this.container.appendChild(header);
    this.container.appendChild(body);

    // Add to DOM
    document.body.appendChild(this.container);
  }

  /**
   * Create navigation sidebar
   */
  private createNavigation(): HTMLDivElement {
    const nav = document.createElement('div');
    nav.style.cssText = `
      width: 200px;
      background: var(--bg-secondary, #1a1a1a);
      border-right: 1px solid var(--border-color, #444);
      padding: 20px;
      overflow-y: auto;
      flex-shrink: 0;
    `;

    const sections = [
      { id: 'quickstart', label: 'Quickstart' },
      { id: 'interface', label: 'Interface' },
      { id: 'components', label: 'Components' },
      { id: 'connections', label: 'Connections' },
      { id: 'keyboard', label: 'Keyboard' },
      { id: 'midi', label: 'MIDI' },
      { id: 'patches', label: 'Patches' },
      { id: 'shortcuts', label: 'Shortcuts' },
      { id: 'tips', label: 'Tips & Tricks' },
      { id: 'polyphony', label: 'Polyphony' },
      { id: 'guided-lessons', label: 'Guided Lessons' },
    ];

    sections.forEach(section => {
      const button = document.createElement('button');
      button.textContent = section.label;
      button.dataset.section = section.id;
      button.style.cssText = `
        display: block;
        width: 100%;
        text-align: left;
        padding: 10px;
        margin-bottom: 5px;
        background: ${this.currentSection === section.id ? 'var(--accent-color, #0066cc)' : 'transparent'};
        border: none;
        border-radius: 4px;
        color: var(--text-primary, #ffffff);
        cursor: pointer;
        font-size: 0.875rem;
        transition: background 0.2s;
      `;

      button.addEventListener('click', () => {
        this.currentSection = section.id;
        this.updateContent();
      });

      button.addEventListener('mouseenter', () => {
        if (this.currentSection !== section.id) {
          button.style.background = 'var(--bg-hover, #2a2a2a)';
        }
      });

      button.addEventListener('mouseleave', () => {
        if (this.currentSection !== section.id) {
          button.style.background = 'transparent';
        }
      });

      nav.appendChild(button);
    });

    return nav;
  }

  /**
   * Create content area
   */
  private createContentArea(): HTMLDivElement {
    const content = document.createElement('div');
    content.id = 'help-sidebar-content';
    content.style.cssText = `
      flex: 1;
      padding: 20px 30px;
      overflow-y: auto;
      line-height: 1.6;
    `;

    // Add styles for lists
    const style = document.createElement('style');
    style.textContent = `
      #help-sidebar-content ul,
      #help-sidebar-content ol {
        padding-left: 24px;
        margin: 8px 0;
      }
      #help-sidebar-content li {
        margin-bottom: 4px;
      }
    `;
    document.head.appendChild(style);

    // Add initial content
    content.innerHTML = this.getContentForSection(this.currentSection);

    return content;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Resize functionality
    this.resizeHandle.addEventListener('mousedown', (e) => {
      this.isResizing = true;
      this.startX = e.clientX;
      this.startWidth = this.container.offsetWidth;
      this.resizeHandle.style.background = 'var(--accent-color, #0066cc)';
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isResizing) return;

      const deltaX = this.startX - e.clientX;
      const newWidth = Math.min(Math.max(400, this.startWidth + deltaX), window.innerWidth - 100);

      this.container.style.width = `${newWidth}px`;
      if (this.isVisible) {
        this.container.style.right = '0';
      }
    });

    document.addEventListener('mouseup', () => {
      if (this.isResizing) {
        this.isResizing = false;
        this.resizeHandle.style.background = 'transparent';
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.close();
      }
    });
  }

  /**
   * Update content when section changes
   */
  private updateContent(): void {
    this.contentContainer.innerHTML = this.getContentForSection(this.currentSection);

    // Update navigation button states
    const buttons = this.navContainer.querySelectorAll('button');
    buttons.forEach((button) => {
      const section = (button as HTMLElement).dataset.section;
      if (section === this.currentSection) {
        (button as HTMLElement).style.background = 'var(--accent-color, #0066cc)';
      } else {
        (button as HTMLElement).style.background = 'transparent';
      }
    });
  }

  /**
   * Open the sidebar
   */
  open(): void {
    if (this.isVisible) return;

    this.isVisible = true;
    this.container.style.right = '0';
  }

  /**
   * Close the sidebar
   */
  close(): void {
    if (!this.isVisible) return;

    this.isVisible = false;
    this.container.style.right = `-${this.container.offsetWidth}px`;
  }

  /**
   * Toggle sidebar visibility
   */
  toggle(): void {
    if (this.isVisible) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Get content HTML for a specific section
   */
  private getContentForSection(section: string): string {
    switch (section) {
      case 'quickstart':
        return this.getQuickstartContent();
      case 'interface':
        return this.getInterfaceContent();
      case 'components':
        return this.getComponentsContent();
      case 'connections':
        return this.getConnectionsContent();
      case 'keyboard':
        return this.getKeyboardContent();
      case 'midi':
        return this.getMidiContent();
      case 'patches':
        return this.getPatchesContent();
      case 'shortcuts':
        return this.getShortcutsContent();
      case 'tips':
        return this.getTipsContent();
      case 'polyphony':
        return this.getPolyphonyContent();
      case 'guided-lessons':
        return this.getGuidedLessonsContent();
      default:
        return '<h2>Section not found</h2>';
    }
  }

  /**
   * Quickstart section content
   */
  private getQuickstartContent(): string {
    return `
      <h2 style="margin-top: 0; color: var(--text-primary, #ffffff);">Quickstart Guide</h2>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Getting Started in 5 Minutes</h3>

      <ol style="color: var(--text-secondary, #cccccc);">
        <li style="margin-bottom: 12px;">
          <strong style="color: var(--text-primary, #ffffff);">Enable Audio:</strong>
          Click anywhere on the page to activate the audio context.
        </li>

        <li style="margin-bottom: 12px;">
          <strong style="color: var(--text-primary, #ffffff);">Load a Factory Preset:</strong>
          Click on "Load" in the Top Menu, then select "Factory" and load a preset by clicking it.
        </li>

        <li style="margin-bottom: 12px;">
          <strong style="color: var(--text-primary, #ffffff);">OR:</strong>
        </li>

        <li style="margin-bottom: 12px;">
          <strong style="color: var(--text-primary, #ffffff);">Add Components:</strong>
          Drag components from the left sidebar onto the canvas (e.g., Keyboard, Oscillator, Filter, Master Output).
        </li>

        <li style="margin-bottom: 12px;">
          <strong style="color: var(--text-primary, #ffffff);">Make Connections:</strong>
          Click on an output port (right side, circle) and then click on an input port (left side, circle) to create a connection.
          <ul style="margin-top: 8px;">
            <li>Green cables = Audio signals</li>
            <li>Blue cables = CV (Control Voltage) signals</li>
            <li>Red cables = Gate signals</li>
          </ul>
        </li>

        <li style="margin-bottom: 12px;">
          <strong style="color: var(--text-primary, #ffffff);">Adjust Parameters:</strong>
          Click and drag knobs or sliders to change values. Click dropdowns to select options.
        </li>

        <li style="margin-bottom: 12px;">
          <strong style="color: var(--text-primary, #ffffff);">Play:</strong>
          Use the keyboard at the bottom to play notes, or use your computer keyboard (A-L keys for white keys, W-O for black keys).
        </li>
      </ol>

      <div style="background: var(--bg-secondary, #1a1a1a); padding: 16px; border-radius: 8px; border-left: 4px solid var(--accent-color, #0066cc); margin-top: 24px;">
        <h4 style="margin-top: 0; color: var(--text-primary, #ffffff);">Basic Patch Example</h4>
        <p style="color: var(--text-secondary, #cccccc); margin-bottom: 8px;">Try this simple setup:</p>
        <ol style="color: var(--text-secondary, #cccccc); margin: 0;">
          <li>Add: Keyboard → Oscillator → ADSR → VCA → Master Output</li>
          <li>Connect: Keyboard Frequency → Oscillator Frequency CV</li>
          <li>Connect: Keyboard Gate → ADSR Gate In</li>
          <li>Connect: ADSR CV Out → VCA CV In/li>
          <li>Connect Oscillator Audio Out → VCA Audio In</li>
          <li>Connect: VCA Audio Out → Master Output Audio In</li>
          <li>Play notes on the keyboard!</li>
        </ol>
      </div>
    `;
  }

  /**
   * Interface section content
   */
  private getInterfaceContent(): string {
    return `
      <h2 style="margin-top: 0; color: var(--text-primary, #ffffff);">Interface Overview</h2>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Top Bar</h3>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong style="color: var(--text-primary, #ffffff);">Patch Name:</strong> Shows and edits the current patch name</li>
        <li><strong style="color: var(--text-primary, #ffffff);">New:</strong> Clear the canvas and start a new patch</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Save:</strong> Save the current patch to browser storage</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Load:</strong> Load a previously saved patch</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Export:</strong> Export patch as JSON file</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Import:</strong> Import a patch from JSON file</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Help:</strong> Open this help dialog</li>
      </ul>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Global BPM</h3>
      <p style="color: var(--text-secondary, #cccccc);">
        A single tempo control in the top bar that all tempo-aware components follow by default.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong style="color: var(--text-primary, #ffffff);">Range:</strong> 30–300 BPM (default 120)</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Global follow:</strong> Step Sequencer, Collider, and Looper adopt the global BPM automatically</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Local override:</strong> Individual components can be switched to a local BPM value that ignores the global setting</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Persisted:</strong> The global BPM and each component's mode (global / local) are saved and restored with the patch</li>
      </ul>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Global Transport</h3>
      <p style="color: var(--text-secondary, #cccccc);">
        A Play / Stop toggle in the top bar that starts and stops all transport-aware components simultaneously.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong style="color: var(--text-primary, #ffffff);">▶ Play:</strong> Starts the Step Sequencer and resumes any recorded Looper loop</li>
        <li><strong style="color: var(--text-primary, #ffffff);">■ Stop:</strong> Halts the Step Sequencer and Looper playback (recorded Looper buffer is preserved)</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Position display:</strong> Shows the current bar and beat (e.g. "3.2" = bar 3, beat 2) while transport is running; resets to "1.1" on Stop</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Beat clock:</strong> Fires a beat event on every beat — future components such as a metronome can subscribe without polling</li>
        <li><strong style="color: var(--text-primary, #ffffff);">BPM changes while playing:</strong> The beat rate adjusts immediately without restarting transport</li>
      </ul>
      <div style="background: var(--bg-secondary, #1a1a1a); padding: 12px 16px; border-radius: 8px; border-left: 4px solid var(--accent-color, #0066cc); margin-top: 8px;">
        <p style="color: var(--text-secondary, #cccccc); margin: 0;">
          <strong style="color: var(--text-primary, #ffffff);">Note:</strong> Transport does not pause mid-position — pressing Stop always resets to bar 1, beat 1.
          Time signature is fixed at 4/4. Looper recording must be triggered manually; pressing Play does not start recording.
        </p>
      </div>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Component Library (Left Sidebar)</h3>
      <p style="color: var(--text-secondary, #cccccc);">
        Browse and drag components onto the canvas. Components are organized into categories:
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong style="color: var(--text-primary, #ffffff);">Generators:</strong> Oscillator, FM Oscillator, LFO, Noise, Karplus-Strong</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Processors:</strong> Filters, VCA, Envelopes</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Effects:</strong> Delay, Reverb, Distortion, Chorus, Bitcrusher, Flanger, Phaser, Tremolo, Ring Modulator</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Utilities:</strong> Keyboard, Mixer, Sequencer, Arpeggiator, Slew Limiter</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Analyzers:</strong> Oscilloscope, VU Meter, Env Follower</li>
      </ul>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Canvas Area</h3>
      <p style="color: var(--text-secondary, #cccccc);">
        The main workspace where you build your synthesizer patches:
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li>Drag the background to pan around</li>
        <li>Scroll wheel to zoom in/out</li>
        <li>Grid helps align components (toggle with ~ key)</li>
        <li>Bottom right shows zoom level, pan position, and snap status</li>
      </ul>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Keyboard Section</h3>
      <p style="color: var(--text-secondary, #cccccc);">
        Interactive piano keyboard for playing notes:
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li>Click keys with mouse</li>
        <li>Use computer keyboard keys</li>
        <li>Octave +/- buttons to change octave</li>
        <li>Panic button to stop all notes</li>
      </ul>
    `;
  }

  /**
   * Components section content
   */
  private getComponentsContent(): string {
    return `
      <h2 style="margin-top: 0; color: var(--text-primary, #ffffff);">Component Reference</h2>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Generators</h3>

      <h4 style="color: var(--text-primary, #ffffff);">Oscillator</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Generates audio waveforms at a specified frequency.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Waveform:</strong> Sine, Square, Sawtooth, Triangle</li>
        <li><strong>Frequency:</strong> Base frequency (Hz)</li>
        <li><strong>Detune:</strong> Fine tuning in cents</li>
        <li><strong>Inputs:</strong> Frequency CV, Detune CV, Gate</li>
        <li><strong>Output:</strong> Audio signal</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">FM Oscillator</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Generates audio waveforms whose frequency is modulated by an incoming audio signal — the foundation of FM (Frequency Modulation) synthesis. Produces bell-like, metallic, and complex harmonic timbres not achievable with a standard oscillator alone.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Waveform:</strong> Sine, Square, Sawtooth, Triangle (carrier waveform)</li>
        <li><strong>Frequency:</strong> Base carrier frequency (Hz)</li>
        <li><strong>Detune:</strong> Fine tuning in cents</li>
        <li><strong>FM Depth:</strong> Modulation intensity — frequency deviation range (0–1000 Hz). At 0 the output is identical to a plain oscillator; higher values add more harmonic richness.</li>
        <li><strong>Inputs:</strong> Frequency CV, Detune CV, FM Input (audio)</li>
        <li><strong>Output:</strong> Audio signal</li>
      </ul>
      <div style="background: var(--bg-secondary, #1a1a1a); padding: 12px 16px; border-radius: 8px; border-left: 4px solid var(--accent-color, #0066cc); margin: 8px 0 16px;">
        <p style="color: var(--text-secondary, #cccccc); margin: 0 0 6px;">
          <strong style="color: var(--text-primary, #ffffff);">Basic FM patch:</strong>
        </p>
        <ol style="color: var(--text-secondary, #cccccc); margin: 0; padding-left: 18px;">
          <li>Add an FM Oscillator (carrier) — set Frequency to 440 Hz</li>
          <li>Add a standard Oscillator (modulator) — set Frequency to 220 Hz</li>
          <li>Connect modulator <strong>Audio Out → FM Oscillator FM Input</strong></li>
          <li>Connect FM Oscillator <strong>Audio Out → Master Output</strong></li>
          <li>Adjust <strong>FM Depth</strong> to change the timbre</li>
        </ol>
      </div>

      <h4 style="color: var(--text-primary, #ffffff);">LFO (Low Frequency Oscillator)</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Generates slow modulation signals for controlling other parameters.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Waveform:</strong> Sine, Square, Sawtooth, Triangle</li>
        <li><strong>Rate:</strong> Oscillation speed (Hz)</li>
        <li><strong>Depth:</strong> Modulation amount</li>
        <li><strong>Output:</strong> CV signal</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">Noise Generator</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Generates random noise signals.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Type:</strong> White, Pink</li>
        <li><strong>Amplitude:</strong> Output level</li>
        <li><strong>Output:</strong> Audio signal</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">Karplus-Strong</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Algorithmic plucked-string / percussive synthesizer using the classic Karplus-Strong
        delay-line-with-feedback-filter technique. Triggered like an envelope (Gate In re-excites
        the string) and tracks pitch via 1V/octave CV, producing a naturally decaying tone without
        needing a separate ADSR to shape amplitude.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Trigger:</strong> Gate input — each rising edge re-excites ("plucks") the string</li>
        <li><strong>Pitch CV:</strong> 1V/octave pitch input — connect a Keyboard, Quantizer, or Sequencer CV output</li>
        <li><strong>Frequency:</strong> Manual base pitch (0–4000 Hz). Acts as the pitch when no CV is connected, or as a transpose offset on top of the CV note when CV is connected — set to 0 for the CV to drive pitch directly with no offset</li>
        <li><strong>Damping:</strong> Decay/sustain length — short percussive pluck at low values, several seconds of ring at high values</li>
        <li><strong>Tone:</strong> Pick-position brightness of the initial pluck — dull/warm at low values, bright/metallic at high values</li>
        <li><strong>Mode:</strong> Decay-algorithm character —
          <strong>String</strong> (clean natural harmonic decay),
          <strong>Stretched</strong> (longer sustain, rougher/percussive, good for toms/drums),
          <strong>Muted</strong> (dull, quickly-damped harmonics — palm-mute character),
          or <strong>Metallic</strong> (inharmonic partials — bell/kalimba-like timbre)
        </li>
        <li><strong>Output:</strong> Audio signal</li>
      </ul>
      <div style="background: var(--bg-secondary, #1a1a1a); padding: 12px 16px; border-radius: 8px; border-left: 4px solid var(--accent-color, #0066cc); margin: 8px 0 16px;">
        <p style="color: var(--text-secondary, #cccccc); margin: 0 0 6px;">
          <strong style="color: var(--text-primary, #ffffff);">Typical patch:</strong>
        </p>
        <ol style="color: var(--text-secondary, #cccccc); margin: 0; padding-left: 18px;">
          <li>Keyboard <strong>Gate → Karplus-Strong Trigger</strong></li>
          <li>Keyboard <strong>Frequency → Karplus-Strong Pitch CV</strong>, and set the Frequency knob to 0</li>
          <li>Karplus-Strong <strong>Audio Out → Master Output</strong></li>
          <li>Play notes on the keyboard — each press plucks a decaying string tone</li>
        </ol>
      </div>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Processors</h3>

      <h4 style="color: var(--text-primary, #ffffff);">Filter</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Shapes the frequency content of audio signals.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Type:</strong> Lowpass, Highpass, Bandpass, Notch</li>
        <li><strong>Cutoff:</strong> Filter frequency (Hz)</li>
        <li><strong>Resonance:</strong> Emphasis at cutoff frequency</li>
        <li><strong>Inputs:</strong> Audio in, Cutoff CV, Resonance CV</li>
        <li><strong>Output:</strong> Filtered audio signal</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">VCA (Voltage Controlled Amplifier)</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Controls the volume/amplitude of audio signals.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Gain:</strong> Output level (0-1)</li>
        <li><strong>Inputs:</strong> Audio in, CV (for envelopes)</li>
        <li><strong>Output:</strong> Amplified audio signal</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">ADSR Envelope</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Generates envelope curves for shaping sound over time.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Attack:</strong> Rise time (0-2s)</li>
        <li><strong>Decay:</strong> Fall time to sustain (0-2s)</li>
        <li><strong>Sustain:</strong> Hold level (0-1)</li>
        <li><strong>Release:</strong> Fall time after note off (0-5s)</li>
        <li><strong>Input:</strong> Gate trigger</li>
        <li><strong>Output:</strong> CV envelope signal</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">Parametric EQ</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Shapes the tone of audio signals with three independent frequency bands:
        a low shelf, a parametric mid peak, and a high shelf.
        All three gain inputs accept CV modulation for animated, LFO-driven timbres.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Low Gain:</strong> Boost or cut below the low shelf corner (−18 to +18 dB)</li>
        <li><strong>Low Freq:</strong> Low shelf corner frequency (20–800 Hz, default 80 Hz)</li>
        <li><strong>Mid Gain:</strong> Boost or cut around the mid peak center (−18 to +18 dB)</li>
        <li><strong>Mid Freq:</strong> Mid peak center frequency (200–8000 Hz, default 1000 Hz)</li>
        <li><strong>Mid Q:</strong> Mid peak bandwidth — higher Q = narrower band (0.1–10)</li>
        <li><strong>High Gain:</strong> Boost or cut above the high shelf corner (−18 to +18 dB)</li>
        <li><strong>High Freq:</strong> High shelf corner frequency (1000–20000 Hz, default 8000 Hz)</li>
        <li><strong>Inputs:</strong> Audio In, Low Gain CV, Mid Gain CV, High Gain CV</li>
        <li><strong>Output:</strong> Processed audio signal</li>
        <li><strong>CV scaling:</strong> 1V = 1 dB — additive with the knob value, clamped to ±18 dB</li>
      </ul>
      <p style="color: var(--text-secondary, #cccccc);">
        <strong style="color: var(--text-primary, #ffffff);">Typical patch:</strong>
        Oscillator → Parametric EQ → Master Out. Boost the low shelf for warmth,
        cut the mid peak to remove harshness, roll off the high shelf to soften brightness.
        Connect an LFO to Low Gain CV for a rhythmic bass-pump effect.
      </p>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Effects</h3>

      <h4 style="color: var(--text-primary, #ffffff);">Delay</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Creates echo effects by repeating the input signal.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Time:</strong> Delay time (ms)</li>
        <li><strong>Feedback:</strong> Number of repeats</li>
        <li><strong>Mix:</strong> Dry/wet balance</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">Reverb</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Simulates acoustic space and reflections.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Room Size:</strong> Space dimensions</li>
        <li><strong>Decay:</strong> Tail length</li>
        <li><strong>Mix:</strong> Dry/wet balance</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">Distortion</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Adds harmonic saturation and grit.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Drive:</strong> Amount of distortion</li>
        <li><strong>Tone:</strong> Frequency shaping</li>
        <li><strong>Mix:</strong> Dry/wet balance</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">Chorus</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Creates thickness by detuning copies of the signal.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Rate:</strong> Modulation speed</li>
        <li><strong>Depth:</strong> Modulation amount</li>
        <li><strong>Mix:</strong> Dry/wet balance</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">Bitcrusher</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Adds lo-fi digital grit by reducing bit depth and sample rate.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Bit Depth:</strong> 1–16 bits (lower = more distortion)</li>
        <li><strong>Sample Rate:</strong> Reduction percentage (lower = more aliasing)</li>
        <li><strong>Mix:</strong> Dry/wet balance</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">Flanger</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Creates a sweeping jet-like effect using a modulated short delay.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Rate:</strong> Modulation speed (0.1–20 Hz)</li>
        <li><strong>Depth:</strong> Modulation amount</li>
        <li><strong>Feedback:</strong> Resonance intensity (0–95%)</li>
        <li><strong>Mix:</strong> Dry/wet balance</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">Phaser</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Adds a sweeping phase-shift character using all-pass filter stages.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Rate:</strong> Modulation speed (0.1–20 Hz)</li>
        <li><strong>Depth:</strong> Sweep amount</li>
        <li><strong>Feedback:</strong> Resonance intensity (0–95%)</li>
        <li><strong>Stages:</strong> Filter stages (2, 4, 6, or 8)</li>
        <li><strong>Mix:</strong> Dry/wet balance</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">Tremolo</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Creates rhythmic volume pulsing via amplitude modulation.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Rate:</strong> Modulation speed (0.1–20 Hz)</li>
        <li><strong>Depth:</strong> Volume swing amount</li>
        <li><strong>Mix:</strong> Dry/wet balance</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">Ring Modulator</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Multiplies two audio signals to produce sum and difference frequencies — classic metallic, bell-like, and robotic timbres.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Audio In:</strong> Carrier signal input</li>
        <li><strong>Modulator In:</strong> Modulator signal input (another oscillator or LFO)</li>
        <li><strong>Output:</strong> Ring-modulated result; silent when modulator is disconnected</li>
        <li><strong>Bypass:</strong> Routes carrier directly to output, bypassing multiplication</li>
      </ul>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Utilities</h3>

      <h4 style="color: var(--text-primary, #ffffff);">Keyboard Input</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Receives note input from the on-screen or computer keyboard.
        Supports both mono (single voice) and poly (4-voice chord) mode.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Mono outputs:</strong> Frequency CV, Gate, Velocity CV — active in mono mode</li>
        <li><strong>Poly CV output:</strong> Bundled 4-voice data — active when Poly Mode is on (purple cable)</li>
        <li><strong>Poly Mode button:</strong> Toggle between mono and poly mode directly on the component</li>
      </ul>
      <p style="color: var(--text-secondary, #cccccc);">
        See the <strong>Polyphony</strong> section for a full wiring guide.
      </p>

      <h4 style="color: var(--text-primary, #ffffff);">Mixer</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Combines multiple audio signals with individual level control.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Channels:</strong> 4 input channels</li>
        <li><strong>Gain 1-4:</strong> Individual channel levels</li>
        <li><strong>Master:</strong> Overall output level</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">Step Sequencer</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Creates rhythmic patterns and sequences.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>BPM:</strong> Tempo</li>
        <li><strong>Note Value:</strong> Step duration</li>
        <li><strong>16 Steps:</strong> Click to enable/disable</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">Chord Finder</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Displays all diatonic chords for a selected key as an interactive chord wheel.
        Click any chord segment to emit its notes as CV and trigger a gate signal.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Root Note:</strong> Key root (C – B)</li>
        <li><strong>Scale:</strong> Major or Natural Minor</li>
        <li><strong>Generate:</strong> Create a random diatonic chord progression (highlighted in teal)</li>
        <li><strong>Chord wheel:</strong> Click a segment to press the chord, release to close the gate</li>
        <li><strong>Outputs:</strong> Note 1 CV, Note 2 CV, Note 3 CV (1V/oct), Gate</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">Quantizer</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Snaps a continuously varying CV signal to the nearest note in a musical scale.
        Connect an LFO, Collider, or any CV source to create in-tune melodies from free-running modulation.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>CV In:</strong> Incoming CV signal to quantize (1V/octave)</li>
        <li><strong>Trig:</strong> Optional gate/trigger input — when connected, output only updates on a rising edge (rhythmically locked pitch steps)</li>
        <li><strong>CV Out:</strong> Quantized CV output (Hz, connects directly to oscillator Frequency CV)</li>
        <li><strong>Root:</strong> Root note of the scale (C – B)</li>
        <li><strong>Scale:</strong> Scale type — Major, Natural Minor, Harmonic Minor, Lydian, Mixolydian, Pentatonic Major, Pentatonic Minor, Chromatic</li>
        <li><strong>Note display:</strong> Shows the currently output pitch (e.g. "A#4")</li>
      </ul>
      <p style="color: var(--text-secondary, #cccccc);">
        <strong style="color: var(--text-primary, #ffffff);">Typical patch:</strong>
        LFO → Quantizer CV In → Oscillator Frequency CV → Filter → Master Out.
        For trigger-locked stepping: Step Sequencer Gate → Quantizer Trig.
      </p>

      <h4 style="color: var(--text-primary, #ffffff);">Arpeggiator</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Steps through held notes at a BPM-synced rate, emitting CV pitch and Gate pulses. Connect a Keyboard or Step Sequencer to its inputs, then wire CV Out to an Oscillator and Gate Out to an ADSR.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>CV In:</strong> Pitch input — accepts any CV or Frequency source (e.g. Keyboard Frequency output)</li>
        <li><strong>Gate In:</strong> Gate input — each gate-high latches the current pitch into the arpeggio sequence; gate-low releases it</li>
        <li><strong>CV Out:</strong> Stepped pitch output — connect to Oscillator Frequency CV</li>
        <li><strong>Gate Out:</strong> Gate pulse per step — connect to ADSR Gate In to trigger envelopes</li>
        <li><strong>Direction:</strong> Step order — Up (low→high), Down (high→low), Up-Down (bounce), Random</li>
        <li><strong>Octaves:</strong> Span 1–4 octaves above the held notes before cycling</li>
        <li><strong>Rate:</strong> Step speed as BPM subdivision — 1/4, 1/8, 1/16, 1/32 note</li>
        <li><strong>Gate Length:</strong> Gate pulse width — Short (25%), Medium (50%), Long (75%) of the step interval</li>
      </ul>
      <p style="color: var(--text-secondary, #cccccc);">
        <strong style="color: var(--text-primary, #ffffff);">Typical patch:</strong>
        Keyboard (Frequency → CV In, Gate → Gate In) → Arpeggiator → Oscillator (CV Out → Frequency CV) + ADSR (Gate Out → Gate In) → VCA → Master Out.
        Hold multiple keys to build up the arpeggio sequence; release all keys to stop.
      </p>

      <h4 style="color: var(--text-primary, #ffffff);">Slew Limiter</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Smooths abrupt CV jumps — produces portamento/glide between pitches.
        Sits between any CV source and any CV destination.
        Rise sets how long the output takes to reach a higher CV value; Fall sets how long it takes to reach a lower one.
        Both controls use an exponential scale for fine resolution at short times.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>CV In:</strong> Any CV source (Sequencer, LFO, Collider, Keyboard, etc.)</li>
        <li><strong>CV Out:</strong> Smoothed CV to any CV-accepting input</li>
        <li><strong>Rise:</strong> 0–5000 ms upward slew time</li>
        <li><strong>Fall:</strong> 0–5000 ms downward slew time</li>
        <li><strong>Bypass:</strong> Passes CV through unmodified with no smoothing</li>
      </ul>
      <p style="color: var(--text-secondary, #cccccc);">
        <em>Example patch:</em> Step Sequencer (CV Out) → Slew Limiter (CV In) → Oscillator (Frequency CV). Set Rise to ~200 ms for classic portamento.
      </p>

      <h4 style="color: var(--text-primary, #ffffff);">X-Y Pad</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        A two-axis controller: drag inside the square pad to drive two CV outputs
        independently and in real time. Record a gesture and play it back on a
        continuous loop to automate a modulation without holding the mouse.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>X / Y outputs:</strong> Independent CV outputs — connect each to a different target parameter (e.g. Filter Cutoff and Resonance)</li>
        <li><strong>X Depth / Y Depth:</strong> 0–100% attenuation per axis — scales how much of the connected target's full range that axis can reach</li>
        <li><strong>Handle:</strong> Drag anywhere inside the pad; position holds at its last value when released</li>
        <li><strong>R (Record):</strong> Starts capturing the pad's movement immediately, even before you move — pressing Record again discards any previous recording</li>
        <li><strong>■ (Stop):</strong> Ends recording or playback; the outputs hold their last value</li>
        <li><strong>▶ (Play):</strong> Loops the recorded gesture continuously — disabled until a recording exists; dragging the pad during playback immediately hands control back to manual input</li>
      </ul>
      <p style="color: var(--text-secondary, #cccccc);">
        <strong style="color: var(--text-primary, #ffffff);">Typical patch:</strong>
        X-Y Pad (X → Filter Cutoff CV, Y → Filter Resonance CV) → set both Depth knobs to taste, then press Record, sweep the pad, press Stop, and press Play to loop the filter sweep hands-free.
      </p>

      <h4 style="color: var(--text-primary, #ffffff);">Notes</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        A free-text scratchpad for documenting a patch — no ports, no parameters, no audio role.
        Click inside the text area to type; click elsewhere on the canvas (or press Escape) to defocus it and resume keyboard shortcuts and musical-key playback.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Text area:</strong> Plain text only, up to 10,000 characters; saved and reloaded with the patch</li>
      </ul>
      <p style="color: var(--text-secondary, #cccccc);">
        <strong style="color: var(--text-primary, #ffffff);">Typical use:</strong>
        Drop a Notes component anywhere on the canvas to jot down signal-chain explanations, todo items, or performance cues for a patch.
      </p>

      <h4 style="color: var(--text-primary, #ffffff);">Master Output</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Final output to speakers/headphones. Required for hearing audio.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Volume:</strong> Master level</li>
        <li><strong>Limiter:</strong> Prevents clipping</li>
      </ul>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Analyzers</h3>

      <h4 style="color: var(--text-primary, #ffffff);">Oscilloscope</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Visualises the audio signal in real time — waveform, spectrum, or both.
        Pass-through output lets it sit anywhere in the signal chain without interrupting audio flow.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Display:</strong> Waveform, Spectrum, or split Both view</li>
        <li><strong>Time Scale:</strong> Horizontal zoom of the waveform</li>
        <li><strong>Gain:</strong> Vertical zoom of the waveform</li>
        <li><strong>Input:</strong> Audio In</li>
        <li><strong>Output:</strong> Audio Out (pass-through)</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">VU Meter</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Passive peak-level monitor. Displays the instantaneous peak amplitude of any audio or CV signal
        as a 20-segment colour-coded column updated every render frame (~60 FPS).
        No audio output — connects in parallel, not in series.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Input:</strong> Audio In (connects to any Audio-typed source)</li>
        <li><strong>Green zone</strong> (segments 1–12): safe operating level</li>
        <li><strong>Yellow zone</strong> (segments 13–17): nominal headroom warning</li>
        <li><strong>Red zone</strong> (segments 18–20): clip danger — signal near or above 0 dBFS</li>
        <li><strong>Peak hold:</strong> White marker stripe holds the highest recent peak for 1.5 seconds, then decays — useful for spotting transients</li>
      </ul>
      <p style="color: var(--text-secondary, #cccccc);">
        <strong style="color: var(--text-primary, #ffffff);">Typical patch:</strong>
        Tap an output from any component (Oscillator, Mixer, LFO) into the VU Meter Audio In
        alongside its normal destination. The meter reads the level without affecting the signal.
      </p>

      <h4 style="color: var(--text-primary, #ffffff);">Envelope Follower</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        Converts the loudness of any audio signal into a 0–1 CV signal that rises with amplitude
        and falls toward zero as the audio quietens. Use it to make one signal dynamically control
        another — open a filter as a drum hits, duck a pad when a bass plays, or vary LFO depth
        with your playing dynamics.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Input:</strong> Audio In — accepts any audio-typed source (oscillator, effect, microphone)</li>
        <li><strong>Output:</strong> CV Out (0–1) — connect to any CV-accepting input (filter cutoff, VCA gain, LFO rate)</li>
        <li><strong>Attack:</strong> How fast the CV rises when input amplitude increases (1–500 ms)</li>
        <li><strong>Release:</strong> How fast the CV falls after amplitude decreases (5–2000 ms)</li>
        <li><strong>Gain:</strong> Scales input sensitivity before detection (0.1×–4×); increase for quiet sources, decrease for loud ones</li>
        <li><strong>Display:</strong> Live vertical green bar showing the current CV output level</li>
      </ul>
      <div style="background: var(--bg-secondary, #1a1a1a); padding: 12px 16px; border-radius: 8px; border-left: 4px solid var(--accent-color, #0066cc); margin: 8px 0 16px;">
        <p style="color: var(--text-secondary, #cccccc); margin: 0 0 6px;">
          <strong style="color: var(--text-primary, #ffffff);">Sidechain pumping patch:</strong>
        </p>
        <ol style="color: var(--text-secondary, #cccccc); margin: 0; padding-left: 18px;">
          <li>Patch a drum/bass audio source into <strong>Envelope Follower Audio In</strong></li>
          <li>Connect <strong>CV Out → VCA Gain CV</strong> on the pad you want to duck</li>
          <li>Set Attack to ~1 ms and Release to ~200 ms</li>
          <li>Adjust Gain until the CV bar responds clearly on each hit</li>
        </ol>
      </div>
      <p style="color: var(--text-secondary, #cccccc);">
        <strong style="color: var(--text-primary, #ffffff);">Note:</strong>
        The Envelope Follower is an audio sink — it has no audio output port. Patch audio to it in parallel
        from the original source; it does not interrupt the signal chain.
        When the audio cable is disconnected, the envelope decays naturally through the Release time.
      </p>
    `;
  }

  /**
   * Connections section content
   */
  private getConnectionsContent(): string {
    return `
      <h2 style="margin-top: 0; color: var(--text-primary, #ffffff);">Working with Connections</h2>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Creating Connections</h3>
      <ol style="color: var(--text-secondary, #cccccc);">
        <li>Click on an <strong style="color: var(--text-primary, #ffffff);">output port</strong> (right side of a component)</li>
        <li>You'll see a cable following your cursor</li>
        <li>Click on an <strong style="color: var(--text-primary, #ffffff);">input port</strong> (left side of another component)</li>
        <li>The connection is created if the signal types match</li>
      </ol>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Signal Types</h3>
      <p style="color: var(--text-secondary, #cccccc);">Connections are color-coded by signal type:</p>

      <div style="background: var(--bg-secondary, #1a1a1a); padding: 16px; border-radius: 8px; margin: 16px 0;">
        <div style="margin-bottom: 12px;">
          <span style="display: inline-block; width: 20px; height: 20px; background: #4CAF50; border-radius: 50%; vertical-align: middle; margin-right: 8px;"></span>
          <strong style="color: var(--text-primary, #ffffff);">Green - Audio:</strong>
          <span style="color: var(--text-secondary, #cccccc);"> Main audio signals (oscillators, filters, effects)</span>
        </div>

        <div style="margin-bottom: 12px;">
          <span style="display: inline-block; width: 20px; height: 20px; background: #2196F3; border-radius: 50%; vertical-align: middle; margin-right: 8px;"></span>
          <strong style="color: var(--text-primary, #ffffff);">Blue - CV (Control Voltage):</strong>
          <span style="color: var(--text-secondary, #cccccc);"> Modulation signals (LFOs, envelopes, frequency)</span>
        </div>

        <div style="margin-bottom: 12px;">
          <span style="display: inline-block; width: 20px; height: 20px; background: #F44336; border-radius: 50%; vertical-align: middle; margin-right: 8px;"></span>
          <strong style="color: var(--text-primary, #ffffff);">Red - Gate:</strong>
          <span style="color: var(--text-secondary, #cccccc);"> Trigger signals (note on/off, sequencer triggers)</span>
        </div>

        <div>
          <span style="display: inline-block; width: 20px; height: 20px; background: #c084fc; border-radius: 50%; vertical-align: middle; margin-right: 8px;"></span>
          <strong style="color: var(--text-primary, #ffffff);">Purple - Poly CV:</strong>
          <span style="color: var(--text-secondary, #cccccc);"> Bundled 4-voice polyphonic data (Keyboard → Poly Oscillator / Poly ADSR). Only connects to other Poly CV ports.</span>
        </div>
      </div>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Deleting Connections</h3>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li>Hold <strong style="color: var(--text-primary, #ffffff);">Shift</strong> and click on a cable to delete it</li>
        <li>Deleting a component automatically removes all its connections</li>
      </ul>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Connection Rules</h3>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li>Signal types must match (e.g., audio to audio, CV to CV)</li>
        <li>One output can connect to multiple inputs</li>
        <li>Each input can only have one connection</li>
        <li>Cables curve to show signal flow direction</li>
      </ul>

      <div style="background: var(--bg-secondary, #1a1a1a); padding: 16px; border-radius: 8px; border-left: 4px solid #FFC107; margin-top: 24px;">
        <h4 style="margin-top: 0; color: var(--text-primary, #ffffff);">Tip</h4>
        <p style="color: var(--text-secondary, #cccccc); margin: 0;">
          Hover over a cable to see it highlighted. This helps identify connections in complex patches.
        </p>
      </div>
    `;
  }

  /**
   * Keyboard section content
   */
  private getKeyboardContent(): string {
    return `
      <h2 style="margin-top: 0; color: var(--text-primary, #ffffff);">Keyboard Control</h2>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">On-Screen Piano</h3>
      <p style="color: var(--text-secondary, #cccccc);">
        Click the piano keys at the bottom of the screen to play notes.
      </p>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Computer Keyboard Layout</h3>

      <div style="background: var(--bg-secondary, #1a1a1a); padding: 16px; border-radius: 8px; margin: 16px 0;">
        <h4 style="color: var(--text-primary, #ffffff); margin-top: 0;">White Keys (Natural Notes)</h4>
        <p style="color: var(--text-secondary, #cccccc); font-family: monospace; font-size: 1.1em;">
          A  S  D  F  G  H  J  K  L  ;  '<br>
          C  D  E  F  G  A  B  C  D  E  F
        </p>

        <h4 style="color: var(--text-primary, #ffffff); margin-top: 16px;">Black Keys (Sharps/Flats)</h4>
        <p style="color: var(--text-secondary, #cccccc); font-family: monospace; font-size: 1.1em;">
          W  E     T  Y  U     O  P<br>
          C# D#    F# G# A#    C# D#
        </p>
      </div>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Keyboard Controls</h3>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong style="color: var(--text-primary, #ffffff);">Z key:</strong> Lower octave by 1</li>
        <li><strong style="color: var(--text-primary, #ffffff);">X key:</strong> Raise octave by 1</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Spacebar:</strong> Sustain pedal (hold notes)</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Octave -/+ buttons:</strong> Change octave range</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Panic button:</strong> Stop all playing notes immediately</li>
      </ul>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Setting Up Keyboard Control</h3>
      <ol style="color: var(--text-secondary, #cccccc);">
        <li>Add a <strong style="color: var(--text-primary, #ffffff);">Keyboard Input</strong> component to your patch</li>
        <li>Connect its outputs to control other components:
          <ul style="margin-top: 8px;">
            <li><strong>Frequency CV →</strong> Oscillator frequency CV (for pitch)</li>
            <li><strong>Gate →</strong> Oscillator gate or Envelope gate (for note on/off)</li>
            <li><strong>Velocity CV →</strong> VCA or envelope (for dynamics)</li>
          </ul>
        </li>
        <li>Now keyboard input will trigger your patch!</li>
      </ol>

      <div style="background: var(--bg-secondary, #1a1a1a); padding: 16px; border-radius: 8px; border-left: 4px solid var(--accent-color, #0066cc); margin-top: 24px;">
        <h4 style="margin-top: 0; color: var(--text-primary, #ffffff);">Note</h4>
        <p style="color: var(--text-secondary, #cccccc); margin: 0;">
          You can have multiple Keyboard Input components in one patch, each controlling different oscillators or voices.
        </p>
      </div>
    `;
  }

  /**
   * Patches section content
   */
  private getPatchesContent(): string {
    return `
      <h2 style="margin-top: 0; color: var(--text-primary, #ffffff);">Managing Patches</h2>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">What is a Patch?</h3>
      <p style="color: var(--text-secondary, #cccccc);">
        A patch is a complete snapshot of your synthesizer setup, including:
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li>All components and their positions</li>
        <li>All connections between components</li>
        <li>All parameter values (knobs, sliders, dropdowns)</li>
        <li>Canvas viewport (zoom, pan)</li>
      </ul>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Saving Patches</h3>

      <h4 style="color: var(--text-primary, #ffffff);">To Browser Storage</h4>
      <ol style="color: var(--text-secondary, #cccccc);">
        <li>Click the <strong style="color: var(--text-primary, #ffffff);">Save</strong> button in the top bar</li>
        <li>Enter a name for your patch (or keep the existing name)</li>
        <li>Click Save</li>
      </ol>
      <p style="color: var(--text-secondary, #cccccc);">
        Patches are stored in your browser's localStorage and persist between sessions.
      </p>

      <h4 style="color: var(--text-primary, #ffffff);">To File (Export)</h4>
      <ol style="color: var(--text-secondary, #cccccc);">
        <li>Click the <strong style="color: var(--text-primary, #ffffff);">Export</strong> button</li>
        <li>A JSON file will be downloaded to your computer</li>
        <li>Share this file with others or keep as backup</li>
      </ol>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Loading Patches</h3>

      <h4 style="color: var(--text-primary, #ffffff);">From Browser Storage</h4>
      <ol style="color: var(--text-secondary, #cccccc);">
        <li>Click the <strong style="color: var(--text-primary, #ffffff);">Load</strong> button</li>
        <li>Select a patch from the list</li>
        <li>Click Load to restore it</li>
        <li>Delete unwanted patches with the trash icon</li>
      </ol>

      <h4 style="color: var(--text-primary, #ffffff);">From File (Import)</h4>
      <ol style="color: var(--text-secondary, #cccccc);">
        <li>Click the <strong style="color: var(--text-primary, #ffffff);">Import</strong> button</li>
        <li>Select a .json patch file</li>
        <li>The patch will load immediately</li>
      </ol>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Creating New Patches</h3>
      <ol style="color: var(--text-secondary, #cccccc);">
        <li>Click the <strong style="color: var(--text-primary, #ffffff);">New</strong> button</li>
        <li>This clears the canvas for a fresh start</li>
        <li>Your previous work is not lost unless you save over it</li>
      </ol>

      <div style="background: var(--bg-secondary, #1a1a1a); padding: 16px; border-radius: 8px; border-left: 4px solid #FFC107; margin-top: 24px;">
        <h4 style="margin-top: 0; color: var(--text-primary, #ffffff);">Important</h4>
        <p style="color: var(--text-secondary, #cccccc); margin: 0;">
          Patches are stored locally in your browser. Clearing browser data will delete saved patches.
          Use Export to create backup files of important patches.
        </p>
      </div>
    `;
  }

  /**
   * Shortcuts section content
   */
  private getShortcutsContent(): string {
    return `
      <h2 style="margin-top: 0; color: var(--text-primary, #ffffff);">Keyboard Shortcuts</h2>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Canvas Navigation</h3>
      <table style="width: 100%; border-collapse: collapse; color: var(--text-secondary, #cccccc);">
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0; font-weight: 600; color: var(--text-primary, #ffffff);">Action</td>
          <td style="padding: 12px 0; font-weight: 600; color: var(--text-primary, #ffffff);">Shortcut</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Pan canvas</td>
          <td style="padding: 12px 0; font-family: monospace;">Click + Drag on empty space</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Zoom in/out</td>
          <td style="padding: 12px 0; font-family: monospace;">Mouse Wheel</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Toggle grid visibility</td>
          <td style="padding: 12px 0; font-family: monospace;">Shift + \` (~)</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Toggle snap to grid</td>
          <td style="padding: 12px 0; font-family: monospace;">\` (backtick)</td>
        </tr>
      </table>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Component Operations</h3>
      <table style="width: 100%; border-collapse: collapse; color: var(--text-secondary, #cccccc);">
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0; font-weight: 600; color: var(--text-primary, #ffffff);">Action</td>
          <td style="padding: 12px 0; font-weight: 600; color: var(--text-primary, #ffffff);">Shortcut</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Select component</td>
          <td style="padding: 12px 0; font-family: monospace;">Click</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Multi-select</td>
          <td style="padding: 12px 0; font-family: monospace;">Ctrl/Cmd + Click</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Move component</td>
          <td style="padding: 12px 0; font-family: monospace;">Click + Drag</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Delete component</td>
          <td style="padding: 12px 0; font-family: monospace;">Delete or Backspace</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Add component</td>
          <td style="padding: 12px 0; font-family: monospace;">Drag from sidebar</td>
        </tr>
      </table>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Connection Operations</h3>
      <table style="width: 100%; border-collapse: collapse; color: var(--text-secondary, #cccccc);">
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0; font-weight: 600; color: var(--text-primary, #ffffff);">Action</td>
          <td style="padding: 12px 0; font-weight: 600; color: var(--text-primary, #ffffff);">Shortcut</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Create connection</td>
          <td style="padding: 12px 0; font-family: monospace;">Click output → Click input</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Delete connection</td>
          <td style="padding: 12px 0; font-family: monospace;">Shift + Click cable</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Cancel connection</td>
          <td style="padding: 12px 0; font-family: monospace;">Click empty space</td>
        </tr>
      </table>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Keyboard/MIDI Input</h3>
      <table style="width: 100%; border-collapse: collapse; color: var(--text-secondary, #cccccc);">
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0; font-weight: 600; color: var(--text-primary, #ffffff);">Action</td>
          <td style="padding: 12px 0; font-weight: 600; color: var(--text-primary, #ffffff);">Shortcut</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Play white keys</td>
          <td style="padding: 12px 0; font-family: monospace;">A S D F G H J K L ; '</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Play black keys</td>
          <td style="padding: 12px 0; font-family: monospace;">W E T Y U O P</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Octave down</td>
          <td style="padding: 12px 0; font-family: monospace;">Z</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Octave up</td>
          <td style="padding: 12px 0; font-family: monospace;">X</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Sustain pedal</td>
          <td style="padding: 12px 0; font-family: monospace;">Spacebar</td>
        </tr>
      </table>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">MIDI</h3>
      <table style="width: 100%; border-collapse: collapse; color: var(--text-secondary, #cccccc);">
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0; font-weight: 600; color: var(--text-primary, #ffffff);">Action</td>
          <td style="padding: 12px 0; font-weight: 600; color: var(--text-primary, #ffffff);">Shortcut</td>
        </tr>
        <tr style="border-bottom: 1px solid var(--border-color, #444);">
          <td style="padding: 12px 0;">Cancel MIDI Learn</td>
          <td style="padding: 12px 0; font-family: monospace;">Escape</td>
        </tr>
      </table>
    `;
  }

  /**
   * Tips section content
   */
  private getTipsContent(): string {
    return `
      <h2 style="margin-top: 0; color: var(--text-primary, #ffffff);">Tips & Tricks</h2>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Sound Design Tips</h3>

      <div style="background: var(--bg-secondary, #1a1a1a); padding: 16px; border-radius: 8px; margin: 16px 0;">
        <h4 style="color: var(--text-primary, #ffffff); margin-top: 0;">Classic Bass Synth</h4>
        <ul style="color: var(--text-secondary, #cccccc); margin: 0;">
          <li>Use a sawtooth or square wave oscillator</li>
          <li>Add a lowpass filter with medium resonance</li>
          <li>Use an ADSR envelope to control the filter cutoff</li>
          <li>Short attack, medium decay, low sustain, short release</li>
        </ul>
      </div>

      <div style="background: var(--bg-secondary, #1a1a1a); padding: 16px; border-radius: 8px; margin: 16px 0;">
        <h4 style="color: var(--text-primary, #ffffff); margin-top: 0;">Pad Sounds</h4>
        <ul style="color: var(--text-secondary, #cccccc); margin: 0;">
          <li>Layer multiple oscillators with slight detuning</li>
          <li>Use sine or triangle waves for smoothness</li>
          <li>Long attack and release times on envelope</li>
          <li>Add reverb and chorus for depth</li>
        </ul>
      </div>

      <div style="background: var(--bg-secondary, #1a1a1a); padding: 16px; border-radius: 8px; margin: 16px 0;">
        <h4 style="color: var(--text-primary, #ffffff); margin-top: 0;">Lead Sounds</h4>
        <ul style="color: var(--text-secondary, #cccccc); margin: 0;">
          <li>Start with a sawtooth wave</li>
          <li>Add filter with envelope for movement</li>
          <li>Use an LFO to modulate filter cutoff or oscillator pitch</li>
          <li>Add delay for space</li>
        </ul>
      </div>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Workflow Tips</h3>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Start Simple:</strong>
          Build your patch gradually, testing at each step
        </li>
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Use the Grid:</strong>
          Enable snap-to-grid (backtick key) for organized layouts
        </li>
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Color Code Cables:</strong>
          Remember: Green=Audio, Blue=CV, Red=Gate
        </li>
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Save Often:</strong>
          Use Save frequently to avoid losing work
        </li>
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Export Backups:</strong>
          Export important patches as JSON files
        </li>
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Master Output Required:</strong>
          Always connect to Master Output to hear audio
        </li>
      </ul>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Modulation Ideas</h3>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Vibrato:</strong>
          Connect LFO (sine, slow rate) to oscillator frequency CV
        </li>
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Tremolo (manual):</strong>
          Connect an LFO to a VCA CV input for custom waveform shapes — or use the dedicated <em>Tremolo</em> effect module for a ready-made solution with rate, depth, and mix controls
        </li>
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Filter Sweep:</strong>
          Connect LFO to filter cutoff CV
        </li>
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Auto-Pan:</strong>
          Use LFO to modulate separate VCAs for left/right
        </li>
      </ul>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Performance Tips</h3>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li>
          <strong style="color: var(--text-primary, #ffffff);">CPU Usage:</strong>
          Each component uses processing power. Remove unused components.
        </li>
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Feedback Loops:</strong>
          Avoid connecting outputs back to inputs in the same signal chain
        </li>
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Panic Button:</strong>
          Use the Panic button if notes get stuck
        </li>
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Volume Control:</strong>
          Keep Master Output volume reasonable to avoid distortion
        </li>
      </ul>

      <div style="background: var(--bg-secondary, #1a1a1a); padding: 16px; border-radius: 8px; border-left: 4px solid var(--accent-color, #0066cc); margin-top: 24px;">
        <h4 style="margin-top: 0; color: var(--text-primary, #ffffff);">Pro Tip</h4>
        <p style="color: var(--text-secondary, #cccccc); margin: 0;">
          Experiment! The best way to learn synthesis is by trying different combinations of components and connections.
          There are no wrong answers in sound design.
        </p>
      </div>
    `;
  }

  /**
   * MIDI section content
   */
  private getMidiContent(): string {
    return `
      <h2 style="margin-top: 0; color: var(--text-primary, #ffffff);">MIDI Support</h2>

      <p style="color: var(--text-secondary, #cccccc);">
        Connect a USB MIDI keyboard or controller to play notes and control parameters in real time.
        MIDI support uses the Web MIDI API — Chrome and Edge work out of the box; Firefox and Safari may require a browser extension.
      </p>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Connecting a Device</h3>
      <ol style="color: var(--text-secondary, #cccccc);">
        <li style="margin-bottom: 10px;">Plug in your USB MIDI keyboard or controller.</li>
        <li style="margin-bottom: 10px;">Open (or reload) the app — the browser will request MIDI permission. Click <strong style="color: var(--text-primary, #ffffff);">Allow</strong>.</li>
        <li style="margin-bottom: 10px;">The device appears automatically in the <strong style="color: var(--text-primary, #ffffff);">MIDI toolbar</strong> below the canvas. A green dot confirms the connection.</li>
        <li style="margin-bottom: 10px;">If you have multiple devices, use the dropdown to pick the active one.</li>
        <li style="margin-bottom: 10px;">Play notes — the on-screen keyboard highlights the keys in real time.</li>
      </ol>

      <div style="background: var(--bg-secondary, #1a1a1a); padding: 12px 16px; border-radius: 8px; border-left: 4px solid #4caf50; margin: 16px 0;">
        <p style="color: var(--text-secondary, #cccccc); margin: 0;">
          <strong style="color: var(--text-primary, #ffffff);">Status indicators</strong> in the toolbar:
          <br>● <strong style="color: #4caf50;">Green dot</strong> — device connected and active
          <br>● <strong style="color: #888;">Grey dot</strong> — MIDI available but no device detected
          <br>● <strong style="color: #444;">Dark dot</strong> — Web MIDI not available in this browser
        </p>
      </div>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Playing Notes via MIDI</h3>
      <p style="color: var(--text-secondary, #cccccc);">
        Once a device is connected, notes played on the MIDI keyboard trigger all <strong style="color: var(--text-primary, #ffffff);">Keyboard Input</strong> components on the canvas — exactly the same as clicking the on-screen piano.
        Velocity is passed through, so dynamics respond to how hard you press the keys.
      </p>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">MIDI Learn — Map CC to Parameters</h3>
      <p style="color: var(--text-secondary, #cccccc);">
        Any knob or slider on any component can be assigned to a physical CC controller:
      </p>
      <ol style="color: var(--text-secondary, #cccccc);">
        <li style="margin-bottom: 10px;">
          Click <strong style="color: var(--text-primary, #ffffff);">MIDI Learn</strong> in the toolbar — the button turns blue and the app enters "waiting for click" mode.
        </li>
        <li style="margin-bottom: 10px;">
          Click any <strong style="color: var(--text-primary, #ffffff);">knob or slider</strong> on the canvas — it pulses with a blue glow to show it is waiting for a CC message.
        </li>
        <li style="margin-bottom: 10px;">
          Turn a <strong style="color: var(--text-primary, #ffffff);">physical knob or fader</strong> on your MIDI controller — the mapping is created instantly.
        </li>
        <li style="margin-bottom: 10px;">
          The MIDI Learn button resets. The mapped control now shows a <strong style="color: var(--text-primary, #ffffff);">small blue dot</strong> in its corner.
        </li>
      </ol>
      <p style="color: var(--text-secondary, #cccccc);">
        To abort at any step, click <strong style="color: var(--text-primary, #ffffff);">Cancel Learn</strong> in the toolbar, or press <strong style="color: var(--text-primary, #ffffff);">Escape</strong>.
      </p>
      <div style="background: var(--bg-secondary, #1a1a1a); padding: 12px 16px; border-radius: 8px; border-left: 4px solid var(--accent-color, #0066cc); margin: 8px 0 16px;">
        <p style="color: var(--text-secondary, #cccccc); margin: 0;">
          <strong style="color: var(--text-primary, #ffffff);">Tip:</strong> CC values are automatically scaled to each parameter's full range.
          A filter cutoff mapped to CC 74 will sweep from its minimum to maximum regardless of what value range the knob physically sends.
        </p>
      </div>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Managing Mappings</h3>
      <ol style="color: var(--text-secondary, #cccccc);">
        <li style="margin-bottom: 10px;">Click <strong style="color: var(--text-primary, #ffffff);">Mappings</strong> in the toolbar to open the MIDI Mappings panel.</li>
        <li style="margin-bottom: 10px;">The table lists every active assignment: Component, Parameter, CC number, and Channel.</li>
        <li style="margin-bottom: 10px;">Click <strong style="color: var(--text-primary, #ffffff);">Delete</strong> on a row to remove that single mapping.</li>
        <li style="margin-bottom: 10px;">Click <strong style="color: var(--text-primary, #ffffff);">Clear All</strong> (with confirmation) to remove every mapping at once.</li>
      </ol>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Patch Persistence</h3>
      <p style="color: var(--text-secondary, #cccccc);">
        All MIDI mappings are saved as part of the patch. When you save and reload a patch — or export and import a JSON file — every mapping is restored automatically. Legacy patches without MIDI mappings load without any issues.
      </p>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">MIDI Channels</h3>
      <p style="color: var(--text-secondary, #cccccc);">
        By default, MIDI Learn captures the channel of the first CC message received and stores it with the mapping. A mapping on <strong style="color: var(--text-primary, #ffffff);">Channel 0</strong> acts as <em>omni</em> — it matches incoming messages on any channel.
      </p>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">MIDI Monitor</h3>
      <p style="color: var(--text-secondary, #cccccc);">
        The MIDI Monitor is a floating diagnostic window that shows every incoming MIDI message in real time — useful for checking what your controller is actually sending before or after setting up mappings.
      </p>
      <ol style="color: var(--text-secondary, #cccccc);">
        <li style="margin-bottom: 10px;">Click <strong style="color: var(--text-primary, #ffffff);">MIDI Monitor</strong> in the toolbar to open the window.</li>
        <li style="margin-bottom: 10px;">Each incoming message appears as a new row: <strong style="color: var(--text-primary, #ffffff);">Time · Type · Channel · Data 1 · Data 2</strong>.</li>
        <li style="margin-bottom: 10px;">The log auto-scrolls to the latest entry. Scroll up manually to pause auto-scroll; scroll back to the bottom to resume.</li>
        <li style="margin-bottom: 10px;">Click <strong style="color: var(--text-primary, #ffffff);">Clear Log</strong> to empty the list instantly.</li>
        <li style="margin-bottom: 10px;">Drag the title bar to reposition the window. Press <strong style="color: var(--text-primary, #ffffff);">Escape</strong> or click <strong style="color: var(--text-primary, #ffffff);">✕</strong> to close it.</li>
      </ol>
      <div style="background: var(--bg-secondary, #1a1a1a); padding: 12px 16px; border-radius: 8px; border-left: 4px solid var(--accent-color, #0066cc); margin: 8px 0 16px;">
        <p style="color: var(--text-secondary, #cccccc); margin: 0;">
          <strong style="color: var(--text-primary, #ffffff);">Tip:</strong> The log is capped at 500 entries. Older messages are removed automatically once the cap is reached, so the window stays responsive even during high-frequency CC or clock messages.
        </p>
      </div>
    `;
  }

  /**
   * Polyphony section content
   */
  private getPolyphonyContent(): string {
    return `
      <h2 style="margin-top: 0; color: var(--text-primary, #ffffff);">4-Voice Polyphony</h2>

      <p style="color: var(--text-secondary, #cccccc);">
        Polyphony lets you play chords — up to 4 notes simultaneously, each with its own pitch,
        envelope, and amplitude — using three dedicated poly components and a mode switch on the Keyboard.
      </p>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">The Poly Signal Chain</h3>

      <div style="background: var(--bg-secondary, #1a1a1a); padding: 16px; border-radius: 8px; border-left: 4px solid #c084fc; margin: 16px 0;">
        <p style="color: var(--text-secondary, #cccccc); margin: 0 0 8px;">
          <strong style="color: var(--text-primary, #ffffff);">Standard poly patch:</strong>
        </p>
        <p style="color: #c084fc; font-family: monospace; margin: 0 0 4px;">
          Keyboard (Poly CV) ──┬──▶ Poly Oscillator (Poly CV)
        </p>
        <p style="color: #c084fc; font-family: monospace; margin: 0 0 4px;">
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└──▶ Poly ADSR (Poly CV)
        </p>
        <p style="color: #c084fc; font-family: monospace; margin: 0 0 4px;">
          Poly Oscillator (Poly Audio) ──▶ Poly VCA (Poly Audio)
        </p>
        <p style="color: #c084fc; font-family: monospace; margin: 0 0 4px;">
          Poly ADSR (Poly Env) ──▶ Poly VCA (Poly Env)
        </p>
        <p style="color: #4ade80; font-family: monospace; margin: 0;">
          Poly VCA (Audio Out) ──▶ Master Out (or any mono effect)
        </p>
      </div>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Step-by-Step Setup</h3>
      <ol style="color: var(--text-secondary, #cccccc);">
        <li style="margin-bottom: 12px;">
          <strong style="color: var(--text-primary, #ffffff);">Add the five components:</strong>
          Keyboard, Poly Oscillator, Poly ADSR, Poly VCA, Master Output.
        </li>
        <li style="margin-bottom: 12px;">
          <strong style="color: var(--text-primary, #ffffff);">Enable Poly Mode on the Keyboard:</strong>
          Click the <strong>Poly Mode</strong> button on the Keyboard tile — it turns blue.
        </li>
        <li style="margin-bottom: 12px;">
          <strong style="color: var(--text-primary, #ffffff);">Connect the Poly CV cables (purple):</strong>
          <ul style="margin-top: 8px;">
            <li>Keyboard <strong>Poly CV</strong> → Poly Oscillator <strong>Poly CV</strong></li>
            <li>Keyboard <strong>Poly CV</strong> → Poly ADSR <strong>Poly CV</strong></li>
          </ul>
          Both poly components connect to the same Keyboard Poly CV port — each reads only what it needs.
        </li>
        <li style="margin-bottom: 12px;">
          <strong style="color: var(--text-primary, #ffffff);">Connect the poly audio cable (purple):</strong>
          <ul style="margin-top: 8px;">
            <li>Poly Oscillator <strong>Poly Audio</strong> → Poly VCA <strong>Poly Audio</strong></li>
          </ul>
          All 4 voice audio signals are bundled in a single cable — no fan-out required.
        </li>
        <li style="margin-bottom: 12px;">
          <strong style="color: var(--text-primary, #ffffff);">Connect the poly envelope cable (purple):</strong>
          <ul style="margin-top: 8px;">
            <li>Poly ADSR <strong>Poly Env</strong> → Poly VCA <strong>Poly Env</strong></li>
          </ul>
          All 4 per-voice envelopes are bundled in a single cable.
        </li>
        <li style="margin-bottom: 12px;">
          <strong style="color: var(--text-primary, #ffffff);">Connect the output:</strong>
          Poly VCA <strong>Audio Out</strong> → Master Output (or any mono effect like Filter or Reverb).
        </li>
        <li style="margin-bottom: 12px;">
          <strong style="color: var(--text-primary, #ffffff);">Play:</strong>
          Hold multiple keys on the keyboard — each key gets its own independent voice.
        </li>
      </ol>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Poly Components Reference</h3>

      <h4 style="color: var(--text-primary, #ffffff);">Poly Oscillator</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        4 independent oscillators — one per voice — each playing the pitch of its assigned key.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Waveform:</strong> Sine, Square, Sawtooth, Triangle — shared across all 4 voices</li>
        <li><strong>Input:</strong> Poly CV (reads frequency per voice)</li>
        <li><strong>Output:</strong> Poly Audio — all 4 voice audio signals bundled in one cable</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">Poly ADSR</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        4 independent ADSR envelopes, one per voice. Each envelope is triggered and released
        independently — releasing one key starts only that voice's release phase.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Attack / Decay / Sustain / Release:</strong> Shared values applied to all 4 envelopes</li>
        <li><strong>Input:</strong> Poly CV (reads gate state per voice)</li>
        <li><strong>Output:</strong> Poly Env — all 4 per-voice envelopes bundled in one cable</li>
      </ul>

      <h4 style="color: var(--text-primary, #ffffff);">Poly VCA</h4>
      <p style="color: var(--text-secondary, #cccccc);">
        4 independent gain stages, each shaped by a per-voice envelope. Sums all voices into a
        single mono audio output that connects to any standard downstream module.
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong>Input:</strong> Poly Audio (from Poly Oscillator) + Poly Env (from Poly ADSR)</li>
        <li><strong>Output:</strong> Audio Out — standard mono audio, compatible with Filter, Reverb, Master Output, etc.</li>
        <li><strong>Summing gain:</strong> 0.25× per voice (4 × 0.25 = 1.0 max) — no clipping at full 4-voice load</li>
        <li><strong>No controls:</strong> Amplitude is entirely shaped by the connected envelopes</li>
      </ul>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Mono / Poly Mode</h3>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li style="margin-bottom: 8px;">
          <strong style="color: var(--text-primary, #ffffff);">Mono mode (default):</strong>
          The Keyboard behaves exactly as before — single voice, last-note priority.
          Frequency CV, Gate, and Velocity CV outputs are active.
          Compatible with all existing mono patches.
        </li>
        <li style="margin-bottom: 8px;">
          <strong style="color: var(--text-primary, #ffffff);">Poly mode (Poly Mode button active / blue):</strong>
          The Keyboard allocates up to 4 independent voice slots.
          The Poly CV output carries all 4 voices; the mono Gate output is held at 0.
        </li>
        <li style="margin-bottom: 8px;">
          <strong style="color: var(--text-primary, #ffffff);">Switching modes live:</strong>
          Toggle at any time — active voices stop immediately when switching.
          The mode is saved with the patch and restored on reload.
        </li>
      </ul>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Voice Stealing</h3>
      <p style="color: var(--text-secondary, #cccccc);">
        When all 4 voice slots are occupied and a new key is pressed, the <strong style="color: var(--text-primary, #ffffff);">oldest active voice</strong>
        is reassigned to the new pitch. The other three voices continue without interruption.
      </p>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Adding Effects</h3>
      <p style="color: var(--text-secondary, #cccccc);">
        The Poly VCA's mono Audio Out connects to any existing mono module — no special poly-aware effects needed.
      </p>
      <div style="background: var(--bg-secondary, #1a1a1a); padding: 12px 16px; border-radius: 8px; border-left: 4px solid var(--accent-color, #0066cc); margin: 8px 0 16px;">
        <p style="color: var(--text-secondary, #cccccc); margin: 0 0 6px;">
          <strong style="color: var(--text-primary, #ffffff);">Poly patch with effects:</strong>
        </p>
        <p style="color: var(--text-secondary, #cccccc); margin: 0; font-family: monospace; font-size: 0.85em;">
          Poly VCA (Audio Out) → Filter → Reverb → Master Output
        </p>
      </div>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Connection Rules</h3>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li style="margin-bottom: 8px;">
          <strong style="color: var(--text-primary, #ffffff);">Poly CV only connects to Poly CV</strong> — the connection system rejects any attempt to connect a purple Poly CV cable to a blue CV or red Gate input, and vice versa.
        </li>
        <li style="margin-bottom: 8px;">
          <strong style="color: var(--text-primary, #ffffff);">Mono Keyboard → Poly Oscillator is rejected</strong> — switch the Keyboard to Poly Mode first.
        </li>
        <li>
          <strong style="color: var(--text-primary, #ffffff);">Poly VCA Audio Out → any mono input is accepted</strong> — it's a standard green audio cable.
        </li>
      </ul>

      <div style="background: var(--bg-secondary, #1a1a1a); padding: 16px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-top: 24px;">
        <h4 style="margin-top: 0; color: var(--text-primary, #ffffff);">Existing patches are unaffected</h4>
        <p style="color: var(--text-secondary, #cccccc); margin: 0;">
          All mono components (Oscillator, ADSR, VCA) and existing patches are completely unchanged.
          The Keyboard defaults to mono mode, so any saved patch with a Keyboard Input loads and plays identically to before.
        </p>
      </div>
    `;
  }

  /**
   * Guided Lessons section content
   */
  private getGuidedLessonsContent(): string {
    return `
      <h2 style="margin-top: 0; color: var(--text-primary, #ffffff);">Guided Lessons</h2>

      <p style="color: var(--text-secondary, #cccccc);">
        Guided Lessons is a structured, in-app learning mode that walks you through the fundamentals of audio synthesis — step by step, hands-on, at your own pace.
      </p>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Getting Started</h3>
      <ol style="color: var(--text-secondary, #cccccc);">
        <li style="margin-bottom: 12px;">
          <strong style="color: var(--text-primary, #ffffff);">Open Lesson Mode:</strong>
          Click the <strong style="color: var(--text-primary, #ffffff);">Learn</strong> button in the top toolbar.
          The Lesson Sidebar slides in from the right.
        </li>
        <li style="margin-bottom: 12px;">
          <strong style="color: var(--text-primary, #ffffff);">Follow the lesson:</strong>
          Each lesson loads a prepared patch onto the canvas, explains a concept, and gives you a task to complete.
        </li>
        <li style="margin-bottom: 12px;">
          <strong style="color: var(--text-primary, #ffffff);">Complete the task:</strong>
          Follow the task instruction — make a connection, change a parameter, or simply observe — then click <strong>Next</strong> to advance.
        </li>
        <li style="margin-bottom: 12px;">
          <strong style="color: var(--text-primary, #ffffff);">Experiment freely:</strong>
          The canvas is always live. You can add components and patch freely during any lesson; extra connections do not affect task validation.
        </li>
      </ol>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Curriculum Overview</h3>
      <p style="color: var(--text-secondary, #cccccc);">
        Click the list icon inside the Lesson Sidebar to open the curriculum overview. All modules and lessons are visible with completion indicators:
      </p>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li><strong style="color: var(--text-primary, #ffffff);">✓ Completed</strong> — lesson finished</li>
        <li><strong style="color: var(--text-primary, #ffffff);">▶ Current</strong> — lesson in progress (highlighted)</li>
        <li><strong style="color: var(--text-primary, #ffffff);">Not started</strong> — dimmed but always clickable</li>
      </ul>
      <p style="color: var(--text-secondary, #cccccc);">
        Lessons are never hard-locked — you can jump to any lesson at any time.
      </p>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Task Types</h3>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li style="margin-bottom: 8px;">
          <strong style="color: var(--text-primary, #ffffff);">Connect</strong> — draw a specific cable connection on the canvas; the task auto-completes the moment the correct connection is made.
        </li>
        <li style="margin-bottom: 8px;">
          <strong style="color: var(--text-primary, #ffffff);">Set Parameter</strong> — change a parameter to a target value; completes the first time the value enters the target range (no need to hold it there).
        </li>
        <li style="margin-bottom: 8px;">
          <strong style="color: var(--text-primary, #ffffff);">Observe</strong> — listen or watch; no validation required. Click Next when you are ready.
        </li>
        <li style="margin-bottom: 8px;">
          <strong style="color: var(--text-primary, #ffffff);">Free</strong> — explore freely; no constraint. Click Next when you are ready.
        </li>
      </ul>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Progress & Persistence</h3>
      <ul style="color: var(--text-secondary, #cccccc);">
        <li>Progress is saved automatically to <strong style="color: var(--text-primary, #ffffff);">browser storage</strong> after each completed lesson.</li>
        <li>When you return to the app and click Learn, the sidebar reopens at your last position.</li>
        <li>To start over, open the settings menu inside Lesson Mode and click <strong style="color: var(--text-primary, #ffffff);">Reset Progress</strong>. This clears the full curriculum and returns to Lesson 1.</li>
        <li>In private browsing mode, progress is kept in memory for the session but is not saved between visits.</li>
      </ul>

      <h3 style="color: var(--text-primary, #ffffff); margin-top: 24px;">Module 1 — Synthesis Fundamentals</h3>
      <p style="color: var(--text-secondary, #cccccc);">The initial release ships three lessons covering the very basics:</p>
      <ol style="color: var(--text-secondary, #cccccc);">
        <li style="margin-bottom: 8px;"><strong style="color: var(--text-primary, #ffffff);">What is Sound?</strong> — Introduces sound as vibration; listens to a simple oscillator patch.</li>
        <li style="margin-bottom: 8px;"><strong style="color: var(--text-primary, #ffffff);">The Oscillator</strong> — Explains the oscillator module and how to connect it to the keyboard for pitch control.</li>
        <li style="margin-bottom: 8px;"><strong style="color: var(--text-primary, #ffffff);">Waveform Shapes</strong> — Explores how different waveforms change the timbre of a sound.</li>
      </ol>
      <p style="color: var(--text-secondary, #cccccc);">
        Modules 2–5 (filters, envelopes, effects, advanced patching) will be added in future updates.
      </p>

      <div style="background: var(--bg-secondary, #1a1a1a); padding: 16px; border-radius: 8px; border-left: 4px solid var(--accent-color, #0066cc); margin-top: 24px;">
        <h4 style="margin-top: 0; color: var(--text-primary, #ffffff);">Tip</h4>
        <p style="color: var(--text-secondary, #cccccc); margin: 0;">
          You can keep the Lesson Sidebar open while patching freely on the canvas — the sidebar stays active and the task remains completable even if you add extra components or connections.
        </p>
      </div>
    `;
  }
}
