import { NextRequest, NextResponse } from 'next/server'

const AUTH_COOKIE = 'app_auth'

export async function POST(request: NextRequest) {
  const { password } = await request.json()
  const correctPassword = process.env.ACCESS_PASSWORD

  if (!correctPassword || password !== correctPassword) {
    return NextResponse.json({ success: false }, { status: 401 })
  }

  const response = NextResponse.json({ success: true })

  // Secure, HTTP-only cookie — expires in 7 days
  response.cookies.set(AUTH_COOKIE, correctPassword, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/'
  })

  return response
}
