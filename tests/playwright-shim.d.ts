declare module '@playwright/test' {
  export type Page = any;
  export const test: any;
  export const expect: any;
  export function defineConfig(config: any): any;
  export const devices: Record<string, any>;
}
