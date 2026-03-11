import { create } from 'zustand'

interface IaMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface IaState {
  messages: IaMessage[]
  open: boolean
  loading: boolean

  toggleOpen: () => void
  setOpen: (open: boolean) => void
  addMessage: (role: 'user' | 'assistant', content: string) => void
  setLoading: (loading: boolean) => void
  clearMessages: () => void
}

export const useIaStore = create<IaState>((set) => ({
  messages: [],
  open: false,
  loading: false,

  toggleOpen: () => set((s) => ({ open: !s.open })),
  setOpen: (open) => set({ open }),

  addMessage: (role, content) =>
    set((s) => ({
      messages: [...s.messages, { role, content, timestamp: new Date().toISOString() }]
    })),

  setLoading: (loading) => set({ loading }),
  clearMessages: () => set({ messages: [] })
}))
