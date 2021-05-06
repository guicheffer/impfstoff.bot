// I know, it's a monolith down here - will get this improved and evolved soon 🙂

const TelegramBot = require("node-telegram-bot-api");
const fetch = require("node-fetch");
const fs = require("fs");

const botToken = process.env.TOKEN;
const bot = new TelegramBot(botToken, { polling: true });
const logger = console;
const usedQueue = {};

const API_FETCH_FROM_URL = `${process.env.API}?robot=1`;
const DIFF_MIN = 10; // TODO: Iterate on top of this if necessary
const TIMER_BOT_FETCH = 1000;
const _guichefferId = 93074192;

const links = {
  arena: "https://bit.ly/2PL4I8J",
  tempelhof: "https://bit.ly/2PONurc",
  messe: "https://bit.ly/3b0xCJr",
  velodrom: "https://bit.ly/3thD8h7",
  tegel: "https://bit.ly/3eeAIeT",
  erika: "https://bit.ly/2QIki5J",
};

const paths = {
  userIds: "./ids.json",
  usersSettings: "./users-settings.json",
};

// Initialize files
if (!fs.existsSync(paths.usersSettings))
  fs.writeFileSync(paths.usersSettings, JSON.stringify({}), { flag: "wx" });
if (!fs.existsSync(paths.userIds))
  fs.writeFileSync(paths.userIds, JSON.stringify([]), { flag: "wx" });

const readTelegramIds = () => JSON.parse(fs.readFileSync(paths.userIds));

const checkFirstAvailableDate = (dates, dateKeys, placeName) => {
  for (let i = 0; i < dateKeys.length; i++) {
    const today = new Date();
    const currentDate = dates[dateKeys[i]];
    const lastTime = new Date(currentDate.last);
    const diffMs = lastTime - today;
    const diffDays = Math.floor(diffMs / 86400000) * -1;
    const diffHrs = Math.floor((diffMs % 86400000) / 3600000) * -1;
    const diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000) * -1;

    if (diffDays !== 1) continue;
    if (diffHrs !== 1) continue;

    logger.info(
      `🔥 Closest: ${dateKeys[i]} for ${diffMins} minutes at ${placeName} - (${diffMins} <> ${DIFF_MIN})`
    );

    if (diffMins <= DIFF_MIN) {
      if (usedQueue[dateKeys[i]]?.toString() === lastTime.toString()) return;
      if (diffMins === 0 && usedQueue[dateKeys[i]] === 0) return;

      if (diffMins === 0) {
        usedQueue[dateKeys[i]] = 0;
      } else {
        usedQueue[dateKeys[i]] = lastTime;
      }

      return { availableDate: dateKeys[i], diffMins };
    }
  }
};

// Interval for checking vaccines appointment
setInterval(() => {
  let msgsQueue = [];

  fetch(API_FETCH_FROM_URL, {
    body: null,
    credentials: "omit",
    method: "GET",
    mode: "cors",
  })
    .then((res) => res.json())
    .then((json) => {
      const { stats: places } = json;

      logger.info("🔥 Fetching from ", new Date());
      const telegramIds = JSON.parse(fs.readFileSync(paths.userIds));

      for (let i = 0; i < places.length; i++) {
        const dates = places[i].stats ?? {};
        const dateKeys = Object.keys(dates);
        const hasDates = Boolean(dateKeys.length);
        const place = places[i].id;
        const placeName = places[i].name;

        if (!hasDates) continue;

        const { availableDate = null, diffMins } =
          checkFirstAvailableDate(dates, dateKeys, placeName) ?? {};

        if (availableDate) {
          const link = links[place];
          const date = new Date(availableDate).toLocaleDateString("pt-BR");
          const seen =
            diffMins === 0 ? "just now" : `seen ${diffMins} mins ago`;

          msgsQueue.push(
            `💉 Appointments on _${placeName}_ available on *${date}* at ${link} (_${seen}_)`
          );
        }
      }

      // Send actual messages to users
      msgsQueue.forEach((msg) => {
        telegramIds.forEach((telegramId) =>
          bot.sendMessage(telegramId, msg, {
            disable_web_page_preview: true,
            parse_mode: "Markdown",
          })
        );
      });
    });
}, TIMER_BOT_FETCH);

// Listen to messages
bot.on("message", (msg) => {
  const givenChatId = msg.chat.id;
  const text = msg.text;

  if (text === "/start") {
    bot.sendMessage(givenChatId, "👋🏼 Please press `Join` to join us! ❤️", {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: 'Join', callback_data: 'join' }]],
      }
    });
  } else if (text === "/help") {
    const telegramIds = readTelegramIds();
    if (telegramIds.includes(givenChatId)) {
      bot.sendMessage(
        givenChatId,
        "❌ You are already part of the team, just sit back, relax and wait for new upcoming, hopefully, available appointments seen in less than 10 minutes. 😘"
      );

      bot.sendMessage(
        givenChatId,
        "❗️ We send the avail. appointments over a time box of 10 minutes (in case new ones pop up). 😘"
      );

      return bot.sendMessage(
        givenChatId,
        '‼️ Based on the statistics we’ve collected, a "significantly earlier" appointment stays available for about *20 seconds*. That is the amount of time that you have to choose the dates for the first and second shots, agree to the notices, fill the form with your information and confirm. Being able to do this all for the first time in 20 seconds is virtually impossible, so we recommend that you book an appointment for a later date to get used to the process, and then cancel that appointment if you want to try to book an earlier date.',
        { parse_mode: "Markdown" }
      );
    }

    bot.sendMessage(givenChatId, "👋🏼 Press `Join` in order to join on the queue for fetching available vaccine appointments.", {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: 'Join', callback_data: 'join' }]],
      }
    });
  } else if (givenChatId === _guichefferId && text.includes("/broadcast")) {
    const telegramIds = readTelegramIds();
    const message = text.replace("/broadcast ", "📣 ");

    logger.log(`📣 Broadcasting: "${text}"`);

    telegramIds.forEach((telegramId) => {
      bot.sendMessage(telegramId, message, { parse_mode: "Markdown" });
    });
  } else {
    bot.sendMessage(
      givenChatId,
      "❌ I appreciate your message, however, I can't talk to you right now as we're kindly waiting and looking for new appointments!"
    );
  }

  // Send message to @guicheffer
  bot.sendMessage(
    _guichefferId,
    `📣 Someone talking to your bot (${givenChatId} - ${msg.chat?.first_name} (${msg.chat?.username})): ${text}`
  );
});

// Listen to queries from inline keyboards
bot.on("callback_query", (query) => {
  const givenChatId = query.from.id;
  const action = query.data;

  if (action === "join") {
    const telegramIds = readTelegramIds();
    if (telegramIds.includes(givenChatId))
      return bot.sendMessage(
        givenChatId,
        "❌ You are already part of the team. 😘"
      );
    const data = JSON.stringify([...telegramIds, givenChatId]);

    fs.writeFileSync(paths.userIds, data, ({ message }) => {
      if (message) {
        logger.error(
          "❌ There has been an error saving your configuration data." + message
        );
        return;
      }
    });

    bot.sendMessage(
      givenChatId,
      "👋🏼 Welcome to the team. Just wait for new avail. appointments now. In the meantime, feel free to check upon this website overall avail. dates: https://impfstoff.link/"
    );
  }
});
