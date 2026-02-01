import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      username: string;
      displayName?: string;
      token: string;
      isGuest?: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    token?: string;
    isGuest?: boolean;
    displayName?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    username?: string;
    displayName?: string;
    accessToken?: string;
    isGuest?: boolean;
  }
}
