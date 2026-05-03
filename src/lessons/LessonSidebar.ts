import type { LessonData, LessonManifest, LessonState } from './types';
import { lessonLoader } from './LessonLoader';
import { lessonProgressStorage } from './LessonProgressStorage';
import { lessonTaskValidator } from './LessonTaskValidator';
import { patchManager } from '../patch/PatchManager';

export class LessonSidebar {
  private container: HTMLDivElement;
  private contentArea: HTMLDivElement;
  private isVisible = false;
  private manifest: LessonManifest | null = null;

  private state: LessonState = {
    currentLesson: null,
    taskComplete: false,
    isLoadingLesson: false,
    highlightDismissed: false,
    patchLoaded: false,
  };

  // Flat ordered list of lesson filenames built from manifest
  private lessonFiles: string[] = [];

  // Index of current lesson in lessonFiles
  private currentIndex = -1;

  constructor() {
    this.container = this.createContainer();
    this.contentArea = this.createContentArea();
    this.setupStructure();
    document.body.appendChild(this.container);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  toggle(): void {
    this.isVisible ? this.close() : this.open();
  }

  open(): void {
    if (this.isVisible) return;
    this.isVisible = true;
    this.container.style.right = '0';
    this.loadInitialLesson();
  }

  close(): void {
    if (!this.isVisible) return;
    this.isVisible = false;
    this.container.style.right = `-${this.container.offsetWidth}px`;
  }

  // ── DOM construction ──────────────────────────────────────────────────────

  private createContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.id = 'lesson-sidebar';
    container.setAttribute('role', 'complementary');
    container.setAttribute('aria-label', 'Guided Lessons');
    container.style.cssText = `
      position: fixed;
      top: 0;
      right: -480px;
      width: 480px;
      height: 100vh;
      background: var(--bg-primary, #2a2a2a);
      border-left: 1px solid var(--border-color, #444);
      display: flex;
      flex-direction: column;
      z-index: 9998;
      transition: right 0.3s ease;
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
    `;
    return container;
  }

  private createContentArea(): HTMLDivElement {
    const area = document.createElement('div');
    area.id = 'lesson-sidebar-content';
    area.style.cssText = `
      flex: 1;
      padding: 24px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    `;
    return area;
  }

  private setupStructure(): void {
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 20px 20px 0;
      border-bottom: 1px solid var(--border-color, #444);
      flex-shrink: 0;
      position: relative;
      padding-bottom: 16px;
    `;

    const title = document.createElement('h2');
    title.textContent = 'Guided Lessons';
    title.style.cssText = `
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-primary, #ffffff);
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close lesson sidebar');
    closeBtn.style.cssText = `
      position: absolute;
      top: 0;
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
    `;
    closeBtn.addEventListener('click', () => this.close());

    header.appendChild(title);
    header.appendChild(closeBtn);
    this.container.appendChild(header);
    this.container.appendChild(this.contentArea);

    const footer = this.createFooter();
    this.container.appendChild(footer);

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) this.close();
    });
  }

  private createFooter(): HTMLDivElement {
    const footer = document.createElement('div');
    footer.style.cssText = `
      padding: 12px 20px;
      border-top: 1px solid var(--border-color, #444);
      flex-shrink: 0;
    `;

    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset Progress';
    resetBtn.setAttribute('aria-label', 'Reset all lesson progress');
    resetBtn.style.cssText = `
      background: none;
      border: none;
      color: var(--text-secondary, #888);
      font-size: 0.75rem;
      cursor: pointer;
      text-decoration: underline;
      padding: 0;
    `;
    resetBtn.addEventListener('click', () => this.handleResetProgress());
    footer.appendChild(resetBtn);
    return footer;
  }

  // ── Lesson loading ────────────────────────────────────────────────────────

  private async loadInitialLesson(): Promise<void> {
    this.renderLoadingState();
    try {
      if (!this.manifest) {
        this.manifest = await lessonLoader.loadManifest();
        this.lessonFiles = this.manifest.modules.flatMap((m) => m.lessons);
      }

      const progress = lessonProgressStorage.loadProgress();

      if (lessonProgressStorage.isUsingFallback) {
        this.showPrivateBrowsingNotice();
      }

      if (progress.currentLessonId) {
        // Resume at the lesson the user was on
        const idx = this.indexForLessonId(progress.currentLessonId);
        const filename = idx >= 0 ? this.lessonFiles[idx] : undefined;
        if (filename) {
          const lesson = await lessonLoader.loadLesson(filename);
          await this.loadLesson(lesson, { skipDirtyCheck: true, fileIndex: idx });
          return;
        }
      }

      // First time: load lesson 1
      const firstFile = this.lessonFiles[0];
      if (firstFile) {
        const lesson = await lessonLoader.loadLesson(firstFile);
        await this.loadLesson(lesson, { skipDirtyCheck: true, fileIndex: 0 });
      }
    } catch (err) {
      this.renderErrorState(`Could not load lessons: ${(err as Error).message}`);
    }
  }

  async loadLesson(lesson: LessonData, opts?: { skipDirtyCheck?: boolean; fileIndex?: number }): Promise<void> {
    if (!opts?.skipDirtyCheck && patchManager.hasUnsavedChanges()) {
      const ok = window.confirm('Your changes will be lost — continue?');
      if (!ok) return;
    }

    this.state = { ...this.state, isLoadingLesson: true, taskComplete: false, highlightDismissed: false, patchLoaded: false };
    this.renderLoadingState();

    // Track position in flat file list
    if (opts?.fileIndex !== undefined) {
      this.currentIndex = opts.fileIndex;
    } else {
      this.currentIndex = this.indexForLessonId(lesson.id);
    }

    // Save progress
    const progress = lessonProgressStorage.loadProgress();
    lessonProgressStorage.saveProgress({ ...progress, currentLessonId: lesson.id });

    // Activate validator
    lessonTaskValidator.setTask(lesson.task);
    lessonTaskValidator.onComplete(() => {
      this.state = { ...this.state, taskComplete: true };
      this.renderLesson(lesson);
    });

    this.state = { ...this.state, currentLesson: lesson, isLoadingLesson: false };
    this.renderLesson(lesson);
  }

  private async loadPatch(lesson: LessonData): Promise<void> {
    if (!lesson.patchFile) return;
    try {
      const patchData = await lessonLoader.loadLessonPatch(lesson.patchFile);
      await patchManager.loadFromData(patchData);
      this.applyHighlights(lesson);
      this.state = { ...this.state, patchLoaded: true };
      this.renderLesson(lesson);
    } catch {
      this.showPatchLoadError();
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  private async nextLesson(): Promise<void> {
    const lesson = this.state.currentLesson;
    if (!lesson) return;

    // Mark current complete
    const progress = lessonProgressStorage.loadProgress();
    if (!progress.completedLessons.includes(lesson.id)) {
      lessonProgressStorage.saveProgress({
        ...progress,
        completedLessons: [...progress.completedLessons, lesson.id],
      });
    }

    const nextIdx = this.currentIndex + 1;
    const nextFile = this.lessonFiles[nextIdx];
    if (!nextFile) return;

    try {
      this.renderLoadingState();
      const nextLesson = await lessonLoader.loadLesson(nextFile);
      await this.loadLesson(nextLesson, { fileIndex: nextIdx });
    } catch (err) {
      this.renderErrorState(`Could not load next lesson: ${(err as Error).message}`);
    }
  }

  private async prevLesson(): Promise<void> {
    if (this.currentIndex <= 0) return;
    const prevIdx = this.currentIndex - 1;
    const prevFile = this.lessonFiles[prevIdx];
    if (!prevFile) return;

    try {
      this.renderLoadingState();
      const prevLesson = await lessonLoader.loadLesson(prevFile);
      await this.loadLesson(prevLesson, { fileIndex: prevIdx });
    } catch (err) {
      this.renderErrorState(`Could not load previous lesson: ${(err as Error).message}`);
    }
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  renderLesson(lesson: LessonData): void {
    this.contentArea.innerHTML = '';

    const isObserveOrFree = lesson.task.type === 'observe' || lesson.task.type === 'free';
    const nextEnabled = this.state.taskComplete || isObserveOrFree;
    const isFirst = this.currentIndex <= 0;
    const isLast = this.currentIndex >= this.lessonFiles.length - 1;

    // Module / lesson number
    const meta = document.createElement('p');
    meta.textContent = this.buildMetaLabel(lesson);
    meta.style.cssText = `
      margin: 0;
      font-size: 0.75rem;
      color: var(--text-secondary, #888);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    `;

    // Title
    const title = document.createElement('h3');
    title.textContent = lesson.title;
    title.style.cssText = `
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-primary, #ffffff);
    `;

    // Concept
    const concept = document.createElement('div');
    concept.innerHTML = lesson.concept
      .split('\n')
      .map((line) => `<p style="margin:0 0 8px;color:var(--text-secondary,#ccc);line-height:1.6;">${line}</p>`)
      .join('');

    // Task box
    const taskBox = document.createElement('div');
    taskBox.style.cssText = `
      background: var(--bg-secondary, #1a1a1a);
      border: 1px solid var(--border-color, #444);
      border-radius: 8px;
      padding: 16px;
    `;

    const taskLabel = document.createElement('p');
    taskLabel.style.cssText = `margin: 0 0 8px; font-size: 0.75rem; color: var(--text-secondary, #888); text-transform: uppercase; letter-spacing: 0.05em;`;
    taskLabel.textContent = 'Task';

    const taskInstr = document.createElement('p');
    taskInstr.style.cssText = `margin: 0; color: var(--text-primary, #fff); line-height: 1.5;`;
    taskInstr.textContent = lesson.task.instruction;

    // Task complete indicator
    const taskStatus = document.createElement('p');
    taskStatus.setAttribute('role', 'status');
    taskStatus.setAttribute('aria-live', 'polite');
    taskStatus.style.cssText = `margin: 8px 0 0; font-size: 0.85rem;`;

    if (isObserveOrFree) {
      taskStatus.style.color = 'var(--text-secondary, #888)';
      taskStatus.textContent = 'No validation required — advance when ready.';
    } else if (this.state.taskComplete) {
      taskStatus.style.color = '#4caf50';
      taskStatus.textContent = '✓ Task complete!';
    } else {
      taskStatus.style.color = 'var(--text-secondary, #888)';
      taskStatus.textContent = 'Complete the task above to advance.';
    }

    taskBox.appendChild(taskLabel);
    taskBox.appendChild(taskInstr);
    taskBox.appendChild(taskStatus);

    // Dismiss highlights button
    if (!this.state.highlightDismissed && lesson.highlightComponentTypes.length > 0) {
      const dismissBtn = document.createElement('button');
      dismissBtn.textContent = '✕ Dismiss highlights';
      dismissBtn.setAttribute('aria-label', 'Dismiss component highlights');
      dismissBtn.style.cssText = `
        background: none;
        border: none;
        color: var(--text-secondary, #888);
        font-size: 0.8rem;
        cursor: pointer;
        text-decoration: underline;
        padding: 0;
      `;
      dismissBtn.addEventListener('click', () => {
        this.clearHighlights();
        this.state = { ...this.state, highlightDismissed: true };
        this.renderLesson(lesson);
      });
      taskBox.appendChild(dismissBtn);
    }

    // Navigation buttons
    const navRow = document.createElement('div');
    navRow.style.cssText = `display: flex; gap: 8px; margin-top: 8px;`;

    const backBtn = document.createElement('button');
    backBtn.textContent = '← Back';
    backBtn.setAttribute('aria-label', 'Go to previous lesson');
    backBtn.disabled = isFirst;
    backBtn.style.cssText = `
      flex: 1;
      padding: 10px;
      border: 1px solid var(--border-color, #444);
      background: none;
      color: ${isFirst ? 'var(--text-secondary, #555)' : 'var(--text-primary, #fff)'};
      border-radius: 6px;
      cursor: ${isFirst ? 'not-allowed' : 'pointer'};
      font-size: 0.9rem;
    `;
    backBtn.addEventListener('click', () => { if (!isFirst) this.prevLesson(); });

    const nextBtn = document.createElement('button');
    nextBtn.textContent = isLast ? 'Finish ✓' : 'Next →';
    nextBtn.setAttribute('aria-label', isLast ? 'Finish curriculum' : 'Go to next lesson');
    nextBtn.disabled = !nextEnabled;
    nextBtn.style.cssText = `
      flex: 2;
      padding: 10px;
      border: none;
      background: ${nextEnabled ? 'var(--accent-color, #0066cc)' : 'var(--bg-secondary, #333)'};
      color: ${nextEnabled ? '#fff' : 'var(--text-secondary, #555)'};
      border-radius: 6px;
      cursor: ${nextEnabled ? 'pointer' : 'not-allowed'};
      font-size: 0.9rem;
      font-weight: 600;
    `;
    nextBtn.addEventListener('click', () => { if (nextEnabled && !isLast) this.nextLesson(); });

    navRow.appendChild(backBtn);
    navRow.appendChild(nextBtn);

    this.contentArea.appendChild(meta);
    this.contentArea.appendChild(title);
    this.contentArea.appendChild(concept);
    this.contentArea.appendChild(taskBox);

    // Load patch button — shown when the lesson has a patch that hasn't been loaded yet
    if (lesson.patchFile && !this.state.patchLoaded) {
      const loadBtn = document.createElement('button');
      const isObserve = lesson.task.type === 'observe' || lesson.task.type === 'free';
      loadBtn.textContent = isObserve ? '▶ Start listening' : '▶ Load patch';
      loadBtn.setAttribute('aria-label', 'Load the lesson patch onto the canvas');
      loadBtn.style.cssText = `
        width: 100%;
        padding: 12px;
        border: none;
        background: var(--accent-color, #0066cc);
        color: #fff;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.95rem;
        font-weight: 600;
      `;
      loadBtn.addEventListener('click', () => this.loadPatch(lesson));
      this.contentArea.appendChild(loadBtn);
    }

    this.contentArea.appendChild(navRow);
  }

  renderLoadingState(): void {
    this.contentArea.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-secondary,#888);">
        Loading lesson…
      </div>
    `;
  }

  renderErrorState(msg: string): void {
    this.contentArea.innerHTML = `
      <div style="padding:16px;color:#f44336;background:var(--bg-secondary,#1a1a1a);border-radius:8px;">
        ${msg}
      </div>
    `;
  }

  // ── Highlights ────────────────────────────────────────────────────────────

  private applyHighlights(lesson: LessonData): void {
    this.clearHighlights();
    for (const type of lesson.highlightComponentTypes) {
      const elements = document.querySelectorAll(`[data-component-type="${type}"]`);
      elements.forEach((el) => el.classList.add('lesson-highlight'));
    }
  }

  private clearHighlights(): void {
    document.querySelectorAll('.lesson-highlight').forEach((el) =>
      el.classList.remove('lesson-highlight')
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private indexForLessonId(lessonId: string): number {
    // lesson IDs are like 'lesson-01-what-is-sound', filenames like '01-what-is-sound.json'
    // Strip the 'lesson-' prefix and '.json' suffix to find a common slug to compare
    const idSlug = lessonId.replace(/^lesson-/, '');
    for (let i = 0; i < this.lessonFiles.length; i++) {
      const fileSlug = this.lessonFiles[i]!.replace('.json', '');
      if (fileSlug === idSlug || idSlug.startsWith(fileSlug) || fileSlug.startsWith(idSlug)) {
        return i;
      }
    }
    return -1;
  }

  private buildMetaLabel(lesson: LessonData): string {
    const modNum = lesson.moduleId.replace('module-', '');
    return `Module ${modNum} · Lesson ${lesson.index}`;
  }

  private showPatchLoadError(): void {
    const notice = document.createElement('div');
    notice.style.cssText = `
      background: #f44336;
      color: #fff;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 0.85rem;
      margin-bottom: 8px;
    `;
    notice.textContent = "Lesson patch couldn't load — you can still read the explanation.";
    this.contentArea.prepend(notice);
  }

  private showPrivateBrowsingNotice(): void {
    const notice = document.createElement('div');
    notice.id = 'lesson-private-notice';
    notice.style.cssText = `
      background: var(--bg-secondary, #1a1a1a);
      border: 1px solid var(--border-color, #555);
      color: var(--text-secondary, #aaa);
      padding: 10px 12px;
      border-radius: 6px;
      font-size: 0.8rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    notice.innerHTML = `
      <span>Progress won't be saved in private browsing mode.</span>
      <button aria-label="Dismiss notice" style="background:none;border:none;color:inherit;cursor:pointer;font-size:1.1rem;padding:0 0 0 8px;">&times;</button>
    `;
    notice.querySelector('button')!.addEventListener('click', () => notice.remove());
    this.contentArea.prepend(notice);
  }

  private handleResetProgress(): void {
    const ok = window.confirm('Reset all lesson progress? This cannot be undone.');
    if (!ok) return;
    lessonProgressStorage.clearProgress();
    lessonTaskValidator.setTask(null);
    this.clearHighlights();
    this.state = { currentLesson: null, taskComplete: false, isLoadingLesson: false, highlightDismissed: false, patchLoaded: false };
    this.manifest = null;
    this.lessonFiles = [];
    this.currentIndex = -1;
    this.loadInitialLesson();
  }
}

export const lessonSidebar = new LessonSidebar();
