import Fuse from 'fuse.js';
import type {VaultCard} from '../../core/vault/models';

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

const aliasGroups = [
  ['american express', 'amex', 'ae'],
  ['state bank of india', 'state bank', 'sbi'],
  [
    'hsbc',
    'hongkong and shanghai banking corporation',
    'hongkong shanghai banking corporation',
    'hong kong and shanghai banking corporation',
    'hongkong',
    'hong kong',
    'shanghai banking corporation',
  ],
];
const acronymStopWords = new Set([
  'the',
  'of',
  'and',
  'ltd',
  'limited',
  'plc',
  'inc',
]);

function aliasesFor(value: string): string[] {
  const name = normalize(value)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  const group = aliasGroups.find((aliases) =>
    aliases.some((alias) => ` ${name} `.includes(` ${alias} `))
  );
  const words = name.split(/\s+/).filter((word) => !acronymStopWords.has(word));
  const acronym = words.length > 1 ? words.map((word) => word[0]).join('') : '';
  return [...(group ?? []), ...(acronym ? [acronym] : [])];
}

export function createCardSearch(cards: VaultCard[]) {
  const entries = cards.map((card) => {
    const aliases = [...aliasesFor(card.bank), ...aliasesFor(card.network)];
    return {
      id: card.id,
      text: [
        card.bank,
        card.variant ?? '',
        card.holder,
        card.tier ?? '',
        card.network,
        card.country ?? '',
      ].map(normalize),
      type: normalize(card.type ?? ''),
      number: card.number.replace(/\D/g, ''),
      aliases,
      identity: [card.bank, card.network].map(normalize),
      abbreviations: aliases.filter((alias) => /^[a-z]{3}$/.test(alias)),
    };
  });
  const fuse = new Fuse(entries, {
    keys: ['text', 'aliases'],
    threshold: 0.4,
    ignoreLocation: true,
    ignoreFieldNorm: true,
    shouldSort: false,
  });
  // Keep credit/debit distinct while allowing small card-type typos.
  const types = new Fuse(entries, {
    keys: ['type'],
    threshold: 0.25,
    ignoreLocation: true,
    shouldSort: false,
  });
  const abbreviations = new Fuse(entries, {
    keys: ['abbreviations'],
    threshold: 0.34,
    ignoreLocation: true,
    shouldSort: false,
  });
  const identities = new Fuse(entries, {
    keys: ['identity', 'aliases'],
    threshold: 0.3,
    ignoreLocation: true,
    shouldSort: false,
  });
  return (query: string): VaultCard[] => {
    const terms = normalize(query).match(/[\p{L}\p{N}]+/gu) ?? [];
    if (!terms.length) return cards;
    let matches: Set<string> | undefined;
    for (const term of new Set(terms)) {
      // Digits must match exactly; never fuzzy-match a different card number.
      const group = aliasGroups.find((aliases) => aliases.includes(term));
      const patterns = group ?? [term];
      const found = new Set(
        patterns.flatMap((pattern) =>
          /^\d+$/.test(pattern) || pattern.length < 4
            ? entries
                .filter(
                  (entry) =>
                    (!group &&
                      (entry.number.includes(pattern) ||
                        entry.type.includes(pattern))) ||
                    [
                      ...(group ? entry.identity : entry.text),
                      ...entry.aliases,
                    ].some((value) => value.includes(pattern))
                )
                .map((entry) => entry.id)
            : (group
                ? identities.search(pattern)
                : [...fuse.search(pattern), ...types.search(pattern)]
              ).map(({item}) => item.id)
        )
      );
      // Only relax an unknown three-letter bank/network acronym, never digits.
      if (!found.size && /^[a-z]{3}$/.test(term))
        for (const {item} of abbreviations.search(term)) found.add(item.id);
      matches = matches
        ? new Set([...matches].filter((id) => found.has(id)))
        : found;
      if (!matches.size) return [];
    }
    return cards.filter((card) => matches?.has(card.id));
  };
}
