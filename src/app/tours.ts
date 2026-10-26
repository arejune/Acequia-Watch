// What the guided tour points at, per role. Targets are data-tour attributes on
// the screen, or tab links (bottom bar on phones, side rail on desktop).
import type { TourStep } from '../components/Tour'

const tab = (href: string) => [`.tabbar a[href="${href}"]`, `.rail a[href="${href}"]`]

export const TOURS: Record<string, { home: string; requires: string; steps: TourStep[] }> = {
  steward: {
    home: '/steward',
    requires: '[data-tour="camera"]',
    steps: [
      { title: 'A quick look around', body: 'This takes about thirty seconds. Each note points at one part of the app. Tap Next to move on, or skip if you’ve been here before.' },
      { target: ['[data-tour="progress"]'], title: 'How far along you are', body: 'The ring counts structures on your ditch that have a report for this fire. The ones nobody has checked yet are called gaps.' },
      { target: ['[data-tour="camera"]'], title: 'Report damage', body: 'Opens the camera. Take a photo, pick which structure it is, tap how bad. It saves on the phone even with no signal.' },
      { target: ['[data-tour="sync"]'], title: 'Sent, or waiting', body: 'This says whether your reports have reached the server. They send by themselves when the app is open and you have signal.' },
      { target: tab('/steward/assess'), title: 'The list of gaps', body: 'Every structure nobody has looked at, starting with the ones closest to known damage.' },
      { target: tab('/map'), title: 'Map', body: 'Your ditches and structures in color, with a dot for where you’re standing. It still draws with no signal.' },
      { target: ['[data-tour="share"]'], title: 'Sharing is off until you say so', body: 'Agency staff see nothing from your acequia until your commission flips this switch. You can turn it back off.' },
      { target: tab('/more'), title: 'Everything else', body: 'Your inventory, the sync center, the severity scale, and this tour again if you want it.' },
    ],
  },
  agency: {
    home: '/agency',
    requires: '[data-tour="totals"]',
    steps: [
      { title: 'A quick look around', body: 'You only see what acequias chose to share, and you can’t change any of it. Here’s where things are.' },
      { target: ['[data-tour="event"]'], title: 'Pick the event', body: 'Each fire or flood is separate. Totals and maps below follow this choice.' },
      { target: ['[data-tour="totals"]'], title: 'Estimated repair cost', body: 'Added up from every shared report, as low, likely and high. The ring shows how many structures were checked.' },
      { target: ['[data-tour="threshold"]'], title: 'Compare to a threshold', body: 'Type the number that applies to this disaster to see how close the total is. It’s your number, not a rule built into the app.' },
      { target: tab('/agency/reports'), title: 'Every report', body: 'Filter by acequia, outcome and severity. Tap one to see its photos, with a before and after slider when there’s an old photo.' },
      { target: tab('/map'), title: 'Map', body: 'Shared reports on a map, plus the structures nobody has checked.' },
    ],
  },
  admin: {
    home: '/admin',
    requires: '.tabs-line',
    steps: [
      { title: 'The admin desk', body: 'You set things up so stewards and agency staff can work. Four tabs, each one job.' },
      { target: ['.tabs-line button:nth-child(1)'], title: 'Requests', body: 'People who made an account and are waiting. Check with their commission, link them to their acequia, and approve.' },
      { target: ['.tabs-line button:nth-child(2)'], title: 'Events', body: 'Start a new fire or flood here. Stewards report against the event you create.' },
      { target: ['.tabs-line button:nth-child(3)'], title: 'Acequias', body: 'The acequias in the app and their regions. The public summary hides any region with fewer than three reports.' },
      { target: ['.tabs-line button:nth-child(4)'], title: 'Stewards', body: 'Who belongs to which acequia. Changes here take effect the next time they sync.' },
      { target: tab('/agency'), title: 'You also see the agency view', body: 'Overview, Map and Reports show what acequias have shared.' },
    ],
  },
  guest: {
    home: '/explore',
    requires: '[data-tour="lead"]',
    steps: [
      { title: 'Here’s what’s in the app', body: 'You don’t need an account for any of this. A few notes, then it’s yours.' },
      { target: ['[data-tour="lead"]'], title: 'Start here if acequias are new to you', body: 'A short explainer with a diagram, history, and where every fact came from.' },
      { target: ['[data-tour="news"]'], title: 'What lawmakers did', body: 'The 2026 acequia bills, which passed and which died, with how far each one got.' },
      { target: ['[data-tour="issues"]'], title: 'What acequias are up against', body: 'Six problems, from burn-scar mud to water rights being sold off. Each says what would help.' },
      { target: tab('/act'), title: 'Do something', body: 'Write your legislator (we draft it, you send it), and find youth programs, paid crews and events.' },
      { target: tab('/play'), title: 'Play Turno', body: 'An arcade game: run the gates on a ditch and keep four fields alive through storms and dry spells.' },
      { target: ['[data-tour="signin"]'], title: 'On an acequia?', body: 'Sign in or make an account here. Stewards log damage; agency staff review what’s shared.' },
    ],
  },
}
