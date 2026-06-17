import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Provider-agnostic user type used across the app.
 * Better Auth sessions are mapped to this shape.
 */
export interface AuthUser {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { authClient } = await import('@/lib/auth/auth-client');
        const session = await authClient.getSession();
        if (!cancelled) {
          if (session?.data?.user) {
            setUser({
              id: session.data.user.id,
              email: session.data.user.email,
              user_metadata: { full_name: session.data.user.name },
            });
          } else {
            setUser(null);
          }
        }
      } catch (error) {
        console.error('Error fetching Better Auth session:', error);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const signOut = async () => {
    try {
      const { authClient } = await import('@/lib/auth/auth-client');
      await authClient.signOut();
      router.push('/auth/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return { user, loading, signOut, isAuthenticated: !!user };
}
