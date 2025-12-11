export interface BrandPattern {
  name: string;
  officialDomains: string[];
}

export const BRAND_PATTERNS: BrandPattern[] = [
  // Payments & finance (global)
  { name: 'paypal', officialDomains: ['paypal.com'] },
  { name: 'visa', officialDomains: [] },
  { name: 'mastercard', officialDomains: [] },
  { name: 'stripe', officialDomains: ['stripe.com'] },
  { name: 'revolut', officialDomains: ['revolut.com'] },
  { name: 'wise', officialDomains: ['wise.com', 'transferwise.com'] },
  { name: 'bank', officialDomains: [] },

  // Big tech & platforms
  { name: 'google', officialDomains: ['google.com', 'accounts.google.com'] },
  { name: 'apple', officialDomains: ['apple.com', 'icloud.com'] },
  { name: 'microsoft', officialDomains: ['microsoft.com', 'live.com', 'office.com'] },
  { name: 'windows', officialDomains: [] },
  { name: 'amazon', officialDomains: ['amazon.com'] },
  { name: 'netflix', officialDomains: ['netflix.com'] },
  { name: 'facebook', officialDomains: ['facebook.com'] },
  { name: 'instagram', officialDomains: ['instagram.com'] },
  { name: 'whatsapp', officialDomains: ['whatsapp.com'] },
  { name: 'tiktok', officialDomains: ['tiktok.com'] },
  { name: 'twitter', officialDomains: ['twitter.com', 'x.com'] },

  // Global shopping & brands
  { name: 'adidas', officialDomains: ['adidas.com'] },
  { name: 'nike', officialDomains: ['nike.com'] },
  { name: 'ebay', officialDomains: ['ebay.com'] },

  // Sri Lankan banks
  { name: 'boc', officialDomains: ['boc.lk', 'online.boc.lk'] },
  { name: 'peoples bank', officialDomains: ['peoplesbank.lk'] },
  { name: 'commercial bank', officialDomains: ['combank.net'] },
  { name: 'hnb', officialDomains: ['hnb.net'] },
  { name: 'sampath', officialDomains: ['sampath.lk'] },
  { name: 'seylan', officialDomains: ['seylan.lk'] },
  { name: 'ndb', officialDomains: ['ndbbank.com'] },
  { name: 'dfcc', officialDomains: ['dfcc.lk'] },
  { name: 'nation trust', officialDomains: ['nationstrust.com'] },
  { name: 'cargills bank', officialDomains: ['cargillsbank.com'] },

  // Sri Lankan telcos
  { name: 'dialog', officialDomains: ['dialog.lk'] },
  { name: 'mobitel', officialDomains: ['mobitel.lk', 'slt.lk'] },
  { name: 'hutch', officialDomains: ['hutch.lk'] },
  { name: 'airtel', officialDomains: ['airtel.lk'] },

  // Sri Lankan e-commerce / services
  { name: 'kapruka', officialDomains: ['kapruka.com'] },
  { name: 'daraz', officialDomains: ['daraz.lk'] },
  { name: 'ikman', officialDomains: ['ikman.lk'] },

  // Sri Lankan gov portals
  { name: 'gov', officialDomains: ['gov.lk'] },
  { name: 'immigration', officialDomains: ['immigration.gov.lk'] },
  { name: 'iraj', officialDomains: [] },
];
