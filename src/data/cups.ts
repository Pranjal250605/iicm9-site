export type Cup = {
  slug: string
  name: string
  short: string
  category: 'Performing' | 'Literary' | 'Visual' | 'Lifestyle'
  events: string[]
  hue: string
}

// Order matches the cabins on the 3D street (Cup_01 … Cup_13).
export const cups: Cup[] = [
  { slug: 'music', name: 'Music Cup', short: 'Music', category: 'Performing', events: ['Band Competition', 'Pair on Stage', 'Solo Singing', 'Classical Vocal Solo'], hue: '#ff8a5c' },
  { slug: 'dance', name: 'Dance Cup', short: 'Dance', category: 'Performing', events: ['Group Dance', 'Street Battle', 'Just-Duet'], hue: '#ff6f91' },
  { slug: 'theatre', name: 'Theatre Arts Cup', short: 'Theatre', category: 'Performing', events: ['Stage Play', 'Street Play', 'Mono-Acting', 'Mime'], hue: '#e2604a' },
  { slug: 'quiz', name: 'Quiz Cup', short: 'Quiz', category: 'Literary', events: ['General Quiz', 'Sports Quiz', 'Sci-Biz-Tech Quiz', 'MELA Quiz', 'India Quiz', 'TLC Quiz'], hue: '#8fb8ff' },
  { slug: 'literary', name: 'Literary Arts Cup', short: 'Literary', category: 'Literary', events: ['Hindi Creative Writing', 'English Creative Writing', 'Hindi Poetry Writing', 'English Poetry Writing', 'Scrabble', 'Cryptic Crossword'], hue: '#bfd9f2' },
  { slug: 'speaking', name: 'Speaking Arts Cup', short: 'Speaking', category: 'Literary', events: ['Hindi Slam Poetry', 'English Slam Poetry', 'Asian Parliamentary Debate', 'Just-A-Minute', 'Mushaira'], hue: '#a4c8ff' },
  { slug: 'comedy', name: 'Comedy Cup', short: 'Comedy', category: 'Performing', events: ['Stand-Up Comedy', 'Improv Comedy'], hue: '#ffc46b' },
  { slug: 'fine-arts', name: 'Fine Arts Cup', short: 'Fine Arts', category: 'Visual', events: ['Live Sketching', 'Canvas Painting', 'Charcoal Art', 'Costume Design'], hue: '#ffb35c' },
  { slug: 'digital-arts', name: 'Digital Arts Cup', short: 'Digital', category: 'Visual', events: ['Photoshop Battle', 'Graphics Design', '3D Sculpting Battle', 'Design Marathon', '3D Animation Competition'], hue: '#7ee0ff' },
  { slug: 'photography', name: 'Photography Cup', short: 'Photography', category: 'Visual', events: ['Online Photostory', 'Online Theme Photography', 'Street Photography'], hue: '#d7e6ff' },
  { slug: 'film', name: 'Film Making Arts Cup', short: 'Film', category: 'Visual', events: ['Online Short Filmmaking', '51 Hour Filmmaking'], hue: '#9fa8ff' },
  { slug: 'fashion', name: 'Fashion Cup', short: 'Fashion', category: 'Lifestyle', events: ['Fashion Show', 'Online Modelling'], hue: '#ff9fc4' },
  { slug: 'culinary', name: 'Culinary Arts Cup', short: 'Culinary', category: 'Lifestyle', events: ['Cook Off', 'Tag Team', 'Mixology'], hue: '#ffa36b' },
]

export const cupCategories = ['All', 'Performing', 'Literary', 'Visual', 'Lifestyle'] as const
export const totalEvents = cups.reduce((n, c) => n + c.events.length, 0)
