export interface ChunkElement {
   type: string; // Assuming elementType is a string
   layer: number;
}

export interface SerializedChunk {
   x: number;
   y: number;
   elements: ChunkElement[];
}
