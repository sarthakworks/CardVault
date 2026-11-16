import type {CardInput, VaultCard} from '../../core/vault/models';
import {
  formatCardExpiry,
  formatCardNumber,
} from '../../shared/utils/formatters';

export function cardDescriptor(
  card: Pick<VaultCard, 'variant' | 'type'>
): string {
  return [card.variant?.trim(), card.type?.trim()]
    .filter(Boolean)
    .join(' \u00b7 ');
}

export function cardPreviewValues(values: CardInput): CardInput {
  const display = (value: string | undefined, placeholder: string) =>
    value?.trim() ? value : placeholder;
  return {
    ...values,
    number: display(values.number, 'XXXX XXXX XXXX XXXX'),
    cvv: display(values.cvv, 'XXX'),
    expiry: display(values.expiry, 'MM/YY'),
    holder: display(values.holder, 'Your name'),
    bank: display(values.bank, 'Your bank'),
    variant: display(values.variant, 'Variant'),
    type: display(values.type, 'Card type'),
    network: display(values.network, 'Network'),
    tier: display(values.tier, 'Tier'),
  };
}

export function cardDetailsForClipboard(
  card: Pick<VaultCard, 'number' | 'cvv' | 'expiry' | 'holder' | 'bank'>
): string {
  return [
    `Bank: ${card.bank}`,
    `Name on card: ${card.holder}`,
    `Card number: ${formatCardNumber(card.number)}`,
    `Expiry date: ${formatCardExpiry(card.expiry)}`,
    `CVV: ${card.cvv}`,
  ].join('\n');
}
