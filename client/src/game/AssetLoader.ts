// client/src/game/AssetLoader.ts

import { Assets, Spritesheet, Texture } from 'pixi.js';
import { createPlayerTypeConfigs, PlayerTypeEnum } from 'shared/game/PlayerTypes';
import { EnemyType } from 'shared/game/enemies/EnemyInterfaces';
import { EnemyTemplates } from 'shared/game/enemies/EnemyTemplates';
import * as RAPIER from '@dimforge/rapier2d-compat';

export class AssetLoader {
   private spriteSheetConfig = {
      tilesheet1: './src/game/assets/map/tilesheet1.json',
      'bullets-sprites': './src/game/assets/bullets/bullets-sprites.json',
      'gun-sprites': './src/game/assets/guns/gun-sprites.json',
      // Add more sprite sheets as needed
   };

   private static loadedAssets: Record<string, Spritesheet> = {};

   /**
    * Initialize and load all assets including dynamically configured character and enemy sprites
    */
   public async loadAllAssets() {
      // Load base assets
      const baseAssetPromises = Object.entries(this.spriteSheetConfig).map(([alias, src]) => {
         Assets.add({ alias, src });
         return alias;
      });

      // Get character sprite configurations from PlayerTypes
      const characterAssetPromises = this.getCharacterAssetPromises();

      // Get enemy sprite configurations from EnemyTemplates
      const enemyAssetPromises = this.getEnemyAssetPromises();

      // Load all assets
      const allAssetAliases = [...baseAssetPromises, ...characterAssetPromises, ...enemyAssetPromises];
      const loadedAssets = await Assets.load(allAssetAliases);
      AssetLoader.loadedAssets = loadedAssets;

      return loadedAssets;
   }

   /**
    * Get character asset loading promises from PlayerType configurations
    */
   private getCharacterAssetPromises(): string[] {
      const rapier = RAPIER;
      const playerTypeConfigs = createPlayerTypeConfigs(rapier);

      const characterAssetPromises: string[] = [];

      Object.values(playerTypeConfigs).forEach((playerType) => {
         const alias = `character-${playerType.id}`;
         Assets.add({ alias, src: playerType.spritePath });
         characterAssetPromises.push(alias);
      });

      return characterAssetPromises;
   }

   /**
    * Get enemy asset loading promises from EnemyTemplates
    */
   private getEnemyAssetPromises(): string[] {
      const enemyAssetPromises: string[] = [];

      // Get all enemy types from templates
      const enemyTypes = EnemyTemplates.getAllTypes();

      enemyTypes.forEach((enemyType) => {
         const template = EnemyTemplates.getTemplate(enemyType);
         const alias = `enemy-${enemyType}`;
         Assets.add({ alias, src: template.spritePath });
         enemyAssetPromises.push(alias);
      });

      return enemyAssetPromises;
   }

   public getMapSprites() {
      return AssetLoader.loadedAssets['tilesheet1'];
   }

   public getBulletSprites() {
      return AssetLoader.loadedAssets['bullets-sprites'];
   }

   public getGunSprites() {
      return AssetLoader.loadedAssets['gun-sprites'];
   }

   /**
    * Get character sprites for a specific player type
    * @param playerType The player type enum
    * @returns Spritesheet for the character or null if not found
    */
   public getCharacterSprites(playerType: PlayerTypeEnum): Spritesheet | null {
      const alias = `character-${playerType}`;
      return AssetLoader.loadedAssets[alias] || null;
   }

   /**
    * Get all textures for a specific player type
    * @param playerType The player type enum
    * @returns Record of texture name to Texture
    */
   public getCharacterTextures(playerType: PlayerTypeEnum): Record<string, Texture> | null {
      const spritesheet = this.getCharacterSprites(playerType);
      return spritesheet ? spritesheet.textures : null;
   }

   /**
    * Check if character sprites are loaded for a player type
    * @param playerType The player type enum
    * @returns boolean indicating if sprites are loaded
    */
   public hasCharacterSprites(playerType: PlayerTypeEnum): boolean {
      return this.getCharacterSprites(playerType) !== null;
   }

   /**
    * Get enemy sprites for a specific enemy type
    * @param enemyType The enemy type enum
    * @returns Spritesheet for the enemy or null if not found
    */
   public getEnemySprites(enemyType: EnemyType): Spritesheet | null {
      const alias = `enemy-${enemyType}`;
      return AssetLoader.loadedAssets[alias] || null;
   }

   /**
    * Get all textures for a specific enemy type
    * @param enemyType The enemy type enum
    * @returns Record of texture name to Texture
    */
   public getEnemyTextures(enemyType: EnemyType): Record<string, Texture> | null {
      const spritesheet = this.getEnemySprites(enemyType);
      return spritesheet ? spritesheet.textures : null;
   }

   /**
    * Check if enemy sprites are loaded for an enemy type
    * @param enemyType The enemy type enum
    * @returns boolean indicating if sprites are loaded
    */
   public hasEnemySprites(enemyType: EnemyType): boolean {
      return this.getEnemySprites(enemyType) !== null;
   }

   /**
    * Get all available enemy types that have loaded sprites
    * @returns Array of enemy types with loaded sprites
    */
   public getLoadedEnemyTypes(): EnemyType[] {
      return EnemyTemplates.getAllTypes().filter((enemyType) => this.hasEnemySprites(enemyType));
   }

   /**
    * Get all available player types that have loaded sprites
    * @returns Array of player types with loaded sprites
    */
   public getLoadedPlayerTypes(): PlayerTypeEnum[] {
      return Object.values(PlayerTypeEnum).filter((playerType) => this.hasCharacterSprites(playerType));
   }

   /**
    * Get the sprite path for a specific player type
    * Useful for debugging or external access to the configuration
    */
   public getPlayerSpritePath(playerType: PlayerTypeEnum): string | null {
      const rapier = RAPIER;
      const playerTypeConfigs = createPlayerTypeConfigs(rapier);
      const config = playerTypeConfigs[playerType];
      return config ? config.spritePath : null;
   }

   /**
    * Get the sprite path for a specific enemy type
    * Useful for debugging or external access to the configuration
    */
   public getEnemySpritePath(enemyType: EnemyType): string | null {
      try {
         const template = EnemyTemplates.getTemplate(enemyType);
         return template.spritePath;
      } catch (error) {
         console.error(`Error getting sprite path for enemy type ${enemyType}:`, error);
         return null;
      }
   }
}
