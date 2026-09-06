import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getIpo } from '../services/ipoService';

const display = (value) => value === null || value === undefined || value === '' ? '—' : value;
const formatDate = (value) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)) : '—';
const formatMoney = (value) => value === null || value === undefined ? '—' : `₹${Number(value).toLocaleString('en-IN')}`;

const IPODetails = () => {
  const { id } = useParams();
  const [ipo, setIpo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadIpo = useCallback(async () => {
    try {
      const data = await getIpo(id);
      setIpo(data?.ipo || null);
      setError('');
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'IPO data is temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!active) return;
      await loadIpo();
    };

    load();
    return () => { active = false; };
  }, [loadIpo]);

  if (loading) return <main className="dashboard-main ipo-page"><section className="panel"><div className="inline-loading">Loading IPO details...</div></section></main>;
  if (error) return <main className="dashboard-main ipo-page"><section className="panel"><div className="inline-error">{error}<button type="button" className="text-button" onClick={() => { setLoading(true); loadIpo(); }}>Retry</button></div></section></main>;
  if (!ipo) return <main className="dashboard-main ipo-page"><section className="panel"><div className="empty-state">IPO not found.</div></section></main>;

  const listed = ipo.status === 'LISTED' && ipo.symbol;
  const subscription = ipo.subscription;
  const timeline = [
    ['Announcement', ipo.dates?.announcement],
    ['IPO opens', ipo.dates?.biddingStart],
    ['IPO closes', ipo.dates?.biddingEnd],
    ['Allotment', ipo.dates?.allotment],
    ['Refund / unblock', ipo.dates?.refund],
    ['Listing', ipo.dates?.listing]
  ];

  return (
    <main className="dashboard-main ipo-page">
      <Link to="/ipo" className="text-button back-link">← Back to IPO centre</Link>
      <section className="page-header ipo-detail-header">
        <div>
          <p className="eyebrow">{display(ipo.issueType)} IPO</p>
          <h1>{display(ipo.name)}</h1>
          <p className="subtitle">{display(ipo.exchange)} {ipo.symbol ? `· ${ipo.symbol}` : ''}</p>
        </div>
        <span className={`ipo-status-pill status-${String(ipo.status || '').toLowerCase()}`}>{display(ipo.status)}</span>
      </section>

      <section className="ipo-detail-grid">
        <div className="panel">
          <div className="panel-header"><h2>IPO overview</h2><span className="muted-status">Data from {display(ipo.provider)}</span></div>
          <div className="ipo-metric-grid">
            <div><span>Price band</span><strong>{ipo.priceBand?.min === null && ipo.priceBand?.max === null ? '—' : `${formatMoney(ipo.priceBand?.min)} – ${formatMoney(ipo.priceBand?.max)}`}</strong></div>
            <div><span>Lot size</span><strong>{display(ipo.lotSize)}</strong></div>
            <div><span>Minimum quantity</span><strong>{display(ipo.minimumQuantity)}</strong></div>
            <div><span>Minimum investment</span><strong>{ipo.priceBand?.max && ipo.lotSize ? formatMoney(Number(ipo.priceBand.max) * Number(ipo.lotSize)) : '—'}</strong></div>
            <div><span>Issue size</span><strong>{display(ipo.issueSize)}</strong></div>
            <div><span>Industry</span><strong>{display(ipo.industry)}</strong></div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><h2>Application</h2></div>
          {ipo.applicationSupported ? <button type="button" className="primary-button" disabled>Application flow unavailable</button> : <div className="ipo-application-disabled"><strong>IPO application integration is not connected.</strong><span>Only an authorized provider can submit a bid or return an application ID.</span></div>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header"><h2>Timeline</h2></div>
        <div className="ipo-timeline">
          {timeline.map(([label, date]) => <div key={label} className="ipo-timeline-item"><span className="ipo-timeline-dot" /><span>{label}</span><strong>{formatDate(date)}</strong></div>)}
        </div>
      </section>

      <section className="ipo-detail-grid">
        <div className="panel">
          <div className="panel-header"><h2>Subscription</h2></div>
          {subscription ? <div className="ipo-metric-grid"><div><span>Retail</span><strong>{display(subscription.retail)}</strong></div><div><span>NII</span><strong>{display(subscription.nii)}</strong></div><div><span>QIB</span><strong>{display(subscription.qib)}</strong></div><div><span>Total</span><strong>{display(subscription.total)}</strong></div></div> : <p className="subtitle">Subscription data unavailable.</p>}
          {subscription?.updatedAt ? <p className="market-updated">Updated {formatDate(subscription.updatedAt)}</p> : null}
        </div>
        <div className="panel">
          <div className="panel-header"><h2>Registrar</h2></div>
          <p className="subtitle">{display(ipo.registrar?.name)}</p>
          {ipo.registrar?.website ? <a href={ipo.registrar.website} target="_blank" rel="noreferrer">Registrar website</a> : null}
        </div>
      </section>

      {listed ? <section className="panel"><h2>Listed stock</h2><p className="subtitle">This IPO is listed with symbol {ipo.symbol}.</p><Link className="primary-button inline-action-button" to={`/stock/${encodeURIComponent(ipo.symbol)}`}>View listed stock</Link></section> : null}
      <p className="ipo-disclaimer">IPO information is provider-supplied. StockPilot does not guarantee allotment and never requests UPI PIN, OTP, bank passwords, or other payment secrets.</p>
    </main>
  );
};

export default IPODetails;
