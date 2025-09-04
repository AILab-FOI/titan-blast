import { FrontendPlayer } from './FrontendPlayer';
import { RenderManager } from './rendering/RenderManager';
import { gameSettings } from 'shared/game/SystemSettings';
import { Position } from 'shared/game/Position';

export class Camera {
   /**
    * The render manager instance
    */
   private renderManager: RenderManager;

   /**
    * The player instance the camera is focused on
    */
   private player: FrontendPlayer | null = null;

   /**
    * The design width for the camera view. Defines how many pixels of the map's width player can see by default.
    * When screenWidth goes above this value, camera will zoom in. For example if player has monitor width larger than
    * 1920 pixels, he wont see the map further, map will zoom in instead.
    */
   private static readonly designWidth: number = gameSettings.gameWidth;

   /**
    * The design height for the camera view. Defines how many pixels of the map's height player can see by default.
    * After screenHeight goes above this value, camera will zoom in.
    */
   private static readonly designHeight: number = gameSettings.gameHeight;

   /**
    * The horizontal screen offset.
    * Defines the distance in pixels between the left edge of the screen and the left-most visible point on the map.
    * @public
    * @type {number}
    */
   public screenOffsetX = 0;

   /**
    * The vertical screen offset.
    * Defines the distance in pixels between the top edge of the screen and the top-most visible point on the map.
    * @public
    * @type {number}
    */
   public screenOffsetY = 0;

   /**
    * The aspect scale factor.
    * Defines the scaling factor applied to the stage to maintain the correct aspect ratio of the game world
    * relative to the screen size. This value ensures that the game world appears correctly proportioned
    * regardless of the screen's dimensions. It adjusts based on the window's current width and height
    * to preserve the designed aspect ratio.
    * @private
    * @type {number}
    */
   private aspectScale: number = 1;

   constructor(renderManager: RenderManager) {
      this.renderManager = renderManager;
      this.onResize = this.onResize.bind(this);
      window.addEventListener('resize', this.onResize);
   }

   /**
    * Focus the camera on a specific player.
    * @param {FrontendPlayer} player - The player to focus on
    */
   public focusPlayer(player: FrontendPlayer): void {
      this.player = player;
      this.updateCamera();
   }

   /**
    * Retrieve screen relative coordinates of a global map position.
    * If it is outside of the screen view, return null.
    * @param {Position} position - The global map position
    * @returns {{ x: number; y: number } | null} - The screen relative coordinates or null if outside of the screen view
    */
   public getScreenPosition(position: Position): { x: number; y: number } | null {
      if (!this.player) return null; // Ensure the camera has a player to base calculations on

      const screen = this.renderManager.getApp().screen;
      const scale = this.renderManager.getApp().stage.scale;
      const playerContainer = this.player.renderComponent.container;

      // Calculate the offset from the player container to the global position
      const mapPositionX = position.x - playerContainer.x;
      const mapPositionY = position.y - playerContainer.y;

      // Apply the camera scale
      const scaledX = mapPositionX * scale.x;
      const scaledY = mapPositionY * scale.y;

      // Convert to screen coordinates considering the camera's screen offset
      const screenX = scaledX + screen.width / 2 - this.screenOffsetX;
      const screenY = scaledY + screen.height / 2 - this.screenOffsetY;

      // Check if the position is within screen bounds
      if (screenX < 0 || screenX > screen.width || screenY < 0 || screenY > screen.height) {
         return null; // Position is outside of screen bounds
      }

      return { x: screenX, y: screenY };
   }

   public screenToWorldPosition(screenPosition: Position): Position | null {
      if (!this.player) return null; // Ensure the camera has a player to base calculations on

      const app = this.renderManager.getApp();
      const scale = app.stage.scale.x;

      // Get screen center (where the player is)
      const screenCenterX = app.screen.width / 2;
      const screenCenterY = app.screen.height / 2;

      // Calculate the difference from screen center
      const deltaX = (screenPosition.x - screenCenterX) / scale;
      const deltaY = (screenPosition.y - screenCenterY) / scale;

      // Get player dimensions from render config
      const playerWidth = this.player.renderComponent.container.width;
      const playerHeight = this.player.renderComponent.container.height;

      // Convert to world coordinates by adding the delta to player position
      return {
         x: this.player.position.x + deltaX,
         y: this.player.position.y + deltaY,
      };
   }

   /**
    * Finds the closest point on the screen edge from a given world position.
    * This ensures bullets animate only to the visible screen edge instead of off-screen.
    *
    * @param {Position} startPos - The starting position of the bullet.
    * @param {number} angle - The angle (in radians) of the bullet trajectory.
    * @returns {Position} - The adjusted end position that lies on the screen edge.
    */
   public getScreenEdgePoint(startPos: Position, angle: number): Position {
      const screen = this.renderManager.getApp().screen;
      const scale = this.renderManager.getApp().stage.scale;

      // Get screen width and height in world coordinates
      const screenWidthWorld = screen.width / scale.x;
      const screenHeightWorld = screen.height / scale.y;

      // Find world boundaries (assuming player is centered)
      const playerPos = this.player?.position || { x: 0, y: 0 };
      const left = playerPos.x - screenWidthWorld / 2;
      const right = playerPos.x + screenWidthWorld / 2;
      const top = playerPos.y - screenHeightWorld / 2;
      const bottom = playerPos.y + screenHeightWorld / 2;

      // Calculate intersection with screen edges
      let edgeX = right,
         edgeY = bottom;
      const slope = Math.tan(angle);

      // Determine which screen edge to hit first
      if (Math.abs(slope) > screenHeightWorld / screenWidthWorld) {
         // Hit top/bottom first
         edgeY = angle > 0 ? bottom : top;
         edgeX = startPos.x + (edgeY - startPos.y) / slope;
      } else {
         // Hit left/right first
         edgeX = angle > -Math.PI / 2 && angle < Math.PI / 2 ? right : left;
         edgeY = startPos.y + (edgeX - startPos.x) * slope;
      }

      return { x: edgeX, y: edgeY };
   }

   /**
    * Checks if a world position is currently visible on the screen.
    * @param {Position} position - The world position to check.
    * @returns {boolean} - True if the position is visible, false otherwise.
    */
   public isPositionOnScreen(position: Position): boolean {
      const screenPosition = this.getScreenPosition(position);
      return screenPosition !== null; // If getScreenPosition returns null, it's off-screen
   }

   /**
    * Update the camera position and scale based on the player position.
    * Focuses the camera on the player, so the player is in the camera center
    * This should be called every rendering tick to ensure camera is focused on the player
    */
   public updateCamera(): void {
      if (!this.player) return;

      const mapContainer = this.renderManager.mapContainer;
      const screen = this.renderManager.getApp().screen;
      const playerContainer = this.player.renderComponent.container;
      // const playerSprite = this.player.renderComponent.sprite;
      const localPlayerContainer = this.renderManager.playerContainer;
      const scale = this.renderManager.getApp().stage.scale;

      // playerSprite.anchor.set(0.5);
      // playerContainer.pivot.set(0.5);

      scale.set(this.aspectScale * (1 / this.player.viewDistance));
      const screenCenterX = screen.width / 2 / scale.x + Math.abs(this.screenOffsetX) / scale.x;
      const screenCenterY = screen.height / 2 / scale.y + Math.abs(this.screenOffsetY) / scale.y;

      const offsetX = screenCenterX - playerContainer.x;
      const offsetY = screenCenterY - playerContainer.y;

      localPlayerContainer.x = offsetX;
      localPlayerContainer.y = offsetY;
      mapContainer.x = offsetX;
      mapContainer.y = offsetY;
   }

   /**
    * Handle window resize event and update the camera scale and position.
    */
   public onResize() {
      const designRatio = Camera.designWidth / Camera.designHeight;
      const aspectRatio = window.innerWidth / window.innerHeight;
      const stage = this.renderManager.getApp().stage;

      if (aspectRatio < designRatio) {
         this.aspectScale = window.innerHeight / Camera.designHeight;
      } else {
         this.aspectScale = window.innerWidth / Camera.designWidth;
      }

      stage.scale.set(this.aspectScale);

      this.screenOffsetX = (window.innerWidth - Camera.designWidth * stage.scale.x) * 0.5;
      this.screenOffsetY = (window.innerHeight - Camera.designHeight * stage.scale.y) * 0.5;

      stage.position.set(this.screenOffsetX, this.screenOffsetY);
   }
}
