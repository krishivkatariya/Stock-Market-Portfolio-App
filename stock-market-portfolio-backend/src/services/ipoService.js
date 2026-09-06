const UpstoxIpoProvider = require('./upstoxIpoProvider');

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();
const provider = new UpstoxIpoProvider();

const normalizeStatus = (value) => {
  const status = String(value || '').trim().toUpperCase();
  if (['UPCOMING', 'OPEN', 'CLOSED', 'LISTED'].includes(status)) return status;
  return null;
};

const normalizeIpo = (raw = {}) => ({
  id: raw.id ?? raw.ipo_id ?? raw.application_number ?? null,
  name: raw.name ?? raw.company_name ?? raw.issuer_name ?? null,
  symbol: raw.symbol ?? raw.trading_symbol ?? null,
  isin: raw.isin ?? null,
  exchange: raw.exchange ?? raw.exchanges ?? null,
  issueType: raw.issue_type ?? raw.issueType ?? raw.segment ?? null,
  status: normalizeStatus(raw.status ?? raw.ipo_status),
  issueSize: raw.issue_size ?? raw.issueSize ?? null,
  industry: raw.industry ?? null,
  priceBand: {
    min: raw.price_band?.min ?? raw.price_band_min ?? null,
    max: raw.price_band?.max ?? raw.price_band_max ?? null,
    cutoff: raw.cutoff_price ?? raw.price_band?.cutoff ?? null
  },
  lotSize: raw.lot_size ?? raw.lotSize ?? null,
  minimumQuantity: raw.minimum_quantity ?? raw.min_quantity ?? null,
  dates: {
    announcement: raw.announcement_date ?? raw.dates?.announcement ?? null,
    biddingStart: raw.bidding_start_date ?? raw.open_date ?? raw.dates?.biddingStart ?? null,
    biddingEnd: raw.bidding_end_date ?? raw.close_date ?? raw.dates?.biddingEnd ?? null,
    allotment: raw.allotment_date ?? raw.dates?.allotment ?? null,
    refund: raw.refund_date ?? raw.dates?.refund ?? null,
    listing: raw.listing_date ?? raw.dates?.listing ?? null
  },
  subscription: raw.subscription ? {
    qib: raw.subscription.qib ?? null,
    nii: raw.subscription.nii ?? null,
    retail: raw.subscription.retail ?? null,
    employee: raw.subscription.employee ?? null,
    total: raw.subscription.total ?? null,
    updatedAt: raw.subscription.updated_at ?? raw.subscription.updatedAt ?? null
  } : null,
  registrar: raw.registrar ? {
    name: raw.registrar.name ?? null,
    website: raw.registrar.website ?? null
  } : null,
  applicationSupported: Boolean(raw.application_supported),
  provider: 'upstox'
});

const getCached = (key) => {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
};

const setCached = (key, value) => {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
};

const listIpos = async () => {
  const cached = getCached('list');
  if (cached) return cached;
  const raw = await provider.list();
  return setCached('list', raw.map(normalizeIpo).filter((ipo) => ipo.id && ipo.name));
};

const getIpo = async (id) => {
  const cacheKey = `detail:${id}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const raw = await provider.getById(id);
  return raw ? setCached(cacheKey, normalizeIpo(raw)) : null;
};

module.exports = {
  listIpos,
  getIpo,
  normalizeIpo,
  provider
};
