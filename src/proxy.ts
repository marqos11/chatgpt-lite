import { NextRequest, NextResponse } from 'next/server'

const AUTH_COOKIE = 'app_auth'
const LOGIN_PATH = '/login'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // If no password is configured, allow everything through
  const password = process.env.ACCESS_PASSWORD
  if (!password) {
    return NextResponse.next()
  }

  // Always allow the login page and auth API through
  if (pathname === LOGIN_PATH || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // Check for a valid auth cookie
  const authCookie = request.cookies.get(AUTH_COOKIE)
  if (authCookie?.value === password) {
    return NextResponse.next()
  }

  // Not authenticated — redirect to login
  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = LOGIN_PATH
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon and public assets
     */
    '/((?!_next/static|_next/image|favicon|apple-touch-icon|.*\\.png$).*)'
  ]
}
