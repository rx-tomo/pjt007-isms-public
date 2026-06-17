import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';
import { RATE_LIMIT_MAX, rateLimit, shouldBypassRateLimit } from '@/lib/middleware/rate-limit';

const intlMiddleware = createIntlMiddleware(routing);
const E2E_ADMIN_SETTINGS_PATH = /^\/(ja|en|zh)\/settings\/(assets|controls|structure|users)(\/|$)/;
// 未認証でも閲覧できる公開ページ（トップ・料金・認証フロー・dev-login）
const PUBLIC_PAGE_PATH = /^\/(ja|en|zh)(\/((auth|dev-login)(\/.*)?|pricing\/?))?$/;
const ADMIN_SETTINGS_ROLES = new Set(['system_operator', 'org_admin']);

/**
 * Check Better Auth session cookie presence (Edge Runtime compatible).
 * This is a lightweight cookie-existence check only — full session validation
 * happens server-side via auth.api.getSession().
 */
function hasBetterAuthSession(request: NextRequest): boolean {
  // Better Auth default session cookie name is "better-auth.session_token"
  // In production with Secure prefix it becomes "__Secure-better-auth.session_token"
  const sessionCookie =
    request.cookies.get('better-auth.session_token') ||
    request.cookies.get('__Secure-better-auth.session_token')
  return !!sessionCookie?.value
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isApiPath = pathname.startsWith('/api/');

  if (isApiPath) {
    const isAuthApiPath = pathname.startsWith('/api/auth/');
    const isStripeWebhookPath =
      pathname === '/api/stripe/webhook' ||
      pathname.startsWith('/api/stripe/webhook/');
    const clientIp = (() => {
      const xForwardedFor = request.headers.get('x-forwarded-for');
      if (xForwardedFor) {
        const firstAddress = xForwardedFor.split(',')[0]?.trim();
        return firstAddress && firstAddress.length > 0
          ? firstAddress
          : 'anonymous';
      }
      return 'anonymous';
    })();

    if (!isAuthApiPath && !isStripeWebhookPath && !shouldBypassRateLimit(clientIp)) {
      const { allowed, remaining, resetAt } = rateLimit(clientIp);

      if (!allowed) {
        const retryAfter = Math.max(
          1,
          Math.ceil((resetAt - Date.now()) / 1000),
        );
        const response = NextResponse.json(
          { error: 'Too Many Requests' },
          { status: 429 },
        );
        response.headers.set('Retry-After', String(retryAfter));
        response.headers.set('X-RateLimit-Remaining', '0');
        return response;
      }

      const response = NextResponse.next();
      response.headers.set('X-RateLimit-Remaining', String(remaining));
      return response;
    }

    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Remaining', String(RATE_LIMIT_MAX));
    return response;
  }

  if (process.env.E2E_MODE === '1' && E2E_ADMIN_SETTINGS_PATH.test(pathname)) {
    const role = request.cookies.get('dev-login.role')?.value;
    const locale = pathname.startsWith('/en') ? 'en' : 'ja';
    if (role && !ADMIN_SETTINGS_ROLES.has(role)) {
      return NextResponse.redirect(new URL(`/${locale}/home`, request.url));
    }
  }

  // E2E テスト用のバイパス: 環境変数 E2E_MODE=1 の場合はミドルウェア処理をスキップ
  if (process.env.E2E_MODE === '1') {
    return NextResponse.next({ request })
  }

  // Extract locale from pathname
  const localeMatch = pathname.match(/^\/(ja|en|zh)(\/|$)/);
  const locale = localeMatch ? localeMatch[1] : 'ja';

  // Check if this is a dev-login request
  if (pathname.includes('/dev-login')) {
    // For dev-login, just apply internationalization
    const response = intlMiddleware(request);
    response.headers.set('x-locale', locale);
    response.headers.set('x-pathname', pathname);
    return response;
  }

  // GAP-020: 未認証アクセスの保護ページはログインへリダイレクトする。
  // cookie存在チェックのみ（完全なセッション検証はサーバー側）。
  // ロケール接頭辞なしのパスは intl ミドルウェアのリダイレクト後に再評価される。
  const isPublicPage =
    !localeMatch || PUBLIC_PAGE_PATH.test(pathname);
  // QAウォームアップ（オンデマンドコンパイル目的の素通し。非本番のみ）
  const isWarmupRequest =
    process.env.NODE_ENV !== 'production' &&
    request.headers.get('x-qa-warmup') === '1';
  if (!isPublicPage && !isWarmupRequest && !hasBetterAuthSession(request)) {
    const loginUrl = new URL(`/${locale}/auth/login`, request.url);
    loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // Better Auth mode: lightweight cookie presence check in Edge Runtime
  // Full session validation is deferred to server-side (auth.api.getSession)
  const intlResponse = intlMiddleware(request);
  intlResponse.headers.set('x-locale', locale);
  intlResponse.headers.set('x-pathname', pathname);
  intlResponse.headers.set('x-auth-mode', 'betterauth');
  intlResponse.headers.set('x-has-session', hasBetterAuthSession(request) ? '1' : '0');
  return intlResponse;
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!api|_next|_vercel|mock|.*\\..*).*)',
    '/([\\w-]+)?/users/(.+)'
  ]
};
