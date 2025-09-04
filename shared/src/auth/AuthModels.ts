export interface User {
   id: string;
   username: string;
   email?: string | null;
   displayName: string;
   isGuest?: boolean;
}

export interface AuthToken {
   token: string;
   refreshToken?: string;
}

export interface AuthUser extends User, AuthToken {}
