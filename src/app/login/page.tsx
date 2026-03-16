'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'error'>('idle')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async () => {
    if (!password || loading) return
    setLoading(true)

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      if (res.ok) {
        router.replace('/')
      } else {
        setStatus('error')
        setPassword('')
        setLoading(false)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    } catch {
      setStatus('error')
      setPassword('')
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmit()
    if (status === 'error') setStatus('idle')
  }

  if (status === 'error') {
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-destructive"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="text-foreground text-base font-semibold">
            You are not authorized. Don&apos;t try again.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-dvh w-full flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo / Title */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-xl">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary"
            >
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-foreground text-xl font-semibold tracking-tight">
            Access Required
          </h1>
          <p className="text-muted-foreground text-sm">
            Enter the password to continue.
          </p>
        </div>

        {/* Input */}
        <div className="space-y-3">
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Password"
            className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50"
            disabled={loading}
            autoComplete="current-password"
          />
          <button
            onClick={handleSubmit}
            disabled={loading || !password}
            className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Verifying…' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
