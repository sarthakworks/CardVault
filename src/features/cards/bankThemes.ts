export type CardGradient = readonly [string, string, string];

// Brand hues are approximations used only to tint card artwork; keys are whole-word phrases.
// Order matters: more specific names must precede names they contain (e.g. "state bank of india" before "bank of india").
const bankBrands: readonly (readonly [color: string, keys: readonly string[]])[] = [
  // Public sector banks (including names merged into them)
  ['#2D5BA8', ['state bank of india', 'sbi', 'sbi card', 'sbi cards', 'state bank']],
  ['#D2232A', ['central bank of india', 'central bank', 'cbi']],
  ['#1E4D9B', ['indian overseas bank', 'iob']],
  ['#C8202F', ['south indian bank', 'sib']],
  ['#193D8F', ['city union bank', 'cub']],
  ['#EE3524', ['bank of maharashtra', 'mahabank', 'bom']],
  ['#E21F26', ['union bank of india', 'union bank', 'ubi', 'andhra bank', 'corporation bank']],
  ['#F37021', ['bank of india', 'boi']],
  ['#F15A22', ['bank of baroda', 'baroda', 'bob', 'bob card', 'bob cards', 'bobcard', 'bobcards', 'vijaya bank', 'dena bank']],
  ['#A2123B', ['punjab national bank', 'pnb', 'oriental bank of commerce', 'obc', 'united bank of india']],
  ['#009245', ['punjab sind bank', 'punjab and sind bank', 'psb']],
  ['#0A73B8', ['canara bank', 'canara', 'syndicate bank']],
  ['#1B4F9C', ['indian bank', 'allahabad bank']],
  ['#0067B1', ['uco bank', 'uco']],
  ['#00836C', ['idbi bank', 'idbi']],
  // Private sector banks
  ['#004C8F', ['hdfc bank', 'hdfc']],
  ['#AE282E', ['icici bank', 'icici']],
  ['#97144D', ['axis bank', 'axis']],
  ['#003B70', ['citibank', 'citi bank', 'citi']],
  ['#C8102E', ['kotak mahindra bank', 'kotak mahindra', 'kotak']],
  ['#98272A', ['indusind bank', 'indusind', 'indus ind']],
  ['#00518F', ['yes bank', 'yes']],
  ['#9C1D26', ['idfc first bank', 'idfc first', 'idfc bank', 'idfc']],
  ['#21409A', ['rbl bank', 'rbl', 'ratnakar bank']],
  ['#0A4C96', ['dcb bank', 'dcb', 'development credit bank']],
  ['#DC3A2B', ['bandhan bank', 'bandhan']],
  ['#00529B', ['federal bank', 'federal', 'fi money', 'scapia']],
  ['#8C1D5A', ['karnataka bank', 'kbl']],
  ['#1D6B3A', ['karur vysya bank', 'karur vysya', 'kvb']],
  ['#1D3C8E', ['tamilnad mercantile bank', 'tamilnad mercantile', 'tmb']],
  ['#0B8B3E', ['csb bank', 'csb', 'catholic syrian bank']],
  ['#006B3F', ['jammu kashmir bank', 'jk bank', 'j k bank', 'jkb']],
  ['#8A2232', ['dhanlaxmi bank', 'dhanlaxmi', 'dhanalakshmi bank']],
  ['#00559E', ['nainital bank']],
  ['#B5121B', ['dbs bank', 'dbs', 'digibank', 'lakshmi vilas bank', 'lvb']],
  // Small finance banks
  ['#6C2C86', ['au small finance bank', 'au small finance', 'au bank', 'au']],
  ['#F37021', ['equitas small finance bank', 'equitas']],
  ['#009A8E', ['ujjivan small finance bank', 'ujjivan']],
  ['#2E8B57', ['jana small finance bank', 'jana']],
  ['#F58220', ['suryoday small finance bank', 'suryoday']],
  ['#2E7D32', ['esaf small finance bank', 'esaf']],
  ['#7B2D8E', ['utkarsh small finance bank', 'utkarsh']],
  ['#0072BC', ['fincare small finance bank', 'fincare']],
  ['#E4672F', ['shivalik small finance bank', 'shivalik']],
  ['#1B5E9E', ['unity small finance bank', 'unity bank', 'unity']],
  ['#0E7C86', ['capital small finance bank', 'capital sfb']],
  ['#C1272D', ['north east small finance bank', 'slice small finance bank']],
  ['#1F6FB2', ['jio payments bank', 'jio']],
  // Payments banks
  ['#E40000', ['airtel payments bank', 'airtel']],
  ['#002E6E', ['paytm payments bank', 'paytm']],
  ['#C8102E', ['india post payments bank', 'ippb', 'india post']],
  ['#3F2A8C', ['fino payments bank', 'fino']],
  ['#0072CE', ['nsdl payments bank', 'nsdl']],
  // Foreign banks in India
  ['#DB0011', ['hsbc']],
  ['#0A60A8', ['standard chartered', 'standard chartered bank', 'scb', 'stanchart']],
  ['#0018A8', ['deutsche bank', 'deutsche']],
  ['#016FD0', ['american express', 'amex']],
  ['#00AEEF', ['barclays', 'barclaycard']],
  ['#012169', ['bank of america']],
  ['#005EB8', ['jpmorgan chase', 'jp morgan', 'chase']],
  ['#E31837', ['sbm bank', 'sbm']],
  ['#003DA5', ['bnp paribas']],
  ['#0065BD', ['mufg', 'mizuho', 'smbc', 'sumitomo mitsui']],
  ['#E60012', ['bank of china', 'emirates nbd', 'qnb']],
  ['#00965E', ['doha bank', 'mashreq', 'first abu dhabi bank', 'fab']],
  // Co-operative banks
  ['#E31837', ['saraswat bank', 'saraswat']],
  ['#0055A5', ['cosmos bank', 'cosmos']],
  ['#2D3B8C', ['svc bank', 'svc', 'shamrao vithal']],
  ['#0059A9', ['tjsb bank', 'tjsb', 'thane janata']],
  ['#1B75BB', ['nkgsb bank', 'nkgsb']],
  ['#D71920', ['abhyudaya bank', 'abhyudaya']],
  ['#0E4C92', ['apna sahakari bank', 'apna sahakari']],
  ['#00703C', ['kalupur bank', 'kalupur']],
  ['#2E3192', ['bharat co operative bank', 'bharat bank']],
  ['#A6192E', ['janata sahakari bank', 'janata sahakari']],
  ['#1A5DAD', ['kerala bank', 'kerala gramin bank']],
  ['#008751', ['maharashtra gramin bank', 'gramin bank']],
  // Card programmes and fintech issuers
  ['#1A1A1A', ['onecard', 'one card', 'fpl technologies']],
  ['#5A2EA6', ['slice']],
  ['#F15A29', ['jupiter']],
  ['#2B0E6A', ['niyo', 'niyox']],
  ['#111111', ['uni', 'uni cards', 'uni card']],
  ['#5F259F', ['phonepe']],
  ['#1A73E8', ['google pay']],
  ['#FF9900', ['amazon pay']],
  ['#2874F0', ['flipkart']],
  ['#0B3D91', ['tata neu', 'tata']],
];

const fallback: CardGradient = ['#3F5E91', '#263E65', '#162A49'];

function normalize(value: string): string {
  return ` ${value.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

const brandIndex = bankBrands.flatMap(([color, keys]) => keys.map((key) => [normalize(key), color] as const));

function channel(hex: string, offset: number): number {
  return parseInt(hex.slice(offset, offset + 2), 16) / 255;
}

function luminance([r, g, b]: number[]): number {
  const linear = (value: number) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r!) + 0.7152 * linear(g!) + 0.0722 * linear(b!);
}

function toHex(rgb: number[]): string {
  return `#${rgb.map((value) => Math.round(Math.min(1, Math.max(0, value)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

// Deepen the brand colour until white card text keeps at least ~5:1 contrast, then shade towards near-black.
function gradientFrom(color: string): CardGradient {
  let rgb = [channel(color, 1), channel(color, 3), channel(color, 5)];
  while (luminance(rgb) > 0.16) rgb = rgb.map((value) => value * 0.92);
  const shade = (amount: number) => toHex(rgb.map((value) => value * (1 - amount) + 0.06 * amount));
  return [toHex(rgb), shade(0.38), shade(0.66)];
}

const cache = new Map<string, CardGradient>();

export function bankGradient(bank: string | undefined): CardGradient {
  const name = normalize(bank ?? '');
  if (!name.trim()) return fallback;
  const cached = cache.get(name);
  if (cached) return cached;
  const compact = name.replace(/ /g, '');
  const match = brandIndex.find(([key]) => name.includes(key) || (!name.trim().includes(' ') && key.trim().includes(' ') && compact.startsWith(key.replace(/ /g, ''))));
  const gradient = match ? gradientFrom(match[1]) : fallback;
  cache.set(name, gradient);
  return gradient;
}
