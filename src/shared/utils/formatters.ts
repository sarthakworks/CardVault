export function formatCardNumber(value: string): string {
  const digits = value.replace(/\s/g, '');
  return /^\d+$/.test(digits) ? digits.match(/.{1,4}/g)?.join(' ') ?? value : value;
}

export function displayDate(value: string): string {
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
