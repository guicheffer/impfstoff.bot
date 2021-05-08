require("dotenv").config();
const fetch = require("node-fetch");

const bots = require("./bots.js");
const logger = require("./logger");

const API_FETCH_FROM_URL = `${process.env.API}?robot=1`;
const DIFF_MIN = 5;
const TIMER_BOT_FETCH = 1000;

const urls = {
  arena: "https://bit.ly/2PL4I8J",
  tempelhof: "https://bit.ly/2PONurc",
  messe: "https://bit.ly/3b0xCJr",
  velodrom: "https://bit.ly/3thD8h7",
  tegel: "https://bit.ly/3eeAIeT",
  erika: "https://bit.ly/2QIki5J",
};

const usedQueue = {};
const checkFirstAvailableDate = (dates, dateKeys) => {
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

    if (diffMins <= DIFF_MIN) {
      if (usedQueue[dateKeys[i]]?.toString() === lastTime.toString()) return;
      if ((diffMins === 0 || diffMins === 1) && usedQueue[dateKeys[i]] === 0)
        return;

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

  logger.info({ timestamp: new Date() }, "FETCH_TIMESTAMP");

  fetch(API_FETCH_FROM_URL, {
    body: null,
    credentials: "omit",
    method: "GET",
    mode: "cors",
  })
    .then((res) => res.json())
    .then((json) => {
      const { stats: places } = json;

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
          const link = urls[place];
          const date = new Date(availableDate).toLocaleDateString("de-DE");
          const seen =
            diffMins === 0 ? "just now" : `seen ${diffMins} mins ago`;

          msgsQueue.push(
            `💉 Appointments on _${placeName}_ available on *${date}* at ${link} (_${seen}_)`
          );
        }
      }

      msgsQueue.forEach((message) => bots.send(message));
    });
}, TIMER_BOT_FETCH);
