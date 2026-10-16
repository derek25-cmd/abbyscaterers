import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { allowedFor, HOME_FOR, whoami } from '@/lib/identity';

/**
 * Every page request: refresh the Supabase session cookie, then route.
 *   signed out          -> /login (except /login itself)
 *   /, /login           -> the user's home (/review, /kiosk or /not-allowed)
 *   /review/*, /enroll/* HR only
 *   /kiosk/*            devices, and HR for testing
 * The identity comes from face_whoami() in the database, not from the client.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return new NextResponse('Supabase is not configured (see .env.example).', { status: 500 });
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() (not getSession()) asks Supabase Auth to verify the token.
  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const redirectTo = (path: string) => {
    const target = request.nextUrl.clone();
    target.pathname = path;
    target.search = '';
    const redirect = NextResponse.redirect(target);
    // Keep any refreshed session cookies.
    response.cookies.getAll().forEach(c => redirect.cookies.set(c));
    return redirect;
  };

  if (!user) {
    return pathname === '/login' ? response : redirectTo('/login');
  }

  const identity = await whoami(supabase);
  const home = HOME_FOR[identity];

  if (pathname === '/' || pathname === '/login') return redirectTo(home);
  if (pathname === '/not-allowed') return identity === 'none' ? response : redirectTo(home);

  const allowed = allowedFor(pathname);
  if (allowed && !allowed.includes(identity)) return redirectTo(home);

  return response;
}

export const config = {
  // Pages only. Anything with a file extension is skipped: Next's own files,
  // the logo and icons, manifest.webmanifest, sw.js, offline.html and
  // /.well-known/assetlinks.json (which must be reachable signed out).
  matcher: ['/((?!_next/static|_next/image|.*\\.[A-Za-z0-9]+$).*)'],
};
