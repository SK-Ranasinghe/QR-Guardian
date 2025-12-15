import Constants from 'expo-constants';

export interface Ip2LocationDomainInfo {
  domain: string;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string;
  registrar?: string;
  countryCode?: string;
  countryName?: string;
  nameservers?: string[];
  raw?: any;
  ageDays?: number;
  isVeryNew?: boolean; // true when ageDays != null and <= 7
}

const IP2L_API_KEY = Constants.expoConfig?.extra?.ip2LocationApiKey as string | undefined;

const VERY_NEW_THRESHOLD_DAYS = 7;

const parseDate = (value?: string | null): Date | undefined => {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
};

export const fetchDomainIntel = async (urlOrDomain: string): Promise<Ip2LocationDomainInfo | null> => {
  console.log('[IP2LOCATION] Starting domain intelligence for:', urlOrDomain);

  if (!IP2L_API_KEY) {
    console.log('[IP2LOCATION] API key is not configured in app.config.js');
    return null;
  }

  // Extract bare domain from URL or raw text
  let domain = urlOrDomain.trim().toLowerCase();
  try {
    if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
      domain = 'http://' + domain;
    }
    const obj = new URL(domain);
    domain = obj.hostname;
  } catch {
    const match = domain.match(/(?:https?:\/\/)?([^\/:?#]+)/);
    if (match?.[1]) domain = match[1];
  }

  // Strip www.
  if (domain.startsWith('www.')) domain = domain.slice(4);

  try {
    const endpoint = `https://api.ip2whois.com/v2?key=${encodeURIComponent(IP2L_API_KEY)}&domain=${encodeURIComponent(
      domain,
    )}`;

    const response = await fetch(endpoint);

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.log('[IP2LOCATION] HTTP error', response.status, 'body:', body);
      return null;
    }

    const data: any = await response.json();

    const created = parseDate(data.creation_date || data.domain_created || data.create_date);
    const updated = parseDate(data.updated_date || data.domain_updated || data.update_date);
    const expires = parseDate(data.expiration_date || data.expire_date || data.domain_expire);

    let ageDays: number | undefined;
    let isVeryNew: boolean | undefined;
    if (created) {
      const diffMs = Date.now() - created.getTime();
      ageDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      isVeryNew = ageDays <= VERY_NEW_THRESHOLD_DAYS;
    }

    const registrarValue =
      typeof data.registrar === 'string'
        ? data.registrar
        : data.registrar?.name || data.domain_registrar;

    const info: Ip2LocationDomainInfo = {
      domain,
      createdAt: created?.toISOString(),
      updatedAt: updated?.toISOString(),
      expiresAt: expires?.toISOString(),
      registrar: registrarValue,
      countryCode: data.country_code || data.domain_country_code,
      countryName: data.country_name || data.domain_country,
      nameservers: Array.isArray(data.nameservers)
        ? data.nameservers
        : typeof data.nameservers === 'string'
        ? data.nameservers.split(/[,\s]+/).filter(Boolean)
        : undefined,
      ageDays,
      isVeryNew,
      raw: data,
    };

    console.log('[IP2LOCATION] Parsed domain info:', info);
    return info;
  } catch (error) {
    console.log('[IP2LOCATION] Unexpected error while fetching domain intel:', error);
    return null;
  }
}
