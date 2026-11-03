// 9.0 partners. Fill `name` + `logo` (public/images/partners/…) when confirmed; empty name = "announcing soon" slot.
export type PartnerSlot = { tier: string; name?: string; logo?: string; href?: string }

export const partnerSlots: PartnerSlot[] = [
  { tier: 'Title Partner' },
  { tier: 'Associate Partner' },
  { tier: 'Powered By' },
  { tier: 'Beverage Partner' },
  { tier: 'Media Partner' },
  { tier: 'Merchandise Partner' },
]

export const previousSponsors = [
  'RSPL', 'Namaste India', 'Red Chief', 'Ghadi', 'Pro-ease', 'Wonderchef', 'Hindustan Times', 'GeeksforGeeks',
  'Fabindia', 'Tanishq', 'India College Fest', 'Beardo', 'Canara Bank', 'Pepsi', 'State Bank of India', 'Samsung',
  'Unibic', 'The Souled Store', '9XM', 'ACE', 'Toppr', 'ICICI Bank',
]
