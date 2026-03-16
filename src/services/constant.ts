export const CacheKey = {
  Theme: 'THEME',
  ThemePreset: 'THEME_PRESET',
  ThemePresetCss: 'THEME_PRESET_CSS',
  SelectedModel: 'SELECTED_MODEL'
}

export const MODELS = [
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'gemini-3.1-pro',
  'gemini-3.0-flash',
  'gpt-5.4-pro',
  'gpt-5.4',
  'codex/gpt-5.4',
  'grok-4.20-beta',
  'grok-4.1-fast',
  'grok-imagine-1.0-video'
] as const

export type ModelId = (typeof MODELS)[number]
export const DEFAULT_MODEL: ModelId = 'claude-sonnet-4-6'
