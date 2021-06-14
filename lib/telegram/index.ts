import fs from 'fs'
import TelegramBot, { SendMessageOptions } from 'node-telegram-bot-api'
import { paths } from './paths'
import { logger } from '../logger'
import * as messages from './messages'

const { ids: adminIds } = JSON.parse(fs.readFileSync(paths.admins.fileName, 'utf-8')) as {
  ids: number[]
}

const botToken = process.env.TELEGRAM_TOKEN

if (!botToken) {
  throw new Error('Please export the telegram bot token as TELEGRAM_TOKEN in your env')
}
const bot = new TelegramBot(botToken, { polling: true })

export const ACTIONS = {
  contribute: {
    copy: 'Contribute',
    enum: 'contribute',
  },
  help: {
    copy: 'Help',
    enum: 'help',
  },
  join: {
    copy: 'Join',
    enum: 'join',
  },
  stop: {
    copy: 'Stop / Unsubscribe',
    enum: 'stop',
  },
}

const DEFAULT_CORONA_IMPFTERMINE_NET_GROUP = process.env.CORONA_IMPFTERMINE_NET_GROUP as string
export const DISABLE_PAGE_PREVIEW = 'disable_web_page_preview'
const DEFAULT_MESSAGE_OPTIONS: Partial<SendMessageOptions> = {
  [DISABLE_PAGE_PREVIEW]: true,
  parse_mode: 'Markdown',
}

const isContributeMessage = (text: string) => text.match(/hey|hi|hello|contribute|feature|thanks|thx|tks|love|nice/)
const isJoinMessage = (text: string) => text.match(/start|join|subscribe|notify|termin|slot/)
const isHelpMessage = (text: string) =>
  text.match(
    /help|hepl|hpel|halp|❤️|will|delay|slow|twitter|info|available|news|update|filter|impfung|what|hilfe|how|when|vaccine|impfstoff|appointment|instruction|insctructio|pfizer|biontech|moderna|wie|astra/,
  )
const getLanguageSwitchRequest = (text: string) => text.match(/deutsch|german/)
const isStopMessage = (text: string) =>
  text.match(
    /close|\/no|stop|spot|spto|sopt|sotp|leave|delete|exit|pause|quiet|mute|end|finish|shut|unsubscribe|unsuscribe|off/,
  )

function readUserIds(): number[] {
  return JSON.parse(fs.readFileSync(paths.users.fileName, 'utf-8')).ids
}

const send = async ({ id, message, omit = true, options, text = undefined }: messages.Message) => {
  if (!omit) logger.info({ id, message, text }, 'SEND')

  await bot.sendMessage(id, message, options)
}

let blockedUserIds: number[] = []
let shouldDebounceBroadcast = false

type BroadcastOptions = { announce: boolean } & Partial<SendMessageOptions>

const broadcast = async (
  message: string,
  { announce, ...options }: BroadcastOptions = { announce: false },
): Promise<void> => {
  // announce debounce on broadcast
  if (!announce && shouldDebounceBroadcast)
    return await Promise.reject({ message: 'STILL_BROADCASTING', text: message })
  if (!announce) shouldDebounceBroadcast = true

  const userIds = readUserIds()

  if (!announce) userIds.push(parseInt(DEFAULT_CORONA_IMPFTERMINE_NET_GROUP))

  // This will prioritize LIFO over the user ids when broadcasting
  blockedUserIds = []
  const mapUsersPromises = userIds.reverse().map(
    (id: number, index: number) =>
      new Promise((resolve, reject) => {
        setTimeout(async () => {
          try {
            return resolve(
              await send({
                id,
                message,
                options: { ...DEFAULT_MESSAGE_OPTIONS, ...options },
              }),
            )
          } catch (error) {
            if (
              error.message.includes('chat not found') ||
              error.message.includes('bot was blocked') ||
              error.message.includes('bot was kicked') ||
              error.message.includes('user is deactivated') ||
              error.message.includes('group chat was upgraded') ||
              error.message.includes('group chat was deactivated')
            ) {
              blockedUserIds.push(id)
              logger.error({ error, id }, 'BLOCKED_USER_TO_REMOVE')
            } else {
              logger.error({ error, id }, 'GENERAL_BROADCAST_ERROR')
            }

            reject(error)
          }
          /* This will make ~30 messages to be sent in a second, considering
           * its potential duplicated messages as well; (max. telegram limit)
           *
           * https://core.telegram.org/bots/faq#broadcasting-to-users
           */
        }, index * 40)
      }),
  )

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  await Promise.all(mapUsersPromises).catch(() => {}) // No needs to log all promises

  if (blockedUserIds.length) {
    const userIdsWithoutBlockedOnes = readUserIds().filter((currentId) => !blockedUserIds.includes(currentId))

    messages.saveUserIds(JSON.stringify({ ids: userIdsWithoutBlockedOnes }))

    logger.warn(
      {
        oldAmount: userIds.length,
        blockedAmount: blockedUserIds.length,
        blocked: blockedUserIds,
      },
      'REMOVED_USERS',
    )
  }

  // Return to normal state
  shouldDebounceBroadcast = false
}

// Listen to messages
bot.on('message', ({ chat, text: rawText }: TelegramBot.Message) => {
  const { id } = chat

  // Broadcast (only for admins)
  if (adminIds.includes(id) && rawText?.startsWith('/broadcast')) {
    const message = rawText?.replace('/broadcast ', '📣 ')

    return broadcast(message, {
      announce: true,
      [DISABLE_PAGE_PREVIEW]: false,
    })
      .then(() => logger.info(`📣 Broadcasted: "${rawText}"`, 'SEND_BROADCAST'))
      .catch((error) => {
        logger.error(error)
      })
  }

  const userIds = readUserIds()
  const text = rawText ? rawText.toLowerCase() : ''

  if (isJoinMessage(text))
    return send(messages.getJoin(userIds, chat)).then(() => {
      return send(messages.getContribute(chat)).then(() => send(messages.getTwitter(chat)))
    })
  if (isHelpMessage(text))
    return send(messages.getHelp(userIds, chat)).then(() => {
      return send(messages.getContribute(chat)).then(() => send(messages.getTwitter(chat)))
    })

  if (getLanguageSwitchRequest(text)) return send(messages.getLanguageSwitchRequest(chat))

  if (isStopMessage(text)) return send(messages.getStop(userIds, chat))

  if (isContributeMessage(text) || text.startsWith('/contribute') || text.startsWith('/share'))
    return send(messages.getContribute(chat, true))

  /* Otherwise show helper actions in buttons style */
  const buttons = [
    [{ text: ACTIONS.help.copy, callback_data: ACTIONS.help.enum }],
    [{ text: ACTIONS.contribute.copy, callback_data: ACTIONS.contribute.enum }],
  ]

  buttons.unshift(
    userIds.includes(id)
      ? [{ text: ACTIONS.stop.copy, callback_data: ACTIONS.stop.enum }]
      : [{ text: ACTIONS.join.copy, callback_data: ACTIONS.join.enum }],
  )

  return send({
    id,
    message: "🤔 I'm not sure what you mean by that. Maybe one of the following options might help you:",
    omit: false,
    text,
    options: {
      reply_markup: {
        inline_keyboard: buttons,
      },
    },
  })
})

// Listen to queries from inline keyboards
bot.on('callback_query', async ({ data: action, message }) => {
  if (!message) {
    return
  }
  const { chat } = message
  const userIds = readUserIds()
  const messageId = message.message_id

  await bot.deleteMessage(chat.id, messageId.toString(10))

  if (ACTIONS.join.enum === action)
    return send(messages.getJoin(userIds, chat)).then(() => {
      return send(messages.getContribute(chat)).then(() => send(messages.getTwitter(chat)))
    })
  if (ACTIONS.help.enum === action)
    return send(messages.getHelp(userIds, chat)).then(() => {
      return send(messages.getContribute(chat)).then(() => send(messages.getTwitter(chat)))
    })
  if (ACTIONS.stop.enum === action) return send(messages.getStop(userIds, chat))
  if (ACTIONS.contribute.enum === action) return send(messages.getContribute(chat, true))
})

// Error all errors
bot.on('polling_error', logger.error)

export default { broadcast }
