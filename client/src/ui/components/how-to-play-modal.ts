// src/ui/components/how-to-play-modal.ts
import { TailwindLitElement } from '../../tailwind-element';
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import './button';

@customElement('how-to-play-modal')
export class HowToPlayModal extends TailwindLitElement {

   private handleClose() {
      this.dispatchEvent(new CustomEvent('close'));
   }

   private handleBackdropClick(e: MouseEvent) {
      if (e.target === e.currentTarget) {
         this.handleClose();
      }
   }

   render() {
      return html`
         <div class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              @click=${this.handleBackdropClick}>
            <div
               class="bg-slate-800 border border-slate-700 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto transform transition-all duration-300"
               @click=${(e: Event) => e.stopPropagation()}>

               <!-- Header -->
               <div
                  class="flex justify-between items-center p-6 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
                  <h2 class="text-3xl font-game text-white">How to Play</h2>
                  <button
                     @click=${this.handleClose}
                     class="text-slate-400 hover:text-white transition-colors p-1"
                  >
                     <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                     </svg>
                  </button>
               </div>

               <!-- Content -->
               <div class="p-6 space-y-6">

                  <!-- Game Objective -->
                  <section>
                     <h3 class="text-xl font-game text-game-primary mb-3">Objective</h3>
                     <div class="bg-slate-900/50 rounded-lg p-4 border border-slate-600">
                        <p class="text-slate-300 leading-relaxed">
                           Survive the endless alien invasion for as long as possible! Work together with up to 3 other
                           players to fight off waves of increasingly dangerous enemies. Coordinate your strategies,
                           share resources, and watch each other's backs to achieve the highest score.
                        </p>
                     </div>
                  </section>

                  <!-- Controls Section -->
                  <section>
                     <h3 class="text-xl font-game text-game-secondary mb-3">Controls</h3>
                     <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

                        <!-- Movement -->
                        <div class="bg-slate-900/50 rounded-lg p-4 border border-slate-600">
                           <h4 class="text-lg font-game text-game-accent mb-2">Movement</h4>
                           <div class="space-y-2 text-sm text-slate-300">
                              <div class="flex justify-between">
                                 <span>Move Up</span>
                                 <span class="font-mono bg-slate-700 px-2 py-1 rounded">W / ↑</span>
                              </div>
                              <div class="flex justify-between">
                                 <span>Move Down</span>
                                 <span class="font-mono bg-slate-700 px-2 py-1 rounded">S / ↓</span>
                              </div>
                              <div class="flex justify-between">
                                 <span>Move Left</span>
                                 <span class="font-mono bg-slate-700 px-2 py-1 rounded">A / ←</span>
                              </div>
                              <div class="flex justify-between">
                                 <span>Move Right</span>
                                 <span class="font-mono bg-slate-700 px-2 py-1 rounded">D / →</span>
                              </div>
                           </div>
                        </div>

                        <!-- Combat -->
                        <div class="bg-slate-900/50 rounded-lg p-4 border border-slate-600">
                           <h4 class="text-lg font-game text-game-accent mb-2">Combat</h4>
                           <div class="space-y-2 text-sm text-slate-300">
                              <div class="flex justify-between">
                                 <span>Aim</span>
                                 <span class="font-mono bg-slate-700 px-2 py-1 rounded">Mouse</span>
                              </div>
                              <div class="flex justify-between">
                                 <span>Shoot</span>
                                 <span class="font-mono bg-slate-700 px-2 py-1 rounded">Left Click</span>
                              </div>
                              <div class="flex justify-between">
                                 <span>Reload</span>
                                 <span class="font-mono bg-slate-700 px-2 py-1 rounded">R</span>
                              </div>
                           </div>
                        </div>

                        <!-- Tips -->
                        <div class="bg-slate-900/50 rounded-lg p-4 border border-slate-600">
                           <h4 class="text-lg font-game text-game-accent mb-2">Pro Tips</h4>
                           <div class="space-y-1 text-sm text-slate-300">
                              <p>• Hold Left Click for automatic fire</p>
                              <p>• Watch your ammo counter</p>
                              <p>• Stay close to teammates</p>
                              <p>• Different enemies have different weaknesses</p>
                           </div>
                        </div>

                     </div>
                  </section>

                  <!-- Multiplayer -->
                  <section>
                     <h3 class="text-xl font-game text-game-primary mb-3">Multiplayer</h3>
                     <div class="bg-slate-900/50 rounded-lg p-4 border border-slate-600">
                        <div class="space-y-3 text-slate-300">
                           <p class="leading-relaxed">
                              <strong class="text-game-accent">Team up with friends:</strong> Up to 4 players can join
                              the same game session
                           </p>
                           <p class="leading-relaxed">
                              <strong class="text-game-accent">Shared objectives:</strong> All players work together to
                              survive waves
                           </p>
                           <p class="leading-relaxed">
                              <strong class="text-game-accent">Communication is key:</strong> Coordinate attacks and
                              cover each other
                           </p>
                        </div>
                     </div>
                  </section>

               </div>

               <!-- Footer -->
               <div class="p-6 border-t border-slate-700 text-center">
                  <game-button
                     variant="primary"
                     text="Got it!"
                     @click=${this.handleClose}>
                  </game-button>
                  <p class="text-xs text-slate-500 mt-3">
                     Good luck, soldier! The fate of humanity depends on you.
                  </p>
               </div>

            </div>
         </div>
      `;
   }
}