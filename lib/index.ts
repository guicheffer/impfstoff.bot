import dotenv from 'dotenv'
dotenv.config()

import { send } from './bots'
import { logger } from './logger'
import { fetchImpfstoffLink, DateKey, ImpfstoffLinkVenue } from './impfstoff-link'

const DIFF_MIN = 2 // 2 minutes safe check
const TIMER_BOT_FETCH = 1 * 1000 // 1 second

const urls = {
  arena: 'https://bit.ly/2PL4I8J',
  tempelhof: 'https://bit.ly/2PONurc',
  messe: 'https://bit.ly/3b0xCJr',
  velodrom: 'https://bit.ly/3thD8h7',
  tegel: 'https://bit.ly/3eeAIeT',
  tegelmod: 'https://bit.ly/2TifHrP',
  erika: 'https://bit.ly/2QIki5J',
}

type AvailableDate = { availableDate: DateKey | null }
const usedQueue: { [dateKey: string]: number | Date } = {}

function checkFirstAvailableDate(dates: ImpfstoffLinkVenue['stats'], dateKeys: DateKey[]): AvailableDate {
  for (let i = 0; i < dateKeys.length; i++) {
    const today = new Date()
    const currentDate = dates[dateKeys[i]]
    const lastTime = new Date(currentDate.last)
    const diffMs = lastTime.getTime() - today.getTime()
    const diffDays = Math.floor(diffMs / 86400000) * -1
    const diffHrs = Math.floor((diffMs % 86400000) / 3600000) * -1
    const diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000) * -1

    if (diffDays !== 1) continue
    if (diffHrs !== 1) continue

    if (diffMins < DIFF_MIN) {
      if (usedQueue[dateKeys[i]]?.toString() === lastTime.toString()) {
        return { availableDate: null }
      }

      if ((diffMins === 0 || diffMins === 1) && usedQueue[dateKeys[i]] === 0) {
        return { availableDate: null }
      }

      if (diffMins === 0) {
        usedQueue[dateKeys[i]] = 0
      } else {
        usedQueue[dateKeys[i]] = lastTime
      }

      return { availableDate: dateKeys[i] }
    }
  }
  return { availableDate: null }
}

// Interval for checking vaccines appointment
setInterval(() => {
  const msgsQueue: string[] = []

  fetchImpfstoffLink()
    .then((json) => {
      const { stats: places } = json

      for (let i = 0; i < places.length; i++) {
        const dates = places[i].stats ?? {}
        const dateKeys: DateKey[] = Object.keys(dates) as DateKey[]
        const hasDates = Boolean(dateKeys.length)
        const place = places[i].id
        const placeName = places[i].name

        if (!hasDates) continue

        const { availableDate = null } = checkFirstAvailableDate(dates, dateKeys) ?? {}

        if (availableDate) {
          const link = urls[place]
          const date = new Date(availableDate).toLocaleDateString('de-DE')

          msgsQueue.push(`💉 Available slots found at _${placeName}_ on *${date}*: ${link}`)
        }
      }

      msgsQueue.forEach((message) => send(message))
    })
    .catch((error) => logger.error({ error }, 'FAILED_FETCH'))
}, TIMER_BOT_FETCH)
