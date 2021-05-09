import telegram from './telegram'

export function send(message: string): void {
  telegram.broadcast(message)
}
