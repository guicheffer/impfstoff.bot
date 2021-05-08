const pino = require("pino");

const base = {
  messageKey: "message",
  customAttributeKeys: {
    req: "request",
    res: "response",
    err: "error",
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  ...(process.env.NODE_ENV === "production"
    ? {}
    : {
        /* 1 */ prettyPrint: {
          hideObject: false,
          singleLine: false,
          levelFirst: true,
        },
      }),
};

const logger = pino(
  {
    ...base,
    name: "Server",
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
    },
  },
  pino.destination({ sync: false })
);

module.exports = logger;
