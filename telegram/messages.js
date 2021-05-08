const fs = require("fs");
const paths = require("./paths.js");
const logger = require("../logger");

const logAction = (
  action,
  amountUsers,
  { first_name, id, username },
  isPresent
) =>
  logger.info(
    {
      amountUsers,
      first_name,
      id,
      username,
      ...(action === "HELP" ? { isPresent } : {}),
    },
    action
  );

const getJoin = (userIds, { id, ...chat }) => {
  const isPresent = userIds.includes(id);

  if (isPresent)
    return { id, message: "❌ You are already part of the team. 😘" };

  const newUserIds = JSON.stringify({ ids: [...userIds, id] });

  fs.writeFileSync(paths.users.fileName, newUserIds, (error) => {
    logger.error({ error }, "FAILED_SAVING_FILE");
  });

  logAction("JOIN", userIds.length + 1, { id, chat });

  return {
    id,
    message:
      "👋🏼 Welcome to the team. Just wait for new avail. appointments now. In the meantime, feel free to check upon this website overall avail. dates: https://impfstoff.link/",
  };
};

const getHelp = (userIds, { id, ...chat }) => {
  const isPresent = userIds.includes(id);

  logAction("HELP", userIds.length, { id, chat }, isPresent);

  if (isPresent)
    return {
      id,
      message:
        '\
‼️ You are already part of the team, just sit back, relax and wait for new upcoming, hopefully, available appointments seen in less than 10 minutes. 😘 \n\n\
❗️ We send the avail. appointments over a time box of 10 minutes (in case new ones pop up). 😘)\n\n\
‼️ Based on the statistics we’ve collected, a "significantly earlier" appointment stays available for about *20 seconds*.\
That is the amount of time that you have to choose the dates for the first and second shots, agree to the notices, fill the form with your information and confirm. Being able to do this all for the first time in 20 seconds is virtually impossible, so we recommend that you book an appointment for a later date to get used to the process, and then cancel that appointment if you want to try to book an earlier date.',
    };

  return {
    id,
    message:
      "👋🏼 Press `Join` in order to join on the queue for fetching available vaccine appointments in Berlin.",
    options: {
      reply_markup: {
        inline_keyboard: [[{ text: "Join", callback_data: "join" }]],
      },
    },
  };
};

const getStop = (userIds, { id, ...chat }) => {
  const isPresent = userIds.includes(id);

  if (isPresent) {
    const filteredUserIds = userIds.filter((currentId) => currentId !== id);
    const newUserIds = JSON.stringify({ ids: filteredUserIds });

    fs.writeFileSync(paths.users.fileName, newUserIds, (error) => {
      logger.error({ error }, "FAIL_SAVING_FILE");
    });

    logAction("STOP", userIds.length - 1, { id, chat });

    return {
      id,
      message:
        "👋🏼 Ok, we will no longer send you any messages. If you want to join us again, just press `Join` below. ❤️",
      options: {
        reply_markup: {
          inline_keyboard: [[{ text: "Join", callback_data: "join" }]],
        },
      },
    };
  }

  return {
    id,
    message:
      "☑️ You've already been removed. If you want to join us again, just press `Join` below. ❤️",
    options: {
      reply_markup: {
        inline_keyboard: [[{ text: "Join", callback_data: "join" }]],
      },
    },
  };
};

module.exports = {
  getHelp,
  getJoin,
  getStop,
};
