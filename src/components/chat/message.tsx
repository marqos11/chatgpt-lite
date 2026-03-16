'use client'

import { memo, useCallback, useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import { getTextFromParts } from '@/components/chat/chat-attachments'
import type {
  ChatMessage,
  ChatMessagePart,
  ChatMessageSource,
  DocumentAttachmentData
} from '@/components/chat/interface'
import { Markdown } from '@/components/markdown/markdown'
import { Button } from '@/components/ui/button'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { cn } from '@/lib/utils'
import { Check, ChevronDown, Copy, ExternalLink, FileText, Sparkles } from 'lucide-react'

export interface MessageProps {
  message: ChatMessage
  isThinking?: boolean
}

function getMessageParts(message: ChatMessage): ChatMessagePart[] {
  return Array.isArray(message.parts) ? message.parts : []
}

function renderDocumentPreview(doc: DocumentAttachmentData, key: string | number): ReactNode {
  return (
    <div key={key} className="border-border bg-muted/50 mt-2 rounded-lg border p-3">
      <div className="mb-2 flex items-center gap-2">
        <FileText className="text-muted-foreground size-4" />
        <span className="text-sm font-medium">{doc.name}</span>
      </div>
      <div className="text-muted-foreground max-h-40 overflow-y-auto text-xs break-words whitespace-pre-wrap">
        {doc.content.slice(0, 500)}
        {doc.content.length > 500 && '...'}
      </div>
    </div>
  )
}

function renderUserParts(parts: ChatMessagePart[]): ReactNode {
  return parts.map((part, index) => {
    switch (part.type) {
      case 'text':
        return <span key={index}>{part.text}</span>
      case 'file':
        if (part.mediaType.startsWith('image/')) {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={index}
              src={part.url}
              alt="Uploaded"
              className="mt-2 max-h-[300px] max-w-full rounded-lg"
            />
          )
        }
        return null
      case 'data-document':
        return renderDocumentPreview(part.data, index)
      default: {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[message.tsx] Unhandled message part type: ${part.type}`)
        }
        return null
      }
    }
  })
}

function getTextContent(parts: ChatMessagePart[]): string {
  return getTextFromParts(parts)
}

function dedupeSources(sources: ChatMessageSource[]): ChatMessageSource[] {
  const seen = new Set<string>()
  const deduped: ChatMessageSource[] = []
  for (const source of sources) {
    const key =
      source.type === 'url'
        ? `url:${source.url}`
        : `document:${source.mediaType}:${source.filename ?? ''}:${source.title}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(source)
  }
  return deduped
}

function stripTrailingSourceMarkdownLinks(text: string, sources: ChatMessageSource[]): string {
  const urlSources = sources.filter((source) => source.type === 'url')
  if (urlSources.length === 0) return text
  const urls = new Set(urlSources.map((source) => source.url))
  let working = text.trimEnd()
  let strippedCount = 0
  while (true) {
    const match = working.match(/\[([^\]]+)\]\(([^)]+)\)\s*$/)
    if (!match) break
    if (!urls.has(match[2])) break
    strippedCount += 1
    working = working.slice(0, Math.max(0, working.length - match[0].length)).trimEnd()
  }
  return strippedCount >= 2 ? working : text
}

function getSourcesFromParts(parts: ChatMessagePart[]): ChatMessageSource[] {
  const sourcesFromParts: ChatMessageSource[] = []
  for (const part of parts) {
    if (part.type === 'source-url') {
      sourcesFromParts.push({ type: 'url', id: part.sourceId, url: part.url, title: part.title })
    } else if (part.type === 'source-document') {
      sourcesFromParts.push({
        type: 'document',
        id: part.sourceId,
        mediaType: part.mediaType,
        title: part.title,
        filename: part.filename
      })
    }
  }
  return dedupeSources(sourcesFromParts)
}

function getSourceTitle(source: ChatMessageSource): string {
  if (source.type === 'url') return source.title || source.url
  if (source.filename) return source.title || `Document: ${source.filename}`
  return source.title || 'Document'
}

// ── Think Block ──────────────────────────────────────────────────────────────

function ThinkBlock({ text }: { text: string }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const lines = text.trim().split('\n').filter(Boolean).length

  return (
    <div className="mb-2 w-full">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'group flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left transition-colors duration-150',
          'text-muted-foreground hover:text-foreground hover:bg-muted/50',
          open && 'bg-muted/40'
        )}
        aria-expanded={open}
      >
        <Sparkles className="size-3 shrink-0 opacity-60" />
        <span className="text-[0.78rem] font-medium">
          {open ? 'Hide' : 'Show'} thinking
          {!open && (
            <span className="text-muted-foreground/60 ml-1 font-normal">
              · {lines} line{lines !== 1 ? 's' : ''}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            'ml-auto size-3 shrink-0 transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>
      {open && (
        <div className="border-border/40 bg-muted/20 mt-1 rounded-lg border px-3 py-2.5">
          <p className="text-muted-foreground whitespace-pre-wrap font-mono text-[0.78rem] leading-relaxed">
            {text.trim()}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Sources ──────────────────────────────────────────────────────────────────

function Sources({ sources }: { sources: ChatMessageSource[] }): React.JSX.Element | null {
  if (sources.length === 0) return null
  return (
    <div className="mt-3 w-full space-y-2">
      <h4 className="text-muted-foreground flex items-center gap-1.5 text-sm font-semibold text-balance">
        <ExternalLink className="size-3.5" aria-hidden="true" />
        Sources
      </h4>
      <div className="space-y-1.5">
        {sources.map((source, idx) => {
          const url = source.type === 'url' ? source.url : undefined
          const title = getSourceTitle(source)
          const Element = url ? 'a' : 'div'
          const linkProps = url ? { href: url, target: '_blank' as const, rel: 'noopener noreferrer' } : {}
          return (
            <Element
              key={source.id}
              {...linkProps}
              className="border-border bg-background/50 hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:ring-ring/50 focus-visible:ring-offset-background group/source flex items-start gap-2 rounded-lg border px-3 py-2 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <span className="text-muted-foreground shrink-0 font-medium">[{idx + 1}]</span>
              <div className="min-w-0 flex-1">
                <div className="text-foreground group-hover/source:text-primary line-clamp-1 font-medium">{title}</div>
                {url && <div className="text-muted-foreground mt-0.5 line-clamp-1 text-xs leading-tight">{url}</div>}
              </div>
              {url && <ExternalLink className="text-muted-foreground mt-0.5 size-3 shrink-0" aria-hidden="true" />}
            </Element>
          )
        })}
      </div>
    </div>
  )
}

// ── User Message ─────────────────────────────────────────────────────────────

function UserMessage({ message }: MessageProps): React.JSX.Element {
  const parts = getMessageParts(message)
  return (
    <div className="group/message animate-in fade-in slide-in-from-bottom-2 flex w-full justify-end py-2.5 duration-200 motion-reduce:animate-none">
      <div className="w-full min-w-0">
        <div className="text-foreground/90 w-full break-words text-right">
          <div className="leading-normal whitespace-pre-wrap">{renderUserParts(parts)}</div>
        </div>
      </div>
    </div>
  )
}

// ── Assistant Message ─────────────────────────────────────────────────────────

function AssistantMessage({ message, isThinking }: MessageProps): React.JSX.Element {
  const parts = getMessageParts(message)
  const sources = useMemo(() => getSourcesFromParts(parts), [parts])
  const deferredParts = useDeferredValue(parts)
  const { copy, copied } = useCopyToClipboard()

  // Collect reasoning parts and text parts separately
  const { reasoningBlocks, markdownSource } = useMemo(() => {
    const reasoning: string[] = []
    const textParts: string[] = []

    for (const part of deferredParts) {
      // Dedicated reasoning part (e.g. Claude, DeepSeek)
      if ((part as { type: string; text?: string }).type === 'reasoning') {
        const t = (part as { type: string; text: string }).text?.trim()
        if (t) reasoning.push(t)
      } else if (part.type === 'text') {
        textParts.push((part as { type: string; text: string }).text)
      }
    }

    const rawText = textParts.join('')

    // Extract tool-noise: [WebSearch] lines + any tool_name {...} call blocks (multi-line JSON)
    const TOOL_LINE = /^(?:\[WebSearch\].*|\[Tool(?:Use|Result)\].*)$/gm
    const TOOL_CALL = /(?:web_search_with_snippets|browse_page|x_keyword_search|x_semantic_search|x_\w+|web_search)\s*\{[\s\S]*?\}/g
    const toolLines: string[] = []
    let afterToolNoise = rawText
      .replace(TOOL_LINE, (match) => { toolLines.push(match.trim()); return '' })
      .replace(TOOL_CALL, (match) => { toolLines.push(match.trim()); return '' })
      .replace(/\n{3,}/g, '\n\n').trim()

    if (toolLines.length > 0) {
      reasoning.unshift(toolLines.join('\n'))
    }

    // Detect Grok-style narrative thinking regardless of whether tool noise was found.
    // Strategy: find where the actual answer begins — it starts with a markdown heading,
    // bold title line, or a formal sentence that doesn't look like internal monologue.
    // Everything before that point is thinking content.
    if (/^Thinking about\b/i.test(afterToolNoise)) {
      // Real response indicators: markdown headings, bold-title lines, or lines
      // that start a clearly formatted answer (numbered list intro, etc.)
      const RESPONSE_START = /^(?:#{1,3}\s|\*{1,2}[A-Z]|Here (?:are|is)\s|As of\s|Below\s|The following)/m

      const match = RESPONSE_START.exec(afterToolNoise)
      if (match && match.index > 0) {
        const thoughtText = afterToolNoise.slice(0, match.index).trim()
        const responseText = afterToolNoise.slice(match.index).trim()
        if (thoughtText) {
          reasoning.push(thoughtText)
          afterToolNoise = responseText
        }
      } else {
        // No clear response start found — entire text is thinking
        reasoning.push(afterToolNoise)
        afterToolNoise = ''
      }
    }

    const withoutTrailingLinks = sources.length > 0
      ? stripTrailingSourceMarkdownLinks(afterToolNoise, sources)
      : afterToolNoise

    return { reasoningBlocks: reasoning, markdownSource: withoutTrailingLinks }
  }, [deferredParts, sources])

  const copyText = useMemo(() => getTextContent(parts), [parts])
  const hasTextContent = copyText.trim().length > 0
  const showThinking = Boolean(isThinking) && !hasTextContent

  const handleCopy = useCallback(() => {
    void copy(copyText)
  }, [copy, copyText])

  return (
    <div className="group/message animate-in fade-in slide-in-from-bottom-2 flex w-full justify-start py-2.5 duration-200 motion-reduce:animate-none">
      <div className="w-full min-w-0">
        <div className="text-foreground w-full break-words">
          <div className="leading-normal">
            {showThinking ? (
              <span className="text-muted-foreground font-medium">Thinking...</span>
            ) : (
              <>
                {reasoningBlocks.map((text, i) => (
                  <ThinkBlock key={i} text={text} />
                ))}
                {markdownSource ? <Markdown>{markdownSource}</Markdown> : null}
              </>
            )}
          </div>
        </div>
        {sources.length > 0 && <Sources sources={sources} />}
        {hasTextContent && (
          <Button
            size="sm"
            variant="outline"
            className={cn(
              'group/copy mt-1 rounded-lg shadow-none transition-colors duration-200 disabled:opacity-100',
              copied
                ? 'border-primary/30 bg-primary/5 text-primary'
                : 'hover:border-primary/30 hover:bg-primary/5 hover:text-primary'
            )}
            disabled={copied}
            onClick={handleCopy}
            aria-label={copied ? 'Copied' : 'Copy to clipboard'}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5 transition-transform duration-200 group-hover/copy:scale-110" />}
            <span className="text-xs font-medium">{copied ? 'Copied' : 'Copy'}</span>
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────

function MessageComponent({ message, isThinking }: MessageProps): React.JSX.Element {
  if (message.role === 'user') return <UserMessage message={message} />
  return <AssistantMessage message={message} isThinking={isThinking} />
}

export const Message = memo(MessageComponent)
Message.displayName = 'Message'
