const express = require('express');
const puppeteer = require('puppeteer');
const cookieParser = require('cookie-parser');
const app = express();
const port = 3000;

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


app.get('/', (req, res) => {
  const searchResults = null;
  const watchlist = getWatchlist(req.cookies.watchlist);
  res.render('index', { searchResults, watchlist, loading: false, error: null });
});

app.post('/scrape', async (req, res) => {
  const productName = req.body.productName;

  if (!productName) {
    const searchResults = 'Please provide a product name.';
    const watchlist = getWatchlist(req.cookies.watchlist);
    return res.render('index', { searchResults, watchlist, loading: false, error: null });
  }

  try {
    const amazonSearchResults = await searchAmazon(productName);
    const watchlist = getWatchlist(req.cookies.watchlist);
    const searchResults = amazonSearchResults.map(product => {
      const isInWatchlist = watchlist.hasOwnProperty(product.title);
      return { ...product, isInWatchlist };
    });

    res.render('index', { searchResults, watchlist, loading: false, error: null });
  } catch (error) {
    console.error('Error during scraping:', error);
    res.render('index', { searchResults: null, watchlist: null, loading: false, error: 'Error during scraping. Please try again.' });
  }
});

app.get('/wishlist', (req, res) => {
  const watchlist = getWatchlist(req.cookies.watchlist);
  res.render('wishlist', { watchlist });
});

app.get('/addToWatchlist', (req, res) => {
  const productName = req.query.productName;
  const productData = req.query.productData;

  if (!productName || !productData) {
    return res.status(400).json({ error: 'Invalid parameters.' });
  }

  try {
    const watchlist = getWatchlist(req.cookies.watchlist);
    watchlist[productName] = { data: JSON.parse(productData), timestamp: new Date() };
    res.cookie('watchlist', JSON.stringify(watchlist));
    res.json({ success: true, watchlist });
  } catch (error) {
    console.error('Error adding to watchlist:', error);
    res.status(500).json({ error: 'Error adding to watchlist. Please try again.' });
  }
});

app.get('/revokeWatch', (req, res) => {
  const productName = req.query.productName;

  if (!productName) {
    return res.status(400).json({ error: 'Invalid parameters.' });
  }

  try {
    const watchlist = getWatchlist(req.cookies.watchlist);
    delete watchlist[productName];
    res.cookie('watchlist', JSON.stringify(watchlist));
    res.json({ success: true, watchlist });
  } catch (error) {
    console.error('Error revoking from watchlist:', error);
    res.status(500).json({ error: 'Error revoking from watchlist. Please try again.' });
  }
});

function getWatchlist(cookieData) {
  let watchlist;

  if (typeof cookieData === 'string') {
    watchlist = JSON.parse(cookieData || '{}');
  } else {
    watchlist = cookieData || {};
  }
  Object.values(watchlist).forEach(item => {
    item.timestamp = new Date(item.timestamp);
  });

  return watchlist;
}

async function searchAmazon(productName) {
  const browser = await puppeteer.launch({
    headless:"new"
  });
  const page = await browser.newPage();
  await page.goto(`https://www.amazon.in/s?k=${productName}`);

  const results = await page.evaluate(() => {
    const products = document.querySelectorAll('.s-result-item');

    return Array.from(products).map(product => {
      const titleElement = product.querySelector('h2 a');
      const priceElement = product.querySelector('.a-offscreen');
      const ratingElement = product.querySelector('.a-icon-star-small .a-icon-alt');
      const imageElement = product.querySelector('.s-image');

      const title = titleElement ? titleElement.innerText.trim() : null;
      const price = priceElement ? priceElement.innerText.trim() : null;
      const rating = ratingElement ? ratingElement.innerText.trim() : null;
      const image = imageElement ? imageElement.src : null;

      if (title && price && rating && image) {
        return { title, price, rating, image };
      }

      return null;
    }).filter(Boolean);
  });

  await browser.close();
  return results;
}

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
