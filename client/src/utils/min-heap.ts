/**
 * MinHeap - Generic binary min-heap with custom comparator
 * Usage:
 *   const heap = new MinHeap<number>((a, b) => a - b);
 *   heap.push(3); heap.push(1); heap.pop(); // -> 1
 */
export class MinHeap<T> {
  private data: T[] = [];
  private readonly compare: (a: T, b: T) => number;

  constructor(compare: (a: T, b: T) => number) {
    this.compare = compare;
  }

  push(value: T): void {
    this.data.push(value);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.isEmpty()) {
      return undefined;
    }
    const size = this.size();
    if (size === 1) {
      return this.data.pop();
    }
    this.swap(0, size - 1);
    const min = this.data.pop();
    this.bubbleDown(0);
    return min;
  }

  peek(): T | undefined {
    return this.data[0];
  }

  isEmpty(): boolean {
    return this.data.length === 0;
  }

  size(): number {
    return this.data.length;
  }

  clear(): void {
    this.data.length = 0;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.data[parent], this.data[index]) <= 0) break;
      this.swap(parent, index);
      index = parent;
    }
  }

  private bubbleDown(index: number): void {
    const length = this.data.length;
    while (true) {
      const left = index * 2 + 1;
      const right = index * 2 + 2;
      let smallest = index;

      if (left < length && this.compare(this.data[left], this.data[smallest]) < 0) {
        smallest = left;
      }
      if (right < length && this.compare(this.data[right], this.data[smallest]) < 0) {
        smallest = right;
      }
      if (smallest === index) break;
      this.swap(index, smallest);
      index = smallest;
    }
  }

  private swap(i: number, j: number): void {
    const tmp = this.data[i];
    this.data[i] = this.data[j];
    this.data[j] = tmp;
  }
}