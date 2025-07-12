import { describe, it, expect } from 'vitest';
import { yjs_snapshots } from '../../shared/schema';
import { prepareSnapshotForStorage, compressBinary, decompressBinary } from '../../server/utils/binary-utils';

describe('Schema', () => {
  it('yjs_snapshots table should be defined', () => {
    expect(yjs_snapshots).toBeDefined();
  });

  it('yjs_snapshots table should have the correct columns', () => {
    const columnNames = Object.keys(yjs_snapshots);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('boardId');
    expect(columnNames).toContain('version');
    expect(columnNames).toContain('snapshot');
    expect(columnNames).toContain('createdAt');
    expect(columnNames).toContain('metadata');
  });
});

describe('Binary Utils', () => {
  it('should prepare snapshot for storage with Buffer type', () => {
    // Create sample binary data
    const originalData = new Uint8Array([1, 2, 3, 255, 0, 128]);
    
    // Prepare for storage
    const prepared = prepareSnapshotForStorage('test-board-id', 1, originalData);
    
    // Verify the data structure
    expect(prepared.boardId).toBe('test-board-id');
    expect(prepared.version).toBe(1);
    
    // With our custom bytea type, the snapshot is passed directly as Uint8Array
    expect(prepared.snapshot).toBe(originalData);
    expect(prepared.snapshot).toBeInstanceOf(Uint8Array);
    
    // Verify the binary data is preserved
    const snapshotArray = new Uint8Array(prepared.snapshot);
    expect(snapshotArray.length).toBe(originalData.length);
    for (let i = 0; i < originalData.length; i++) {
      expect(snapshotArray[i]).toBe(originalData[i]);
    }
  });
  
  it('should have placeholder compression functions', async () => {
    // Create sample binary data
    const originalData = new Uint8Array([1, 2, 3, 255, 0, 128]);
    
    // Test compression (currently a no-op)
    const compressed = await compressBinary(originalData);
    expect(compressed).toBe(originalData); // Same reference for now
    
    // Test decompression (currently a no-op)
    const decompressed = await decompressBinary(compressed);
    expect(decompressed).toBe(compressed); // Same reference for now
  });
}); 