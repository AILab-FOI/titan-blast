// auth/src/models/User.ts

export interface User {
   id: number;
   username: string;
   displayName: string;
   email: string | null;
   avatar: string | null;
   passwordHash: string;
   createdAt: number;
   lastActive: number;
}

export interface RegisterUserData {
   username: string;
   displayName?: string;
   email: string;
   password: string;
   avatar?: string;
}

export interface JwtPayload {
   id: number;
   username: string;
   email: string | null;
   isGuest?: boolean;
   iat?: number;
   exp?: number;
}

export interface GameTokenPayload {
   userId: number;
   username: string;
   gameId: string;
   purpose: string;
   iat?: number;
   exp?: number;
}

export interface RefreshTokenPayload {
   id: number;
   username: string;
   tokenVersion: number;
   iat?: number;
   exp?: number;
}
