import { AuthUser } from 'shared/auth/AuthModels';

/**
 * Service for handling authentication with the auth server
 */
export class AuthService {
   private static instance: AuthService;
   private currentUser: AuthUser | null = null;
   private authUrl: string;

   private readonly TOKEN_KEY = 'auth_token';
   private readonly REFRESH_TOKEN_KEY = 'refresh_token';
   private readonly USER_KEY = 'user_data';

   private constructor() {
      // Get auth service URL from environment or use default
      this.authUrl = import.meta.env.VITE_AUTH_SERVICE_URL || 'http://localhost:4000';

      // Try to load user from local storage
      this.loadUserAndValidateToken();
   }

   /**
    * Get the singleton instance of AuthService
    */
   public static getInstance(): AuthService {
      if (!AuthService.instance) {
         AuthService.instance = new AuthService();
      }
      return AuthService.instance;
   }

   /**
    * Load user data from local storage if available and validate token
    */
   private loadUserAndValidateToken(): void {
      const userJson = localStorage.getItem(this.USER_KEY);
      if (userJson) {
         try {
            const userData = JSON.parse(userJson);

            // Check if token is expired
            if (this.isTokenExpired(userData.token)) {
               console.log('Token expired, attempting to refresh...');
               // Try to refresh token or clear if refresh fails
               this.refreshToken().catch(() => {
                  console.log('Token refresh failed, logging out');
                  this.clearUser();
               });
            } else {
               this.currentUser = userData;
            }
         } catch (error) {
            console.error('Failed to parse stored user data:', error);
            localStorage.removeItem(this.USER_KEY);
         }
      }
   }

   /**
    * Check if a JWT token is expired
    * @param token The JWT token to check
    * @returns true if token is expired or invalid, false if still valid
    */
   private isTokenExpired(token: string): boolean {
      if (!token) return true;

      try {
         // Extract the payload from the JWT token
         const base64Url = token.split('.')[1];
         const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
         const jsonPayload = decodeURIComponent(
            atob(base64)
               .split('')
               .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
               .join(''),
         );

         const { exp } = JSON.parse(jsonPayload);

         // Check if the expiration time has passed
         const currentTime = Math.floor(Date.now() / 1000);
         return exp < currentTime;
      } catch (error) {
         console.error('Error decoding token:', error);
         return true; // If we can't decode the token, consider it expired
      }
   }

   /**
    * Check if the user is authenticated with a valid token
    */
   public isAuthenticated(): boolean {
      if (!this.currentUser || !this.currentUser.token) return false;

      // Check if token is expired
      if (this.isTokenExpired(this.currentUser.token)) {
         // Token is expired, attempt to refresh
         this.refreshToken().catch(() => {
            this.clearUser();
         });
         return false;
      }

      return true;
   }

   /**
    * Get the current authenticated user
    */
   public getUser(): AuthUser | null {
      if (this.currentUser && this.isTokenExpired(this.currentUser.token)) {
         return null;
      }
      return this.currentUser;
   }

   /**
    * Register a new user
    */
   public async register(username: string, password: string, email?: string): Promise<AuthUser> {
      try {
         const response = await fetch(`${this.authUrl}/auth/register`, {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password, email }),
         });

         if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Registration failed');
         }

         const data = await response.json();

         const user: AuthUser = {
            id: data.user.id.toString(),
            username: data.user.username,
            email: data.user.email,
            displayName: data.user.displayName,
            token: data.token,
            refreshToken: data.refreshToken,
         };

         this.saveUser(user);
         return user;
      } catch (error) {
         console.error('Registration error:', error);
         throw error;
      }
   }

   /**
    * Login with username/email and password
    */
   public async login(login: string, password: string): Promise<AuthUser> {
      try {
         const response = await fetch(`${this.authUrl}/auth/login`, {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
            },
            body: JSON.stringify({ login, password }),
         });

         if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Login failed');
         }

         const data = await response.json();

         const user: AuthUser = {
            id: data.user.id.toString(),
            username: data.user.username,
            email: data.user.email,
            displayName: data.user.displayName,
            token: data.token,
            refreshToken: data.refreshToken,
         };

         this.saveUser(user);
         return user;
      } catch (error) {
         console.error('Login error:', error);
         throw error;
      }
   }

   /**
    * Login as a guest
    */
   public async loginAsGuest(): Promise<AuthUser> {
      try {
         const response = await fetch(`${this.authUrl}/auth/guest`, {
            method: 'POST',
         });

         if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Guest login failed');
         }

         const data = await response.json();

         const user: AuthUser = {
            id: data.user.id.toString(),
            username: data.user.username,
            isGuest: true,
            token: data.token,
            displayName: data.user.username,
         };

         this.saveUser(user);
         return user;
      } catch (error) {
         console.error('Guest login error:', error);
         throw error;
      }
   }

   /**
    * Logout the current user
    */
   public logout(): void {
      this.clearUser();
   }

   /**
    * Save user data to local storage
    */
   private saveUser(user: AuthUser): void {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      localStorage.setItem(this.TOKEN_KEY, user.token);
      if (user.refreshToken) {
         localStorage.setItem(this.REFRESH_TOKEN_KEY, user.refreshToken);
      }
      this.currentUser = user;
   }

   /**
    * Clear user data from local storage
    */
   private clearUser(): void {
      localStorage.removeItem(this.USER_KEY);
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.REFRESH_TOKEN_KEY);
      this.currentUser = null;
   }

   /**
    * Refresh the authentication token
    */
   public async refreshToken(): Promise<boolean> {
      const refreshToken = localStorage.getItem(this.REFRESH_TOKEN_KEY);
      if (!refreshToken) return false;

      try {
         const response = await fetch(`${this.authUrl}/auth/refresh`, {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
         });

         if (!response.ok) {
            this.clearUser();
            return false;
         }

         const data = await response.json();

         // Update tokens in storage
         if (this.currentUser) {
            this.currentUser.token = data.token;
            this.currentUser.refreshToken = data.refreshToken;
            this.saveUser(this.currentUser);
         }

         return true;
      } catch (error) {
         console.error('Token refresh error:', error);
         this.clearUser();
         return false;
      }
   }

   /**
    * Get authorization headers for API requests
    */
   public getAuthHeaders(): HeadersInit {
      const token = this.currentUser?.token;
      return token ? { Authorization: `Bearer ${token}` } : {};
   }

   /**
    * Get a game-specific token for joining a game
    */
   public async getGameToken(gameId: string): Promise<string | null> {
      if (!this.currentUser?.token) return null;

      try {
         const response = await fetch(`${this.authUrl}/auth/game-token`, {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
               ...this.getAuthHeaders(),
            },
            body: JSON.stringify({ gameId }),
         });

         if (!response.ok) {
            throw new Error('Failed to get game token');
         }

         const data = await response.json();
         return data.gameToken;
      } catch (error) {
         console.error('Game token error:', error);
         return null;
      }
   }
}
