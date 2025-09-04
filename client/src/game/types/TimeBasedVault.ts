export interface TimeBasedVaultEntry<T> {
   older: T;
   newer: T;
}

export class TimeBasedVault<T extends { timestamp: number }> {
   protected vault: T[] = [];
   protected maxSize: number;
   protected timeThreshold: number;

   constructor(maxSize: number = 120, timeThreshold: number = 50) {
      this.maxSize = maxSize;
      this.timeThreshold = timeThreshold;
   }

   public add(state: T): void {
      if (this.vault.length >= this.maxSize) {
         // Remove oldest state
         this.vault.sort((a, b) => a.timestamp - b.timestamp).shift();
      }
      this.vault.push(state);
   }

   public get(timestamp: number): T | undefined {
      const sorted = this.vault.sort((a, b) => b.timestamp - a.timestamp);

      // Find states around the target timestamp
      for (let i = 0; i < sorted.length; i++) {
         const current = sorted[i];
         const next = sorted[i + 1];

         if (!next) {
            // We're at the end, return the last state
            console.log('AT THE END, RETURNING LAST STATE');
            return current;
         }

         if (current.timestamp >= timestamp && next.timestamp <= timestamp) {
            // Return the closest state based on timestamp difference
            const currentDiff = Math.abs(timestamp - current.timestamp);
            const nextDiff = Math.abs(timestamp - next.timestamp);
            console.log('vault diffs:', currentDiff, nextDiff);

            return currentDiff < nextDiff ? current : next;
         }
      }

      console.log('returning UNDEFINED');
      return undefined;
   }

   public getLatest(): T | undefined {
      if (this.vault.length === 0) return undefined;
      return this.vault.sort((a, b) => b.timestamp - a.timestamp)[0];
   }

   public getStatesInRange(startTime: number, endTime: number): T[] {
      return this.vault
         .filter((state) => state.timestamp >= startTime && state.timestamp <= endTime)
         .sort((a, b) => a.timestamp - b.timestamp);
   }

   public removeOlderThan(timestamp: number): void {
      this.vault = this.vault.filter((state) => state.timestamp > timestamp);
   }

   public clear(): void {
      this.vault = [];
   }

   public get size(): number {
      return this.vault.length;
   }

   public setMaxSize(size: number): void {
      this.maxSize = size;
      if (this.vault.length > size) {
         // Keep only the newest entries up to maxSize
         this.vault = this.vault.sort((a, b) => b.timestamp - a.timestamp).slice(0, size);
      }
   }

   public getMaxSize(): number {
      return this.maxSize;
   }
}
