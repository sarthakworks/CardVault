import { z } from 'zod';
import { cardDetailFields, cardDetailLabels, type CardDetailField } from '../../core/validation/cardRules';

export interface CardBinDetails {
  bin: string;
  bank?: string;
  network?: string;
  tier?: string;
  type?: string;
  country?: string;
  missingFields: CardDetailField[];
  warnings: string[];
}

const responseSchema = z.object({
  Status: z.string().max(64),
  Issuer: z.unknown().optional(),
  Scheme: z.unknown().optional(),
  CardTier: z.unknown().optional(),
  Type: z.unknown().optional(),
  Country: z.unknown().optional(),
});

const countrySchema = z.object({ Name: z.unknown().optional() });

function apiKey(): string {
  return process.env.EXPO_PUBLIC_HANDY_API_KEY?.trim() ?? '';
}

export function isCardBinLookupConfigured(): boolean {
  return Boolean(apiKey());
}

export function cardBinPrefix(number: string): string {
  return number.replace(/\D/g, '').slice(0, 8);
}

export function parseCardBinDetails(bin: string, value: unknown): CardBinDetails {
  const parsed = responseSchema.safeParse(value);
  if (!parsed.success) throw new Error('HandyAPI returned unexpected data. Enter the card details manually.');
  if (parsed.data.Status.trim().toUpperCase() !== 'SUCCESS') {
    throw new Error('HandyAPI could not identify this BIN. Check the API configuration or enter details manually.');
  }
  const warnings: string[] = [];
  function text(input: unknown, field: CardDetailField): string | undefined {
    if (input === undefined || input === null || input === '') return undefined;
    if (typeof input !== 'string') {
      warnings.push(`${cardDetailLabels[field]} was not readable. You can edit it manually.`);
      return undefined;
    }
    return input.trim() ? input : undefined;
  }
  const country = countrySchema.safeParse(parsed.data.Country);
  if (!country.success && parsed.data.Country != null) warnings.push('Country was not readable. You can edit it manually.');
  const details: CardBinDetails = {
    bin,
    bank: text(parsed.data.Issuer, 'bank'),
    network: text(parsed.data.Scheme, 'network'),
    tier: text(parsed.data.CardTier, 'tier'),
    type: text(parsed.data.Type, 'type'),
    country: text(country.success ? country.data.Name : undefined, 'country'),
    missingFields: [],
    warnings,
  };
  details.missingFields = cardDetailFields.filter((field) => details[field] === undefined);
  return details;
}

export async function lookupCardBin(bin: string, signal: AbortSignal): Promise<CardBinDetails> {
  if (!/^\d{8}$/.test(bin)) throw new Error('Card lookup requires exactly eight BIN digits.');
  if (signal.aborted) throw new Error('Card lookup was cancelled.');
  const key = apiKey();
  if (!key) throw new Error('Card auto-fill is not configured in this build. Enter details manually.');
  let response: Response;
  try {
    response = await fetch(`https://data.handyapi.com/bin/${bin}`, {
      headers: { Accept: 'application/json', 'x-api-key': key },
      credentials: 'omit',
      redirect: 'error',
      signal,
    });
  } catch (cause) {
    if (signal.aborted) throw cause;
    throw new Error('Cannot reach HandyAPI. Check your connection or enter details manually.');
  }
  if (response.status === 401 || response.status === 403) throw new Error('HandyAPI rejected the key. Check your Publishable (Frontend) API key.');
  if (response.status === 429) throw new Error('The HandyAPI lookup limit was reached. Enter details manually or retry later.');
  if (response.status === 404) throw new Error('No matching BIN was found. Enter the card details manually.');
  if (!response.ok) throw new Error('HandyAPI is unavailable. Enter details manually or retry later.');
  let value: unknown;
  try {
    const text = await response.text();
    if (text.length > 32_768) throw new Error('Response is too large.');
    value = JSON.parse(text);
  } catch (cause) {
    if (signal.aborted) throw cause;
    throw new Error('HandyAPI returned unreadable data. Enter details manually or retry.');
  }
  return parseCardBinDetails(bin, value);
}
