import type { VaultCard } from '../../core/vault/models';
import { cardNetworkIdentity, cardNetworkLabel } from '../../core/validation/cardRules';
import { formatCardExpiry } from '../../shared/utils/formatters';

export interface CardFilter {
  holder: string | null;
  bank: string | null;
  network: string | null;
  sort: 'newest' | 'bank' | 'expiry';
}

export interface CardFilterOption {
  key: string;
  label: string;
}

export const initialCardFilter: CardFilter = { holder: null, bank: null, network: null, sort: 'newest' };

const bankSuffixes = new Set(['bank', 'ltd', 'limited', 'plc', 'inc', 'co', 'corp', 'corporation', 'na']);

function bankWords(bank: string): string[] {
  const words = bank.trim().split(/\s+/).filter(Boolean);
  while (words.length > 1 && bankSuffixes.has(words[words.length - 1]!.toLowerCase().replace(/[^a-z]/g, ''))) words.pop();
  if (words.length > 1 && words[0]!.toLowerCase() === 'the') words.shift();
  return words;
}

// "ICICI", "ICICI Bank" and "ICICI Bank Ltd." share one filter.
export function cardBankIdentity(bank: string): string {
  return bankWords(bank).join('').toLowerCase().replace(/[^a-z0-9]/g, '') || bank.trim().toLowerCase();
}

export function cardBankLabel(bank: string): string {
  return bankWords(bank).join(' ').replace(/[.,]+$/, '') || bank.trim();
}

export function cardHolderIdentity(holder: string): string {
  return holder.trim().replace(/\s+/g, ' ').toLowerCase();
}

function uppercaseCount(value: string): number {
  return value.replace(/[^A-Z]/g, '').length;
}

function groupOptions(values: string[], identity: (value: string) => string, label: (value: string) => string): CardFilterOption[] {
  const groups = new Map<string, Map<string, number>>();
  for (const value of values) {
    const key = identity(value);
    if (!key) continue;
    const labels = groups.get(key) ?? new Map<string, number>();
    const text = label(value);
    labels.set(text, (labels.get(text) ?? 0) + 1);
    groups.set(key, labels);
  }
  return [...groups].map(([key, labels]) => ({
    key,
    label: [...labels].sort(([a, countA], [b, countB]) => countB - countA || uppercaseCount(b) - uppercaseCount(a) || a.localeCompare(b))[0]![0],
  })).sort((a, b) => a.label.localeCompare(b.label));
}

export function cardFilterOptions(cards: VaultCard[]) {
  return {
    holders: groupOptions(cards.map((card) => card.holder), cardHolderIdentity, (holder) => holder.trim().replace(/\s+/g, ' ')),
    banks: groupOptions(cards.map((card) => card.bank), cardBankIdentity, cardBankLabel),
    networks: groupOptions(cards.map((card) => card.network), cardNetworkIdentity, (network) => cardNetworkLabel(network.trim())),
  };
}

function expirySortValue(expiry: string): number {
  const match = /^(0[1-9]|1[0-2])\/(\d{2}|\d{4})$/.exec(formatCardExpiry(expiry));
  const month = match?.[1];
  const year = match?.[2];
  return month && year ? (year.length === 2 ? 2000 + Number(year) : Number(year)) * 12 + Number(month) : Number.POSITIVE_INFINITY;
}

export function selectCards(cards: VaultCard[], filter: CardFilter): VaultCard[] {
  const result = cards.filter((card) => (!filter.holder || cardHolderIdentity(card.holder) === filter.holder)
    && (!filter.bank || cardBankIdentity(card.bank) === filter.bank)
    && (!filter.network || cardNetworkIdentity(card.network) === filter.network));
  return result.sort((left, right) => {
    if (filter.sort === 'bank') return left.bank.localeCompare(right.bank) || left.id.localeCompare(right.id);
    if (filter.sort === 'expiry') {
      const leftExpiry = expirySortValue(left.expiry);
      const rightExpiry = expirySortValue(right.expiry);
      if (leftExpiry !== rightExpiry) return leftExpiry < rightExpiry ? -1 : 1;
      return left.id.localeCompare(right.id);
    }
    return right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id);
  });
}
