export const networks = ['Visa', 'Mastercard', 'RuPay', 'Amex', 'Diners'] as const;
export type CardNetwork = typeof networks[number];

export const cardFieldLimits = {
  number: 128,
  expiry: 32,
  cvv: 32,
} as const;
