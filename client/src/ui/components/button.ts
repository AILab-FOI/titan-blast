// src/ui/components/button.ts
import { html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { LitElement } from "lit";
import { TailwindLitElement } from "../../tailwind-element";

@customElement("game-button")
export class GameButton extends TailwindLitElement {
  @property({ type: String }) variant = "primary";
  @property({ type: String }) size = "md";
  @property({ type: Boolean }) disabled = false;
  @property({ type: String }) type = "button";
  @property({ type: String }) text = "Button";

  render() {
    // Base styles for all buttons
    const baseClasses = "font-game font-bold rounded-md transition-all duration-150 border-2 border-black";

    // Size-specific classes
    const sizeClasses = {
      sm: "text-sm py-1 px-3",
      md: "py-2 px-4",
      lg: "text-lg py-3 px-6"
    }[this.size] || "py-2 px-4";

    // Variant-specific classes
    const variantClasses = {
      primary: "bg-game-primary text-black shadow-[0_4px_0_0_rgba(0,0,0,0.3)] hover:bg-[#E6B800] hover:shadow-[0_6px_0_0_rgba(0,0,0,0.3)]",
      secondary: "bg-game-secondary text-white shadow-[0_4px_0_0_rgba(0,0,0,0.3)] hover:bg-[#2970E6] hover:shadow-[0_6px_0_0_rgba(0,0,0,0.3)]",
      accent: "bg-game-accent text-white shadow-[0_4px_0_0_rgba(0,0,0,0.3)] hover:bg-[#7C4DDD] hover:shadow-[0_6px_0_0_rgba(0,0,0,0.3)]"
    }[this.variant] || "bg-game-primary text-black shadow-[0_4px_0_0_rgba(0,0,0,0.3)]";

    // State classes
    const stateClasses = this.disabled
      ? "opacity-50 cursor-not-allowed"
      : "hover:translate-y-[-2px] active:translate-y-[2px] active:shadow-none";

    return html`
      <button
        type=${this.type}
        class="${baseClasses} ${sizeClasses} ${variantClasses} ${stateClasses}"
        ?disabled=${this.disabled}
      >
        ${this.text}
      </button>
    `;
  }
}