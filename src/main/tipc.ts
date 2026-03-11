import { tipc } from '@egoist/tipc/main'

const t = tipc.create()

export const router = {
  'app.health': t.procedure.action(async () => {
    return { status: 'ok' as const, timestamp: new Date().toISOString() }
  })
}

export type Router = typeof router
