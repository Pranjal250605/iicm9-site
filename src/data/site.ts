export const site = {
  name: 'Inter IIT Cultural Meet 9.0',
  short: 'IICM 9.0',
  host: 'IIT Mandi',
  location: 'Kamand, Himachal Pradesh',
  dates: '25–29 December 2026',
  datesShort: '25–29 DEC 2026',
  startsAt: '2026-12-25T09:00:00+05:30',
  email: 'iicm9.0@iitmandi.ac.in',
  // Rulebook isn't published yet. Set a URL here and every "Rulebook" link goes live.
  rulebookUrl: '' as string,
  socials: [
    { label: 'Instagram', href: 'https://www.instagram.com/interiit_culturals/' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/company/inter-iit-culturals/' },
  ],
  mapEmbed: 'https://www.google.com/maps?q=IIT+Mandi+South+Campus+Kamand&output=embed',
  mapLink: 'https://maps.google.com/?q=IIT+Mandi+Kamand',
}

export const stats = [
  { value: 23, suffix: '', label: 'IITs' },
  { value: 49, suffix: '', label: 'Events across 13 cups' },
  { value: 5, suffix: 'K+', label: 'Expected footfall' },
  { value: 5, suffix: '', label: 'Days, 25–29 December' },
]

export const reach = [
  { value: '140K+', label: 'Social media reach' },
  { value: '25L+', label: 'Overall reach' },
]

export const fee = {
  amount: '₹4000',
  note: '+ GST per participant',
  includes: ['Event participation', 'Accommodation on campus', 'Transport', 'Mess', 'Official merchandise', 'Amenity kit'],
}

export const about = {
  lead: 'For the first time in our history, IIT Mandi is proud to host this celebrated gathering of art, expression, and talent.',
  body: [
    'IICM brings together the most creative minds from across the IITs to compete, collaborate, and showcase their craft in music, dance, drama, literature, fine arts, digital arts, and more. For us, hosting it is both an honour and a responsibility. It is a chance to welcome the IIT community into our home and share a campus, a culture, and a spirit that is uniquely ours.',
    'Nestled in the Himalayan foothills of Himachal Pradesh, IIT Mandi is a young institute built on curiosity, innovation, and a deep connection with its surroundings. Though this is our first time hosting, our students have long carried that same spirit to cultural stages across the country. Now we have the opportunity to create one of our own.',
    'Every detail of IICM 9.0 has been shaped by the passion of students who want to make this meet memorable for every participant, performer, and spectator. We hope to set a new benchmark for warmth, creativity, and hospitality, and to begin a tradition that future editions can build on.',
  ],
}

export const convener = [
  'On behalf of the Indian Institute of Technology Mandi, it is my privilege to welcome you to the Inter-IIT Cultural Meet 2026.',
  'Every edition of IICM brings together ideas, energies, and stories from across the IITs, and this year is no exception. More than a competition, it is a celebration of the creativity, camaraderie, and curiosity that define our community.',
  'Set against the quiet grandeur of the Himalayan foothills, we have worked to build a space where talent can flourish and passion can speak in its own voice. Whether you perform, create, compete, or simply cheer from the audience, we hope you find something here that moves you.',
  "May IICM '26 inspire you, challenge you, and leave you with memories as lasting as the mountains that surround us.",
  'Welcome to IIT Mandi. Let the celebration begin.',
]

export const contacts = [
  { name: 'Pranjal Rai', phone: '+91 98210 44361' },
  { name: 'Ayan Garg', phone: '+91 77568 37945' },
  { name: 'Hardik Malik', phone: '+91 98702 10462' },
]

export const nav = [
  { to: '/about', label: 'About' },
  { to: '/events', label: 'Events' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/rulebook', label: 'Rulebook' },
  { to: '/venues', label: 'Venues' },
  { to: '/team', label: 'Team' },
  { to: '/partners', label: 'Partners' },
  { to: '/contact', label: 'Contact' },
]
