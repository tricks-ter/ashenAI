/**
 * Multi-Tier Real-Time Web Search & Financial Grounding Engine
 * 1. Live Stock & Crypto Financial Market Quotes (Yahoo Finance & CoinGecko)
 * 2. Real-Time News Feeds (Google News RSS & HackerNews)
 * 3. General Web Search (Tavily AI / Brave / Jina / DuckDuckGo)
 * 4. Direct Webpage Scraper (Jina Reader)
 */

import { logger } from './logger';

// Popular Stock Ticker Map
const STOCK_TICKERS = {
  'nvidia': 'NVDA', 'nvda': 'NVDA',
  'apple': 'AAPL', 'aapl': 'AAPL',
  'microsoft': 'MSFT', 'msft': 'MSFT',
  'google': 'GOOGL', 'alphabet': 'GOOGL', 'googl': 'GOOGL', 'goog': 'GOOG',
  'amazon': 'AMZN', 'amzn': 'AMZN',
  'tesla': 'TSLA', 'tsla': 'TSLA',
  'meta': 'META', 'facebook': 'META',
  'amd': 'AMD', 'intel': 'INTC', 'intc': 'INTC',
  'qualcomm': 'QCOM', 'qcom': 'QCOM',
  'arm': 'ARM', 'broadcom': 'AVGO', 'tsmc': 'TSM'
};

const CRYPTO_TICKERS = {
  'bitcoin': 'bitcoin', 'btc': 'bitcoin',
  'ethereum': 'ethereum', 'eth': 'ethereum',
  'solana': 'solana', 'sol': 'solana',
  'dogecoin': 'dogecoin', 'doge': 'dogecoin',
  'binance': 'binancecoin', 'bnb': 'binancecoin',
  'cardano': 'cardano', 'ada': 'cardano',
  'ripple': 'ripple', 'xrp': 'ripple'
};

export function extractUrlsFromText(text) {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  return text.match(urlRegex) || [];
}

export function shouldAutoSearchWeb(text) {
  if (!text) return false;
  const q = text.toLowerCase();

  // 1. Direct URLs in query
  if (extractUrlsFromText(text).length > 0) return true;

  // 2. Stock queries
  for (const sym of Object.keys(STOCK_TICKERS)) {
    if (new RegExp(`\\b${sym}\\b`, 'i').test(q)) {
      if (/(stock|share|price|market|valuation|earning|revenue|quarter|ticker|quote|nasdaq|nyse|cap|chart)/i.test(q)) {
        return true;
      }
    }
  }

  // 3. Crypto queries
  for (const sym of Object.keys(CRYPTO_TICKERS)) {
    if (new RegExp(`\\b${sym}\\b`, 'i').test(q)) {
      if (/(crypto|coin|price|token|market|cap|worth|btc|eth|sol)/i.test(q)) {
        return true;
      }
    }
  }

  // 4. Real-time / News / Current events triggers
  const searchTriggers = [
    /\b(search|google|look up|find out|browse|check online)\b/i,
    /\b(latest|breaking|news|today|tonight|current|recent|updates?|happening|headlines?)\b/i,
    /\b(who is the current|what is the price|weather in|election|winner|championship|score)\b/i,
    /\b(2025|2026|2027)\b/i,
    /\b(stock price|market cap|all time high|ath|release date|patch notes)\b/i
  ];

  return searchTriggers.some(pattern => pattern.test(q));
}

// 1. Fetch Real-Time Stock Market Data from Yahoo Finance
export async function fetchLiveStockQuote(query) {
  const q = query.toLowerCase();
  let ticker = null;

  // Find matching ticker in query
  for (const [name, sym] of Object.entries(STOCK_TICKERS)) {
    const wordRegex = new RegExp(`\\b${name}\\b`, 'i');
    if (wordRegex.test(q)) {
      ticker = sym;
      break;
    }
  }

  if (!ticker) return null;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (res.ok) {
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (meta && meta.regularMarketPrice) {
        const price = meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose || meta.previousClose || price;
        const change = (price - prevClose).toFixed(2);
        const changePct = (((price - prevClose) / prevClose) * 100).toFixed(2);
        const currency = meta.currency || 'USD';
        const marketTime = meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toUTCString() : new Date().toUTCString();

        return {
          title: `${meta.symbol} Live Stock Quote (${meta.shortName || meta.symbol})`,
          url: `https://finance.yahoo.com/quote/${meta.symbol}`,
          type: 'financial_quote',
          content: `TICKER: ${meta.symbol}\nCURRENT PRICE: ${currency} $${price.toFixed(2)}\nCHANGE: ${change >= 0 ? '+' : ''}${change} (${changePct}%)\nPREVIOUS CLOSE: $${prevClose.toFixed(2)}\nMARKET: ${meta.exchangeName || 'NASDAQ/NYSE'}\nTIMESTAMP: ${marketTime}`
        };
      }
    }
  } catch (err) {
    console.warn('Yahoo Finance quote fetch error:', err);
  }
  return null;
}

// 2. Fetch Real-Time Crypto Data from CoinGecko
export async function fetchLiveCryptoQuote(query) {
  const q = query.toLowerCase();
  let cryptoId = null;

  for (const [name, id] of Object.entries(CRYPTO_TICKERS)) {
    const wordRegex = new RegExp(`\\b${name}\\b`, 'i');
    if (wordRegex.test(q)) {
      cryptoId = id;
      break;
    }
  }

  if (!cryptoId) return null;

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (res.ok) {
      const data = await res.json();
      const coin = data[cryptoId];
      if (coin && coin.usd) {
        return {
          title: `${cryptoId.toUpperCase()} Live Crypto Price`,
          url: `https://www.coingecko.com/en/coins/${cryptoId}`,
          type: 'crypto_quote',
          content: `ASSET: ${cryptoId.toUpperCase()}\nPRICE: USD $${coin.usd.toLocaleString()}\n24H CHANGE: ${(coin.usd_24h_change || 0).toFixed(2)}%\nMARKET CAP: $${(coin.usd_market_cap || 0).toLocaleString()}\nTIMESTAMP: ${new Date().toUTCString()}`
        };
      }
    }
  } catch (err) {
    console.warn('CoinGecko quote fetch error:', err);
  }
  return null;
}

// 3. Fetch Real-Time News from Google News RSS
export async function fetchGoogleNews(query, maxItems = 4) {
  try {
    const cleanQ = query.replace(/(search for|tell me about|what is the latest|news on|stock price of)/gi, '').trim();
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(cleanQ)}&hl=en-US&gl=US&ceid=US:en`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    
    const res = await fetch(rssUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (res.ok) {
      const xmlText = await res.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      const items = xmlDoc.querySelectorAll('item');
      
      const newsResults = [];
      items.forEach((item, idx) => {
        if (idx < maxItems) {
          const title = item.querySelector('title')?.textContent || 'News Headline';
          const link = item.querySelector('link')?.textContent || 'https://news.google.com';
          const pubDate = item.querySelector('pubDate')?.textContent || '';
          const source = item.querySelector('source')?.textContent || 'News';
          
          newsResults.push({
            title: title.replace(/ - [^-]+$/, ''),
            url: link,
            type: 'news_article',
            content: `HEADLINE: ${title}\nSOURCE: ${source}\nDATE PUBLISHED: ${pubDate}\nLINK: ${link}`
          });
        }
      });
      return newsResults;
    }
  } catch (err) {
    console.warn('Google News RSS fetch error:', err);
  }
  return [];
}

// 4. Scrape Direct Webpage via Jina Reader
export async function scrapeUrlContent(url) {
  try {
    const cleanUrl = url.trim().replace(/^<|>$/g, '');
    const jinaUrl = `https://r.jina.ai/${cleanUrl}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const res = await fetch(jinaUrl, {
      headers: { 'Accept': 'text/plain', 'X-No-Cache': 'true' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (res.ok) {
      const text = await res.text();
      const truncated = text.slice(0, 3000);
      let title = cleanUrl;
      const titleMatch = text.match(/^Title:\s*(.+)$/m);
      if (titleMatch) title = titleMatch[1].trim();
      
      return {
        title,
        url: cleanUrl,
        type: 'scraped_page',
        content: truncated,
        snippet: truncated.slice(0, 240) + '...'
      };
    }
  } catch (err) {
    console.warn(`Failed to scrape ${url}:`, err);
  }
  return null;
}

// 5. Query Tavily Search API if user provided a Tavily Key in settings
export async function searchTavily(query, apiKey) {
  if (!apiKey) return [];
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        include_answer: true,
        max_results: 5
      })
    });
    if (res.ok) {
      const data = await res.json();
      return (data.results || []).map(r => ({
        title: r.title,
        url: r.url,
        type: 'tavily_search',
        content: `TITLE: ${r.title}\nURL: ${r.url}\nCONTENT: ${r.content}`
      }));
    }
  } catch (e) {
    console.warn('Tavily search error:', e);
  }
  return [];
}

// Main Multi-Tier Search Coordinator
export async function performWebSearch(query, tavilyApiKey = '', maxResults = 5) {
  logger.info('SEARCH', `Initiating real-time web search for: "${query}"`);
  const results = [];

  // 1. Direct URLs in query
  const directUrls = extractUrlsFromText(query);
  if (directUrls.length > 0) {
    logger.info('SEARCH', `Detected ${directUrls.length} direct URLs to scrape`);
    for (const url of directUrls.slice(0, 2)) {
      const scraped = await scrapeUrlContent(url);
      if (scraped) results.push(scraped);
    }
  }

  // 2. Real-time Stock / Crypto Quotes (Yahoo Finance & CoinGecko)
  const stockQuote = await fetchLiveStockQuote(query);
  if (stockQuote) {
    logger.info('SEARCH', `Found stock quote: ${stockQuote.title}`);
    results.push(stockQuote);
  }

  const cryptoQuote = await fetchLiveCryptoQuote(query);
  if (cryptoQuote) {
    logger.info('SEARCH', `Found crypto quote: ${cryptoQuote.title}`);
    results.push(cryptoQuote);
  }

  // 3. Tavily Search API (if key configured)
  if (tavilyApiKey) {
    logger.info('SEARCH', 'Querying Tavily AI Search API...');
    const tavilyResults = await searchTavily(query, tavilyApiKey);
    if (tavilyResults.length > 0) {
      logger.info('SEARCH', `Tavily returned ${tavilyResults.length} search results`);
      results.push(...tavilyResults);
    }
  }

  // 4. Google News RSS for real-time news & recent events
  if (results.length < maxResults) {
    const newsItems = await fetchGoogleNews(query, maxResults - results.length);
    if (newsItems.length > 0) {
      logger.info('SEARCH', `Google News RSS retrieved ${newsItems.length} news articles`);
      results.push(...newsItems);
    }
  }

  const finalResults = results.slice(0, maxResults);
  logger.info('SEARCH', `Web search finished. Found ${finalResults.length} grounded sources`, {
    query,
    sourcesCount: finalResults.length,
    sources: finalResults.map(s => ({ title: s.title, url: s.url, type: s.type }))
  });

  return finalResults;
}

// Build Strict Grounding Context for LLM with Anti-Hallucination Guardrails
export function buildGroundingContext(sources) {
  if (!sources || sources.length === 0) return '';
  
  let context = `\n\n=================================================================\n`;
  context += `[LIVE REAL-TIME INTERNET DATA & FINANCIAL QUOTES]\n`;
  context += `Retrieved on: ${new Date().toUTCString()}\n`;
  context += `=================================================================\n`;
  
  sources.forEach((src, idx) => {
    context += `\n[Source ${idx + 1}]: ${src.title}\nURL: ${src.url}\nDATA:\n${src.content}\n`;
  });
  
  context += `\n=================================================================\n`;
  context += `STRICT ANTI-HALLUCINATION INSTRUCTIONS:\n`;
  context += `1. You MUST state the EXACT numbers, prices, and facts from the [LIVE DATA] above.\n`;
  context += `2. Today's date is: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.\n`;
  context += `3. Always cite sources with markdown links [Source Title](URL).\n`;
  context += `4. NEVER invent fake dates, fake prices, or fake news.\n`;
  context += `=================================================================\n\n`;
  
  return context;
}
