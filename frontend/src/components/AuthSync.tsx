'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useStore } from '@/store/useStore';

export default function AuthSync() {
  const { data: session, status } = useSession();
  const { setUser, setAuthStatus } = useStore();

  useEffect(() => {
    if (status === 'loading') {
      setAuthStatus('loading');
      return;
    }

    if (status === 'authenticated' && session?.user) {
      setAuthStatus('authenticated');
      setUser({
        id: session.user.id,
        username: session.user.username,
        displayName: session.user.displayName || session.user.username,
        token: session.user.token,
      });
      return;
    }

    setAuthStatus('unauthenticated');
    setUser(null);
  }, [session, status, setAuthStatus, setUser]);

  return null;
}
