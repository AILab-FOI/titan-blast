declare module '*.wasm' {
   const content: any;
   export default content;
}

declare namespace WebAssembly {
   interface Module {}
   interface Instance {
      exports: any;
   }
   interface Memory {
      buffer: ArrayBuffer;
   }
}
