import { useState } from 'react';

const categories = ['OPEN', 'UPCOMING', 'RECENTLY CLOSED'];
const segments = ['MAINBOARD', 'SME'];

const IPO = () => {
  const [category, setCategory] = useState('OPEN');
  const [segment, setSegment] = useState('MAINBOARD');

  return (
    <main className="dashboard-main ipo-page">
      <section className="page-header">
        <div>
          <p className="eyebrow">Primary market</p>
          <h1>IPO centre</h1>
          <p className="subtitle">Track public issues and prepare applications when a verified provider is connected.</p>
        </div>
        <span className="data-status-badge">Provider unavailable</span>
      </section>

      <section className="panel ipo-notice" role="status">
        <div className="ipo-notice-icon" aria-hidden="true">i</div>
        <div>
          <h2>IPO application integration is not connected</h2>
          <p>StockPilot will not display, submit, or claim IPO data until an authorized broker or ASBA provider is configured.</p>
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
        </div>

        <div className="ipo-empty-state">
          <div className="ipo-empty-mark" aria-hidden="true">—</div>
          <h2>Data unavailable</h2>
          <p>No verified {segment.toLowerCase()} IPO data is connected for {category.toLowerCase()} issues.</p>
          <button type="button" className="secondary-button" disabled>Prepare application</button>
        </div>
      </section>

      <section className="panel ipo-application-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Application workspace</p>
            <h2>Draft applications</h2>
          </div>
          <span className="muted-status">Broker integration required</span>
        </div>
        <p className="subtitle">Draft preparation can be added once an authorized provider supplies price bands, lot sizes, investor categories, and application status.</p>
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
