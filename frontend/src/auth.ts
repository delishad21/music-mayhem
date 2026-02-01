import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

const backendBaseUrl =
  process.env.NEXT_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:5000';

function backendUrl(path: string) {
  const base = backendBaseUrl.replace(/\/$/, '');
  return `${base}${path}`;
}

type BackendAuthResponse = {
  token: string;
  user: {
    id: string;
    username: string;
    displayName?: string;
    isGuest?: boolean;
  };
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: {
    strategy: 'jwt',
  },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        mode: { label: 'Mode', type: 'text' },
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        const mode = credentials?.mode as string | undefined;
        const username = credentials?.username as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!mode || !username) {
          throw new Error('Missing credentials');
        }

        let endpoint = '/api/auth/login';
        let body: Record<string, unknown> = { username, password };

        if (mode === 'register') {
          endpoint = '/api/auth/register';
        } else if (mode === 'guest') {
          endpoint = '/api/auth/guest';
          body = { username };
        } else if (mode !== 'login') {
          throw new Error('Invalid auth mode');
        }

        const response = await fetch(backendUrl(endpoint), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          cache: 'no-store',
        });

        const data = (await response.json()) as Partial<BackendAuthResponse> & {
          error?: string;
        };

        if (!response.ok || !data.user || !data.token) {
          throw new Error(data.error || 'Authentication failed');
        }

        return {
          id: data.user.id,
          name: data.user.username,
          displayName: data.user.displayName || data.user.username,
          token: data.token,
          isGuest: data.user.isGuest === true,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.username = user.name;
        token.displayName = (user as { displayName?: string }).displayName || user.name;
        token.accessToken = (user as { token?: string }).token;
        token.isGuest = (user as { isGuest?: boolean }).isGuest === true;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.userId as string) || '';
        session.user.username = (token.username as string) || session.user.name || '';
        session.user.displayName = (token.displayName as string) || session.user.username;
        session.user.token = (token.accessToken as string) || '';
        session.user.isGuest = token.isGuest === true;
      }
      return session;
    },
  },
});
