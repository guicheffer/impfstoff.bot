import fs from 'fs'

type DefaultIdsPayload = {
  ids: string[]
}

type PathInfo<T = DefaultIdsPayload> = {
  default: T
  fileName: string
}

const DEFAULT_IDS_PAYLOAD: DefaultIdsPayload = { ids: [] }

type Admins = PathInfo
type Users = PathInfo
type UsersSettings = PathInfo<Record<string, unknown>>

type Paths = {
  admins: Admins
  users: Users
  usersSettings: UsersSettings
}

export const paths: Paths = {
  admins: {
    default: DEFAULT_IDS_PAYLOAD,
    fileName: './resources/telegram/admins.json',
  },
  users: {
    default: DEFAULT_IDS_PAYLOAD,
    fileName: './resources/telegram/users.json',
  },
  usersSettings: {
    default: {},
    fileName: './resources/telegram/users-settings.json',
  },
}

for (const path of Object.values(paths)) {
  if (!fs.existsSync(path.fileName)) {
    fs.writeFileSync(path.fileName, JSON.stringify(path.default), {
      flag: 'wx',
    })
  }
}
