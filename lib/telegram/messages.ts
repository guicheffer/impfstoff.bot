import fs from 'fs'
import { paths } from './paths'
import { logger } from '../logger'
import TelegramBot from 'node-telegram-bot-api'
import { ACTIONS, DISABLE_PAGE_PREVIEW } from '.'

export type Message = {
  id: number
  message: string
  text?: string
  omit?: boolean
  options?: TelegramBot.SendMessageOptions
}
const logAction = (action: string, chat: TelegramBot.Chat, amountUsers?: number, _isPresent = false) => {
  const { id } = chat

  logger.info(
    {
      amountUsers,
      id,
      ...(action === 'HELP' ? { _isPresent } : {}),
    },
    action,
  )
}

export function saveNewUserIds(userIds: string): void {
  try {
    fs.writeFileSync(paths.users.fileName, userIds)
  } catch (error) {
    logger.error({ error }, 'FAILED_SAVING_FILE')
  }
}

export function getJoin(userIds: number[], chat: TelegramBot.Chat): Message {
  const { id } = chat
  const _isPresent = userIds.includes(id)

  if (_isPresent) return { id, message: "🎉 You're already subscribed to the latest notifications." }

  saveNewUserIds(JSON.stringify({ ids: [...userIds, id] }))
  logAction('JOIN', chat, userIds.length + 1)

  return {
    id,
    message:
      "👋🏼 Welcome to the Impfstoff bot! I check Doctolib for available vaccine appointments in Berlin, and notify you as soon as they become available.\n\n🌴 Sit back and relax. If you don't hear from me right away, keep in mind that slots open infrequently, and tend to open up during the day.\n\nIn the meantime, feel free to check the website for recent availability statistics: https://impfstoff.link/",
  }
}

export function getHelp(userIds: number[], chat: TelegramBot.Chat): Message {
  const { id } = chat
  const _isPresent = userIds.includes(id)

  logAction('HELP', chat, userIds.length, _isPresent)

  if (_isPresent)
    return {
      id,
      message:
        '\
✨ You are already subscribed to updates — sit back, relax, and wait for vaccine appoinment notifications as they become available.\n\n\
💁 Keep in mind that slots open infrequently, and tend to open up during the day\n\n\
📝 Note: Available appointments tend to be booked quickly once available. For example, some same-week appointments may be gone by the time you see the notification.\
For best results, we recommend booking appointments further into the future. If an earlier date becomes more readily available, you can always cancel your original appointment.',
    }

  return {
    id,
    message: '👋🏼 Tap or press `Join` to begin receiving notificatoins for available vaccine appointments in Berlin.',
    omit: false,
    options: {
      reply_markup: {
        inline_keyboard: [
          [{ text: ACTIONS.join.copy, callback_data: ACTIONS.join.enum }],
          [{ text: ACTIONS.contribute.copy, callback_data: ACTIONS.contribute.enum }],
        ],
      },
    },
  }
}

export function getStop(userIds: number[], chat: TelegramBot.Chat): Message {
  const { id } = chat
  const _isPresent = userIds.includes(id)

  if (_isPresent) {
    const filteredUserIds = userIds.filter((currentId) => currentId !== id)

    saveNewUserIds(JSON.stringify({ ids: filteredUserIds }))
    logAction('STOP', chat, userIds.length - 1)

    return {
      id,
      message:
        "👍 Alles klar! I'll stop sending messages. If at any point you want to resubscribe, just tap or press `Join` below. ❤️",
      options: {
        reply_markup: {
          inline_keyboard: [
            [{ text: ACTIONS.join.copy, callback_data: ACTIONS.join.enum }],
            [{ text: ACTIONS.contribute.copy, callback_data: ACTIONS.contribute.enum }],
          ],
        },
      },
    }
  }

  return {
    id,
    message: "☑️ You've already been removed. If you want to join again, just tap or press `Join` below. ❤️",
    options: {
      reply_markup: {
        inline_keyboard: [[{ text: ACTIONS.join.copy, callback_data: ACTIONS.join.enum }]],
      },
    },
  }
}

export function getTwitter(chat: TelegramBot.Chat): Message {
  const { id } = chat

  return {
    id,
    message: '🐥 Prefer Twitter? Check out our Twitter bot here: https://twitter.com/impfstoffBot',
    options: {
      [DISABLE_PAGE_PREVIEW]: true,
    },
  }
}

export function getContribute(chat: TelegramBot.Chat, shouldLog = false): Message {
  const { id } = chat

  if (shouldLog) logAction('CONTRIBUTE', chat)

  return {
    id,
    options: {
      [DISABLE_PAGE_PREVIEW]: true,
    },
    message: `Hey${
      chat.first_name ? ' ' + chat.first_name : ''
    }, if you find this bot useful, my team would appreciate any support, no matter what kind! 💖\n\n\
I'm powered by open-source code written by the local Berlin community. To support in improving my functionality, helping cover the costs involved to regularly check availabilities, and more, you can:\n\n\
💸 Donate via PayPal for whatever amount you find appropriate: https://paypal.me/guicheffer\n\
🍻 Buy me a beer (to be enjoyed at a local Berlin patio): https://www.buymeacoffee.com/guicheffer\n\
🧑‍💻 Contribue to the code or open issues: https://github.com/guicheffer/impfstoff.bot\n
📢 Provide feedback on this Reddit thread: https://www.reddit.com/r/berlin/comments/mzo067/availability_of_appointments_for_the_vaccination/\n\n\
I hope I can help you find vaccine slots. Stay safe, and thanks for your support! ❤️`,
  }
}
