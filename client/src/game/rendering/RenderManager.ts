import { Application, Container, ContainerChild } from 'pixi.js';
import FrontendGame from '../FrontendGame';
import { Camera } from '../Camera';
import { Renderable } from './Renderable';
import { FrontendPlayerJoinEvent } from '../events/FrontendPlayerJoinEvent';
import { GameEventEmitter } from 'shared/game/events/GameEventEmitter';
import { TaskPriority, TaskScheduler } from 'shared/util/TaskScheduler';

export class RenderManager {
   private app: Application;
   rootContainer!: Container<ContainerChild>;
   mapContainer!: Container<ContainerChild>;
   bulletContainer!: Container<ContainerChild>;
   playerContainer!: Container<ContainerChild>;
   private game: FrontendGame;
   private camera!: Camera;
   private renderableObjects: Renderable[] = [];
   private taskScheduler: TaskScheduler;
   private isRendering: boolean = false;
   private frameCount: number = 0;

   constructor(game: FrontendGame) {
      this.game = game;
      this.app = new Application();
      this.taskScheduler = new TaskScheduler(() => this.frameCount);
   }

   public async init(): Promise<void> {
      await this.app.init({
         background: 'black',
         resizeTo: window,
         autoDensity: true,
         resolution: window.devicePixelRatio || 1,
         backgroundColor: 0x2c3e50,
         eventMode: 'none',
         antialias: false,
      });

      document.body.appendChild(this.app.canvas);

      this.rootContainer = this.app.stage.addChild(new Container());

      this.mapContainer = this.rootContainer.addChild(new Container());
      this.mapContainer.zIndex = 1;

      this.bulletContainer = this.rootContainer.addChild(new Container());
      this.bulletContainer.zIndex = 5;

      this.playerContainer = this.rootContainer.addChild(new Container());
      this.playerContainer.zIndex = 10;

      this.camera = new Camera(this);
      this.camera.onResize();

      GameEventEmitter.getInstance().on(FrontendPlayerJoinEvent, (event) => {
         if (!event.isLocal()) return;
         this.camera.focusPlayer(event.getPlayer());
         this.camera.updateCamera();
      });
   }

   /**
    * Main render loop callback
    */
   private renderLoop(): void {
      // Skip if not rendering
      if (!this.isRendering) return;
      if (!this.camera) return;

      this.frameCount++;

      this.game.getPerformanceMonitor().onFrameStart();

      // Interpolate and render game objects
      this.interpolateAndRender();

      this.updateCamera();

      // Update all renderable objects
      for (const renderable of this.renderableObjects) {
         renderable.update();
      }

      // Execute render tasks
      this.taskScheduler.processTasks();

      this.game.getPerformanceMonitor().onFrameEnd();
   }

   /**
    * Force a single render pass (useful for rendering before game starts)
    */
   public renderOnce(): void {
      this.frameCount++;

      // Update all renderable objects
      for (const renderable of this.renderableObjects) {
         renderable.update();
      }

      // Execute render tasks
      this.taskScheduler.processTasks();

      // Interpolate and render game objects
      this.interpolateAndRender();

      // Update camera
      this.updateCamera();

      // Force a render
      this.app.render();
   }

   /**
    * Update camera position and zoom
    */
   private updateCamera(): void {
      const localPlayer = this.game.getPlayerManager().getLocalPlayerSafe();
      if (localPlayer) {
         this.camera.updateCamera();
      }
   }

   interpolateAndRender() {
      this.game
         .getPlayerManager()
         .getPlayers()
         .forEach((player) => {
            player.update();
         });
   }

   public addRenderableObject(renderable: Renderable) {
      this.renderableObjects.push(renderable);
   }

   public removeRenderableObject(renderable: Renderable) {
      this.renderableObjects = this.renderableObjects.filter((r) => r !== renderable);
      // if (renderable.destroy) {
      //    renderable.destroy();
      // }
   }

   /**
    * Schedule a task to run on every render frame
    */
   public scheduleRepeatingTask(
      callback: () => void,
      intervalTicks: number,
      initialDelay?: number,
      priority: TaskPriority = TaskPriority.NORMAL,
   ): string {
      return this.taskScheduler.scheduleRepeatingTask(callback, intervalTicks, initialDelay, priority);
   }

   /**
    * Schedule a task to run only on the next render frame
    */
   public scheduleOnce(callback: () => void, priority: TaskPriority = TaskPriority.NORMAL): string {
      return this.taskScheduler.scheduleOnce(callback, priority);
   }

   /**
    * Cancel a scheduled task
    */
   public cancelTask(taskId: string): boolean {
      return this.taskScheduler.cancelTask(taskId);
   }

   /**
    * Start the rendering loop
    */
   public startRendering(): void {
      if (this.isRendering) return;

      this.isRendering = true;
      this.app.ticker.add(this.renderLoop, this);
   }

   /**
    * Stop the rendering loop
    */
   public stopRendering(): void {
      this.isRendering = false;
      this.app.ticker.remove(this.renderLoop, this);
   }

   public getApp() {
      return this.app;
   }

   public getCamera() {
      return this.camera;
   }

   /**
    * Get the task scheduler
    */
   public getTaskScheduler(): TaskScheduler {
      return this.taskScheduler;
   }
}
