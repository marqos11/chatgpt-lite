'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from 'react'
import { cacheGet, cacheGetJson, cacheSet, cacheSetJson } from '@/lib/cache'
import { getInitialPresetId } from '@/lib/themes'
import { CacheKey, DEFAULT_MODEL, type ModelId } from '@/services/constant'

const SIDEBAR_STORAGE_KEY = 'sidebarToggle'

function getInitialThemePreset(): string {
  return getInitialPresetId(cacheGet(CacheKey.ThemePreset))
}

function getInitialModel(): ModelId {
  return (cacheGet(CacheKey.SelectedModel) as ModelId) || DEFAULT_MODEL
}

interface AppContextValue {
  themePreset: string
  setThemePreset: Dispatch<SetStateAction<string>>
  toggleSidebar: boolean
  onToggleSidebar: () => void
  personaPanelOpen: boolean
  openPersonaPanel: () => void
  closePersonaPanel: () => void
  personaModalOpen: boolean
  openPersonaModal: () => void
  closePersonaModal: () => void
  selectedModel: ModelId
  setSelectedModel: (model: ModelId) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used within AppContextProvider')
  }
  return context
}

type AppContextProviderProps = {
  children: ReactNode
}

export function AppContextProvider({ children }: AppContextProviderProps): React.JSX.Element {
  const [themePreset, setThemePreset] = useState<string>(getInitialThemePreset)
  const [toggleSidebar, setToggleSidebarState] = useState<boolean>(false)
  const [personaPanelOpen, setPersonaPanelOpen] = useState<boolean>(false)
  const [personaModalOpen, setPersonaModalOpen] = useState<boolean>(false)
  const [selectedModel, setSelectedModelState] = useState<ModelId>(getInitialModel)

  useEffect(() => {
    cacheSet(CacheKey.ThemePreset, themePreset)
  }, [themePreset])

  useEffect(() => {
    const defaultOpen = window.innerWidth >= 768
    setToggleSidebarState(cacheGetJson<boolean>(SIDEBAR_STORAGE_KEY, defaultOpen))
  }, [])

  const onToggleSidebar = useCallback(() => {
    setToggleSidebarState((prev) => {
      const next = !prev
      cacheSetJson(SIDEBAR_STORAGE_KEY, next)
      return next
    })
  }, [])

  const setSelectedModel = useCallback((model: ModelId) => {
    setSelectedModelState(model)
    cacheSet(CacheKey.SelectedModel, model)
  }, [])

  const openPersonaPanel = useCallback(() => setPersonaPanelOpen(true), [])
  const closePersonaPanel = useCallback(() => setPersonaPanelOpen(false), [])
  const openPersonaModal = useCallback(() => setPersonaModalOpen(true), [])
  const closePersonaModal = useCallback(() => setPersonaModalOpen(false), [])

  const contextValue = useMemo<AppContextValue>(
    () => ({
      themePreset,
      setThemePreset,
      toggleSidebar,
      onToggleSidebar,
      personaPanelOpen,
      openPersonaPanel,
      closePersonaPanel,
      personaModalOpen,
      openPersonaModal,
      closePersonaModal,
      selectedModel,
      setSelectedModel
    }),
    [
      themePreset,
      toggleSidebar,
      personaPanelOpen,
      personaModalOpen,
      onToggleSidebar,
      openPersonaPanel,
      closePersonaPanel,
      openPersonaModal,
      closePersonaModal,
      selectedModel,
      setSelectedModel
    ]
  )

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>
}
