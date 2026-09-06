const { listIpos, getIpo } = require('../services/ipoService');

const providerError = (error) => {
  if (error?.code === 'IPO_PROVIDER_NOT_CONFIGURED') {
    return { status: 503, code: 'provider_not_configured', message: error.message };
  }
  if (error?.status === 401 || error?.status === 403) {
    return { status: 502, code: 'provider_unauthorized', message: 'IPO data provider authorization is unavailable.' };
  }
  if (error?.status === 429) {
    return { status: 429, code: 'provider_rate_limited', message: 'IPO data provider rate limit reached. Try again later.' };
  }
  return { status: 502, code: 'provider_unavailable', message: 'IPO data is temporarily unavailable.' };
};

const sendProviderError = (res, error) => {
  const result = providerError(error);
  return res.status(result.status).json({ success: false, ...result });
};

const getIpos = async (req, res) => {
  try {
    const requestedStatus = String(req.query.status || '').trim().toUpperCase();
    const requestedSegment = String(req.query.segment || '').trim().toUpperCase();
    const search = String(req.query.search || '').trim().toLowerCase();
    const allowedStatuses = ['UPCOMING', 'OPEN', 'CLOSED', 'LISTED'];
    const allowedSegments = ['MAINBOARD', 'SME'];

    if (requestedStatus && !allowedStatuses.includes(requestedStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid IPO status.' });
    }
    if (requestedSegment && !allowedSegments.includes(requestedSegment)) {
      return res.status(400).json({ success: false, message: 'Invalid IPO segment.' });
    }

    let ipos = await listIpos();
    if (requestedStatus) ipos = ipos.filter((ipo) => ipo.status === requestedStatus);
    if (requestedSegment) ipos = ipos.filter((ipo) => String(ipo.issueType || '').toUpperCase() === requestedSegment);
    if (search) ipos = ipos.filter((ipo) => `${ipo.name} ${ipo.symbol || ''}`.toLowerCase().includes(search));

    return res.json({ success: true, provider: 'upstox', count: ipos.length, ipos });
  } catch (error) {
    return sendProviderError(res, error);
  }
};

const getIpoById = async (req, res) => {
  try {
    const ipo = await getIpo(req.params.id);
    if (!ipo) return res.status(404).json({ success: false, message: 'IPO not found.' });
    return res.json({ success: true, provider: 'upstox', ipo });
  } catch (error) {
    return sendProviderError(res, error);
  }
};

module.exports = { getIpos, getIpoById };
