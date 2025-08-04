const puppeteer = require('puppeteer');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

if (process.argv[2] === "help") {
    console.log("node tokped-crawler.js [keyword=\"handphone\"] [target item=100] [price min] [price max]");
    process.exit();
}

const keyword = process.argv[2] || "handphone";
const target_number = parseInt(process.argv[3]) || 100;
const pmin = process.argv[4];
const pmax = process.argv[5];

const concurrency = 6; // may differ for each device
const maxRetries = 3;

const url = new URL('https://www.tokopedia.com/search');
url.searchParams.set('q', keyword);
if (pmin) url.searchParams.set('pmin', pmin);
if (pmax) url.searchParams.set('pmax', pmax);

const csvWriter = createCsvWriter({
    path: './csv/' + keyword + '.csv',
    header: [
        { id: 'name', title: 'Product Name' },
        { id: 'desc', title: 'Description' },
        { id: 'image', title: 'Image URL' },
        { id: 'price', title: 'Price' },
        { id: 'rating', title: 'Rating (out of 5)' },
        { id: 'store', title: 'Store Name' },
    ]
});

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36';

(async () => {
    console.log("Starting...");
    const start = Date.now();
    let products = [];
    let product_found = true;

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.goto(url.href);

    while (products.length < target_number && product_found) {
        await autoScroll(page);

        try {
            await page.waitForSelector('div[data-testid="divSRPContentProducts"] div.css-5wh65g', { timeout: 5000 });
        } catch {
            console.log("Product not found or too little.");
            break;
        }

        const newProducts = await page.$$eval('div[data-testid="divSRPContentProducts"] div.css-5wh65g', (items) => {
            return items.map(el => {
                const name = el.querySelector('span[class*="+tnoqZhn89+NHUA43BpiJg=="]')?.textContent?.trim();
                if (!name) return null;

                return {
                    name,
                    price: el.querySelector('div[class*="urMOIDHH7I0Iy1Dv2oFaNw=="]')?.textContent || '-',
                    store: el.querySelector('span[class*="si3CNdiG8AR0EaXvf6bFbQ=="]')?.textContent || '-',
                    desc: el.querySelector('a[class*="Ui5-B4CDAk4Cv-cjLm4o0g== XeGJAOdlJaxl4+UD3zEJLg=="]')?.href || '-',
                    rating: el.querySelector('span[class*="_2NfJxPu4JC-55aCJ8bEsyw=="]')?.textContent || '-',
                    image: el.querySelector('img[alt="product-image"]')?.src || '-',
                };
            }).filter(Boolean);
        });

        products = products.concat(newProducts);
    }

    products = products.slice(0, target_number);

    await scrapeDescriptions(browser, products);
    await csvWriter.writeRecords(products);
    console.log(`\n✅ Done. ${products.length} items saved to CSV.`);
    console.log(`⌛ Total time: ${(Date.now() - start) / 1000}s`);
    await browser.close();
})();

async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise(resolve => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= document.body.scrollHeight - window.innerHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 10);
        });
    });
}

async function scrapeDescriptions(browser, products) {
    const chunks = [];

    for (let i = 0; i < products.length; i += concurrency) {
        chunks.push(products.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
        await Promise.all(chunk.map(async (prod) => {
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const tab = await browser.newPage();
                    await tab.setUserAgent(USER_AGENT);

                    const rawUrl = new URL(prod.desc);
                    const togo = rawUrl.searchParams.get('r') || rawUrl.href;

                    await tab.goto(togo.split('?')[0], { waitUntil: 'domcontentloaded', timeout: 10000 });

                    await tab.waitForSelector('div[role="tabpanel"] div[data-testid="lblPDPDescriptionProduk"]', { timeout: 5000 });

                    const desc = await tab.$eval(
                        'div[role="tabpanel"] div[data-testid="lblPDPDescriptionProduk"]',
                        el => el.textContent.trim()
                    );

                    prod.desc = desc || '-';
                    await tab.close();
                    break; // ✅ Success, break retry loop
                } catch (err) {
                    if (attempt === maxRetries) {
                        prod.desc = `-failed after ${maxRetries} attempts-`;
                    }
                }
            }
            process.stdout.write(".");
        }));
    }
}
