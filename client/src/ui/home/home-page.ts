// src/ui/home/home-page.ts
import { customElement, property, state } from 'lit/decorators.js';
import { TailwindLitElement } from '../../tailwind-element';
import { html } from 'lit';
import '../components/button';

@customElement('home-page')
export class HomePage extends TailwindLitElement {
   @property({ type: Boolean }) isAuthenticated = false;
   @property({ type: String }) username = '';

   @state() private showHowToPlay = false;

   private handleLogin() {
      this.dispatchEvent(new CustomEvent('login'));
   }

   private handleRegister() {
      this.dispatchEvent(new CustomEvent('register'));
   }

   private handleGuestLogin() {
      this.dispatchEvent(new CustomEvent('guest-login'));
   }

   private handlePlay() {
      this.dispatchEvent(new CustomEvent('play'));
   }

   private handleLogout() {
      this.dispatchEvent(new CustomEvent('logout'));
   }

   private handleHowToPlay() {
      this.showHowToPlay = true;
   }

   private handleCloseHowToPlay() {
      this.showHowToPlay = false;
   }

   render() {
      return html`
         <!-- Header/Navigation - Now with relative positioning -->
         <header class="relative w-full p-4 flex justify-between items-center z-10">
            <div class="text-xl font-game text-white">TITAN BLAST</div>

            <!-- Authentication buttons now aligned to the right -->
            <div>
               ${this.isAuthenticated
                  ? html`
                       <div class="flex items-center gap-4">
                          <span class="text-white"
                             >Welcome, <span class="text-game-primary font-bold">${this.username}</span></span
                          >
                          <game-button variant="secondary" size="sm" text="Logout" @click=${this.handleLogout}>
                          </game-button>
                       </div>
                    `
                  : html`
                       <div class="flex gap-2 justify-end">
                          <game-button variant="secondary" size="sm" text="Login" @click=${this.handleLogin}>
                          </game-button>
                          <game-button variant="primary" size="sm" text="Register" @click=${this.handleRegister}>
                          </game-button>
                       </div>
                    `}
            </div>
         </header>

         <!-- Main Content - Added margin-top to move content down -->
         <main class="flex flex-col items-center justify-center h-full pb-16">
            <div class="flex flex-col items-center mb-20 mt-20 animate-float">
               <h1 class="text-8xl font-game font-bold text-white mb-4 text-center">
                  <span class="text-game-primary">TITAN</span> BLAST
               </h1>
               <p class="text-2xl text-game-light font-game">Cooperative Alien Defense</p>
            </div>

            <!-- Action Buttons -->
            <div class="flex flex-col gap-6 items-center">
               <game-button variant="primary" size="lg" text="PLAY NOW" @click=${this.handlePlay}></game-button>

               ${!this.isAuthenticated
                  ? html`
                       <game-button variant="secondary" text="Play as Guest" @click=${this.handleGuestLogin}>
                       </game-button>
                    `
                  : ''}

               <div class="mt-6 flex gap-4">
                  <game-button variant="accent" size="sm" text="How to Play"
                               @click=${this.handleHowToPlay}></game-button>
                  <!--                  <game-button variant="accent" size="sm" text="Leaderboard"></game-button>-->
               </div>
            </div>

            <!-- Game Features -->
            <div class="absolute bottom-4 left-0 right-0 flex justify-center gap-8 text-center text-game-light">
               <div>
                  <div class="text-game-primary text-2xl font-bold mb-1">4</div>
                  <div class="text-sm">Player Co-op</div>
               </div>
               <div>
                  <div class="text-game-secondary text-2xl font-bold mb-1">4</div>
                  <div class="text-sm">Character Classes</div>
               </div>
               <div>
                  <div class="text-game-accent text-2xl font-bold mb-1">∞</div>
                  <div class="text-sm">Alien Threats</div>
               </div>
            </div>
         </main>

         ${this.showHowToPlay ? html`
            <how-to-play-modal @close=${this.handleCloseHowToPlay}></how-to-play-modal>
         ` : ''}
      `;
   }
}
