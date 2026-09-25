// Branding and static options. Adjust to your server.
export const brand = {
  name: 'CompV2 Exchange',
  footer: 'CompV2 Exchange • Szybko • Bezpiecznie • 24/7',
};

export const colors = {
  primary: 0x5865f2,
  success: 0x23a55a,
  warning: 0xf0b232,
  danger: 0xf23f43,
  neutral: 0x2b2d31,
  gold: 0xf5c542,
};

export const ticketTypes = {
  exchange: {
    label: 'Exchange',
    emoji: '💱',
    description: 'Wymiana środków pomiędzy metodami płatności',
    color: colors.primary,
    prefix: 'exchange',
  },
  support: {
    label: 'Pomoc',
    emoji: '🛟',
    description: 'Pytania, problemy i pomoc techniczna',
    color: colors.success,
    prefix: 'pomoc',
  },
  partnership: {
    label: 'Współpraca',
    emoji: '🤝',
    description: 'Partnerstwa, reklamy i propozycje',
    color: colors.gold,
    prefix: 'wspolpraca',
  },
  report: {
    label: 'Zgłoszenie',
    emoji: '🚨',
    description: 'Zgłoś oszusta lub nieprawidłowość',
    color: colors.danger,
    prefix: 'zgloszenie',
  },
};

// Payment methods offered in the exchange form (max 25).
export const methods = {
  blik: { label: 'BLIK', emoji: '📱' },
  bank: { label: 'Przelew bankowy', emoji: '🏦' },
  paypal: { label: 'PayPal', emoji: '🅿️' },
  revolut: { label: 'Revolut', emoji: '💳' },
  psc: { label: 'Paysafecard', emoji: '🎫' },
  btc: { label: 'Bitcoin (BTC)', emoji: '🪙' },
  ltc: { label: 'Litecoin (LTC)', emoji: '🪙' },
  eth: { label: 'Ethereum (ETH)', emoji: '🪙' },
  usdt: { label: 'USDT (TRC20)', emoji: '💵' },
};

// Default fee (%) when no specific rate is set with /kurs.
export const defaultFee = 10;

export const statuses = {
  waiting: { label: 'Oczekuje na obsługę', emoji: '🕓', color: colors.neutral },
  payment: { label: 'Oczekuje na płatność', emoji: '💸', color: colors.warning },
  received: { label: 'Płatność otrzymana', emoji: '📥', color: colors.primary },
  processing: { label: 'W realizacji', emoji: '⚙️', color: colors.primary },
  done: { label: 'Zrealizowano', emoji: '✅', color: colors.success },
};
