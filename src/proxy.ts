import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const token = request.cookies.get('auth_token');
  const { pathname } = request.nextUrl;

  // If the user is authenticated and trying to access login/signup, redirect to dashboard
  if (token && (pathname === '/login' || pathname === '/signup')) {
    // Decode the JWT payload (base64url) to extract the user role
    let portalType = 'b2c'; // default fallback
    try {
      const payload = token.value.split('.')[1];
      const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      if (decoded.role === 'mentee') {
        portalType = 'b2b';
      } else if (decoded.role === 'mentor') {
        return NextResponse.redirect(new URL('/dashboard/mentor', request.url));
      } else if (decoded.role === 'admin') {
        return NextResponse.redirect(new URL('/admin', request.url));
      } else if (decoded.role === 'superadmin') {
        return NextResponse.redirect(new URL('/superadmin', request.url));
      }
    } catch {
      // If token decoding fails, fall back to b2c
    }
    return NextResponse.redirect(new URL(`/dashboard/${portalType}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/login', '/signup'],
};
