import twitter from 'twitter-lite'
import config from '../../resources/twitter/config'
import { logger } from '../logger'

const client = new twitter(config)

const tweet = async (rawStatus: string): Promise<void> => {
  const status = rawStatus.replace(/_|\*/g, '')

  await client
    .post('statuses/update', { status })
    .then((result) => {
      if (process.env.NODE_ENV === 'development') logger.info({ message: result.text }, 'TWEET')
    })
    .catch((error) => logger.error({ error }, 'FAILED_TO_TWEET'))
}

export default { tweet }
