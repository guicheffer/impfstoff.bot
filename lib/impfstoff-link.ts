import fetch from 'node-fetch'

const IMPFSTOFF_LINK_URL = process.env.API || `https://api.impfstoff.link/?robot=1`

export type VenueId = 'arena' | 'tempelhof' | 'messe' | 'velodrom' | 'tegel' | 'erika'
export type DateKey = `${number}-${number}-${number}`

export interface ImpfstoffLinkStats {
  percent: number
  last: number
  count: number
}

export interface ImpfstoffLinkVenue {
  id: VenueId
  name: string
  open: boolean
  lastUpdate?: number
  stats: { [date: string]: ImpfstoffLinkStats }
}

export interface ImpfstoffLinkResponse {
  language: string
  stats: ImpfstoffLinkVenue[]
}

export async function fetchImpfstoffLink(): Promise<ImpfstoffLinkResponse> {
  const request = await fetch(IMPFSTOFF_LINK_URL)
  const response = await request.json()

  return response
}
