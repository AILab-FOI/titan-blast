interface ImportMeta {
   readonly env: {
      readonly VITE_AUTH_SERVICE_URL?: string;
      readonly [key: string]: string | undefined;
   };
}