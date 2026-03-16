import type { NextRequest } from 'next/server'
import { azure as azureProvider, createAzure } from '@ai-sdk/azure'
import { createOpenAI } from '@ai-sdk/openai'
import type { ModelMessage } from '@ai-sdk/provider-utils'
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type LanguageModel,
  type ToolSet
} from 'ai'

export const runtime = 'edge'

// Cache the provider config only — never a specific model instance
type ProviderConfig =
  | { isAzure: true; azure: ReturnType<typeof createAzure>; azureDeployment: string }
  | { isAzure: false; openai: ReturnType<typeof createOpenAI>; defaultModel: string }

let cachedProvider: ProviderConfig | undefined

function getProvider(): ProviderConfig {
  if (cachedProvider) return cachedProvider

  const azureResourceName = process.env.AZURE_OPENAI_RESOURCE_NAME
  const azureApiKey = process.env.AZURE_OPENAI_API_KEY
  const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT

  if (azureResourceName && azureApiKey && azureDeployment) {
    cachedProvider = {
      isAzure: true,
      azure: createAzure({ resourceName: azureResourceName, apiKey: azureApiKey }),
      azureDeployment
    }
    return cachedProvider
  }

  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) {
    throw new Error(
      'No AI provider configured. Please set either Azure OpenAI or OpenAI credentials in environment variables.'
    )
  }
  let openaiBaseUrl = process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1'
  if (!openaiBaseUrl.endsWith('/v1')) {
    openaiBaseUrl = openaiBaseUrl.replace(/\/$/, '') + '/v1'
  }

  cachedProvider = {
    isAzure: false,
    openai: createOpenAI({ apiKey: openaiApiKey, baseURL: openaiBaseUrl }),
    defaultModel: process.env.OPENAI_MODEL || 'gpt-4o-mini'
  }
  return cachedProvider
}

// Build a fresh model instance per request so the selected model is always respected
function buildModel(requestedModel?: string): LanguageModel {
  const provider = getProvider()
  if (provider.isAzure) {
    return provider.azure(provider.azureDeployment)
  }
  const modelId = requestedModel || provider.defaultModel
  return provider.openai.chat(modelId)
}

type MessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image'; image: string | URL }
      | {
          type: 'document'
          name: string
          content: string
          mimeType: string
          images?: Array<{
            pageNumber: number
            name: string
            width: number
            height: number
            dataUrl: string
          }>
        }
    >

type ChatCompletionMessage = {
  role: 'assistant' | 'user' | 'system'
  content: MessageContent
}

function convertToCoreMessage(msg: ChatCompletionMessage): ModelMessage {
  if (msg.role === 'system') {
    return {
      role: 'system',
      content: typeof msg.content === 'string' ? msg.content : ''
    }
  }

  if (msg.role === 'user') {
    if (typeof msg.content === 'string') {
      return { role: 'user', content: msg.content }
    }
    return {
      role: 'user',
      content: msg.content.flatMap((part) => {
        if (part.type === 'text') {
          return [{ type: 'text', text: part.text }]
        } else if (part.type === 'image') {
          return [{ type: 'image', image: part.image }]
        } else {
          const result: Array<
            { type: 'text'; text: string } | { type: 'image'; image: string | URL }
          > = []
          result.push({ type: 'text', text: `[Document: ${part.name}]\n\n${part.content}` })
          if (part.images && part.images.length > 0) {
            result.push({
              type: 'text',
              text: `\n\n[This document contains ${part.images.length} image(s)]`
            })
            part.images.forEach((img) => {
              result.push({ type: 'image', image: img.dataUrl })
            })
          }
          return result
        }
      })
    }
  }

  return {
    role: 'assistant',
    content: typeof msg.content === 'string' ? msg.content : ''
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const toToolSetEntry = <T>(tool: T): ToolSet[string] => tool as ToolSet[string]
    const { prompt, messages, input, model: requestedModel } = (await req.json()) as {
      prompt: string
      model?: string
      messages: ChatCompletionMessage[]
      input: MessageContent
    }

    const acceptHeader = req.headers.get('accept') ?? ''
    const wantsUiStream = acceptHeader.includes('text/event-stream')

    const messagesWithHistory: ModelMessage[] = [
      { role: 'system', content: prompt },
      ...messages.map(convertToCoreMessage),
      convertToCoreMessage({ role: 'user', content: input })
    ]

    // Build the model fresh every request so the selected model is always respected
    const model = buildModel(requestedModel)
    const provider = getProvider()

    console.log('[Chat API] Using model:', requestedModel || (provider.isAzure ? provider.azureDeployment : provider.defaultModel))

    const runStream = async () => {
      if (provider.isAzure) {
        const tools = {
          web_search_preview: toToolSetEntry(
            azureProvider.tools.webSearchPreview({ searchContextSize: 'high' })
          )
        } satisfies ToolSet
        return streamText({ model, messages: messagesWithHistory, tools })
      }

      return streamText({ model, messages: messagesWithHistory })
    }

    if (!wantsUiStream) {
      const result = await runStream()
      return result.toTextStreamResponse()
    }

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const result = await runStream()
        writer.merge(result.toUIMessageStream({ sendSources: true, sendReasoning: true }))
      },
      onFinish: ({ finishReason, responseMessage }) => {
        console.log('[Chat API] UI stream finished:', { finishReason, messageId: responseMessage?.id })
      }
    })

    return createUIMessageStreamResponse({ stream })
  } catch (error) {
    console.error('[Chat API] Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
