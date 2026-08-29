const YahooFinance = require('yahoo-finance2').default;

const yahooFinance = new YahooFinance();


// Convert user symbol to Yahoo Finance NSE symbol
const getYahooSymbol = (symbol) => {
  const cleanSymbol = symbol.toUpperCase();

  // Already contains exchange
  if (cleanSymbol.includes('.')) {
    return cleanSymbol;
  }

  // Default to NSE
  return `${cleanSymbol}.NS`;
};


// Search stocks
const searchStocks = async (query) => {
  const results = await yahooFinance.search(query);

  return results;
};


// Get current stock quote
const getStockQuote = async (symbol) => {
  const yahooSymbol = getYahooSymbol(symbol);

  const quote = await yahooFinance.quote(yahooSymbol);

  return quote;
};


// Get historical stock data
const getHistoricalData = async (
  symbol,
  period1,
  period2
) => {
  const yahooSymbol = getYahooSymbol(symbol);

  const historicalData = await yahooFinance.historical(
    yahooSymbol,
    {
      period1,
      period2,
      interval: '1d'
    }
  );

  return historicalData;
};


module.exports = {
  searchStocks,
  getStockQuote,
  getHistoricalData
};