import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getIpos } from '../services/ipoService';

const categories = ['UPCOMING', 'OPEN', 'CLOSED', 'LISTED'];
const segments = ['ALL', 'MAINBOARD', 'SME'];
const display = (value) => value === null || value === undefined || value === '' ? '—' : value;
const formatDate = (value) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)) : '—';
const formatMoney = (value) => value === null || value === undefined ? '—' : `₹${Number(value).toLocaleString('en-IN')}`;

const IPO = () => {
  const [category, setCategory] = useState('OPEN');
  const [segment, setSegment] = useState('ALL');
  const [search, setSearch] = useState('');
  const [ipos, setIpos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadIpos = useCallback(async () => {
    try {
      const data = await getIpos({ status: category, ...(segment !== 'ALL' ? { segment } : {}), ...(search ? { search } : {}) });
      setIpos(data?.ipos || []);
      setError('');
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'IPO data is temporarily unavailable.');
      setIpos([]);
    } finally {
      setLoading(false);
    }
  }, [category, search, segment]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!active) return;
      await loadIpos();
    };

    load();
    return () => { active = false; };
  }, [loadIpos]);

  return (
    <main className="dashboard-main ipo-page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Primary market</p>
          <h1>IPO centre</h1>
          <p className="subtitle">Track public issues and prepare applications when a verified provider is connected.</p>
        </div>
        <span className="data-status-badge">Verified provider data</span>
      </section>

      <section className="panel ipo-notice" role="status">
        <div className="ipo-notice-icon" aria-hidden="true">i</div>
        <div>
          <h2>Indian IPOs, separated from listed stocks</h2>
          <p>IPO records, subscription figures, and applications come only from the configured authorized provider. Missing provider data is never replaced with examples.</p>
        </div>
      </section>

      <section className="panel">
        <div className="ipo-filter-row">
          <div className="segmented-control" aria-label="IPO status">
            {categories.map((item) => (
              <button key={item} type="button" className={category === item ? 'active' : ''} onClick={() => setCategory(item)} aria-pressed={category === item}>
                {item}
              </button>
            ))}
          </div>
          <div className="segmented-control" aria-label="IPO segment">
            {segments.map((item) => (
              <button key={item} type="button" className={segment === item ? 'active' : ''} onClick={() => setSegment(item)} aria-pressed={segment === item}>
                {item}
              </button>
            ))}
          </div>

          <input className="ipo-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search IPOs" aria-label="Search IPOs" />
        </div>

        {loading ? <div className="ipo-empty-state"><div className="inline-loading">Loading verified IPO data...</div></div> : error ? <div className="ipo-empty-state"><h2>Provider unavailable</h2><p>{error}</p><button type="button" className="secondary-button" onClick={() => { setLoading(true); loadIpos(); }}>Retry</button></div> : ipos.length === 0 ? <div className="ipo-empty-state">
          <div className="ipo-empty-mark" aria-hidden="true">—</div>
          <h2>Data unavailable</h2>
          <p>No verified IPO records are available for this lifecycle and segment.</p>
        </div> : <div className="ipo-card-grid">{ipos.map((ipo) => <article className="ipo-card" key={ipo.id}><div className="ipo-card-header"><div><h2>{display(ipo.name)}</h2><p>{display(ipo.issueType)} · {display(ipo.exchange)}</p></div><span className="ipo-status-pill">{display(ipo.status)}</span></div><div className="ipo-card-metrics"><div><span>Price band</span><strong>{ipo.priceBand?.min === null && ipo.priceBand?.max === null ? '—' : `${formatMoney(ipo.priceBand?.min)} – ${formatMoney(ipo.priceBand?.max)}`}</strong></div><div><span>Lot size</span><strong>{display(ipo.lotSize)}</strong></div><div><span>Issue size</span><strong>{display(ipo.issueSize)}</strong></div><div><span>Open / close</span><strong>{formatDate(ipo.dates?.biddingStart)} · {formatDate(ipo.dates?.biddingEnd)}</strong></div></div><div className="ipo-card-footer"><span>Subscription: {ipo.subscription ? 'Available' : 'Unavailable'}</span><Link className="secondary-button compact-button" to={`/ipo/${encodeURIComponent(ipo.id)}`}>View IPO</Link></div></article>)}</div>}
      </section>

      <section className="panel ipo-application-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Application workspace</p>
            <h2>Draft applications</h2>
          </div>
          <span className="muted-status">Broker integration required</span>
        </div>
          <p className="subtitle">Application submission is disabled until an authorized IPO/broker provider confirms support. No application IDs, allotments, or mandates are generated locally.</p>
        <div className="ipo-safety-grid">
          <span>Never request UPI PIN</span>
          <span>Never store OTPs</span>
          <span>Never claim allotment without confirmation</span>
        </div>
      </section>
    </main>
  );
};

export default IPO;
