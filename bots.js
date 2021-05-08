const telegramBot = require("./telegram");

const send = (message) => {
  telegramBot.broadcast(message);
};

module.exports.send = send;
