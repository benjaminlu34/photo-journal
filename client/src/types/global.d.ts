/* Global window augmentations for analytics */
export {};

declare global {
  interface Window {
    posthog?: {
      capture: (event: string, properties?: Record<string, unknown>) => void;
      identify?: (id: string, properties?: Record<string, unknown>) => void;
      reset?: () => void;
    };
  }
}