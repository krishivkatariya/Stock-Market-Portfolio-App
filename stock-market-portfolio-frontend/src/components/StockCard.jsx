import { Link } from 'react-router-dom';

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
});

const StockCard = ({ symbol, companyName, price, change, percentChange, isLive }) => {
  const numericChange = Number(change);
  const hasChange = change !== null && change !== undefined && !Number.isNaN(numericChange);
  const isPositive = hasChange && numericChange >= 0;
  const numericPrice = Number(price);
  const hasPrice = price !== null && price !== undefined && !Number.isNaN(numericPrice);

  return (
    <Link to={`/stock/${encodeURIComponent(symbol)}`} className="stock-card">
      <span className="stock-card-top">
        <span className="stock-card-symbol">{symbol}</span>
        {isLive ? (
          <span className="live-badge" title="Live (Twelve Data WebSocket)">
            LIVE
          </span>
        ) : null}
      </span>
      <span className="stock-card-name">{companyName || symbol}</span>
      <span className="stock-card-price">
        {hasPrice ? currencyFormatter.format(numericPrice) : 'N/A'}
      </span>
      {hasChange ? (
        <span className={`stock-card-change ${isPositive ? 'positive-text' : 'negative-text'}`}>
          {isPositive ? '+' : ''}
          {Number(percentChange ?? 0).toFixed(2)}%
        </span>
      ) : (
        <span className="stock-card-change stock-card-change-muted">--</span>
      )}
    </Link>
  );
};

export default StockCard;