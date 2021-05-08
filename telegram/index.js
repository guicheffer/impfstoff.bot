const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");
const paths = require("./paths.js");
const adminIds = require("./resources/admins.json").ids;
const logger = require("../logger");
const messages = require("./messages");

const botToken = process.env.TOKEN;
const bot = new TelegramBot(botToken, { polling: true });

const ACTIONS = {
  help: {
    copy: "Help",
    enum: "help",
  },
  join: {
    copy: "Join",
    enum: "join",
  },
  stop: {
    copy: "Stop, please!",
    enum: "stop",
  },
};
const DISABLE_PAGE_PREVIEW = "disable_web_page_preview";
const DEFAULT_TELEGRAM_MESSAGE_OPTIONS = {
  [DISABLE_PAGE_PREVIEW]: true,
  parse_mode: "Markdown",
};

const isJoinMessage = (text) => text.match(/start|join/);
const isHelpMessage = (text) => text.match(/help|halp|what|hilfe|how/);
const isStopMessage = (text) => text.match(/stop|leave|exit|pause|quiet|mute/);

const readUserIds = () => JSON.parse(fs.readFileSync(paths.users.fileName)).ids;

const send = async ({ id, message, omit, options }) => {
  if (!omit) logger.info({ id, message }, "SEND");

  await bot.sendMessage(id, message, options).catch((error) => {
    logger.error({ id, error }, "FAILED_TO_SEND");
  });
};

const broadcast = (message, options = {}) => {
  const mapUsersPromises = readUserIds().map((id) => {
    return send({
      id,
      message,
      omit: true,
      options: { ...DEFAULT_TELEGRAM_MESSAGE_OPTIONS, ...options },
    });
  });

  return Promise.all(mapUsersPromises);
};

// Listen to messages
bot.on("message", ({ chat, text: rawText }) => {
  const { id } = chat;
  const text = rawText.toLowerCase();

  // Broadcast (only for admins)
  if (adminIds.includes(id) && text.startsWith("/broadcast")) {
    const message = text.replace("/broadcast ", "📣 ");

    return broadcast(message, {
      [TELEGRAM_DISABLE_PAGE_PREVIEW]: false,
    }).then(() => logger.info(`📣 Broadcasted: "${text}"`, "SEND_BROADCAST"));
  }

  const userIds = readUserIds();

  if (isJoinMessage(text)) return send(messages.getJoin(userIds, chat));
  if (isStopMessage(text)) return send(messages.getStop(userIds, chat));
  if (isHelpMessage(text)) return send(messages.getHelp(userIds, chat));

  // Otherwise:
  let buttons = [
    [{ text: ACTIONS.help.copy, callback_data: ACTIONS.help.enum }],
  ];

  buttons.unshift(
    userIds.includes(id)
      ? [{ text: ACTIONS.stop.copy, callback_data: ACTIONS.stop.enum }]
      : [{ text: ACTIONS.join.copy, callback_data: ACTIONS.join.enum }]
  );

  return send({
    id,
    message:
      "🤔 Not sure what you mean, but maybe one of the following options can help you:",
    options: {
      reply_markup: {
        inline_keyboard: buttons,
      },
    },
  });
});

// Listen to queries from inline keyboards
bot.on("callback_query", ({ data: action, message }) => {
  const { chat } = message;
  const userIds = readUserIds();

  if (ACTIONS.join.enum === action)
    return send(messages.getJoin(userIds, chat));
  if (ACTIONS.stop.enum === action)
    return send(messages.getStop(userIds, chat));
  if (ACTIONS.help.enum === action)
    return send(messages.getHelp(userIds, chat));
});

// Error all errors
bot.on("polling_error", logger.error);

module.exports = { broadcast };
