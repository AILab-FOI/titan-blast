// src/utils/tailwind-element.ts
import { LitElement, css, CSSResult } from "lit";

/**
 * A base class for Lit components that need to use Tailwind CSS classes
 * By default, Lit components use shadow DOM which isolates styles.
 * This component disables shadow DOM to allow Tailwind's global styles to affect it.
 */
export class TailwindLitElement extends LitElement {
  /**
   * Disable shadow DOM so Tailwind classes can apply directly
   */
  createRenderRoot() {
    return this; // Use the component's host element as the render root
  }
}

/**
 * Helper to add component-specific styles along with Tailwind
 */
export const withComponentStyles = (componentStyles: CSSResult | CSSResult[]) => {
  return class extends TailwindLitElement {
    static styles = Array.isArray(componentStyles) ? componentStyles : [componentStyles];
  };
};