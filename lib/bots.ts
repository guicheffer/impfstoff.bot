import { broadcast } from './telegram'

export function send (message: string): void {
  broadcast(message);
};
