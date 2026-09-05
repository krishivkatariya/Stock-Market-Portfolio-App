import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import api from '../api/api';
import TradeModal from '../components/TradeModal';
import { addRecentStock } from '../utils/recentStocks';
import { useAuth } from '../context/useAuth';
import {
  getStockQuote,
  getStockHistory
} from '../services/stockService';
import { addToWatchlist } from '../services/watchlistService';
import { subscribeToMarketSymbols } from '../services/marketStreamService';

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
});

const compactNumberFormatter = new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 2
});

const formatCurrency = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  return currencyFormatter.format(Number(value));
};

const formatSignedCurrency = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  return `${value >= 0 ? '+' : '-'}${currencyFormatter.format(Math.abs(Number(value)))}`;
};

const formatPercent = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  return `${Number(value).toFixed(2)}%`;
};

const formatCompactNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  return compactNumberFormatter.format(Number(value));
};

const formatChartDate = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short'
  }).format(date);
};

const formatChartTooltipDate = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  return date.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
};

const formatUpdatedTime = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

const friendlyErrorMessage = (error) => {
  if (error?.response?.status === 401) {
    return 'Your session has expired. Please log in again.';
  }

  if (error?.response?.status === 400) {
    return error.response?.data?.message ||
      'This stock could not be found or the request was invalid.';
  }

  if (error?.response?.status === 404) {
    return error.response?.data?.message ||
      'This stock could not be found.';
  }

  if (error?.request) {
    return 'Unable to reach the server. Please check your connection and try again.';
  }

  return error.response?.data?.message ||
    'Something went wrong. Please try again.';
};

const RANGE_OPTIONS = [
  { label: '1D', value: '1D' },
  { label: '1W', value: '1W' },
  { label: '1M', value: '1M' },
  { label: '3M', value: '3M' },
  { label: '6M', value: '6M' },
  { label: '1Y', value: '1Y' },
  { label: '5Y', value: '5Y' }
];

const calculateSma = (values, period) => values.map((value, index) => {
  if (index < period - 1) return null;
  const window = values.slice(index - period + 1, index + 1);
  return window.reduce((sum, item) => sum + item, 0) / period;
});

const calculateEma = (values, period) => {
  const multiplier = 2 / (period + 1);
  let previous = null;
  return values.map((value, index) => {
    if (index < period - 1) return null;
    if (previous === null) {
      previous = values.slice(index - period + 1, index + 1)
        .reduce((sum, item) => sum + item, 0) / period;
      return previous;
    }
    previous = (value - previous) * multiplier + previous;
    return previous;
  });
};

const calculateRsi = (values, period = 14) => values.map((_, index) => {
  if (index < period) return null;
  let gains = 0;
  let losses = 0;
  for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
    const change = values[cursor] - values[cursor - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }
  if (losses === 0) return 100;
  const relativeStrength = (gains / period) / (losses / period);
  return 100 - (100 / (1 + relativeStrength));
});

const calculateBollinger = (values, period = 20) => values.map((_, index) => {
  if (index < period - 1) return null;
  const window = values.slice(index - period + 1, index + 1);
  const mean = window.reduce((sum, value) => sum + value, 0) / period;
  const deviation = Math.sqrt(window.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / period);
  return { middle: mean, upper: mean + deviation * 2, lower: mean - deviation * 2 };
});

const calculateVwap = (points) => {
  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;

  return points.map((point) => {
    const high = Number(point.high ?? point.close);
    const low = Number(point.low ?? point.close);
    const close = Number(point.close);
    const volume = Number(point.volume);

    if (!Number.isFinite(volume) || volume <= 0) return null;

    cumulativePriceVolume += ((high + low + close) / 3) * volume;
    cumulativeVolume += volume;
    return cumulativePriceVolume / cumulativeVolume;
  });
};

const calculateMacd = (values) => {
  const fast = calculateEma(values, 12);
  const slow = calculateEma(values, 26);
  const macd = values.map((_, index) => (
    fast[index] === null || slow[index] === null ? null : fast[index] - slow[index]
  ));
  const definedMacd = macd.filter((value) => value !== null);
  const signalValues = calculateEma(definedMacd, 9);
  const signal = macd.map((value, index) => {
    if (value === null) return null;
    const definedIndex = macd.slice(0, index + 1).filter((item) => item !== null).length - 1;
    return signalValues[definedIndex] ?? null;
  });
  return { macd, signal };
};

const calculateAtr = (points, period = 10) => {
  const trueRanges = points.map((point, index) => {
    if (index === 0) return Number(point.high) - Number(point.low);
    const high = Number(point.high);
    const low = Number(point.low);
    const previousClose = Number(points[index - 1].close);
    return Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose));
  });

  return trueRanges.map((_, index) => {
    if (index < period - 1) return null;
    return trueRanges.slice(index - period + 1, index + 1)
      .reduce((sum, value) => sum + value, 0) / period;
  });
};

const calculateSupertrend = (points, period = 10, multiplier = 3) => {
  const atr = calculateAtr(points, period);
  let finalUpper = null;
  let finalLower = null;
  let direction = 1;

  return points.map((point, index) => {
    if (atr[index] === null) return null;
    const midpoint = (Number(point.high) + Number(point.low)) / 2;
    const upper = midpoint + multiplier * atr[index];
    const lower = midpoint - multiplier * atr[index];
    finalUpper = finalUpper === null || upper < finalUpper || Number(points[index - 1]?.close) > finalUpper ? upper : finalUpper;
    finalLower = finalLower === null || lower > finalLower || Number(points[index - 1]?.close) < finalLower ? lower : finalLower;
    if (direction === 1 && Number(point.close) < finalLower) direction = -1;
    if (direction === -1 && Number(point.close) > finalUpper) direction = 1;
    return direction === 1 ? finalLower : finalUpper;
  });
};

const PriceChart = ({ data, chartMode, indicators }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [viewport, setViewport] = useState({ start: 0, end: Math.max(0, (data?.length || 1) - 1) });
  const dragRef = useRef(null);
  const gradientId = `price-area-${useId().replace(/:/g, '')}`;
  const points = (data || []).filter((point) => Number.isFinite(Number(point.close)));
  const width = 900;
  const height = 460;
  const padX = 58;
  const padTop = 18;
  const plotW = width - padX - 16;
  const priceH = 300;
  const volumeTop = 338;
  const volumeH = 74;

  if (points.length === 0) return null;

  const visibleStart = Math.max(0, Math.min(viewport.start, points.length - 1));
  const visibleEnd = Math.max(visibleStart, Math.min(viewport.end, points.length - 1));
  const visiblePoints = points.slice(visibleStart, visibleEnd + 1);
  const values = visiblePoints.flatMap((point) => [Number(point.high), Number(point.low), Number(point.close)]);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = (rawMax - rawMin || 1) * 0.08;
  const minPrice = rawMin - padding;
  const maxPrice = rawMax + padding;
  const priceSpan = maxPrice - minPrice || 1;
  const maxVolume = Math.max(...visiblePoints.map((point) => Number(point.volume) || 0), 1);
  const closes = visiblePoints.map((point) => Number(point.close));
  const sma = calculateSma(closes, 20);
  const ema = calculateEma(closes, 20);
  const bollinger = calculateBollinger(closes);
  const rsi = calculateRsi(closes);
  const vwap = calculateVwap(visiblePoints);
  const macd = calculateMacd(closes);
  const supertrend = calculateSupertrend(visiblePoints);
  const pivotSource = visiblePoints.length > 1 ? visiblePoints[visiblePoints.length - 2] : null;
  const pivotLevels = pivotSource ? {
    pivot: (Number(pivotSource.high) + Number(pivotSource.low) + Number(pivotSource.close)) / 3,
    resistance: (2 * ((Number(pivotSource.high) + Number(pivotSource.low) + Number(pivotSource.close)) / 3)) - Number(pivotSource.low),
    support: (2 * ((Number(pivotSource.high) + Number(pivotSource.low) + Number(pivotSource.close)) / 3)) - Number(pivotSource.high)
  } : null;
  const toX = (index) => padX + (visiblePoints.length === 1 ? plotW / 2 : (index / (visiblePoints.length - 1)) * plotW);
  const toPriceY = (value) => padTop + (1 - (Number(value) - minPrice) / priceSpan) * priceH;
  const toVolumeY = (value) => volumeTop + volumeH - ((Number(value) || 0) / maxVolume) * volumeH;
  const candleWidth = Math.max(2, Math.min(14, (plotW / visiblePoints.length) * 0.62));
  const lineColor = Number(visiblePoints.at(-1).close) >= Number(visiblePoints[0].close) ? '#16a34a' : '#dc2626';
  const hoveredPoint = hoveredIndex === null ? null : visiblePoints[hoveredIndex];
  const yLines = Array.from({ length: 5 }, (_, index) => {
    const value = minPrice + (priceSpan * index) / 4;
    return { y: toPriceY(value), label: currencyFormatter.format(value).replace(/\.00$/, '') };
  });
  const drawIndicator = (valuesToDraw) => valuesToDraw.map((value, index) => value === null ? null : `${toX(index)},${toPriceY(value)}`).filter(Boolean).join(' ');
  const zoom = (direction) => {
    const currentSize = visibleEnd - visibleStart + 1;
    const nextSize = Math.max(12, Math.min(points.length, Math.round(currentSize * direction)));
    const center = Math.round((visibleStart + visibleEnd) / 2);
    setViewport({
      start: Math.max(0, center - Math.floor(nextSize / 2)),
      end: Math.min(points.length - 1, center + Math.ceil(nextSize / 2) - 1)
    });
  };

  return (
    <div className="chart-workspace">
      <div className="chart-toolbar" aria-label="Chart controls">
        <span className="chart-hint">Scroll to zoom · drag to pan</span>
        <button type="button" className="chart-control-button" onClick={() => zoom(0.7)} aria-label="Zoom in">+</button>
        <button type="button" className="chart-control-button" onClick={() => zoom(1.4)} aria-label="Zoom out">−</button>
        <button type="button" className="chart-control-button" onClick={() => setViewport({ start: 0, end: points.length - 1 })}>Reset</button>
      </div>
      <svg
        className="price-chart advanced-price-chart"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${chartMode === 'candle' ? 'Candlestick' : 'Line'} chart with volume`}
        onWheel={(event) => { event.preventDefault(); zoom(event.deltaY > 0 ? 1.2 : 0.8); }}
        onMouseDown={(event) => { dragRef.current = { x: event.clientX, start: visibleStart, end: visibleEnd }; }}
        onMouseMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const relativeX = Math.max(0, Math.min(plotW, ((event.clientX - bounds.left) / bounds.width) * width - padX));
          const nextIndex = Math.round((relativeX / plotW) * (visiblePoints.length - 1));
          setHoveredIndex(Math.max(0, Math.min(visiblePoints.length - 1, nextIndex)));
          if (dragRef.current) {
            const delta = Math.round(((dragRef.current.x - event.clientX) / bounds.width) * points.length);
            const size = dragRef.current.end - dragRef.current.start;
            const start = Math.max(0, Math.min(points.length - 1 - size, dragRef.current.start + delta));
            setViewport({ start, end: start + size });
          }
        }}
        onMouseUp={() => { dragRef.current = null; }}
        onMouseLeave={() => { setHoveredIndex(null); dragRef.current = null; }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.22" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {yLines.map((line) => (
          <g key={`grid-${line.y}`}>
            <line x1={padX} y1={line.y} x2={width - 16} y2={line.y} className="chart-grid-line" />
            <text x={4} y={line.y + 4} className="chart-y-label">{line.label}</text>
          </g>
        ))}
        <line x1={padX} y1={volumeTop - 10} x2={width - 16} y2={volumeTop - 10} className="chart-divider" />
        <text x={padX} y={volumeTop + 12} className="chart-volume-label">VOLUME</text>
        {visiblePoints.map((point, index) => {
          const open = Number(point.open ?? point.close);
          const high = Number(point.high ?? point.close);
          const low = Number(point.low ?? point.close);
          const close = Number(point.close);
          const rising = close > open;
          const falling = close < open;
          const candleColor = rising ? '#16a34a' : falling ? '#dc2626' : '#64748b';
          const bodyTop = toPriceY(Math.max(open, close));
          const bodyHeight = Math.max(1, Math.abs(toPriceY(open) - toPriceY(close)));
          return (
            <g key={`${point.date}-${index}`}>
              <rect x={toX(index) - candleWidth / 2} y={toVolumeY(point.volume)} width={candleWidth} height={volumeTop + volumeH - toVolumeY(point.volume)} fill={candleColor} opacity="0.35" />
              {chartMode === 'candle' ? <>
                <line x1={toX(index)} y1={toPriceY(high)} x2={toX(index)} y2={toPriceY(low)} stroke={candleColor} strokeWidth="1.5" />
                <rect x={toX(index) - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} fill={candleColor} />
              </> : null}
            </g>
          );
        })}
        {chartMode === 'line' ? <>
          <polygon points={`${padX},${priceH + padTop} ${visiblePoints.map((point, index) => `${toX(index)},${toPriceY(point.close)}`).join(' ')} ${width - 16},${priceH + padTop}`} fill={`url(#${gradientId})`} />
          <polyline points={visiblePoints.map((point, index) => `${toX(index)},${toPriceY(point.close)}`).join(' ')} fill="none" stroke={lineColor} strokeWidth="2.5" />
        </> : null}
        {indicators.sma ? <polyline points={drawIndicator(sma)} fill="none" className="chart-sma-line" /> : null}
        {indicators.ema ? <polyline points={drawIndicator(ema)} fill="none" className="chart-ema-line" /> : null}
        {indicators.bollinger ? <>
          <polyline points={drawIndicator(bollinger.map((item) => item?.upper))} fill="none" className="chart-bollinger-line" />
          <polyline points={drawIndicator(bollinger.map((item) => item?.lower))} fill="none" className="chart-bollinger-line" />
        </> : null}
        {indicators.vwap ? <polyline points={drawIndicator(vwap)} fill="none" className="chart-vwap-line" /> : null}
        {indicators.supertrend ? <polyline points={drawIndicator(supertrend)} fill="none" className="chart-supertrend-line" /> : null}
        {indicators.pivots && pivotLevels ? Object.entries(pivotLevels).map(([key, value]) => (
          <line key={key} x1={padX} y1={toPriceY(value)} x2={width - 16} y2={toPriceY(value)} className={`chart-pivot-line pivot-${key}`} />
        )) : null}
        {hoveredPoint ? <g pointerEvents="none">
          <line x1={toX(hoveredIndex)} y1={padTop} x2={toX(hoveredIndex)} y2={volumeTop + volumeH} className="chart-crosshair" />
          <g transform={`translate(${Math.min(toX(hoveredIndex) + 8, width - 190)} ${Math.max(toPriceY(hoveredPoint.close) - 64, 4)})`}>
            <rect width="182" height="58" rx="4" className="chart-tooltip-bg" />
            <text x="8" y="14" className="chart-tooltip-date">{formatChartTooltipDate(hoveredPoint.date)}</text>
            <text x="8" y="28" className="chart-tooltip-price">O {formatCurrency(hoveredPoint.open)} · H {formatCurrency(hoveredPoint.high)}</text>
            <text x="8" y="42" className="chart-tooltip-price">L {formatCurrency(hoveredPoint.low)} · C {formatCurrency(hoveredPoint.close)}</text>
            <text x="8" y="54" className="chart-tooltip-date">Volume {formatCompactNumber(hoveredPoint.volume)}</text>
          </g>
        </g> : null}
        {[0, Math.floor((visiblePoints.length - 1) / 2), visiblePoints.length - 1].map((index) => (
          <text key={`xlabel-${index}`} x={toX(index)} y={height - 8} textAnchor={index === 0 ? 'start' : index === visiblePoints.length - 1 ? 'end' : 'middle'} className="chart-x-label">{formatChartDate(visiblePoints[index].date)}</text>
        ))}
      </svg>
      <div className="indicator-readout">
        {indicators.rsi && rsi.some((value) => value !== null) ? <span>RSI(14): {rsi.at(-1)?.toFixed(1) ?? '—'}</span> : null}
        {indicators.macd && macd.macd.some((value) => value !== null) ? <span>MACD: {macd.macd.at(-1)?.toFixed(2) ?? '—'} / Signal {macd.signal.at(-1)?.toFixed(2) ?? '—'}</span> : null}
        {indicators.pivots && pivotLevels ? <span>Pivot: {formatCurrency(pivotLevels.pivot)}</span> : null}
      </div>
    </div>
  );
};
const StockDetails = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { symbol } = useParams();

  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [range, setRange] = useState('1M');
  const [chartMode, setChartMode] = useState('candle');
  const [indicators, setIndicators] = useState({
    sma: false,
    ema: false,
    rsi: false,
    bollinger: false,
    macd: false,
    vwap: false,
    supertrend: false,
    pivots: false
  });
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');

  const [availableCash, setAvailableCash] = useState(0);
  const [ownedQuantity, setOwnedQuantity] = useState(0);

  const [tradeState, setTradeState] = useState(null);

  const [addingToWatchlist, setAddingToWatchlist] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistMessage, setWatchlistMessage] = useState('');
  const [watchlistError, setWatchlistError] = useState('');

    // Live quote stream (shared marketStreamService, no new EventSource here).
  const [streamStatus, setStreamStatus] = useState('connecting');
  const [streamSession, setStreamSession] = useState(null); // 'open' | 'closed' | null
  const [lastLiveUpdate, setLastLiveUpdate] = useState(null);
  const [streamIssue, setStreamIssue] = useState(false);
  // Tracks whether the live price for this symbol came via Twelve Data WS
  // or REST fallback, so the status label can distinguish them.
  const [livePriceSource, setLivePriceSource] = useState(null);
  const historyCache = useRef(new Map());
  const historyRequestId = useRef(0);

  const fetchQuoteData = useCallback(async () => {
    try {
      const [quoteResponse, accountResponse, portfolioResponse] = await Promise.all([
        getStockQuote(symbol),
        api.get('/account'),
        api.get('/portfolio')
      ]);

      const quoteStock = quoteResponse?.stock || null;
      setStock(quoteStock);

      if (quoteStock?.symbol) {
        addRecentStock(quoteStock.symbol);
      }

      setAvailableCash(Number(accountResponse?.data?.account?.availableCash ?? 0));

      const holdings = portfolioResponse?.data?.portfolio?.stocks || [];
      const holding = holdings.find((item) => item.symbol === (quoteStock?.symbol || symbol));
      setOwnedQuantity(holding ? Number(holding.quantity ?? 0) : 0);
      setError('');
    } catch (fetchError) {
      if (fetchError?.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      setError(friendlyErrorMessage(fetchError));
    } finally {
      setLoading(false);
    }
  }, [symbol, logout, navigate]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!active) {
        return;
      }

      await fetchQuoteData();
    };

    load();

    return () => {
      active = false;
    };
  }, [fetchQuoteData]);

  // ---- Live price stream ----
  // Subscribes only to the current route symbol. When the user navigates
  // AAPL -> MSFT, this effect cleans up the old subscription and subscribes
  // to the new symbol automatically.
  useEffect(() => {
    let active = true;

    const unsubscribe = subscribeToMarketSymbols([symbol], {
      onMessage: (data) => {
        if (!active) {
          return;
        }
        const safeSymbol = String(symbol || '').trim().toUpperCase();
        const quote = data?.quotes?.[safeSymbol];

        // Only apply when the backend actually returned a fresh price
        // (placeholder quotes have price === null and are ignored).
        if (quote && quote.price !== null && quote.price !== undefined) {
          setStock((current) =>
            current
              ? {
                  ...current,
                  currentPrice: quote.price,
                  change: quote.change ?? current.change,
                  percentChange: quote.percentChange ?? current.percentChange
                }
              : current
          );
          setLivePriceSource(quote.source || null);
          setLastLiveUpdate(new Date());
        }

        if (data?.marketStatus === 'open' || data?.marketStatus === 'closed') {
          setStreamSession(data.marketStatus);
        }

        if (data?.status === 'error' || data?.status === 'stale') {
          setStreamIssue(true);
        } else if (data?.status) {
          setStreamIssue(false);
        }
      },
      onStatus: (next) => {
        if (active) {
          setStreamStatus(next);
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [symbol]);

  const fetchHistory = useCallback(async () => {
    const requestId = historyRequestId.current + 1;
    historyRequestId.current = requestId;
    const cacheKey = `${String(symbol).toUpperCase()}:${range}`;
    const cachedHistory = historyCache.current.get(cacheKey);

    if (cachedHistory) {
      setHistory(cachedHistory);
      setHistoryLoading(false);
      setHistoryError('');
      return;
    }

    try {
      const data = await getStockHistory(symbol, range);
      if (requestId !== historyRequestId.current) {
        return;
      }
      const nextHistory = data?.history || [];
      historyCache.current.set(cacheKey, nextHistory);
      setHistory(nextHistory);
      setHistoryError('');
    } catch (fetchError) {
      if (requestId !== historyRequestId.current) {
        return;
      }
      if (fetchError?.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      setHistoryError(friendlyErrorMessage(fetchError));
    } finally {
      setHistoryLoading(false);
    }
  }, [symbol, range, logout, navigate]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!active) {
        return;
      }

      await fetchHistory();
    };

    load();

    return () => {
      active = false;
    };
  }, [fetchHistory]);

  const handleRetry = () => {
    setLoading(true);
    setError('');
    fetchQuoteData();
  };

  const handleRangeChange = (nextRange) => {
    // fetchHistory re-runs via its useEffect when `range` changes.
    // Calling it directly here would use the stale `range` closure
    // and race with the effect's request.
    setRange(nextRange);
    setHistoryLoading(true);
    setHistoryError('');
  };

  const handleRetryHistory = () => {
    setHistoryLoading(true);
    setHistoryError('');
    fetchHistory();
  };

  const handleAddToWatchlist = async () => {
    if (!stock || addingToWatchlist || inWatchlist) {
      return;
    }

    setAddingToWatchlist(true);
    setWatchlistMessage('');
    setWatchlistError('');

    try {
      await addToWatchlist(stock.symbol);
      setInWatchlist(true);
      setWatchlistMessage(`${stock.symbol} added to your watchlist.`);
    } catch (addError) {
      if (addError?.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      setWatchlistError(
        addError?.response?.data?.message ||
          'Unable to add this stock to your watchlist. Please try again.'
      );
    } finally {
      setAddingToWatchlist(false);
    }
  };

  const openTrade = (mode) => {
    if (!stock) {
      return;
    }

    setTradeState({
      mode,
      stock: {
        symbol: stock.symbol,
        companyName: stock.companyName,
        currentPrice: stock.currentPrice,
        ownedQuantity
      }
    });
  };

  const closeTrade = () => {
    setTradeState(null);
  };

  // Live-status indicator state for the price section.
  const liveStatus = useMemo(() => {
    if (streamStatus === 'connecting') {
      return { dot: 'connecting', label: 'Connecting…' };
    }

    if (streamStatus === 'reconnecting') {
      return { dot: 'reconnecting', label: 'Reconnecting…' };
    }

    if (streamStatus === 'error') {
      return { dot: 'error', label: 'Market data unavailable' };
    }

    if (streamStatus === 'connected') {
      if (streamSession === 'closed') {
        return { dot: 'closed', label: 'Market closed' };
      }

      if (streamIssue) {
        return { dot: 'connecting', label: 'Market data temporarily unavailable' };
      }

      if (livePriceSource === 'twelve_data_ws') {
        return { dot: 'live', label: 'Live (Twelve Data WS)' };
      }

      if (livePriceSource === 'rest_fallback') {
        return { dot: 'delayed', label: 'Delayed (REST Fallback)' };
      }

      return { dot: 'live', label: 'Live' };
    }

    return { dot: 'connecting', label: 'Connecting…' };
  }, [streamStatus, streamSession, streamIssue, livePriceSource]);

  const refreshAfterTrade = useCallback(async () => {
    try {
      const [accountResponse, portfolioResponse] = await Promise.all([
        api.get('/account'),
        api.get('/portfolio')
      ]);

      setAvailableCash(Number(accountResponse?.data?.account?.availableCash ?? 0));

      const holdings = portfolioResponse?.data?.portfolio?.stocks || [];
      const holding = holdings.find((item) => item.symbol === (stock?.symbol || symbol));
      setOwnedQuantity(holding ? Number(holding.quantity ?? 0) : 0);
    } catch (refreshError) {
      if (refreshError?.response?.status === 401) {
        logout();
        navigate('/login');
      }
    }
  }, [stock, symbol, logout, navigate]);

  return (
    <div className="dashboard-app">
      <main className="dashboard-main">
        <section className="page-header stock-details-header">
          <Link to="/dashboard" className="text-button back-link">
            ← Back to Dashboard
          </Link>
          <p className="eyebrow">Stock Details</p>
          <h1>{stock?.symbol || symbol}</h1>
          <p className="subtitle">
            {stock?.companyName || 'Loading company information...'}
          </p>
        </section>

        {loading ? (
          <section className="panel">
            <div className="inline-loading">Loading stock details...</div>
          </section>
        ) : error ? (
          <section className="panel">
            <div className="inline-error">
              {error}
              <button type="button" className="text-button" onClick={handleRetry}>
                Retry
              </button>
            </div>
          </section>
        ) : stock ? (
          <>
            <section className="panel">
              <div className="stock-price-section">
                <h2 className="stock-details-price">
                  {formatCurrency(stock.currentPrice)}
                </h2>
                <span className={Number(stock.change) >= 0 ? 'positive-text' : 'negative-text'}>
                  {formatSignedCurrency(stock.change)} ({formatPercent(stock.percentChange)})
                </span>

                <div className="market-status-wrap">
                  <span className={`market-status-dot ${liveStatus.dot}`} aria-hidden="true" />
                  <span className="market-status-text" aria-live="polite">
                    {liveStatus.label}
                  </span>
                  {lastLiveUpdate ? (
                    <span className="market-updated">
                      Last updated: {formatUpdatedTime(lastLiveUpdate)}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="stock-details-actions">
                <button
                  type="button"
                  className="primary-button quote-action-button"
                  onClick={() => openTrade('buy')}
                >
                  Buy
                </button>
                <button
                  type="button"
                  className="secondary-button quote-action-button"
                  onClick={() => openTrade('sell')}
                  disabled={ownedQuantity <= 0}
                >
                  Sell
                </button>
                <button
                  type="button"
                  className="warning-button quote-action-button"
                  onClick={handleAddToWatchlist}
                  disabled={addingToWatchlist || inWatchlist}
                >
                  {inWatchlist
                    ? 'In Watchlist ✓'
                    : addingToWatchlist
                      ? 'Adding...'
                      : 'Add to Watchlist'}
                </button>
              </div>

              {watchlistMessage ? (
                <div className="success-message watchlist-inline-message">
                  {watchlistMessage}
                </div>
              ) : null}

              {watchlistError ? (
                <div className="inline-error watchlist-inline-message">
                  {watchlistError}
                </div>
              ) : null}
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>Price History</h2>
                <div className="chart-controls-stack">
                  <div className="chart-range-selector" aria-label="Chart time range">
                    {RANGE_OPTIONS.map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        className={`range-button ${range === option.value ? 'active' : ''}`}
                        onClick={() => handleRangeChange(option.value)}
                        disabled={historyLoading}
                        aria-pressed={range === option.value}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="chart-mode-selector" aria-label="Chart type">
                    {['candle', 'line'].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`chart-mode-button ${chartMode === mode ? 'active' : ''}`}
                        onClick={() => setChartMode(mode)}
                        aria-pressed={chartMode === mode}
                      >
                        {mode === 'candle' ? 'Candles' : 'Line'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="indicator-selector" aria-label="Technical indicators">
                {[
                  ['sma', 'SMA 20'],
                  ['ema', 'EMA 20'],
                  ['bollinger', 'Bollinger'],
                  ['rsi', 'RSI 14'],
                  ['macd', 'MACD'],
                  ['vwap', 'VWAP'],
                  ['supertrend', 'Supertrend'],
                  ['pivots', 'Pivot points']
                ].map(([key, label]) => (
                  <label key={key} className="indicator-toggle">
                    <input
                      type="checkbox"
                      checked={indicators[key]}
                      onChange={() => setIndicators((current) => ({ ...current, [key]: !current[key] }))}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>

              {historyLoading ? (
                <div className="inline-loading">Loading price history...</div>
              ) : historyError ? (
                <div className="inline-error">
                  {historyError}
                  <button
                    type="button"
                    className="text-button"
                    onClick={handleRetryHistory}
                  >
                    Retry
                  </button>
                </div>
              ) : history.length === 0 ? (
                <div className="empty-notes">
                  No historical data available for this range.
                </div>
              ) : (
                <PriceChart data={history} chartMode={chartMode} indicators={indicators} />
              )}
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>Market Metrics</h2>
              </div>

              <div className="quote-grid">
                <div className="metric-box">
                  <span>Open</span>
                  <strong>{formatCurrency(stock.open)}</strong>
                </div>
                <div className="metric-box">
                  <span>High</span>
                  <strong>{formatCurrency(stock.high)}</strong>
                </div>
                <div className="metric-box">
                  <span>Low</span>
                  <strong>{formatCurrency(stock.low)}</strong>
                </div>
                <div className="metric-box">
                  <span>Previous Close</span>
                  <strong>{formatCurrency(stock.previousClose)}</strong>
                </div>
                <div className="metric-box">
                  <span>Volume</span>
                  <strong>{formatCompactNumber(stock.volume)}</strong>
                </div>
                <div className="metric-box">
                  <span>Market Cap</span>
                  <strong>{formatCompactNumber(stock.marketCap)}</strong>
                </div>
                <div className="metric-box">
                  <span>Your Shares</span>
                  <strong>{ownedQuantity}</strong>
                </div>
                <div className="metric-box">
                  <span>Available Cash</span>
                  <strong>{formatCurrency(availableCash)}</strong>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </main>

      {tradeState ? (
        <TradeModal
          key={`${tradeState.stock.symbol}-${tradeState.mode}`}
          isOpen
          mode={tradeState.mode}
          stock={tradeState.stock}
          availableCash={availableCash}
          onClose={closeTrade}
          onRefresh={refreshAfterTrade}
        />
      ) : null}
    </div>
  );
};

export default StockDetails;