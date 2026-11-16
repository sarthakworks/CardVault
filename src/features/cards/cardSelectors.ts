import type {VaultCard} from '../../core/vault/models';

export interface CardFilter {
  holder: string | null;
  bank: string | null;
}

export interface CardFilterOption {
  key: string;
  label: string;
}

export const initialCardFilter: CardFilter = {
  holder: null,
  bank: null,
};

const bankSuffixes = new Set([
  'bank',
  'ltd',
  'limited',
  'plc',
  'inc',
  'co',
  'corp',
  'corporation',
  'na',
]);

function bankWords(bank: string): string[] {
  const words = bank.trim().split(/\s+/).filter(Boolean);
  while (
    words.length > 1 &&
    bankSuffixes.has(
      words[words.length - 1]!.toLowerCase().replace(/[^a-z]/g, '')
    )
  )
    words.pop();
  if (words.length > 1 && words[0]!.toLowerCase() === 'the') words.shift();
  return words;
}

// "ICICI", "ICICI Bank" and "ICICI Bank Ltd." share one filter.
export function cardBankIdentity(bank: string): string {
  return (
    bankWords(bank)
      .join('')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') || bank.trim().toLowerCase()
  );
}

export function cardBankLabel(bank: string): string {
  return (
    bankWords(bank)
      .join(' ')
      .replace(/[.,]+$/, '') || bank.trim()
  );
}

export function cardHolderIdentity(holder: string): string {
  return holder.trim().replace(/\s+/g, ' ').toLowerCase();
}

function uppercaseCount(value: string): number {
  return value.replace(/[^A-Z]/g, '').length;
}

function groupOptions(
  values: string[],
  identity: (value: string) => string,
  label: (value: string) => string
): CardFilterOption[] {
  const groups = new Map<string, Map<string, number>>();
  for (const value of values) {
    const key = identity(value);
    if (!key) continue;
    const labels = groups.get(key) ?? new Map<string, number>();
    const text = label(value);
    labels.set(text, (labels.get(text) ?? 0) + 1);
    groups.set(key, labels);
  }
  return [...groups]
    .map(([key, labels]) => ({
      key,
      label: [...labels].sort(
        ([a, countA], [b, countB]) =>
          countB - countA ||
          uppercaseCount(b) - uppercaseCount(a) ||
          a.localeCompare(b)
      )[0]![0],
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function cardFilterOptions(cards: VaultCard[]) {
  return {
    holders: groupOptions(
      cards.map((card) => card.holder),
      cardHolderIdentity,
      (holder) => holder.trim().replace(/\s+/g, ' ')
    ),
    banks: groupOptions(
      cards.map((card) => card.bank),
      cardBankIdentity,
      cardBankLabel
    ),
  };
}

export function selectCards(
  cards: VaultCard[],
  filter: CardFilter
): VaultCard[] {
  const result = cards.filter(
    (card) =>
      (!filter.holder || cardHolderIdentity(card.holder) === filter.holder) &&
      (!filter.bank || cardBankIdentity(card.bank) === filter.bank)
  );
  return result.sort(
    (left, right) =>
      left.bank.trim().localeCompare(right.bank.trim(), undefined, {
        sensitivity: 'base',
      }) || left.id.localeCompare(right.id)
  );
}
