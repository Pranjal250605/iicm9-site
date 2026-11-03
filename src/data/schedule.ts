// Day-wise schedule. Times are placeholders until the events team locks the plan.
// To publish a slot: fill in time/venue and the UI picks it up. Keep `tag` in scheduleTags.

export type Slot = { title: string; time: string; venue: string; tag: ScheduleTag }
export type Day = { label: string; date: string; weekday: string; theme: string; slots: Slot[] }

export const scheduleTags = ['Main Event', 'Competition', 'Pro Night', 'Practice', 'Hospitality'] as const
export type ScheduleTag = (typeof scheduleTags)[number]

const tba = 'TBA'

export const schedule: Day[] = [
  {
    label: 'Day 0', date: '25 Dec', weekday: 'Friday', theme: 'Arrivals & Opening',
    slots: [
      { title: 'Contingent Arrivals & Registration', time: tba, venue: tba, tag: 'Hospitality' },
      { title: 'Opening Ceremony', time: tba, venue: tba, tag: 'Main Event' },
      { title: 'Band Soundcheck', time: tba, venue: tba, tag: 'Practice' },
      { title: 'Bonfire Night', time: tba, venue: tba, tag: 'Pro Night' },
    ],
  },
  {
    label: 'Day 1', date: '26 Dec', weekday: 'Saturday', theme: 'Curtains Up',
    slots: [
      { title: 'Competitions: Wave 1', time: tba, venue: tba, tag: 'Competition' },
      { title: 'Quiz Prelims', time: tba, venue: tba, tag: 'Competition' },
      { title: 'Group Dance Practice', time: tba, venue: tba, tag: 'Practice' },
      { title: 'Jam Night', time: tba, venue: tba, tag: 'Pro Night' },
    ],
  },
  {
    label: 'Day 2', date: '27 Dec', weekday: 'Sunday', theme: 'Full Swing',
    slots: [
      { title: 'Competitions: Wave 2', time: tba, venue: tba, tag: 'Competition' },
      { title: 'Street Play', time: tba, venue: tba, tag: 'Competition' },
      { title: 'Food Stalls', time: tba, venue: tba, tag: 'Hospitality' },
      { title: 'Sufi Night', time: tba, venue: tba, tag: 'Pro Night' },
    ],
  },
  {
    label: 'Day 3', date: '28 Dec', weekday: 'Monday', theme: 'Finals',
    slots: [
      { title: 'Competitions: Finals', time: tba, venue: tba, tag: 'Competition' },
      { title: 'Band Competition', time: tba, venue: tba, tag: 'Competition' },
      { title: 'DJ Night', time: tba, venue: tba, tag: 'Pro Night' },
    ],
  },
  {
    label: 'Day 4', date: '29 Dec', weekday: 'Tuesday', theme: 'Closing & Farewell',
    slots: [
      { title: 'Closing Ceremony & Prize Distribution', time: tba, venue: tba, tag: 'Main Event' },
      { title: 'Contingent Departures', time: tba, venue: tba, tag: 'Hospitality' },
    ],
  },
]
