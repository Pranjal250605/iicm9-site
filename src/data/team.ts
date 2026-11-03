// Core team. Replace placeholders with real entries:
//   { name: 'Full Name', role: 'Head', photo: '/images/team/full-name.webp', phone?: '+91 …', linkedin?: 'https://…' }
// Photos: square, ≥600px, drop them in public/images/team/.

export type Member = { name: string; role: string; photo?: string; phone?: string; linkedin?: string; email?: string }
export type Committee = { slug: string; name: string; members: Member[] }

const placeholders = (roles: string[]): Member[] => roles.map((role) => ({ name: 'Name TBA', role }))

export const committees: Committee[] = [
  { slug: 'faculty', name: 'Faculty Advisors', members: placeholders(['Chairman, Cultural Board', 'Convener', 'Faculty Advisor']) },
  { slug: 'oc', name: 'Overall Coordinators', members: placeholders(['Overall Coordinator', 'Overall Coordinator', 'Overall Coordinator']) },
  { slug: 'hospitality', name: 'Hospitality', members: placeholders(['Head', 'Head', 'Coordinator', 'Coordinator']) },
  { slug: 'events', name: 'Events', members: placeholders(['Head', 'Head', 'Coordinator', 'Coordinator']) },
  { slug: 'finance', name: 'Finance', members: placeholders(['Head', 'Coordinator']) },
  { slug: 'show', name: 'Show Management', members: placeholders(['Head', 'Head', 'Coordinator']) },
  { slug: 'marketing', name: 'Marketing', members: placeholders(['Head', 'Head', 'Coordinator']) },
  { slug: 'pr', name: 'Public Relations', members: placeholders(['Head', 'Coordinator', 'Coordinator']) },
  { slug: 'media', name: 'Media & Publicity', members: placeholders(['Head', 'Head', 'Coordinator']) },
  { slug: 'security', name: 'Security', members: placeholders(['Head', 'Coordinator']) },
  { slug: 'design', name: 'Design', members: placeholders(['Head', 'Head', 'Coordinator']) },
  { slug: 'web', name: 'Web & App', members: placeholders(['Head', 'Coordinator']) },
]
