import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/drizzle/client';
import { userPreferences } from '@/lib/db/drizzle/schema';
import { handleRouteError } from '@/lib/errors/handleRouteError';
import { resolveCallerOrg } from '@/lib/server/auth/resolveCallerOrg';

export const runtime = 'nodejs';

const validThemes = ['light', 'dark', 'liquid-glass'] as const;
type AppTheme = (typeof validThemes)[number];

const defaultPreferences = { theme: 'light' as AppTheme };

function isAppTheme(value: unknown): value is AppTheme {
  return typeof value === 'string' && validThemes.includes(value as AppTheme);
}

export async function GET(request: NextRequest) {
  const caller = await resolveCallerOrg(request);
  if (caller.error) return NextResponse.json(defaultPreferences);

  try {
    const [preferences] = await getDb()
      .select({ theme: userPreferences.theme })
      .from(userPreferences)
      .where(eq(userPreferences.userId, caller.userId))
      .limit(1);

    return NextResponse.json({
      theme: isAppTheme(preferences?.theme) ? preferences.theme : defaultPreferences.theme,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  const caller = await resolveCallerOrg(request);
  if (caller.error) return caller.error;

  try {
    const body = await request.json().catch(() => ({}));
    if (!isAppTheme(body?.theme)) {
      return NextResponse.json({ error: 'Invalid theme' }, { status: 400 });
    }

    const now = new Date();
    await getDb()
      .insert(userPreferences)
      .values({
        id: crypto.randomUUID(),
        userId: caller.userId,
        theme: body.theme,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: {
          theme: body.theme,
          updatedAt: now,
        },
      });

    return NextResponse.json({ theme: body.theme });
  } catch (error) {
    return handleRouteError(error);
  }
}
