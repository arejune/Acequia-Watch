// The community side as data: issues, bills, ways to help, and the year on the
// ditch. Every fact carries a source key from src/content/learn.ts. Advice
// ("what you can do") is ours and is not presented as fact.
// Bill statuses checked on nmlegis.gov on CHECKED_AT.
import type { SourceKey } from './learn'

export const CHECKED_AT = '2026-10-24'

export interface Issue {
  id: string
  title: string
  stat?: string
  statLabel?: string
  what: string
  why: string
  sources: SourceKey[]
  helps: string
  art: 'debris' | 'money' | 'drought' | 'sale' | 'map' | 'repair'
}

export const ISSUES: Issue[] = [
  {
    id: 'debris',
    title: 'Burn scars fill the ditches',
    stat: '~90',
    statLabel: 'acequias blocked by debris after one 2022 fire',
    what: 'After a wildfire the slopes are bare. The next hard rain washes mud, ash and logs downhill, and it piles up in the ditches and at the intakes.',
    why: 'After the Hermits Peak–Calf Canyon fire, stream debris blocked about 90 acequias. A ditch full of silt can’t carry water to anyone’s field.',
    sources: ['undark', 'sourceNmRecovering'],
    helps: 'Fast, well-documented damage reports, so cleanup money gets approved sooner. That part is what the steward side of this app is for.',
    art: 'debris',
  },
  {
    id: 'money',
    title: 'Aid pays back, months later',
    stat: '25%',
    statLabel: 'of the cost the local group pays in a state disaster (12.5% in a federal one)',
    what: 'Disaster aid pays an acequia back after the repair is done. In a state disaster the local group pays 25%. In a federal disaster FEMA pays 75%, the state 12.5% and the local group 12.5%.',
    why: 'Acequias are run by volunteers. At the 2022 Congreso, mayordomos said even a 10% share for cleanup was too much for small ditches.',
    sources: ['nmaaGuide', 'semanario'],
    helps: 'A state fund that pays the local share. In 2026 lawmakers doubled it (see SB 193 under Bills).',
    art: 'money',
  },
  {
    id: 'drought',
    title: 'Less snow, less water',
    stat: '25%',
    statLabel: 'less runoff New Mexico could see soon',
    what: 'A researcher at NMSU says the state could see up to 25% less runoff in the near future. It already gets less runoff from the same snowpack.',
    why: 'One acequia in the Undark story went from water every two weeks to one day every three weeks.',
    sources: ['undark'],
    helps: 'Acequias already split shortages between ditches through repartimiento. Water that seeps from earthen ditches also refills shallow groundwater.',
    art: 'drought',
  },
  {
    id: 'sale',
    title: 'Water rights sold off the ditch',
    what: 'Water rights used to stay in the community. José Rivera told Undark they are now “bought and sold, like any kind of property.”',
    why: 'He called it a major threat. Every right that leaves is one less family sharing the water and the spring cleaning.',
    sources: ['undark'],
    helps: 'If your family has rights, learn your acequia’s rules before anyone sells. If you don’t, buying from farms on the ditch keeps those fields in use.',
    art: 'sale',
  },
  {
    id: 'map',
    title: 'Ditches the state can’t see',
    stat: '73%',
    statLabel: 'of mapped acequia systems have no name on the state map',
    what: 'Most acequia systems on the State Engineer’s map have no name, because nobody has reported them to the state.',
    why: 'Officials say an accurate map matters most after a disaster, when state and federal money has to find the ditches that were hurt.',
    sources: ['sourceNmMapping'],
    helps: 'Stewards can report their acequia to the State Engineer’s mapping project. Acequia Watch keeps an inventory of every headgate and culvert, ready before anything breaks.',
    art: 'map',
  },
  {
    id: 'repair',
    title: '$73 million in repairs waiting',
    stat: '$73M',
    statLabel: 'in unmet needs, told to lawmakers in 2026',
    what: 'The New Mexico Acequia Association told lawmakers in 2026 that acequias have $73 million in repairs and upgrades they can’t pay for.',
    why: 'Until July 2026 the main state fund for acequia projects gave about $2.5 million a year. Spread across hundreds of ditches, that doesn’t go far.',
    sources: ['sourceNmFunding', 'isc2025'],
    helps: 'Bills that set aside steady money for repairs. One passed in 2026 and a bigger one died (see Bills).',
    art: 'repair',
  },
]

export type Stage = 'filed' | 'committee' | 'first' | 'second' | 'governor'
export const STAGES: { key: Stage; label: string }[] = [
  { key: 'filed', label: 'Filed' },
  { key: 'committee', label: 'Committee' },
  { key: 'first', label: 'First chamber' },
  { key: 'second', label: 'Second chamber' },
  { key: 'governor', label: 'Signed' },
]

export interface Bill {
  id: string
  number: string
  name: string
  plain: string
  outcome: 'signed' | 'died' | 'law'
  reached: Stage
  statusLine: string
  sponsors?: string
  story?: string
  sources: SourceKey[]
  issue?: string
}

export const BILLS: Bill[] = [
  {
    id: 'sb193',
    number: 'SB 193',
    name: 'Acequia & Ditch Infrastructure Fund Transfer',
    plain: 'Doubles the yearly money for the state’s acequia and community ditch fund, from $2.5 million to $5 million, starting July 1, 2026.',
    outcome: 'signed',
    reached: 'governor',
    statusLine: 'Signed by the governor March 9, 2026 (Chapter 56).',
    sponsors: 'Sen. Pete Campos, Sen. Leo Jaramillo, Rep. Anita Gonzales',
    story: 'In December 2022, mayordomos at the Congreso de las Acequias asked for this exact change: take the fund from $2.5 million to $5 million. It became law a little over three years later.',
    sources: ['sb193', 'nmaa2026', 'semanario'],
    issue: 'repair',
  },
  {
    id: 'hb111',
    number: 'HB 111',
    name: 'Water Law Violation Maximum Penalty',
    plain: 'Raises fines for some water law violations, up to $3,400 a day, and sets penalties for selling water without a permit.',
    outcome: 'signed',
    reached: 'governor',
    statusLine: 'Signed by the governor March 4, 2026 (Chapter 28).',
    sources: ['hb111', 'nmaa2026'],
    issue: 'sale',
  },
  {
    id: 'hb371',
    number: 'HB 371',
    name: 'Land Grant-Merced & Acequia Infrastructure',
    plain: 'Would have set up steady repair funds and a trust fund for acequias and land grants.',
    outcome: 'died',
    reached: 'first',
    statusLine: 'Passed the House 63–2 on February 15, 2026. Died in the Senate Finance Committee.',
    story: 'This one got very close. Bills that die can be filed again in a later session.',
    sources: ['hb371'],
    issue: 'repair',
  },
  {
    id: 'hb21',
    number: 'HB 21',
    name: 'Land Grant-Merced Acequia Infrastructure Act',
    plain: 'Another 2026 bill with the same goal: one project fund for acequias and one for land grants. HB 371 carried the idea further that session.',
    outcome: 'died',
    reached: 'committee',
    statusLine: 'Passed its first committee January 27, 2026, then stalled.',
    sources: ['hb21', 'sourceNmFunding'],
    issue: 'repair',
  },
  {
    id: 'hpcc',
    number: 'Federal',
    name: 'Hermit’s Peak/Calf Canyon Fire Assistance Act',
    plain: 'In 2022 Congress set up a $2.5 billion program to pay people hurt by the Hermits Peak–Calf Canyon fire. FEMA runs claims offices in Santa Fe, Las Vegas and Mora.',
    outcome: 'law',
    reached: 'governor',
    statusLine: 'Federal law since 2022. Claims offices changed their hours in May 2026.',
    sources: ['semanario', 'femaHpcc'],
    issue: 'debris',
  },
]

export interface Opportunity {
  name: string
  who: string
  what: string
  kind: 'youth' | 'job' | 'event' | 'support'
  url: string
  source: SourceKey
}

export const OPPORTUNITIES: Opportunity[] = [
  { kind: 'youth', name: 'Sembrando Semillas', who: 'Kids and families near Taos, Chamisal, Chimayó or Abiquiú', what: 'Farm projects where older people teach younger ones how acequia farming works.', url: 'https://lasacequias.org/youth-opportunities', source: 'nmaaYouth' },
  { kind: 'youth', name: 'Acequia Culture Youth Leadership Institute', who: 'Young people from acequia communities', what: 'NMAA’s leadership program. Applications usually open early in the year.', url: 'https://lasacequias.org/youth-opportunities', source: 'nmaaYouth' },
  { kind: 'youth', name: 'Los Sembradores Farmer Training', who: 'New farmers', what: 'NMAA’s farmer training. The page says applications open in January.', url: 'https://lasacequias.org/youth-opportunities', source: 'nmaaYouth' },
  { kind: 'youth', name: 'Acequia Career and Livelihood Program', who: 'Middle school through college', what: 'Mentoring toward work as a farmer, rancher, mayordomo or commissioner, plus links into science and tech.', url: 'https://lasacequias.org/career-livelihood/', source: 'nmaaCareer' },
  { kind: 'job', name: 'NM Youth Conservation Corps', who: 'Youth and young adults', what: 'Paid crew jobs across the state. Postings are on the EMNRD jobs page.', url: 'https://lasacequias.org/youth-opportunities', source: 'nmaaYouth' },
  { kind: 'job', name: 'Forest Stewards Youth Corps', who: 'Ages 18 to 25', what: 'Paid fire and forest crews with chainsaw and wildland fire training.', url: 'https://lasacequias.org/youth-opportunities', source: 'nmaaYouth' },
  { kind: 'job', name: 'Rocky Mountain Youth Corps', who: 'Youth and young adults', what: 'Paid conservation crews. Openings are posted year round.', url: 'https://lasacequias.org/youth-opportunities', source: 'nmaaYouth' },
  { kind: 'event', name: 'Acequia Day at the Roundhouse', who: 'Anyone', what: 'Acequia people meet lawmakers during the session. In 2026 it fell on February 2.', url: 'https://lasacequias.org/2025-legislative-updates/', source: 'nmaa2026' },
  { kind: 'event', name: 'Congreso de las Acequias', who: 'Anyone', what: 'The yearly statewide gathering, held in December. About 300 people came in 2025.', url: 'https://lasacequias.org/congreso/', source: 'nmaaCongreso' },
  { kind: 'support', name: 'New Mexico Acequia Association', who: 'Anyone', what: 'The statewide group for acequias. Its site lists programs, news and how to give.', url: 'https://lasacequias.org/', source: 'nmaaCareer' },
]

/** Topics for the message builder. The text is a starting point the person edits. */
export const LETTER_TOPICS: { id: string; label: string; ask: string }[] = [
  { id: 'fund', label: 'Steady repair money', ask: 'Acequias have told lawmakers they need about $73 million in repairs. SB 193 helped by doubling the infrastructure fund. Please support a dedicated, long-term repair fund for acequias in the next session, like the one in HB 371 that passed the House 63–2.' },
  { id: 'disaster', label: 'Faster disaster help', ask: 'When a fire or flood hits, acequias are run by volunteers who have to pay up front and wait to be paid back. Please support covering the local cost share and paying acequias faster after disasters.' },
  { id: 'map', label: 'Mapping every acequia', ask: 'Most acequia systems on the state map still have no name. Please fund the work to map them, so disaster money can find the ditches that need it.' },
  { id: 'water', label: 'Keeping water on the ditch', ask: 'Water rights leaving acequias weakens the communities that share them. Please support acequias’ say in water transfers and enforce the water laws already on the books.' },
]

/** The year on the ditch. Months are 0-based. */
export const YEAR: { months: number[]; title: string; text: string; source: SourceKey }[] = [
  { months: [0, 1, 2], title: 'Session at the Roundhouse', text: 'Lawmakers meet in Santa Fe. Acequia bills are heard in committee. Acequia Day was February 2 in 2026.', source: 'nmaa2026' },
  { months: [2, 3, 4], title: 'La limpia', text: 'Members clean the ditch together before the water comes, usually in spring.', source: 'utton' },
  { months: [6, 7, 8], title: 'Monsoon and burn scars', text: 'Summer storms on burned slopes can send mud and logs into ditches. That is what happened in 2022.', source: 'undark' },
  { months: [9, 10, 11], title: 'Congreso and next year’s asks', text: 'The statewide Congreso meets in December and sets priorities for the next session.', source: 'nmaaCongreso' },
]
