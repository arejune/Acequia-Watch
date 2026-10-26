// Learn page content as data. Every fact is paraphrased and carries its source
// link. `checked` records how the source was verified on `CHECKED_ON`:
//   'opened'  — the page itself was read
//   'excerpt' — only a search excerpt of the page was read; open it before relying on it
// Facts that could not be linked are not published (see docs/SOURCES.md).

export const CHECKED_ON = '2026-10-21'

export interface Source { title: string; publisher: string; year: string; url: string; checked: 'opened' | 'excerpt' }

export const SOURCES = {
  nmaaGuide: { title: 'Acequia Guide to Disaster Funding (rev. June 2024)', publisher: 'New Mexico Acequia Association', year: '2024', url: 'https://lasacequias.org/wp-content/uploads/2024/07/Acequia-Guide-to-Disaster-Funding-Rev-June-2024.pdf', checked: 'opened' },
  sourceNmBlackFire: { title: 'Acequia steward strains to get help to recover historic southern NM irrigation systems', publisher: 'Source NM', year: '2022', url: 'https://sourcenm.com/2022/12/20/acequia-steward-strains-to-get-help-to-recover-historic-southern-nm-irrigation-systems/', checked: 'opened' },
  sourceNmMuddy: { title: 'Southern acequia stewards try to understand “muddy” disaster recovery process', publisher: 'Source NM', year: '2023', url: 'https://sourcenm.com/2023/02/24/southern-acequia-stewards-try-to-understand-muddy-disaster-recovery-process/', checked: 'excerpt' },
  sourceNmMapping: { title: 'Disaster recovery efforts boost initiative to map acequias in the state', publisher: 'Source NM', year: '2023', url: 'https://sourcenm.com/2023/06/08/disaster-recovery-efforts-boost-initiative-to-map-acequias-in-the-state/', checked: 'excerpt' },
  sourceNmRecovering: { title: 'Acequias recovering after NM disasters, but federal cuts loom', publisher: 'Source NM', year: '2025', url: 'https://sourcenm.com/2025/07/01/acequias-recovering-after-nm-disasters-but-federal-cuts-loom/', checked: 'excerpt' },
  sourceNmFunding: { title: 'NM committee OKs bill giving acequias dedicated funding stream', publisher: 'Source NM', year: '2026', url: 'https://sourcenm.com/2026/01/27/nm-committee-oks-bill-giving-acequias-dedicated-funding-stream/', checked: 'excerpt' },
  sourceNm2024: { title: 'New Mexico’s acequias outline 2025 legislative priorities', publisher: 'Source NM', year: '2024', url: 'https://sourcenm.com/2024/11/29/new-mexicos-acequias-outline-2025-legislative-priorities/', checked: 'excerpt' },
  ap2021: { title: 'Drought tests centuries-old water traditions in New Mexico', publisher: 'AP via KSAT', year: '2021', url: 'https://www.ksat.com/news/2021/09/18/drought-tests-centuries-old-water-traditions-in-new-mexico/', checked: 'excerpt' },
  isc2021: { title: 'NMISC Acequia Program (legislative handout)', publisher: 'Interstate Stream Commission', year: '2021', url: 'https://nmlegis.gov/handouts/REOTF%20071921%20Item%203%20NMISC%20Acequia%20Program.pdf', checked: 'excerpt' },
  isc2025: { title: 'ISC Acequia Infrastructure (legislative handout)', publisher: 'Interstate Stream Commission', year: '2025', url: 'https://www.nmlegis.gov/handouts/WNR%20070125%20Item%202%20ISC%20Acequia%20Infrastructure.pdf', checked: 'excerpt' },
  nmaa2023: { title: 'NMAA Disaster Recovery (legislative handout)', publisher: 'New Mexico Acequia Association', year: '2023', url: 'https://www.nmlegis.gov/handouts/WNR%20071023%20Item%207%20NMAA%20Disaster%20Recovery.pdf', checked: 'excerpt' },
  hm14: { title: 'House Memorial 14 (2007): Acequia de Chamita', publisher: 'New Mexico Legislature', year: '2007', url: 'https://www.nmlegis.gov/Sessions/07%20Regular/final/HM014.html', checked: 'excerpt' },
  haer: { title: 'Alamo Madre Acequia, San Antonio (HAER TX-1)', publisher: 'Library of Congress', year: 'n.d.', url: 'https://loc.gov/pictures/item/tx0215/', checked: 'excerpt' },
  cwt: { title: 'San Luis People’s Ditch', publisher: 'Colorado Water Trust', year: 'n.d.', url: 'https://coloradowatertrust.org/?p=8673', checked: 'excerpt' },
  moore: { title: 'Colorado Open Lands: community-guided irrigation stewardship', publisher: 'Moore Charitable Foundation', year: 'n.d.', url: 'https://moorecharitable.org/impact-story-2-colorado-open-lands-championing-community-guided-irrigation-stewardship-through-acequia-support/', checked: 'excerpt' },
  natgeo: { title: 'Small farms battle speculators over centuries-old water rights in drought-stricken Colorado', publisher: 'National Geographic', year: '2021', url: 'https://www.nationalgeographic.com/environment/article/small-farms-battle-speculators-over-centuries-old-water-rights-in-drought-stricken-colorado', checked: 'excerpt' },
  cuHandbook: { title: 'Colorado Acequia Handbook, 3rd edition', publisher: 'CU Boulder and partners', year: '2019', url: 'https://www.colorado.edu/center/gwc/sites/default/files/attached-files/colorado-acequia-handbook-third-edition-final.pdf', checked: 'excerpt' },
  nmsuSeepage: { title: 'Benefits of traditional acequia irrigation systems', publisher: 'Farm Progress (NMSU study)', year: '2009', url: 'https://www.farmprogress.com/irrigation/benefits-traditional-acequia-irrigation-systems', checked: 'excerpt' },
  nmsuWtf: { title: 'River, Acequia and Shallow Groundwater Interactions', publisher: 'NMSU Water Task Force', year: 'n.d.', url: 'https://pubs.nmsu.edu/water/WTF2/index.html', checked: 'excerpt' },
  dictionary: { title: 'acequia (word origin)', publisher: 'Dictionary.com (Random House)', year: 'n.d.', url: 'https://www.dictionary.com/browse/acequia', checked: 'opened' },
  utton: { title: 'Glossary of terms', publisher: 'UNM Utton Center', year: '2021', url: 'https://uttoncenter.unm.edu/news/2021/09/glossary-of-terms.pdf', checked: 'excerpt' },
  nmaaRepartimiento: { title: 'NM tradition of repartimiento in times of water shortage', publisher: 'New Mexico Acequia Association', year: '2016', url: 'https://lasacequias.org/2016/06/14/nm-tradition-of-repartimiento-in-times-of-water-shortage/', checked: 'excerpt' },
  nmaa2015: { title: 'Acequia count by county (2015 list)', publisher: 'NMAA, legislative handout', year: '2016', url: 'https://www.nmlegis.gov/handouts/WNR%20082516%20Item%206%20ACEQUIA%20COUNT%20BY%20COUNTY.pdf', checked: 'excerpt' },
  nmaa2016: { title: 'Acequia Association report', publisher: 'NMAA, legislative handout', year: '2016', url: 'https://www.nmlegis.gov/handouts/WNR%20082516%20Item%206%20ACEQUIA%20ASSOCIATION%20REPORT.pdf', checked: 'excerpt' },
  nmaa2017: { title: 'Winter 2017 newsletter', publisher: 'New Mexico Acequia Association', year: '2017', url: 'https://lasacequias.org/wp-content/uploads/2024/04/NMAA2017WinterNews.pdf', checked: 'excerpt' },
  nmaa2018: { title: 'Acequia updates and policy recommendations', publisher: 'NMAA, legislative handout', year: '2018', url: 'https://www.nmlegis.gov/handouts/WNR%20100218%20Item%207%20Acequia%20Updates%20and%20Policy%20Recommendations.pdf', checked: 'excerpt' },
  nmaa2019: { title: 'NM Acequia Association presentation', publisher: 'NMAA, legislative handout', year: '2019', url: 'https://www.nmlegis.gov/handouts/WNR%20110719%20Item%208%20NM%20Acequia%20Association%20presentation.pdf', checked: 'excerpt' },
  oseDitches: { title: 'Acequia conveyances and points of diversion (ArcGIS)', publisher: 'Office of the State Engineer, EDAC', year: '2026', url: 'https://services2.arcgis.com/qXZbWTdPDbTjl7Dy/ArcGIS/rest/services/Acequia_ProjectCP/FeatureServer', checked: 'opened' },
  // Community side (checked 2026-10-24)
  sb193: { title: 'SB 193 (2026): Acequia & Ditch Infrastructure Fund Transfer', publisher: 'New Mexico Legislature', year: '2026', url: 'https://www.nmlegis.gov/Legislation/Legislation?chamber=S&legType=B&legNo=193&year=26', checked: 'opened' },
  hb111: { title: 'HB 111 (2026): Water Law Violation Maximum Penalty', publisher: 'New Mexico Legislature', year: '2026', url: 'https://www.nmlegis.gov/Legislation/Legislation?chamber=H&legType=B&legNo=111&year=26', checked: 'opened' },
  hb371: { title: 'HB 371 (2026): Land Grant-Merced & Acequia Infrastructure', publisher: 'New Mexico Legislature', year: '2026', url: 'https://www.nmlegis.gov/Legislation/Legislation?chamber=H&legType=B&legNo=371&year=26', checked: 'opened' },
  hb21: { title: 'HB 21 (2026): Land Grant-Merced Acequia Infrastructure Act', publisher: 'New Mexico Legislature', year: '2026', url: 'https://www.nmlegis.gov/Legislation/Legislation?chamber=H&legType=B&legNo=21&year=26', checked: 'opened' },
  nmaa2026: { title: '2026 legislative session updates', publisher: 'New Mexico Acequia Association', year: '2026', url: 'https://lasacequias.org/2025-legislative-updates/', checked: 'opened' },
  semanario: { title: 'Mayordomos from across New Mexico gather to call for help (Congreso, Dec. 2022)', publisher: 'El Semanario', year: '2022', url: 'https://www.elsemanarioonline.com/mayordomos-from-across-new-mexico-gather-to-call-for-help/', checked: 'opened' },
  undark: { title: 'Can New Mexico’s ancient water system survive climate change?', publisher: 'Undark', year: '2024', url: 'https://undark.org/2024/10/09/new-mexico-ancient-water-system-survive-climate-change/', checked: 'opened' },
  femaHpcc: { title: 'Hermit’s Peak/Calf Canyon Claims Office', publisher: 'FEMA', year: '2026', url: 'https://www.fema.gov/hermits-peak', checked: 'opened' },
  nmaaYouth: { title: 'Opportunities for acequia youth', publisher: 'New Mexico Acequia Association', year: '2026', url: 'https://lasacequias.org/youth-opportunities', checked: 'opened' },
  nmaaCareer: { title: 'Acequia Career and Livelihood Program', publisher: 'New Mexico Acequia Association', year: 'n.d.', url: 'https://lasacequias.org/career-livelihood/', checked: 'opened' },
  nmaaCongreso: { title: 'Annual Congreso de las Acequias', publisher: 'New Mexico Acequia Association', year: '2025', url: 'https://lasacequias.org/congreso/', checked: 'excerpt' },
  findLegislator: { title: 'Find my legislator', publisher: 'New Mexico Legislature', year: '2026', url: 'https://www.nmlegis.gov/Members/Find_My_Legislator', checked: 'opened' },
} satisfies Record<string, Source>

export type SourceKey = keyof typeof SOURCES

export interface Fact { text: string; source: SourceKey; stat?: string }

export const FACTS: Record<'origins' | 'beyond' | 'matter' | 'today' | 'disaster', Fact[]> = {
  origins: [
    { stat: 'Arabic', text: 'The word “acequia” came into Spanish from the Arabic al-sāqiyah, “the irrigation ditch.”', source: 'dictionary' },
    { stat: '1598', text: 'According to a 2007 New Mexico House memorial, in 1598 Oñate’s men and villagers from Ohkay Owingeh dug a ditch of Iberian-Arabic design. The memorial says it became the Acequia de Chamita, still in use.', source: 'hm14' },
    { text: 'The State Engineer’s office says Puebloan irrigation came before every acequia in New Mexico.', source: 'sourceNmMapping' },
  ],
  beyond: [
    { stat: '1852', text: 'The San Luis People’s Ditch in southern Colorado holds that state’s oldest water right, from 1852.', source: 'cwt' },
    { stat: '2,100 acres', text: 'One foundation says that ditch irrigates about 2,100 acres for 16 water users. Other sources give slightly smaller numbers.', source: 'moore' },
    { text: 'Colorado acequia groups and partners publish a Colorado Acequia Handbook on water rights and how acequias govern themselves. It was modeled on New Mexico’s.', source: 'cuHandbook' },
    { stat: '1718', text: 'In Texas, San Antonio’s first acequia, the Alamo Madre, was begun soon after the town was founded in 1718. (Some sources say 1719.)', source: 'haer' },
    { text: 'In Colorado, warmer temperatures, smaller snowpack, and record drought have dried up some acequias.', source: 'natgeo' },
  ],
  matter: [
    { stat: '16%', text: 'On one northern New Mexico ditch, researchers measured about 16% of the water seeping into the ditch bed over five miles. That water does not disappear. It soaks into the ground.', source: 'nmsuSeepage' },
    { text: 'Studies found that ditch seepage refills shallow groundwater, helps streamside plants and wildlife habitat, and improves water quality.', source: 'nmsuWtf' },
    { text: 'When water runs in the ditches, nitrate in nearby groundwater is lower close to the ditch. The seepage seems to dilute it.', source: 'nmsuSeepage' },
  ],
  today: [
    { stat: '~640', text: 'In 2021, about 640 New Mexico acequias still delivered water to farmland.', source: 'ap2021' },
    { stat: '$5.3M', text: 'From 2017 to 2021, the Interstate Stream Commission put more than $5.3 million in state money into acequia projects.', source: 'isc2021' },
    { text: 'About 73% of the acequia systems on the state map have no name, because stewards have not reported them to the state.', source: 'sourceNmMapping' },
  ],
  disaster: [
    { stat: '24', text: 'In late 2022, at least 24 acequias were still damaged by flooding after the Black Fire. The state may have underestimated the cost to fix them.', source: 'sourceNmBlackFire' },
    { text: 'Acequias are run by volunteers. After the Black Fire, stewards in southern New Mexico met with state officials because they did not know how to get disaster aid.', source: 'sourceNmMuddy' },
    { stat: '~90', text: 'After the 2022 Hermits Peak–Calf Canyon fire, debris from streams blocked about 90 acequias.', source: 'sourceNmRecovering' },
    { stat: '12.5%', text: 'Disaster aid pays acequias back after the work is done. In a state disaster the local group pays 25% of the cost; in a federal one, FEMA pays 75%, the state 12.5% and the local group 12.5%.', source: 'nmaaGuide' },
    { stat: '$5M', text: 'A state fund run by the Interstate Stream Commission can help acequias pay the share other programs require. SB 193 raised it from $2.5 million to $5 million a year, starting July 1, 2026.', source: 'sb193' },
    { text: 'An accurate map of acequias matters most after a disaster, so state and federal money can reach them.', source: 'sourceNmMapping' },
    { stat: '$73M', text: 'In 2026, the New Mexico Acequia Association told lawmakers that acequias have $73 million in unmet needs.', source: 'sourceNmFunding' },
  ],
}

/** How many acequias are there? Different counts, years, and methods. */
export const COUNTS: { label: string; value: number; approx?: boolean; plus?: boolean; source: SourceKey; note: string }[] = [
  { label: 'NMAA list, 2015', value: 583, source: 'nmaa2015', note: 'statewide list in 20 counties' },
  { label: 'NMAA report, 2016', value: 700, approx: true, source: 'nmaa2016', note: 'estimate' },
  { label: 'NMAA newsletter, 2017', value: 611, source: 'nmaa2017', note: 'acequias with active commissions' },
  { label: 'NMAA, 2018', value: 640, source: 'nmaa2018', note: 'database with contact info, 22 counties' },
  { label: 'NMAA, 2019', value: 659, source: 'nmaa2019', note: '23 counties' },
  { label: 'AP, 2021', value: 640, approx: true, source: 'ap2021', note: 'still delivering water' },
  { label: 'State Engineer, 2023', value: 2000, approx: true, source: 'sourceNmMapping', note: 'estimate; “no definitive, proven number”' },
  { label: 'Source NM, 2024', value: 700, plus: true, source: 'sourceNm2024', note: '“more than 700”' },
]

export const TIMELINE: { year: string; text: string; source: SourceKey }[] = [
  { year: '1598', text: 'A New Mexico memorial dates the Acequia de Chamita to this year.', source: 'hm14' },
  { year: '1718', text: 'San Antonio’s Alamo Madre acequia is begun.', source: 'haer' },
  { year: '1852', text: 'Colorado’s oldest water right: the San Luis People’s Ditch.', source: 'cwt' },
  { year: '2021', text: 'About 640 New Mexico acequias still deliver water.', source: 'ap2021' },
  { year: '2022', text: 'The Black Fire and Hermits Peak–Calf Canyon fire. Floods off the burn scars fill ditches with debris.', source: 'sourceNmRecovering' },
  { year: '2023', text: 'A push to map every acequia, so disaster money can find them.', source: 'sourceNmMapping' },
  { year: '2026', text: 'Acequias tell lawmakers they have $73 million in unmet needs.', source: 'sourceNmFunding' },
]

/** Plain-words definitions, checked against the Utton Center glossary. */
export const GLOSSARY: { term: string; def: string }[] = [
  { term: 'Acequia', def: 'A community irrigation ditch, and the group of neighbors who share and run it.' },
  { term: 'Acequia madre', def: 'The “mother ditch”: the main channel that carries water from the river.' },
  { term: 'Presa', def: 'A small dam or diversion that turns river water into the ditch.' },
  { term: 'Compuerta', def: 'A headgate. Opening it lets water flow into the ditch or onto a field.' },
  { term: 'Mayordomo', def: 'The person the members choose to manage the ditch and divide the water.' },
  { term: 'Parciante', def: 'A member of the acequia who has a share of its water.' },
  { term: 'Comisión', def: 'The elected commission, often three people, that governs the acequia.' },
  { term: 'Limpia', def: 'The yearly cleaning of the ditch, usually in spring, done by the members together.' },
  { term: 'Repartimiento', def: 'The custom of sharing water fairly between acequias when there is not enough.' },
]

/** "Check your knowledge." Every answer points to the source behind it. */
export const QUIZ: { q: string; options: string[]; answer: number; why: string; source: SourceKey }[] = [
  { q: 'What is an acequia?', options: ['A type of dam built by the state', 'A community irrigation ditch run by its members', 'A well that pumps groundwater'], answer: 1, why: 'Neighbors share the water and the work, and elect who runs it.', source: 'utton' },
  { q: 'About how many New Mexico acequias still delivered water to farms in 2021?', options: ['About 60', 'About 640', 'About 6,400'], answer: 1, why: 'The AP reported about 640 in 2021. Other counts range from about 580 to 2,000.', source: 'ap2021' },
  { q: 'What happens to water that seeps out of an earthen ditch?', options: ['It is lost for good', 'It soaks in and can refill shallow groundwater', 'It evaporates within a day'], answer: 1, why: 'Studies found ditch seepage recharges shallow aquifers and supports streamside plants.', source: 'nmsuWtf' },
  { q: 'After a disaster, how does federal aid usually pay an acequia?', options: ['Up front, before any work', 'Back, after the work is done', 'It does not pay acequias'], answer: 1, why: 'It pays back after the work is done. The local share is 25% in a state disaster and 12.5% in a federal one.', source: 'nmaaGuide' },
  { q: 'Why does an accurate map of acequias matter after a fire or flood?', options: ['So state and federal money can reach them', 'So the ditches can be sold', 'It does not matter'], answer: 0, why: 'Officials said a good map helps disaster funding get distributed.', source: 'sourceNmMapping' },
]
