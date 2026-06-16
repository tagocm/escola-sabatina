import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import type { WebSocketLikeConstructor } from '@supabase/realtime-js';
import { NextResponse, type NextRequest } from 'next/server';
import WebSocket from 'ws';

const webSocketTransport = WebSocket as unknown as WebSocketLikeConstructor;
type CookieToSet = { name: string; value: string; options: CookieOptions };

const TEACHER_ONLY_PREFIXES = ['/classes', '/alunos', '/relatorios', '/responsabilidades'];
const GUARDIAN_ONLY_PREFIXES = ['/responsavel'];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
      realtime: {
        transport: webSocketTransport,
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/cadastro-responsavel') &&
    !request.nextUrl.pathname.startsWith('/convite') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // If user is already logged in and tries to access login or signup page, redirect to dashboard
  if (user && (request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/cadastro-responsavel'))) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role === 'teacher' ? 'teacher' : 'guardian';
    const pathname = request.nextUrl.pathname;

    if (role === 'guardian' && matchesPrefix(pathname, TEACHER_ONLY_PREFIXES)) {
      const url = request.nextUrl.clone();
      url.pathname = '/responsavel';
      url.search = '';
      return NextResponse.redirect(url);
    }

    if (role === 'teacher' && matchesPrefix(pathname, GUARDIAN_ONLY_PREFIXES)) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
