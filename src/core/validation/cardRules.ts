export const networks = ['Visa', 'Mastercard', 'RuPay', 'Amex', 'Diners', 'Discover', 'UnionPay', 'JCB', 'Maestro', 'Other'] as const;
export type CardNetwork = string;
export const cardDetailFields = ['bank', 'network', 'tier', 'type', 'country'] as const;
export type CardDetailField = typeof cardDetailFields[number];
export const cardDetailLabels: Record<CardDetailField, string> = { bank: 'Bank name', network: 'Network', tier: 'Network tier', type: 'Card type', country: 'Country' };

const networkAliases = new Map([
  ['americanexpress', 'amex'], ['dinersclub', 'diners'], ['dinersclubinternational', 'diners'], ['chinaunionpay', 'unionpay'],
]);

export function cardNetworkIdentity(value: string): string {
  const key = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  return networkAliases.get(key) ?? (key || value.trim().toLowerCase());
}

const networkLabels = new Map(networks.map((network) => [cardNetworkIdentity(network), network]));
export function cardNetworkLabel(value: string): string {
  return networkLabels.get(cardNetworkIdentity(value)) ?? value;
}

// Raw/storage bounds allow legacy values and grouped pastes; entry limits apply after normalization.
export const cardFieldLimits = {
  number: 128,
  expiry: 32,
  cvv: 32,
  bank: 256,
  network: 80,
  type: 80,
  tier: 160,
  country: 128,
} as const;

export const cardEntryLimits = {
  minimumNumberDigits: 13,
  maximumNumberDigits: 19,
  minimumCvvDigits: 3,
  maximumCvvDigits: 4,
  maximumExpiryDigits: 6,
} as const;

export function numericCardInput(value: string, maximumDigits: number): string {
  return value.replace(/\D/g, '').slice(0, maximumDigits);
}

export function cardExpiryInput(value: string): string {
  const digits = numericCardInput(value, cardEntryLimits.maximumExpiryDigits);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

export function cardExpiryError(value: string, now = new Date()): string | null {
  const match = /^(0[1-9]|1[0-2])\/?(\d{2}|\d{4})$/.exec(value);
  const month = match?.[1];
  const year = match?.[2];
  if (!month || !year) return 'Enter a valid expiry date as MM/YY or MM/YYYY.';
  const fullYear = year.length === 2 ? 2000 + Number(year) : Number(year);
  if (fullYear < now.getFullYear() || (fullYear === now.getFullYear() && Number(month) < now.getMonth() + 1)) {
    return 'This card has expired. Use the current month or a later date.';
  }
  return null;
}
