import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const token = request.cookies.get('auth_token');
  const { pathname } = request.nextUrl;

  // If the user is authenticated and trying to access login/signup, redirect to dashboard
  if (token && (pathname === '/login' || pathname === '/signup')) {
    // Token format: "token|userId|sessionId" — not a JWT, so we can't decode role here.
    // The actual role-based redirect is handled client-side after login.
    // Default redirect to B2C dashboard; the dashboard page itself will redirect if needed.
    return NextResponse.redirect(new URL('/dashboard/b2c', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/login', '/signup'],
};
