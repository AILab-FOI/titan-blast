// shared/src/util/NetworkCompression.ts

import { unzlibSync, zlibSync } from 'fflate';

export class CompressionUtil {
   /**
    * Compresses data for network transmission
    * @param data - Any serializable data
    * @returns Compressed base64 string
    */
   public static compress(data: any): string {
      try {
         // Convert data to JSON string, preserving array structure
         const jsonString = JSON.stringify(data);

         // Convert string to Uint8Array
         const uint8Array = new TextEncoder().encode(jsonString);

         // Compress using zlib
         const compressed = zlibSync(uint8Array, { level: 6 });

         // Convert to base64
         return btoa(String.fromCharCode.apply(null, Array.from(compressed)));
      } catch (error) {
         console.error('Compression failed:', error);
         throw error;
      }
   }

   /**
    * Decompresses data back to its original form
    * @param compressedString - Compressed base64 string
    * @returns Original data structure with preserved array types
    */
   public static decompress<T>(compressedString: string): T {
      try {
         // Convert base64 to Uint8Array
         const compressedData = Uint8Array.from(atob(compressedString), (c) => c.charCodeAt(0));

         // Decompress
         const decompressed = unzlibSync(compressedData);

         // Convert back to string and parse JSON
         const jsonString = new TextDecoder().decode(decompressed);
         return JSON.parse(jsonString);
      } catch (error) {
         console.error('Decompression failed:', error);
         throw error;
      }
   }

   /**
    * Determine if data should be compressed based on size and type
    * @param data - Data to evaluate
    * @returns Whether compression should be used
    */
   public static shouldCompress(data: any): boolean {
      // Don't compress small primitives
      if (typeof data !== 'object' || data === null) {
         return false;
      }

      // Always compress arrays
      if (Array.isArray(data)) {
         return true;
      }

      // Estimate size by converting to JSON
      try {
         const jsonString = JSON.stringify(data);
         // Compress if larger than 500 bytes
         return jsonString.length > 500;
      } catch (e) {
         return false;
      }
   }
}