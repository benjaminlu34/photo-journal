/**
 * Utilities for handling binary data, including YJS snapshots
 */

/**
 * Prepares a YJS snapshot for database storage
 * 
 * @param boardId - UUID of the board
 * @param version - Version number
 * @param snapshot - Binary YJS snapshot data
 * @param metadata - Optional metadata
 * @returns Object ready for database insertion
 */
export function prepareSnapshotForStorage(
  boardId: string,
  version: number,
  snapshot: Uint8Array,
  metadata: Record<string, any> = {}
) {
  return {
    boardId,
    version,
    snapshot, // Our custom bytea type handles the conversion
    metadata
  };
}

/**
 * Future enhancement: Compress binary data using gzip
 * 
 * @param data - Binary data to compress
 * @returns Compressed binary data
 */
export async function compressBinary(data: Uint8Array): Promise<Uint8Array> {
  // TODO: Implement compression when needed
  // Example implementation using Node.js zlib:
  // const zlib = await import('zlib');
  // const compressed = zlib.gzipSync(Buffer.from(data));
  // return new Uint8Array(compressed);
  
  return data; // Return uncompressed for now
}

/**
 * Future enhancement: Decompress binary data
 * 
 * @param compressedData - Compressed binary data
 * @returns Decompressed binary data
 */
export async function decompressBinary(compressedData: Uint8Array): Promise<Uint8Array> {
  // TODO: Implement decompression when needed
  // Example implementation using Node.js zlib:
  // const zlib = await import('zlib');
  // const decompressed = zlib.gunzipSync(Buffer.from(compressedData));
  // return new Uint8Array(decompressed);
  
  return compressedData; // Return as-is for now
} 