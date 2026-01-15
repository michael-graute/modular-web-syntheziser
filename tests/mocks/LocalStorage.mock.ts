/**
 * LocalStorage Mock
 *
 * In-memory localStorage for testing without browser persistence.
 * Based on research.md decision: Use in-memory Map for testing
 */

export class MockLocalStorage implements Storage {
  private data: Map<string, string> = new Map();

  get length(): number {
    return this.data.size;
  }

  getItem(key: string): string | null {
    return this.data.get(key) || null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }

  key(index: number): string | null {
    const keys = Array.from(this.data.keys());
    return keys[index] || null;
  }

  // Test utilities
  getAllKeys(): string[] {
    return Array.from(this.data.keys());
  }

  getAllValues(): Record<string, string> {
    const result: Record<string, string> = {};
    this.data.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
}
