import fs from 'fs'
import TelegramBot, { SendMessageOptions } from 'node-telegram-bot-api'
import { paths } from './paths'
import { ids as adminIds } from '../../resources/telegram/admins.json'
import { logger } from '../logger'
import * as messages from './messages'

const botToken = process.env.TOKEN

if (!botToken) {
  throw new Error('Please export the telegram bot token as TOKEN in your env')
}
const bot = new TelegramBot(botToken, { polling: true })

const ACTIONS = {
  help: {
    copy: 'Help',
    enum: 'help',
  },
  join: {
    copy: 'Join',
    enum: 'join',
  },
  stop: {
    copy: 'Stop, please!',
    enum: 'stop',
  },
}
const DISABLE_PAGE_PREVIEW = 'disable_web_page_preview'
const DEFAULT_MESSAGE_OPTIONS: Partial<SendMessageOptions> = {
  [DISABLE_PAGE_PREVIEW]: true,
  parse_mode: 'Markdown',
}

const isJoinMessage = (text: string) => text.match(/start|join/)
const isHelpMessage = (text: string) => text.match(/help|halp|what|hilfe|how/)
const isStopMessage = (text: string) => text.match(/stop|leave|exit|pause|quiet|mute/)

function readUserIds(): number[] {
  return JSON.parse(fs.readFileSync(paths.users.fileName, 'utf-8')).ids
}

const send = async ({ id, message, omit = true, options }: messages.Message) => {
  if (!omit) logger.info({ id, message }, 'SEND')

  await bot.sendMessage(id, message, options)
}

let blockedUserIds: number[] = []
let shouldDebounceBroadcast = false

export type BroadcastOptions = { force: boolean } & Partial<SendMessageOptions>
export async function broadcast(
  message: string,
  { force, ...options }: BroadcastOptions = { force: false },
): Promise<void> {
  // Force debounce on broadcast
  if (!force && shouldDebounceBroadcast) {
    return Promise.reject({ message: 'STILL_BROADCASTING', text: message })
  }
  if (!force) {
    shouldDebounceBroadcast = true
  }

  const userIds = readUserIds()

  // This will prioritize LIFO over the user ids when broadcasting
  blockedUserIds = []
  const mapUsersPromises = readUserIds()
    .reverse()
    .map(
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
              if (error.message.includes('bot was blocked by the user')) {
                blockedUserIds.push(id)
                logger.error({ error, id }, 'BLOCKED_USER_TO_REMOVE')
              } else {
                logger.error({ error, id }, 'GENERAL_BROADCAST_ERROR')
              }

              reject(error)
            }
          }, index * 200)
        }),
    )

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  await Promise.all(mapUsersPromises).catch(() => {}) // No needs to log all promises

  if (blockedUserIds.length) {
    const userIdsWithoutBlockedOnes = readUserIds().filter((currentId) => !blockedUserIds.includes(currentId))

    messages.saveNewUserIds(JSON.stringify({ ids: userIdsWithoutBlockedOnes }))

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
  const text = rawText ? rawText.toLowerCase() : ''

  // Broadcast (only for admins)
  if (adminIds.includes(id) && text.startsWith('/broadcast')) {
    const message = text.replace('/broadcast ', '📣 ')

    return broadcast(message, {
      force: true, // Force broadcast to happen since it's a manual announcement
      [DISABLE_PAGE_PREVIEW]: false,
    })
      .then(() => logger.info(`📣 Broadcasted: "${text}"`, 'SEND_BROADCAST'))
      .catch((error) => {
        logger.error(error)
      })
  }

  const userIds = readUserIds()

  if (isJoinMessage(text)) return send(messages.getJoin(userIds, chat))
  if (isStopMessage(text)) return send(messages.getStop(userIds, chat))
  if (isHelpMessage(text)) return send(messages.getHelp(userIds, chat))

  // Otherwise:
  const buttons = [[{ text: ACTIONS.help.copy, callback_data: ACTIONS.help.enum }]]

  buttons.unshift(
    userIds.includes(id)
      ? [{ text: ACTIONS.stop.copy, callback_data: ACTIONS.stop.enum }]
      : [{ text: ACTIONS.join.copy, callback_data: ACTIONS.join.enum }],
  )

  return send({
    id,
    message: '🤔 Not sure what you mean, but maybe one of the following options can help you:',
    omit: false,
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

  if (ACTIONS.join.enum === action) return send(messages.getJoin(userIds, chat))
  if (ACTIONS.stop.enum === action) return send(messages.getStop(userIds, chat))
  if (ACTIONS.help.enum === action) return send(messages.getHelp(userIds, chat))
})

// Error all errors
bot.on('polling_error', logger.error)
