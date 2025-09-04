// src/ui/auth/auth-modal.ts
import { TailwindLitElement } from '../../tailwind-element';
import { html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../components/button';

@customElement('auth-modal')
export class AuthModal extends TailwindLitElement {
  @property({ type: String }) type: 'login' | 'register' = 'login';
  @property({ type: String }) error = '';
  @property({ type: Boolean }) isLoading = false;

  private handleClose() {
    this.dispatchEvent(new CustomEvent('close'));
  }

  private handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      this.handleClose();
    }
  }

  private switchToLogin() {
    this.dispatchEvent(new CustomEvent('switch-to-login'));
  }

  private switchToRegister() {
    this.dispatchEvent(new CustomEvent('switch-to-register'));
  }

  private handleLogin(e: CustomEvent) {
    this.dispatchEvent(new CustomEvent('login', { detail: e.detail }));
  }

  private handleRegister(e: CustomEvent) {
    this.dispatchEvent(new CustomEvent('register', { detail: e.detail }));
  }

  render() {
    return html`
      <div class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center" @click=${this.handleBackdropClick}>
        <div class="bg-slate-800 border border-slate-700 rounded-lg shadow-xl w-full max-w-md transform transition-all duration-300 animate-slide-up" @click=${(e: Event) => e.stopPropagation()}>
          <div class="flex justify-between items-center p-6 border-b border-slate-700">
            <h2 class="text-2xl font-game text-white">
              ${this.type === 'login' ? 'Sign In' : 'Create Account'}
            </h2>
            <button
              @click=${this.handleClose}
              class="text-slate-400 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="p-6">
            ${this.error ? html`
              <div class="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-6" role="alert">
                ${this.error}
              </div>
            ` : ''}

            ${this.isLoading ? html`
              <div class="flex justify-center py-12">
                <div class="w-12 h-12 border-4 border-t-game-primary border-r-transparent rounded-full animate-spin"></div>
              </div>
            ` : this.type === 'login' ? html`
              <login-form @login=${this.handleLogin}></login-form>
              <div class="mt-6 pt-4 border-t border-slate-700 text-center text-sm text-slate-400">
                Don't have an account?
                <button
                  @click=${this.switchToRegister}
                  class="text-game-accent hover:underline ml-1 font-medium"
                >
                  Create one
                </button>
              </div>
            ` : html`
              <register-form @register=${this.handleRegister}></register-form>
              <div class="mt-6 pt-4 border-t border-slate-700 text-center text-sm text-slate-400">
                Already have an account?
                <button
                  @click=${this.switchToLogin}
                  class="text-game-accent hover:underline ml-1 font-medium"
                >
                  Sign in
                </button>
              </div>
            `}
          </div>
        </div>
      </div>

      <style>
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .animate-slide-up {
          animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
      </style>
    `;
  }
}