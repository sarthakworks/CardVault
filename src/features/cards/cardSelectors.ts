import type { VaultCard } from '../../core/vault/models';
import type { CardNetwork } from '../../core/validation/cardRules';

export interface CardFilter {
  owner: string | null;
  bank: string | null;
  network: CardNetwork | null;
  sort: 'newest' | 'bank' | 'expiry';
}

export const initialCardFilter: CardFilter = { owner: null, bank: null, network: null, sort: 'newest' };

function expirySortValue(expiry: string): number {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(expiry);
  const month = match?.[1];
  const year = match?.[2];
  return month && year ? Number(year) * 12 + Number(month) : Number.POSITIVE_INFINITY;
}

export function selectCards(cards: VaultCard[], filter: CardFilter): VaultCard[] {
  const result = cards.filter((card) => (!filter.owner || card.owner === filter.owner)
    && (!filter.bank || card.bank === filter.bank) && (!filter.network || card.network === filter.network));
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
