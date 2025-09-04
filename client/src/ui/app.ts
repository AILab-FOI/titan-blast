import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';

// Import UI components
import './home/home-page';
import './auth/login-form';
import './auth/register-form';
import './auth/auth-modal';
import './components/button';
import './components/how-to-play-modal';
import { AuthService } from '../services/AuthService';
import { TailwindLitElement } from '../tailwind-element';

type AppView = 'home' | 'game' | 'loading';
type AuthModalType = 'login' | 'register' | null;

@customElement('game-app')
export class GameApp extends TailwindLitElement {
   @state() private currentView: AppView = 'home';
   @state() private showAuthModal: AuthModalType = null;
   @state() private isAuthenticated: boolean = false;
   @state() private authError: string = '';
   @state() private isLoading: boolean = false;

   private authService = AuthService.getInstance();

   static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100vh;
    }
  `;

   constructor() {
      super();
      this.isAuthenticated = this.authService.isAuthenticated();
   }

   private showLogin() {
      this.showAuthModal = 'login';
      this.authError = '';
   }

   private showRegister() {
      this.showAuthModal = 'register';
      this.authError = '';
   }

   private closeAuthModal() {
      this.showAuthModal = null;
   }

   private async handleLogin(e: CustomEvent) {
      e.preventDefault();
      this.isLoading = true;
      this.authError = '';

      try {
         const { username, password } = e.detail;
         await this.authService.login(username, password);
         this.isAuthenticated = true;
         this.closeAuthModal();
        console.log("Login successful as: " + username);
      } catch (error) {
         this.authError = error instanceof Error ? error.message : 'Login failed';
      } finally {
         this.isLoading = false;
      }
   }

   private async handleRegister(e: CustomEvent) {
      e.preventDefault();
      this.isLoading = true;
      this.authError = '';

      try {
         const { username, email, password } = e.detail;
         await this.authService.register(username, password, email);
         this.isAuthenticated = true;
         this.closeAuthModal();
        console.log("registration successful as: " + username);
      } catch (error) {
         this.authError = error instanceof Error ? error.message : 'Registration failed';
      } finally {
         this.isLoading = false;
      }
   }

   private async handleGuestLogin() {
      this.isLoading = true;

      try {
         await this.authService.loginAsGuest();
         this.isAuthenticated = true;
      } catch (error) {
         console.error('Guest login failed:', error);
      } finally {
         this.isLoading = false;
      }
   }

  private handlePlay() {
    if (!this.isAuthenticated) {
      this.showLogin();
      return;
    }

    console.log('Starting game as', this.authService.getUser()?.username);

    // Set current view to loading
    this.currentView = 'loading';

    // Create and dispatch the event - make sure the name matches the listener
    // The event needs to bubble up to the document level
    const startGameEvent = new CustomEvent('start-game', {
      detail: {
        user: this.authService.getUser(),
        token: this.authService.getUser()?.token
      },
      bubbles: true,
      composed: true
    });

    this.dispatchEvent(startGameEvent);
  }

   // Handle logout
   private handleLogout() {
      this.authService.logout();
      this.isAuthenticated = false;
   }

   render() {
      // Determine which view to show
      let mainContent;

      switch (this.currentView) {
         case 'home':
            mainContent = html`
          <home-page 
            .isAuthenticated=${this.isAuthenticated}
            .username=${this.authService.getUser()?.username || ''}
            @login=${this.showLogin}
            @register=${this.showRegister}
            @logout=${this.handleLogout}
            @play=${this.handlePlay}
            @guest-login=${this.handleGuestLogin}
          ></home-page>
        `;
            break;

         case 'loading':
            mainContent = html`
          <div class="flex items-center justify-center h-full w-full">
            <div class="text-center">
              <div class="w-16 h-16 border-4 border-t-game-primary border-b-game-secondary border-l-game-accent border-r-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p class="text-xl font-game text-white">Loading Game...</p>
            </div>
          </div>
        `;
            break;

         case 'game':
            mainContent = html`<div>Game goes here</div>`;
            break;
      }

      return html`
      ${mainContent}
      
      ${this.showAuthModal ? html`
        <auth-modal 
          .type=${this.showAuthModal} 
          .error=${this.authError}
          .isLoading=${this.isLoading}
          @close=${this.closeAuthModal}
          @login=${this.handleLogin}
          @register=${this.handleRegister}
          @switch-to-login=${() => this.showAuthModal = 'login'}
          @switch-to-register=${() => this.showAuthModal = 'register'}
        ></auth-modal>
      ` : ''}
    `;
   }
}