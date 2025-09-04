// src/index.ts
import './styles/tailwind.css';
import './ui/app';

// Prevent duplicate initialization
if (!window.__PIXICANVASAPP__) {
   window.__PIXICANVASAPP__ = true;

   (async () => {
      const appElement = document.getElementById('app');
      if (appElement) {
         appElement.innerHTML = '<game-app></game-app>';
      }

      // Listen for the start-game event
      document.addEventListener('start-game', async (event) => {
         const eventDetail = (event as CustomEvent).detail;
         console.log('Starting game initialization...');

         // Show loading screen
         const loadingElement = document.createElement('div');
         loadingElement.className = 'loading-overlay';
         loadingElement.innerHTML = `
            <div class="loading-content">
               <div class="w-16 h-16 border-4 border-t-game-primary border-b-game-secondary border-r-transparent rounded-full animate-spin mb-4"></div>
               <p class="text-xl font-game text-white">Loading Game Assets...</p>
            </div>
         `;
         document.body.appendChild(loadingElement);

         try {
            const { AssetLoader } = await import('./game/AssetLoader');
            const { default: FrontendGame } = await import('./game/FrontendGame');

            const assetLoader = new AssetLoader();
            await assetLoader.loadAllAssets();

            const app = new FrontendGame(assetLoader, eventDetail.user);
            await app.init();

            document.body.removeChild(loadingElement);
            if (appElement) {
               appElement.innerHTML = '';
            }
         } catch (error) {
            console.error('Failed to load game:', error);
            // Show error message to user
            loadingElement.innerHTML = `
               <div class="loading-content">
                  <p class="text-xl font-game text-red-500">Error loading game assets!</p>
                  <p class="text-game-light">Please check the console for details.</p>
                  <button id="retry-button" class="mt-4 px-4 py-2 bg-game-primary text-black font-bold rounded">
                     Retry
                  </button>
               </div>
            `;
            document.getElementById('retry-button')?.addEventListener('click', () => {
               document.body.removeChild(loadingElement);
               document.dispatchEvent(new CustomEvent('start-game'));
            });
         }
      });
   })();
}
