const puppeteer = require('puppeteer-core');

// SEPERATOR "<*>"
const SEPARATOR_RE = new RegExp(/\n<\*>[\n]?/);
const SEPARATOR_QUERY = '%0A<*>%0A'; //length: 9 + 2('\n') = 11;
const SEPARATOR_LEN = 11;

const CHARACTER_LIMIT = 4900; // Google Page limit is 5000, use this for security

const URL = 'https://translate.google.com/?source=osdd#view=home&op=translate';

// "%" replace for Google bug "<$>"
const PERCENT_REPLACE = '<$>';
const PERCENT_REPLACE_RE = new RegExp(/\s<\$>/, 'g'); // include added space on translation

// include Google % Bug handle
function rebuildText(text) {
  // Split by SEPARATOR and remove last (empty) element
  return text
    .replace(PERCENT_REPLACE_RE, '%') // remove space added
    .split(SEPARATOR_RE)
    .slice(0, -1);
}

// a workaround Google Translate Webpage bug on encoded URLs that include texts with %
function myencodeURIComponent(text) {
  return encodeURIComponent(text.replace(new RegExp('%', 'g'), PERCENT_REPLACE));
}

// Query Example
// "https://translate.google.com/?source=osdd#view=home&op=translate&sl=en&tl=es&text=google%20translate%0A%0Apencil%0A%0Acrazy",
function buildQueryURL(text, sl, tl) {
  let url = `${URL}&sl=${sl}&tl=${tl}&text=`;
  let querys = [url];
  let idx = 0;
  let count = 0;
  // create multiple url for handle character limit
  for (let t of text) {
    const len = t.length + SEPARATOR_LEN;
    if (count + len < CHARACTER_LIMIT) {
      querys[idx] = querys[idx] += `${myencodeURIComponent(t)}${SEPARATOR_QUERY}`;
      count += len;
    } else {
      idx++;
      querys.push(url + `${myencodeURIComponent(t)}${SEPARATOR_QUERY}`);
      count = len;
    }
  }
  return querys;
}

async function translateWithProxy(text, slang = 'en', tlang = 'es', proxy = '') {
  let browser;
  let raw;
  try {
    browser = await puppeteer.launch({
      //headless: false,
      args: [`--proxy-server=${proxy}`],
    });
    const querys = buildQueryURL(text, slang, tlang);
    raw = [];

    for (const query of querys) {
      const page = await browser.newPage();
      await page.goto(query, { waitUntil: 'load' });
      let [res] = await page.$$eval('span.tlid-translation.translation', elem =>
        elem.map(e => e.innerText)
      );

      res = rebuildText(res);
      raw = raw.concat(res);
    }
  } catch (e) {
    throw e;
  } finally {
    // comment this when headless: false
    await browser.close();
  }
  return raw;
}

async function translate(text, slang = 'en', tlang = 'es') {
  const proxy = JSON.parse(process.env.USE_PROXY) ? await require('./proxy')() : '';

  if (proxy) console.info(`Using proxy: ${proxy}`);
  return translateWithProxy(text, slang, tlang, proxy);
}

module.exports = {
  puppyTrans: translate,
  translateWithProxy,
};

// UNCOMMENT for test
/*
translate(["Google translator", "pencil", "dog", "cat"], "en", "es").then(res =>
  console.log(res)
);
*/
