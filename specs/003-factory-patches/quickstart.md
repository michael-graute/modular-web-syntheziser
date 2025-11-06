# Quickstart Guide: Factory Patches

**Feature**: 003-factory-patches
**Target Audience**: Developers implementing this feature
**Date**: 2025-10-31

## Overview

This guide walks you through implementing factory patches - pre-built synthesizer patches that ship with the application and can be loaded by users. The implementation extends existing patch infrastructure with minimal changes.

**Estimated Implementation Time**: 4-6 hours

---

## Prerequisites

Before starting:
- [ ] Familiarize yourself with `src/patch/PatchManager.ts`
- [ ] Familiarize yourself with `src/patch/PatchStorage.ts`
- [ ] Familiarize yourself with `src/ui/LoadModal.ts`
- [ ] Understand the `PatchData` interface in `src/core/types.ts`
- [ ] Review the feature spec at `specs/003-factory-patches/spec.md`

---

## Implementation Steps

### Step 1: Extend PatchData Interface (10 mins)

**File**: `src/core/types.ts`

Add optional `description` field to `PatchData`:

```typescript
export interface PatchData {
  name: string;
  version: string;
  created: string;
  modified: string;
  description?: string;  // ADD THIS LINE
  components: ComponentData[];
  connections: Connection[];
}
```

**Why**: Factory patches need descriptions to help users understand what each patch does.

---

### Step 2: Create FactoryPatchLoader (45 mins)

**File**: `src/patch/FactoryPatchLoader.ts` (NEW)

Implement factory patch loading logic:

```typescript
/**
 * Loads factory patches from static JSON files
 */
export class FactoryPatchLoader {
  private patches: Map<string, PatchData> = new Map();
  private state: 'NOT_LOADED' | 'LOADING' | 'READY' | 'ERROR' = 'NOT_LOADED';

  async loadAll(): Promise<PatchData[]> {
    this.state = 'LOADING';

    const patchFiles = [
      'basic-oscillator.json',
      'bass-synth.json',
      'pad-sound.json'
    ];

    try {
      const results = await Promise.allSettled(
        patchFiles.map(filename => this.loadPatch(filename))
      );

      const loaded = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<PatchData>).value);

      this.state = 'READY';
      return loaded;
    } catch (error) {
      this.state = 'ERROR';
      console.error('Failed to load factory patches:', error);
      return [];
    }
  }

  private async loadPatch(filename: string): Promise<PatchData> {
    const response = await fetch(`/patches/factory/${filename}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${filename}`);
    }

    const data = await response.json();

    if (!this.validatePatch(data)) {
      throw new Error(`Invalid patch format: ${filename}`);
    }

    this.patches.set(filename, data);
    return data;
  }

  private validatePatch(data: any): data is PatchData {
    return (
      typeof data === 'object' &&
      typeof data.name === 'string' &&
      typeof data.version === 'string' &&
      Array.isArray(data.components) &&
      Array.isArray(data.connections)
    );
  }

  getAll(): PatchData[] {
    return Array.from(this.patches.values());
  }

  isReady(): boolean {
    return this.state === 'READY';
  }
}

export const factoryPatchLoader = new FactoryPatchLoader();
```

**Testing**:
- Create test JSON file in `/public/patches/factory/test.json`
- Call `factoryPatchLoader.loadAll()` in console
- Verify patches are loaded without errors

---

### Step 3: Update LoadModal UI (60 mins)

**File**: `src/ui/LoadModal.ts`

Add tabbed interface for Factory vs. My Patches:

**3a. Add category state**:
```typescript
export class LoadModal extends Modal {
  private patchList: HTMLDivElement;
  private currentCategory: 'user' | 'factory' = 'user';  // ADD THIS
  // ... existing properties
}
```

**3b. Create tab navigation**:
```typescript
private createTabs(): HTMLDivElement {
  const tabs = document.createElement('div');
  tabs.style.cssText = `
    display: flex;
    gap: 2px;
    margin-bottom: 16px;
    border-bottom: 2px solid var(--border-color, #444);
  `;

  const userTab = this.createTab('My Patches', this.currentCategory === 'user');
  const factoryTab = this.createTab('Factory', this.currentCategory === 'factory');

  userTab.addEventListener('click', () => this.switchCategory('user'));
  factoryTab.addEventListener('click', () => this.switchCategory('factory'));

  tabs.appendChild(userTab);
  tabs.appendChild(factoryTab);

  return tabs;
}

private createTab(label: string, active: boolean): HTMLButtonElement {
  const tab = document.createElement('button');
  tab.textContent = label;
  tab.style.cssText = `
    padding: 10px 20px;
    border: none;
    border-bottom: 3px solid ${active ? 'var(--accent-color, #0066cc)' : 'transparent'};
    background: ${active ? 'var(--bg-secondary, #1a1a1a)' : 'transparent'};
    color: var(--text-primary, #ffffff);
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: ${active ? '600' : '400'};
    transition: all 0.2s;
  `;

  return tab;
}

private switchCategory(category: 'user' | 'factory'): void {
  this.currentCategory = category;
  this.refreshPatchList();
}
```

**3c. Update setupContent() to include tabs**:
```typescript
private setupContent(): void {
  const body = this.getBody();
  body.innerHTML = '';
  body.style.display = 'flex';
  body.style.flexDirection = 'column';

  // Add tabs
  body.appendChild(this.createTabs());  // ADD THIS

  // Info text
  const info = document.createElement('p');
  info.textContent = this.currentCategory === 'user'
    ? 'Select a patch to load:'
    : 'Select a factory patch to load:';
  // ... rest of existing code
}
```

**3d. Update refreshPatchList() to handle categories**:
```typescript
private refreshPatchList(): void {
  this.patchList.innerHTML = '';

  let patches: PatchMetadata[];

  if (this.currentCategory === 'user') {
    patches = patchManager.getAllPatches();  // Existing code
  } else {
    // Load factory patches
    patches = factoryPatchLoader.getAll().map(patch => ({
      name: patch.name,
      modified: patch.modified,
      description: patch.description
    }));
  }

  // Render patches (rest of existing code)
  // ...
}
```

**Testing**:
- Open Load modal
- Verify two tabs appear: "My Patches" and "Factory"
- Click "Factory" tab and verify it switches
- Verify factory patches display correctly

---

### Step 4: Create Factory Patch JSON Files (30 mins)

**Directory**: `/public/patches/factory/`

Create at least 3 starter patches:

**4a. Basic Oscillator** (`basic-oscillator.json`):
```json
{
  "name": "Basic Oscillator",
  "version": "1.0.0",
  "description": "A simple sine wave oscillator connected to the master output. Perfect for testing audio routing.",
  "created": "2025-10-31T00:00:00Z",
  "modified": "2025-10-31T00:00:00Z",
  "components": [
    {
      "id": "osc-1",
      "type": "OSCILLATOR",
      "position": { "x": 150, "y": 150 },
      "parameters": {
        "waveform": 0,
        "frequency": 440,
        "detune": 0
      }
    },
    {
      "id": "master-1",
      "type": "MASTER_OUTPUT",
      "position": { "x": 400, "y": 150 },
      "parameters": {
        "volume": 0.5
      }
    }
  ],
  "connections": [
    {
      "id": "conn-1",
      "sourceId": "osc-1",
      "sourcePort": "audio-out",
      "targetId": "master-1",
      "targetPort": "audio-in"
    }
  ]
}
```

**4b. Bass Synth** (`bass-synth.json`):
Create a patch with Oscillator → Filter → Master Output

**4c. Pad Sound** (`pad-sound.json`):
Create a patch with multiple detuned oscillators, chorus, and reverb

**Pro Tip**: Build each patch in the UI, export to JSON, then add the description field manually.

---

### Step 5: Initialize Factory Patches on Startup (15 mins)

**File**: `src/main.ts`

Load factory patches during application initialization:

```typescript
async function init(): Promise<void> {
  // ... existing initialization code

  // Load factory patches
  try {
    await factoryPatchLoader.loadAll();
    console.log('✅ Factory patches loaded');
  } catch (error) {
    console.warn('⚠️ Failed to load factory patches:', error);
    // Continue anyway - app still works without factory patches
  }

  // ... rest of initialization
}
```

**Testing**:
- Refresh the app
- Check console for "Factory patches loaded" message
- Open Load modal and verify factory patches appear

---

### Step 6: Handle Read-Only Behavior (20 mins)

**File**: `src/ui/LoadModal.ts`

Factory patches should not show delete button:

```typescript
private createPatchItem(patch: PatchMetadata): HTMLDivElement {
  const item = document.createElement('div');
  // ... existing item creation code

  // Only show delete button for user patches
  if (this.currentCategory === 'user') {
    const deleteBtn = this.createDeleteButton(patch.name);
    item.appendChild(deleteBtn);
  }

  return item;
}
```

**Testing**:
- Switch to "Factory" tab
- Verify no delete buttons appear
- Switch to "My Patches" tab
- Verify delete buttons are present

---

## Verification Checklist

After implementation, verify:

- [ ] Factory patches load on application startup without errors
- [ ] LoadModal displays two tabs: "My Patches" and "Factory"
- [ ] Clicking "Factory" tab shows factory patches
- [ ] Factory patches display description text
- [ ] Selecting and loading a factory patch works correctly
- [ ] Loaded factory patch plays audio when keyboard is pressed
- [ ] No delete button appears for factory patches
- [ ] Invalid factory patch files are skipped gracefully
- [ ] Missing factory patches folder doesn't crash the app
- [ ] User patches in localStorage still work normally

---

## Common Issues & Solutions

### Issue: Factory patches not loading

**Solution**: Check browser console for fetch errors. Verify files exist in `/public/patches/factory/` and are valid JSON.

### Issue: "404 Not Found" errors

**Solution**: Vite serves `/public` folder at root. Paths should be `/patches/factory/file.json`, not `/public/patches/factory/file.json`.

### Issue: Tabs not switching

**Solution**: Verify `switchCategory()` is updating `currentCategory` and calling `refreshPatchList()`.

### Issue: Factory patches show delete button

**Solution**: Check the `createPatchItem()` conditional - delete button should only render when `currentCategory === 'user'`.

---

## Next Steps

After completing implementation:

1. Create 2-3 additional factory patches (lead sound, arpeggio, etc.)
2. Add loading spinner while factory patches load
3. Consider adding patch preview/thumbnail images
4. Test with screen reader for accessibility

---

## Additional Resources

- **Feature Spec**: `specs/003-factory-patches/spec.md`
- **Data Model**: `specs/003-factory-patches/data-model.md`
- **Research**: `specs/003-factory-patches/research.md`
- **Contracts**: `specs/003-factory-patches/contracts/factory-patch-format.ts`
