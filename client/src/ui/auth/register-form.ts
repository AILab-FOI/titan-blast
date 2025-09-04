// src/ui/auth/register-form.ts
import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { TailwindLitElement } from '../../tailwind-element';
import '../components/button';

@customElement('register-form')
export class RegisterForm extends TailwindLitElement {
   @state() private username: string = '';
   @state() private email: string = '';
   @state() private password: string = '';
   @state() private confirmPassword: string = '';
   @state() private agreeTerms: boolean = false;

   @state() private usernameError: string = '';
   @state() private emailError: string = '';
   @state() private passwordError: string = '';
   @state() private confirmPasswordError: string = '';
   @state() private termsError: string = '';

   private validateForm(): boolean {
      let isValid = true;

      // Reset errors
      this.usernameError = '';
      this.emailError = '';
      this.passwordError = '';
      this.confirmPasswordError = '';
      this.termsError = '';

      // Validate username
      if (!this.username.trim()) {
         this.usernameError = 'Username is required';
         isValid = false;
      } else if (this.username.length < 3) {
         this.usernameError = 'Username must be at least 3 characters';
         isValid = false;
      } else if (this.username.length > 20) {
         this.usernameError = 'Username cannot exceed 20 characters';
         isValid = false;
      } else if (!/^[a-zA-Z0-9_]+$/.test(this.username)) {
         this.usernameError = 'Username can only contain letters, numbers, and underscores';
         isValid = false;
      }

      if (this.email && !/^\S+@\S+\.\S+$/.test(this.email)) {
         this.emailError = 'Please enter a valid email address';
         isValid = false;
      }

      // Validate password
      if (!this.password) {
         this.passwordError = 'Password is required';
         isValid = false;
      } else if (this.password.length < 8) {
         this.passwordError = 'Password must be at least 8 characters';
         isValid = false;
      } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()]).+$/.test(this.password)) {
         this.passwordError = 'Password must include uppercase, lowercase, number, and special character';
         isValid = false;
      }

      // Validate confirm password
      if (this.password !== this.confirmPassword) {
         this.confirmPasswordError = 'Passwords do not match';
         isValid = false;
      }

      return isValid;
   }

   private handleSubmit(e: Event) {
      e.preventDefault();

      if (this.validateForm()) {
         const registerEvent = new CustomEvent('register', {
            detail: {
               username: this.username,
               email: this.email || null,
               password: this.password
            }
         });

         this.dispatchEvent(registerEvent);
      }
   }

   render() {
      return html`
         <form @submit=${this.handleSubmit} class="space-y-4">
            <div>
               <label for="reg-username" class="block text-sm font-medium text-slate-300 mb-1">Username <span class="text-red-500">*</span></label>
               <input
                 type="text"
                 id="reg-username"
                 class="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-game-accent focus:border-transparent transition-all"
                 .value=${this.username}
                 @input=${(e: InputEvent) => this.username = (e.target as HTMLInputElement).value}
                 placeholder="Choose a username (3-20 characters)"
               />
               ${this.usernameError ? html`<p class="mt-1 text-sm text-red-400">${this.usernameError}</p>` : ''}
            </div>

            <div>
               <label for="reg-email" class="block text-sm font-medium text-slate-300 mb-1">Email (Optional)</label>
               <input
                 type="email"
                 id="reg-email"
                 class="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-game-accent focus:border-transparent transition-all"
                 .value=${this.email}
                 @input=${(e: InputEvent) => this.email = (e.target as HTMLInputElement).value}
                 placeholder="Enter your email (recommended)"
               />
               ${this.emailError ? html`<p class="mt-1 text-sm text-red-400">${this.emailError}</p>` : ''}
            </div>

            <div>
               <label for="reg-password" class="block text-sm font-medium text-slate-300 mb-1">Password <span class="text-red-500">*</span></label>
               <input
                 type="password"
                 id="reg-password"
                 class="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-game-accent focus:border-transparent transition-all"
                 .value=${this.password}
                 @input=${(e: InputEvent) => this.password = (e.target as HTMLInputElement).value}
                 placeholder="Create a strong password"
               />
               ${this.passwordError ? html`<p class="mt-1 text-sm text-red-400">${this.passwordError}</p>` : ''}
            </div>

            <div>
               <label for="reg-confirm-password" class="block text-sm font-medium text-slate-300 mb-1">Confirm Password <span class="text-red-500">*</span></label>
               <input
                 type="password"
                 id="reg-confirm-password"
                 class="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-game-accent focus:border-transparent transition-all"
                 .value=${this.confirmPassword}
                 @input=${(e: InputEvent) => this.confirmPassword = (e.target as HTMLInputElement).value}
                 placeholder="Confirm your password"
               />
               ${this.confirmPasswordError ? html`<p class="mt-1 text-sm text-red-400">${this.confirmPasswordError}</p>` : ''}
            </div>


            <div class="pt-2">
               <game-button
                 type="submit"
                 variant="primary"
                 text="Create Account"
                 class="w-full"
               ></game-button>
            </div>

            <!-- Social registration options -->
            <div class="relative my-4">
               <div class="absolute inset-0 flex items-center">
                  <div class="w-full border-t border-slate-700"></div>
               </div>
               <div class="relative flex justify-center text-sm">
                  <span class="px-2 bg-slate-800 text-slate-400">Or sign up with</span>
               </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
               <button
                 type="button"
                 class="flex justify-center items-center gap-2 w-full py-2 px-4 bg-slate-900 border border-slate-700 rounded-md text-slate-300 hover:bg-slate-800 transition-colors"
               >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                     <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                  </svg>
                  GitHub
               </button>
               <button
                 type="button"
                 class="flex justify-center items-center gap-2 w-full py-2 px-4 bg-slate-900 border border-slate-700 rounded-md text-slate-300 hover:bg-slate-800 transition-colors"
               >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                     <path d="M15.545 6.558a9.42 9.42 0 0 1 .139 1.626c0 2.434-.87 4.492-2.384 5.885h.002C11.978 15.292 10.158 16 8 16A8 8 0 1 1 8 0a7.689 7.689 0 0 1 5.352 2.082l-2.284 2.284A4.347 4.347 0 0 0 8 3.166c-2.087 0-3.86 1.408-4.492 3.304a4.792 4.792 0 0 0 0 3.063h.003c.635 1.893 2.405 3.301 4.492 3.301 1.078 0 2.004-.276 2.722-.764h-.003a3.702 3.702 0 0 0 1.599-2.431H8v-3.08h7.545z"/>
                  </svg>
                  Google
               </button>
            </div>
         </form>
      `;
   }
}