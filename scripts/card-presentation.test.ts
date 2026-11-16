import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  cardInputSchema,
  cardSchema,
  snapshotSchema,
} from '../src/core/vault/schemas';
import {
  cardDescriptor,
  cardDetailsForClipboard,
  cardPreviewValues,
} from '../src/features/cards/cardPresentation';
import {bankGradient, bankWatermark} from '../src/features/cards/bankThemes';

const fields = {
  number: '0000000000000000019',
  expiry: `12/${new Date().getFullYear() + 5}`,
  cvv: '007',
  holder: 'Synthetic Name',
  bank: 'Synthetic Bank',
  network: 'Visa',
  type: 'Credit',
  tier: 'Synthetic Tier',
  country: 'Synthetic Country',
};
const metadata = {
  id: '00000000-0000-4000-8000-000000000001',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

test('variant is optional and enforces 15 characters on entry and stored records', () => {
  for (const variant of [undefined, '', 'Scapia', 'IOCL', 'ABCDEFGHIJKLMNO']) {
    assert(cardInputSchema.safeParse({...fields, variant}).success);
    assert(cardSchema.safeParse({...fields, ...metadata, variant}).success);
  }
  for (const schema of [cardInputSchema, cardSchema]) {
    const result = schema.safeParse({
      ...fields,
      ...metadata,
      variant: 'ABCDEFGHIJKLMNOP',
    });
    assert(!result.success);
    assert.deepEqual(result.error.issues[0]?.path, ['variant']);
  }
});

test('version-one snapshot round trips preserve variants and accept older cards without one', () => {
  const legacy = {...fields, ...metadata, expiry: '01/2020'};
  const withVariant = {
    ...fields,
    ...metadata,
    id: '00000000-0000-4000-8000-000000000002',
    variant: 'Flipkart',
  };
  const snapshot = snapshotSchema.parse({
    version: 1,
    vaultId: '00000000-0000-4000-8000-000000000003',
    cards: [legacy, withVariant],
    notes: [],
  });
  const restored = snapshotSchema.parse(JSON.parse(JSON.stringify(snapshot)));
  assert.equal(restored.cards[0]?.variant, undefined);
  assert.equal(restored.cards[0]?.expiry, '01/2020');
  assert.equal(restored.cards[1]?.variant, 'Flipkart');
  assert.deepEqual(restored, snapshot);
});

test('copy details contains exactly the five requested fields and preserves leading zeros', () => {
  const card = {...fields, ...metadata, variant: 'Scapia'};
  assert.equal(
    cardDetailsForClipboard(card),
    [
      'Bank: Synthetic Bank',
      'Name on card: Synthetic Name',
      'Card number: 0000 0000 0000 0000 019',
      `Expiry date: ${fields.expiry}`,
      'CVV: 007',
    ].join('\n')
  );
  assert.equal(cardDescriptor(card), 'Scapia \u00b7 Credit');
  assert.equal(cardDescriptor({type: 'Debit'}), 'Debit');
  assert.equal(cardDescriptor({variant: ' IOCL ', type: '  '}), 'IOCL');
  assert.equal(cardDescriptor({}), '');
});

test('bank wordmarks reuse normalized brand matching and safe text fallbacks', () => {
  assert.equal(bankWatermark('HDFC Bank Ltd.'), 'HDFC');
  assert.equal(bankWatermark('hdfcbanklimited'), 'HDFC');
  assert.equal(bankWatermark('ICICI-Bank Limited'), 'ICICI');
  assert.equal(bankWatermark('My Local Bank Ltd.'), 'MY LOCAL');
  assert.equal(bankWatermark('Yesville Credit Union'), 'YESVILLE CREDIT UNION');
  assert.equal(bankWatermark('Mizuho Bank'), 'MIZUHO');
  assert.equal(bankWatermark(undefined), 'BANK');
  assert.deepEqual(bankGradient('hdfcbanklimited'), bankGradient('HDFC Bank'));
  assert.deepEqual(bankGradient('Unknown Local Bank'), bankGradient(''));
});

test('empty preview fields use display-only placeholders without changing the form', () => {
  const values = Object.freeze({
    number: '',
    expiry: '',
    cvv: '',
    holder: '',
    bank: ' ',
    network: '',
    type: '',
    variant: '',
    tier: '',
  });
  const original = {...values};
  assert.deepEqual(cardPreviewValues(values), {
    number: 'XXXX XXXX XXXX XXXX',
    expiry: 'MM/YY',
    cvv: 'XXX',
    holder: 'Your name',
    bank: 'Your bank',
    network: 'Network',
    type: 'Card type',
    variant: 'Variant',
    tier: 'Tier',
  });
  assert.deepEqual(values, original);
  assert(!cardInputSchema.safeParse(values).success);
});

test('preview values reflect every edit, including partial secrets and clearing fields', () => {
  const initial = {...fields, variant: 'IOCL'};
  assert.deepEqual(cardPreviewValues(initial), initial);
  const edited = {
    ...initial,
    number: '0001',
    cvv: '0',
    expiry: '01/',
    holder: 'Updated synthetic name',
    bank: 'HDFC Bank',
    network: 'Mastercard',
    type: 'Debit',
    variant: 'Scapia',
    tier: 'Gold',
  };
  assert.deepEqual(cardPreviewValues(edited), edited);
  const cleared = cardPreviewValues({...edited, number: '', cvv: ''});
  assert.equal(cleared.number, 'XXXX XXXX XXXX XXXX');
  assert.equal(cleared.cvv, 'XXX');
  assert.equal(cleared.variant, 'Scapia');
  assert.equal(initial.number, fields.number);
});
