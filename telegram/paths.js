const fs = require("fs");

const DEFAULT_IDS_PAYLOAD = { ids: [] };

const paths = {
  admins: {
    default: DEFAULT_IDS_PAYLOAD,
    fileName: "./telegram/resources/admins.json",
  },
  users: {
    default: DEFAULT_IDS_PAYLOAD,
    fileName: "./telegram/resources/users.json",
  },
  usersSettings: {
    default: {},
    fileName: "./telegram/resources/users-settings.json",
  },
};

// Intialize files
Object.keys(paths).forEach((pathKey) => {
  const path = paths[pathKey];

  if (!fs.existsSync(path.fileName))
    fs.writeFileSync(path.fileName, JSON.stringify(path.default), {
      flag: "wx",
    });
});

module.exports = paths;
