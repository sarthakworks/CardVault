import { z } from 'zod';
import type { CameraTextRegion, ReadCardDetails } from '../../../modules/card-reader';
import { cardInputSchema } from '../../core/vault/schemas';
import { VaultError } from '../../core/errors/VaultError';

export type CardReadMethod = 'camera' | 'nfc';
export const cardReadReviewSchema = cardInputSchema.pick({ number: true, expiry: true, holder: true });
export type CardReadReview = z.infer<typeof cardReadReviewSchema>;

const linesSchema = z.array(z.string().max(160)).max(80);
const coordinate = z.number().finite().min(-65_536).max(65_536);
const regionsSchema = z.array(z.object({
  text: z.string().max(160),
  line: z.number().int().min(0).max(79).optional(),
  left: coordinate, top: coordinate, right: coordinate, bottom: coordinate,
})).max(160);
const nfcResultSchema = z.strictObject({
  number: z.string().regex(/^\d{13,19}$/),
  expiry: z.string().max(7).optional(),
  holder: z.string().max(80).optional(),
});

export function parseNfcCard(value: unknown): ReadCardDetails {
  const parsed = nfcResultSchema.safeParse(value);
  if (!parsed.success) throw new VaultError('format', 'This card returned unsupported details. Use camera or manual entry.');
  return parsed.data;
}

function passesLuhn(number: string): boolean {
  let total = 0;
  for (let index = number.length - 1, double = false; index >= 0; index--, double = !double) {
    let digit = Number(number[index]);
    if (double) { digit *= 2; if (digit > 9) digit -= 9; }
    total += digit;
  }
  return total % 10 === 0;
}

function ocrDigits(text: string): string | null {
  const compact = text.replace(/[ -]/g, '');
  if (!/^[\dOQIlL|BS]+$/.test(compact) || (compact.match(/[OQIlL|BS]/g)?.length ?? 0) > 2) return null;
  return compact.replace(/[OQ]/g, '0').replace(/[IlL|]/g, '1').replace(/B/g, '8').replace(/S/g, '5');
}

function ocrExpiry(month: string, year: string): string | null {
  const digits = ocrDigits(`${month}${year}`);
  if (!digits) return null;
  const normalizedMonth = digits.slice(0, month.length).padStart(2, '0');
  const normalizedYear = digits.slice(month.length);
  if (!/^(0[1-9]|1[0-2])$/.test(normalizedMonth) || !/^(?:\d{2}|20\d{2})$/.test(normalizedYear)) return null;
  return `${normalizedMonth}/${normalizedYear.slice(-2)}`;
}

function normalizeOcr(text: string): string {
  return text.normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\s+/g, ' ').trim();
}

function regionGroups(regions: readonly CameraTextRegion[], vertical = false): CameraTextRegion[][] {
  const start = (region: CameraTextRegion) => vertical ? region.left : region.top;
  const end = (region: CameraTextRegion) => vertical ? region.right : region.bottom;
  const along = (region: CameraTextRegion) => vertical ? region.top : region.left;
  const rows: CameraTextRegion[][] = [];
  for (const region of [...regions].sort((a, b) => start(a) - start(b) || along(a) - along(b))) {
    const center = (start(region) + end(region)) / 2;
    const row = rows.find((items) => {
      const first = items[0]!;
      return Math.abs(center - (start(first) + end(first)) / 2) <= Math.min(end(region) - start(region), end(first) - start(first)) * 0.65;
    });
    if (row) row.push(region);
    else rows.push([region]);
  }
  return rows.map((row) => row.sort((a, b) => along(a) - along(b)));
}

function spatialNumberRuns(regions: readonly CameraTextRegion[]): string[] {
  const labels = regions.filter((region) => /^(?:CVV2?|CVC2?|CID|CSC|SECURITYCODE|EXP|EXPIRY|EXPIRES|EXPIRATION|THRU|THROUGH|UNTIL)$/i.test(region.text.replace(/[ :.-]/g, '')));
  const securityLabels = regions.filter((region) => /^SECURITY$/i.test(region.text));
  const codeLabels = regions.filter((region) => /^CODE$/i.test(region.text));
  for (const security of securityLabels) for (const code of codeLabels) {
    const height = Math.max(security.bottom - security.top, code.bottom - code.top);
    const beside = Math.abs((security.top + security.bottom - code.top - code.bottom) / 2) < height * 0.75 &&
      code.left >= security.right && code.left - security.right < height * 2;
    const below = code.top >= security.bottom && code.top - security.bottom < height * 1.5 &&
      Math.abs((security.left + security.right - code.left - code.right) / 2) < Math.max(security.right - security.left, code.right - code.left);
    if (beside || below) labels.push({
      text: 'SECURITYCODE',
      left: Math.min(security.left, code.left), top: Math.min(security.top, code.top),
      right: Math.max(security.right, code.right), bottom: Math.max(security.bottom, code.bottom),
    });
  }
  const numeric = regions.filter((region) => {
    const digits = ocrDigits(region.text);
    if (!digits || digits.length < 3 || digits.length > 19) return false;
    if (digits.length >= 13) return true;
    if (digits.length > 6) return false;
    return !labels.some((label) => {
      const height = Math.max(region.bottom - region.top, label.bottom - label.top);
      const sameRow = Math.abs((region.top + region.bottom - label.top - label.bottom) / 2) < height * 0.75;
      const afterLabel = region.left >= label.left && region.left - label.right < height * 4;
      const belowLabel = region.top >= label.bottom && region.top - label.bottom < height * 2.5 &&
        Math.abs((region.left + region.right - label.left - label.right) / 2) < Math.max(region.right - region.left, label.right - label.left);
      return sameRow && afterLabel || belowLabel;
    });
  });
  const complete = numeric.filter((region) => (ocrDigits(region.text)?.length ?? 0) >= 13).map((region) => region.text);
  const groups = numeric.filter((region) => (ocrDigits(region.text)?.length ?? 0) <= 6);
  const connected = (a: CameraTextRegion, b: CameraTextRegion) => {
    const ah = a.bottom - a.top, bh = b.bottom - b.top;
    if (Math.min(ah, bh) / Math.max(ah, bh) < 0.65) return false;
    const horizontalGap = Math.max(a.left, b.left) - Math.min(a.right, b.right);
    const verticalGap = Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom);
    const sameRow = Math.abs((a.top + a.bottom - b.top - b.bottom) / 2) < Math.max(ah, bh) * 0.75 && horizontalGap < Math.max(ah, bh) * 3;
    const sameColumn = Math.abs((a.left + a.right - b.left - b.right) / 2) < Math.max(a.right - a.left, b.right - b.left) * 0.4 && verticalGap < Math.max(ah, bh) * 1.25;
    return sameRow || sameColumn;
  };
  const seen = new Set<number>();
  for (let index = 0; index < groups.length; index++) {
    if (seen.has(index)) continue;
    const component: CameraTextRegion[] = [];
    const pending = [index];
    seen.add(index);
    while (pending.length) {
      const next = groups[pending.pop()!]!;
      component.push(next);
      for (let other = 0; other < groups.length; other++) {
        if (!seen.has(other) && connected(next, groups[other]!)) { seen.add(other); pending.push(other); }
      }
    }
    if (component.length < 2 || component.length > 5) continue;
    const rowOrder = regionGroups(component).flat();
    complete.push(rowOrder.map((region) => region.text).join(''));
    const columnOrder = regionGroups(component, true).flat();
    complete.push(columnOrder.map((region) => region.text).join(''));
  }
  return complete;
}

export function parseCameraCard(value: unknown, regionValue?: unknown): ReadCardDetails | null {
  const parsed = linesSchema.safeParse(value);
  if (!parsed.success) throw new VaultError('format', 'The scanner returned unreadable text. Try again or enter the card manually.');
  const parsedRegions = regionsSchema.safeParse(regionValue ?? []);
  if (!parsedRegions.success) throw new VaultError('format', 'The scanner returned unreadable layout. Try again or enter the card manually.');
  const regions = parsedRegions.data.filter((region) => region.right > region.left && region.bottom > region.top &&
    (region.line === undefined || !/\b(?:CVV2?|CVC2?|CID|CSC|SECURITY\s*CODE)\b|(?:[Xx*\u2022\u25cf]\s*){2,}/i.test(parsed.data[region.line] ?? '')))
    .map((region) => ({ ...region, text: normalizeOcr(region.text) }));
  const orderedLines = regionGroups(regions).map((row) => row.map((region) => region.text).join(' ').slice(0, 160));
  const lines = [...parsed.data.map(normalizeOcr), ...orderedLines].filter(Boolean);
  const dates = new Set<string>();
  const labelledDates = new Set<string>();
  const dateLabels = /\b(?:FROM|ISSUED|ISSUE DATE|DOB|THRU|THROUGH|UNTIL|EXP|EXPIRES|EXPIRY|EXPIRATION)\b/gi;
  const isExpiry = (label: string) => /^(?:THRU|THROUGH|UNTIL|EXP|EXPIRES|EXPIRY|EXPIRATION)$/i.test(label);
  const isIssued = (label: string) => /^(?:FROM|ISSUED|ISSUE DATE|DOB)$/i.test(label);
  const numberLines = lines.map((line, index) => {
    const previous = lines[index - 1] ?? '';
    const inherited = previous.length <= 40 && !/\d/.test(previous) ? [...previous.matchAll(dateLabels)].at(-1)?.[0] : undefined;
    const masked = line.replace(/\b([0-9OQIlL]{1,2})\s*[/.-]\s*([0-9OQIlL]{2,4})\b/g, (match: string, month: string, year: string, offset: number) => {
      const expiry = ocrExpiry(month, year);
      if (!expiry) return match;
      const label = [...line.slice(0, offset).matchAll(dateLabels)].at(-1)?.[0] ??
        (isExpiry([...line.matchAll(dateLabels)].at(-1)?.[0] ?? '') ? 'EXP' : inherited) ?? '';
      if (!isIssued(label)) dates.add(expiry);
      if (isExpiry(label)) labelledDates.add(expiry);
      return ' / ';
    });
    const label = [...line.matchAll(dateLabels)].at(-1);
    const compactDate = (label ? line.slice((label.index ?? 0) + label[0].length) : inherited ? line : '').replace(/[ :.-]/g, '');
    if (isExpiry(label?.[0] ?? inherited ?? '') && /^[0-9OQIlL]{4}$/.test(compactDate)) {
      const expiry = ocrExpiry(compactDate.slice(0, 2), compactDate.slice(2));
      if (expiry) { labelledDates.add(expiry); dates.add(expiry); return ' / '; }
    }
    return masked;
  });
  const numbers = new Set<string>();
  const addNumber = (text: string) => {
    const tokens = text.trim().split(/[ -]+/);
    while (tokens.length > 1 && !/\d/.test(tokens[0]!)) tokens.shift();
    while (tokens.length > 1 && !/\d/.test(tokens.at(-1)!)) tokens.pop();
    const digits = ocrDigits(tokens.join(''));
    if (digits && /^[1-9]\d{12,18}$/.test(digits) && passesLuhn(digits)) numbers.add(digits);
  };
  for (const run of spatialNumberRuns(regions)) addNumber(run);
  for (let index = 0; index < numberLines.length; index++) {
    const line = numberLines[index]!;
    if (/(?:[Xx*\u2022\u25cf]\s*){2,}/.test(line)) continue;
    for (const match of line.matchAll(/[0-9OQIlL|BS][0-9OQIlL|BS -]{11,}[0-9OQIlL|BS]/g)) addNumber(match[0]);
    if (regions.length) continue;
    let grouped = '';
    for (const next of numberLines.slice(index, index + 5)) {
      if (!/^[0-9OQIlL|BS -]+$/.test(next)) break;
      grouped += next.replace(/[ -]/g, '');
      if (grouped.length > 19) break;
      addNumber(grouped);
    }
  }
  if (numbers.size !== 1) return null;
  const names = new Set<string>();
  for (const line of lines) {
    const name = line.replace(/^(?:CARDHOLDER(?: NAME)?|NAME(?: ON CARD)?)\s*[:.-]?\s+/i, '').trim();
    if (/^[\p{L}][\p{L} .'-]{2,79}$/u.test(name) && name.split(/\s+/).length >= 2 &&
      !/\b(?:BANK|DEBIT|CREDIT|CARD|VISA|MASTERCARD|AMEX|AMERICAN|EXPRESS|RUPAY|PLATINUM|GOLD|WORLD|SIGNATURE|VALID|MEMBER|SECURITY|CUSTOMER|SERVICE|INTERNATIONAL|REWARDS|CONTACTLESS|ISSUED|ISSUER|DESIGNED|BY|EXP|EXPIRY|EXPIRES|EXPIRATION|THRU|THROUGH|UNTIL|DATE|FROM|CODE|SUPPORT|HELP|PHONE)\b/i.test(name)) {
      names.add(name);
    }
  }
  return {
    number: [...numbers][0]!,
    expiry: labelledDates.size === 1 ? [...labelledDates][0] : dates.size === 1 ? [...dates][0] : undefined,
    holder: names.size === 1 ? [...names][0] : undefined,
  };
}

export function selectStableCameraCard(samples: readonly (ReadCardDetails | null)[]): ReadCardDetails | null {
  const recent = samples.slice(-5);
  const current = recent.at(-1);
  if (!current) return null;
  const matching = recent.filter((sample): sample is ReadCardDetails => sample?.number === current.number);
  if (matching.length < 3) return null;
  const confirmed = (field: 'expiry' | 'holder'): string | undefined => {
    const counts = new Map<string, number>();
    for (const sample of matching) {
      const value = sample[field];
      if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    const ranked = [...counts].sort((a, b) => b[1] - a[1]);
    return ranked[0] && ranked[0][1] >= 2 && ranked[0][1] > (ranked[1]?.[1] ?? 0) ? ranked[0][0] : undefined;
  };
  return { number: current.number, expiry: confirmed('expiry'), holder: confirmed('holder') };
}

export function createCardReadReview(details: ReadCardDetails, existing: CardReadReview): CardReadReview {
  return {
    number: details.number,
    expiry: details.expiry ?? existing.expiry,
    holder: details.holder ?? existing.holder,
  };
}
