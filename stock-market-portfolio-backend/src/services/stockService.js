const YahooFinance = require('yahoo-finance2').default;

const yahooFinance = new YahooFinance();

const normalizeSymbol = (symbol) => {
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Stock symbol is required');
  }

  const cleanSymbol = symbol.trim().toUpperCase();

  if (!cleanSymbol) {
    throw new Error('Stock symbol is required');
  }

  if (!/^[A-Z0-9.^-]+$/.test(cleanSymbol)) {
    throw new Error(`Invalid stock symbol: ${symbol}`);
  }

  if (cleanSymbol.includes('.')) {
    return cleanSymbol;
  }

  return cleanSymbol;
};

// Search stocks
const searchStocks = async (query) => {
  const cleanQuery = query?.trim();

  if (!cleanQuery) {
    throw new Error('Search query is required');
  }

  const results = await yahooFinance.search(cleanQuery);
  return results;
};

// Get current stock quote
const getStockQuote = async (symbol) => {
  const yahooSymbol = normalizeSymbol(symbol);

  const quote = await yahooFinance.quote(yahooSymbol);

  if (!quote || !quote.symbol) {
    throw new Error(`Unsupported or invalid symbol: ${symbol}`);
  }

  return quote;
};

// Get historical stock data
const getHistoricalData = async (
  symbol,
  period1,
  period2,
  interval = '1d'
) => {
  const yahooSymbol = normalizeSymbol(symbol);

  let historicalData;

  const chartResult = async () => {
    const result = await yahooFinance.chart(
      yahooSymbol,
      {
        period1,
        period2,
        interval
      }
    );

    return (result?.quotes || []).filter(
      (row) =>
        row &&
        row.date &&
        row.close !== null &&
        row.close !== undefined
    );
  };

  // yahooFinance.historical only accepts daily/weekly/monthly intervals in
  // v4. Use chart directly for intraday ranges such as 1D and 1W.
  if (!['1d', '1wk', '1mo'].includes(interval)) {
    return chartResult();
  }

  try {
    historicalData = await yahooFinance.historical(
      yahooSymbol,
      {
        period1,
        period2,
        interval
      }
    );
  } catch (error) {
    // yahoo-finance2 throws when a row has SOME (but not all) null values.
    // This happens whenever the current trading day is still in progress
    // (close/adjclose not yet available), which breaks the price chart
    // during market hours. Fall back to the raw chart endpoint and drop
    // partially-null rows ourselves.
    if (
      !String(error?.message || '').includes(
        'SOME (but not all) null values'
      )
    ) {
      throw error;
    }

    historicalData = await chartResult();
  }

  return historicalData;
};

module.exports = {
  searchStocks,
  getStockQuote,
  getHistoricalData,
  normalizeSymbol
};