export class InvalidBodyTypeError extends Error {
   constructor(message?: string) {
      super(message || 'Invalid body type');
      this.name = 'InvalidBodyTypeError';
   }
}

export class InvalidMapDefinitionError extends Error {
   constructor(message?: string) {
      super(message || 'Invalid map definition');
      this.name = 'InvalidMapDefinition';
   }
}