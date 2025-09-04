class LRUNode<K, V> {
   constructor(
      public key: K,
      public value: V,
      public prev: LRUNode<K, V> | null = null,
      public next: LRUNode<K, V> | null = null,
   ) {}
}

export class LRUCache<K, V> {
   private cache: Map<K, LRUNode<K, V>>;
   private head: LRUNode<K, V> | null = null;
   private tail: LRUNode<K, V> | null = null;
   private currentSize: number = 0;

   constructor(private capacity: number) {
      this.cache = new Map();
   }

   public get(key: K): V | undefined {
      const node = this.cache.get(key);
      if (!node) return undefined;

      // Move to front (most recently used)
      this.moveToFront(node);
      return node.value;
   }

   public set(key: K, value: V): void {
      const existingNode = this.cache.get(key);

      if (existingNode) {
         // Update existing node
         existingNode.value = value;
         this.moveToFront(existingNode);
      } else {
         // Create new node
         const newNode = new LRUNode(key, value);

         // Add to cache
         this.cache.set(key, newNode);
         this.addToFront(newNode);

         // Check capacity
         if (this.currentSize > this.capacity) {
            this.removeLRU();
         }
      }
   }

   public delete(key: K): boolean {
      const node = this.cache.get(key);
      if (!node) return false;

      this.removeNode(node);
      this.cache.delete(key);
      this.currentSize--;
      return true;
   }

   public clear(): void {
      this.cache.clear();
      this.head = null;
      this.tail = null;
      this.currentSize = 0;
   }

   public getSize(): number {
      return this.currentSize;
   }

   private moveToFront(node: LRUNode<K, V>): void {
      if (node === this.head) return;

      this.removeNode(node);
      this.addToFront(node);
   }

   private addToFront(node: LRUNode<K, V>): void {
      this.currentSize++;

      if (!this.head) {
         this.head = node;
         this.tail = node;
         return;
      }

      node.next = this.head;
      this.head.prev = node;
      this.head = node;
   }

   private removeNode(node: LRUNode<K, V>): void {
      if (node.prev) {
         node.prev.next = node.next;
      } else {
         this.head = node.next;
      }

      if (node.next) {
         node.next.prev = node.prev;
      } else {
         this.tail = node.prev;
      }

      node.prev = null;
      node.next = null;
   }

   private removeLRU(): void {
      if (!this.tail) return;

      const key = this.tail.key;
      this.cache.delete(key);
      this.removeNode(this.tail);
      this.currentSize--;
   }

   public getMRUKeys(): K[] {
      const keys: K[] = [];
      let current = this.head;
      while (current) {
         keys.push(current.key);
         current = current.next;
      }
      return keys;
   }
}