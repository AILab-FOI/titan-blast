// client/src/game/performance/PerformanceMonitor.ts

import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';

export interface PerformanceMetrics {
   renderingFps: number;
   renderingTimeMs: number;
   clientPhysicsTps: number;
   clientPhysicsStepTimeMs: number;
   clientTickTimeMs: number;
   serverPhysicsTps: number;
   serverPhysicsStepTimeMs: number;
   serverTickTimeMs: number;
   networkInboundKbps: number;
   networkOutboundKbps: number;
   pingMs: number;
   averagePingMs: number;
}

@customElement('performance-monitor')
export class PerformanceMonitor extends LitElement {
   @state() private fps = 0;
   @state() private renderTime = 0;
   @state() private clientTps = 0;
   @state() private clientPhysicsStepTime = 0;
   @state() private clientTickTime = 0;
   @state() private serverTps = 0;
   @state() private serverPhysicsStepTime = 0;
   @state() private serverTickTime = 0;
   @state() private networkInbound = 0;
   @state() private networkOutbound = 0;
   @state() private ping = 0;
   @state() private averagePing = 0;

   // FPS calculation
   private frameCount = 0;
   private lastFpsUpdate = 0;
   private lastFrameTime = 0;

   // Client physics tracking
   private clientTickCount = 0;
   private lastClientTpsUpdate = 0;

   // Network tracking
   private lastNetworkUpdate = 0;
   private inboundBytes = 0;
   private outboundBytes = 0;

   static styles = css`
      :host {
         position: fixed;
         top: 10px;
         left: 50%;
         transform: translateX(-50%);
         z-index: 9999;
         pointer-events: none;
      }

      .performance-container {
         background: rgba(0, 0, 0, 0.8);
         border-radius: 8px;
         padding: 12px 16px;
         display: flex;
         gap: 24px;
         font-family: 'Courier New', monospace;
         font-size: 11px;
         color: white;
         border: 1px solid rgba(255, 255, 255, 0.1);
         backdrop-filter: blur(4px);
      }

      .metric-column {
         display: flex;
         flex-direction: column;
         gap: 3px;
         min-width: 120px;
      }

      .metric-row {
         display: flex;
         flex-direction: column;
         line-height: 1.2;
      }

      .metric-label {
         color: #94a3b8;
         font-size: 9px;
         text-transform: uppercase;
         letter-spacing: 0.5px;
      }

      .metric-value {
         color: #ffffff;
         font-weight: bold;
      }

      .fps-good {
         color: #10b981;
      }

      .fps-medium {
         color: #f59e0b;
      }

      .fps-bad {
         color: #ef4444;
      }

      .time-good {
         color: #10b981;
      }

      .time-medium {
         color: #f59e0b;
      }

      .time-bad {
         color: #ef4444;
      }

      .tps-good {
         color: #10b981;
      }

      .tps-medium {
         color: #f59e0b;
      }

      .tps-bad {
         color: #ef4444;
      }

      .network {
         color: #3b82f6;
      }
   `;

   constructor() {
      super();
      this.setupUpdateLoop();
   }

   private setupUpdateLoop(): void {
      // Update displays every 250ms to avoid flickering
      setInterval(() => {
         this.requestUpdate();
      }, 250);
   }

   // Called by the render loop to track FPS and render time
   public onFrameStart(): void {
      this.lastFrameTime = performance.now();
   }

   public onFrameEnd(): void {
      const currentTime = performance.now();
      this.renderTime = currentTime - this.lastFrameTime;
      this.frameCount++;

      // Update FPS every second
      if (currentTime - this.lastFpsUpdate >= 1000) {
         this.fps = this.frameCount;
         this.frameCount = 0;
         this.lastFpsUpdate = currentTime;
      }
   }

   // Called by physics manager to track client physics
   public onClientPhysicsTickStart(): void {
      this.lastFrameTime = performance.now();
   }

   public onClientPhysicsTickEnd(): void {
      this.clientTickCount++;

      const currentTime = performance.now();
      // Update TPS every second
      if (currentTime - this.lastClientTpsUpdate >= 1000) {
         this.clientTps = this.clientTickCount;
         this.clientTickCount = 0;
         this.lastClientTpsUpdate = currentTime;
      }
   }

   // Called to update client timing metrics from BasePhysicsManager
   public updateClientTimingMetrics(physicsStepTime: number, tickTime: number): void {
      this.clientPhysicsStepTime = physicsStepTime;
      this.clientTickTime = tickTime;

      // Update TPS calculation
      this.clientTickCount++;
      const currentTime = performance.now();
      if (currentTime - this.lastClientTpsUpdate >= 1000) {
         this.clientTps = this.clientTickCount;
         this.clientTickCount = 0;
         this.lastClientTpsUpdate = currentTime;
      }
   }

   // Called when server metrics are received
   public updateServerMetrics(tps: number, physicsStepTime: number, tickTime: number): void {
      this.serverTps = tps;
      this.serverPhysicsStepTime = physicsStepTime;
      this.serverTickTime = tickTime;
   }

   // Called to update ping metrics
   public updatePingMetrics(currentPing: number, averagePing: number): void {
      this.ping = currentPing;
      this.averagePing = averagePing;
   }

   public onNetworkDataSent(bytes: number): void {
      this.outboundBytes += bytes;
      this.updateNetworkMetrics();
   }

   public onNetworkDataReceived(bytes: number): void {
      this.inboundBytes += bytes;
      this.updateNetworkMetrics();
   }

   private updateNetworkMetrics(): void {
      const currentTime = performance.now();

      // Update network metrics every second
      if (currentTime - this.lastNetworkUpdate >= 1000) {
         const timeSpanSeconds = (currentTime - this.lastNetworkUpdate) / 1000;

         if (timeSpanSeconds > 0) {
            // Convert bytes per second to kilobits per second
            this.networkInbound = (this.inboundBytes * 8) / (timeSpanSeconds * 1000);
            this.networkOutbound = (this.outboundBytes * 8) / (timeSpanSeconds * 1000);
         }

         this.inboundBytes = 0;
         this.outboundBytes = 0;
         this.lastNetworkUpdate = currentTime;
      }
   }

   private getFpsClass(fps: number): string {
      if (fps >= 55) return 'fps-good';
      if (fps >= 30) return 'fps-medium';
      return 'fps-bad';
   }

   private getTimeClass(timeMs: number): string {
      if (timeMs <= 16.67) return 'time-good'; // 60fps = 16.67ms
      if (timeMs <= 33.33) return 'time-medium'; // 30fps = 33.33ms
      return 'time-bad';
   }

   private getTpsClass(tps: number): string {
      if (tps >= 24) return 'tps-good'; // Target is 25 TPS
      if (tps >= 20) return 'tps-medium';
      return 'tps-bad';
   }

   private getPingClass(pingMs: number): string {
      if (pingMs <= 50) return 'time-good';
      if (pingMs <= 100) return 'time-medium';
      return 'time-bad';
   }

   public getMetrics(): PerformanceMetrics {
      return {
         renderingFps: this.fps,
         renderingTimeMs: this.renderTime,
         clientPhysicsTps: this.clientTps,
         clientPhysicsStepTimeMs: this.clientPhysicsStepTime,
         clientTickTimeMs: this.clientTickTime,
         serverPhysicsTps: this.serverTps,
         serverPhysicsStepTimeMs: this.serverPhysicsStepTime,
         serverTickTimeMs: this.serverTickTime,
         networkInboundKbps: this.networkInbound,
         networkOutboundKbps: this.networkOutbound,
         pingMs: this.ping,
         averagePingMs: this.averagePing,
      };
   }

   render() {
      return html`
         <div class="performance-container">
            <!-- Column 1: Rendering -->
            <div class="metric-column">
               <div class="metric-row">
                  <span class="metric-label">FPS</span>
                  <span class="metric-value ${this.getFpsClass(this.fps)}">${this.fps}</span>
               </div>
               <div class="metric-row">
                  <span class="metric-label">Render</span>
                  <span class="metric-value ${this.getTimeClass(this.renderTime)}"
                     >${this.renderTime.toFixed(2)} ms</span
                  >
               </div>
            </div>

            <!-- Column 2: Client Physics -->
            <div class="metric-column">
               <div class="metric-row">
                  <span class="metric-label">Client TPS</span>
                  <span class="metric-value ${this.getTpsClass(this.clientTps)}">${this.clientTps}</span>
               </div>
               <div class="metric-row">
                  <span class="metric-label">Physics Step</span>
                  <span class="metric-value ${this.getTimeClass(this.clientPhysicsStepTime)}"
                     >${this.clientPhysicsStepTime.toFixed(2)} ms</span
                  >
               </div>
               <div class="metric-row">
                  <span class="metric-label">Total Tick</span>
                  <span class="metric-value ${this.getTimeClass(this.clientTickTime)}"
                     >${this.clientTickTime.toFixed(2)} ms</span
                  >
               </div>
            </div>

            <!-- Column 3: Server Physics -->
            <div class="metric-column">
               <div class="metric-row">
                  <span class="metric-label">Server TPS</span>
                  <span class="metric-value ${this.getTpsClass(this.serverTps)}">${this.serverTps}</span>
               </div>
               <div class="metric-row">
                  <span class="metric-label">Physics Step</span>
                  <span class="metric-value ${this.getTimeClass(this.serverPhysicsStepTime)}"
                     >${this.serverPhysicsStepTime.toFixed(2)} ms</span
                  >
               </div>
               <div class="metric-row">
                  <span class="metric-label">Total Tick</span>
                  <span class="metric-value ${this.getTimeClass(this.serverTickTime)}"
                     >${this.serverTickTime.toFixed(2)} ms</span
                  >
               </div>
            </div>

            <!-- Column 4: Network -->
            <div class="metric-column">
               <div class="metric-row">
                  <span class="metric-label">Ping</span>
                  <span class="metric-value ${this.getPingClass(this.ping)}">${this.ping.toFixed(0)} ms</span>
               </div>
               <div class="metric-row">
                  <span class="metric-label">Avg Ping</span>
                  <span class="metric-value ${this.getPingClass(this.averagePing)}"
                     >${this.averagePing.toFixed(0)} ms</span
                  >
               </div>
               <div class="metric-row">
                  <span class="metric-label">Inbound</span>
                  <span class="metric-value network">${this.networkInbound.toFixed(1)} kbps</span>
               </div>
               <div class="metric-row">
                  <span class="metric-label">Outbound</span>
                  <span class="metric-value network">${this.networkOutbound.toFixed(1)} kbps</span>
               </div>
            </div>
         </div>
      `;
   }
}
