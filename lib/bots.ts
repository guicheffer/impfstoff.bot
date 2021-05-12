import telegram from './telegram'
import twitter from './twitter'

export function send(message: string): void {
  telegram.broadcast(message)

  // TODO: Add it if configuration exists on development
  if (process.env.NODE_ENV !== 'development') twitter.tweet(message)
}
