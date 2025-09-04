import { Container, Text, TextStyle } from 'pixi.js';

export class PlayerNameLabel {
   private nameText: Text;
   private container: Container;
   private readonly FONT_SIZE = 14;

   constructor(playerName: string) {
      // Create the text style for player names
      const textStyle = new TextStyle({
         fontFamily: 'Arial, sans-serif',
         fontSize: this.FONT_SIZE,
         fill: '#ffffff',
         stroke: { color: '#000000', width: 2 },
         align: 'center',
         fontWeight: 'bold',
      });

      // Create the text object with modern PixiJS API
      this.nameText = new Text({
         text: playerName,
         style: textStyle,
         anchor: { x: 0.5, y: 1 }, // Center horizontally, bottom vertically
      });

      // Create container for the name label
      this.container = new Container();
      this.container.addChild(this.nameText);
   }

   /**
    * Position the name label above the character based on character height
    * @param characterHeight Height of the player character sprite in pixels
    */
   public setPosition(characterHeight: number): void {
      // Position above the character with some padding
      const verticalOffset = characterHeight / 2 + 10; // 10px padding above character
      this.container.position.set(0, -verticalOffset);
   }

   /**
    * Set the visibility of the name label
    * @param visible Whether the name should be visible
    */
   public setVisible(visible: boolean): void {
      this.container.visible = visible;
   }

   /**
    * Get the container for this name label
    */
   public getContainer(): Container {
      return this.container;
   }

   /**
    * Destroy the name label
    */
   public destroy(): void {
      this.nameText.destroy();
      this.container.destroy();
   }
}
