import { useMemo, useState } from 'react';

import api from '../api/api';

const formatCurrency = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '₹0.00';
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(Number(value));
};

const TradeModal = ({
  isOpen,
  mode,
  stock,
  availableCash,
  onClose,
  onRefresh
}) => {
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentPrice = Number(stock?.currentPrice ?? 0);
  const ownedQuantity = Number(stock?.ownedQuantity ?? 0);
  const totalAmount = currentPrice * Number(quantity || 0);

  const maxAffordableQuantity = useMemo(() => {
    if (!currentPrice || currentPrice <= 0) {
      return 0;
    }

    return Math.floor(Number(availableCash || 0) / currentPrice);
  }, [availableCash, currentPrice]);

  if (!isOpen || !stock) {
    return null;
  }

  const validateQuantity = () => {
    const parsedQuantity = Number(quantity);

    if (!quantity || !Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      return 'Quantity must be a positive integer.';
    }

    if (mode === 'buy' && parsedQuantity > maxAffordableQuantity) {
      return 'Insufficient wallet balance.';
    }

    if (mode === 'sell' && parsedQuantity > ownedQuantity) {
      return 'Insufficient stock quantity.';
    }

    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationError = validateQuantity();

    if (validationError) {
      setError(validationError);
      setSuccessMessage('');
      return;
    }

    const requestPayload = {
      symbol: stock.symbol,
      quantity: Number(quantity)
    };

    setSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      const endpoint = mode === 'buy' ? '/portfolio/buy' : '/portfolio/sell';
      const response = await api.post(endpoint, requestPayload);

      const successText = response.data?.message ||
        (mode === 'buy' ? 'Purchase completed successfully.' : 'Sale completed successfully.');

      setSuccessMessage(successText);

      if (onRefresh) {
        await onRefresh();
      }

      setTimeout(() => {
        onClose();
      }, 700);
    } catch (submitError) {
      setSuccessMessage('');
      setError(submitError.response?.data?.message || 'Unable to complete the transaction. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="trade-modal" onClick={(event) => event.stopPropagation()}>
        <div className="trade-modal-header">
          <div>
            <p className="trade-modal-kicker">{mode === 'buy' ? 'Buy stock' : 'Sell stock'}</p>
            <h3>{stock.symbol}</h3>
          </div>
          <button type="button" className="close-modal-button" onClick={onClose} aria-label="Close trade dialog">
            ×
          </button>
        </div>

        <div className="trade-stock-summary">
          <div>
            <span>Company</span>
            <strong>{stock.companyName || 'Unknown company'}</strong>
          </div>
          <div>
            <span>Current price</span>
            <strong>{formatCurrency(currentPrice)}</strong>
          </div>
          <div>
            <span>{mode === 'buy' ? 'Available cash' : 'Owned quantity'}</span>
            <strong>
              {mode === 'buy'
                ? formatCurrency(availableCash)
                : `${ownedQuantity} shares`}
            </strong>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="trade-form">
          <div className="form-group trade-form-group">
            <label htmlFor="trade-quantity">Quantity</label>
            <input
              id="trade-quantity"
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="1"
            />
          </div>

          <div className="trade-total-row">
            <span>Total amount</span>
            <strong>{formatCurrency(totalAmount)}</strong>
          </div>

          {error ? <div className="inline-error">{error}</div> : null}
          {successMessage ? <div className="success-message">{successMessage}</div> : null}

          <div className="trade-actions">
            <button type="button" className="secondary-button" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? (mode === 'buy' ? 'Processing purchase...' : 'Processing sale...') : (mode === 'buy' ? 'Buy Shares' : 'Sell Shares')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TradeModal;
