// auth/src/PassportConfig.ts
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { userService } from './services/UserService';

export function configurePassport(): void {
   // Configure Local Strategy for username/email and password
   passport.use(
      new LocalStrategy(
         {
            usernameField: 'login', // 'login' can be username or email
            passwordField: 'password',
         },
         async (login, password, done) => {
            try {
               // Authenticate user
               const user = await userService.authenticate(login, password);

               // Authentication failed
               if (!user) {
                  return done(null, false, { message: 'Incorrect login or password' });
               }

               return done(null, user);
            } catch (error) {
               return done(error);
            }
         },
      ),
   );
}
