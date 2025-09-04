export enum CollisionCategory {
   Player = 0x0001,
   Bullet = 0x0002,
   Enemy = 0x0004,
   Obstacle = 0x0008,
   EnemyBullet = 0x0010,
}

export enum CollisionMask {
   Player = CollisionCategory.Enemy | CollisionCategory.Obstacle,
   Bullet = CollisionCategory.Enemy | CollisionCategory.Obstacle,
   Enemy = CollisionCategory.Player | CollisionCategory.Bullet | CollisionCategory.Obstacle | CollisionCategory.Enemy,
   Obstacle = CollisionCategory.Player | CollisionCategory.Bullet | CollisionCategory.Enemy,
   EnemyBullet = CollisionCategory.Player | CollisionCategory.Obstacle,
}

// Helper function to create a collision group from membership and filter
function createCollisionGroup(membership: number, filter: number): number {
   return ((membership & 0xffff) << 16) | (filter & 0xffff);
}

// Pre-created collision groups for each category
export const CollisionGroups = {
   Player: createCollisionGroup(CollisionCategory.Player, CollisionMask.Player),
   Bullet: createCollisionGroup(CollisionCategory.Bullet, CollisionMask.Bullet),
   Enemy: createCollisionGroup(CollisionCategory.Enemy, CollisionMask.Enemy),
   Obstacle: createCollisionGroup(CollisionCategory.Obstacle, CollisionMask.Obstacle),
   EnemyBullet: createCollisionGroup(CollisionCategory.EnemyBullet, CollisionMask.EnemyBullet),
} as const;
