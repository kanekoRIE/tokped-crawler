const puppeteer = require('puppeteer');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

if (process.argv[2] == "help") {
    console.log("node tokped-crawler.js [keyword=\"handphone\"] [target item=100] [price min] [price max]");
    process.exit();
}

let keyword = "handphone";
if (process.argv[2] != null) {
    keyword = process.argv[2];
}

let target_number = 100;
if (process.argv[3] != null) {
    target_number = process.argv[3];
}

var url = new URL('https://www.tokopedia.com/search');
url.searchParams.set('q', keyword);
if (process.argv[4] != null) {
    url.searchParams.set('pmin', process.argv[4]);
}
if (process.argv[5] != null) {
    url.searchParams.set('pmax', process.argv[5]);
}

const csvWriter = createCsvWriter({
    path: './csv/'+keyword+'.csv',
    header: [{
            id: 'name',
            title: 'Product Name'
        },
        {
            id: 'desc',
            title: 'Description'
        },
        {
            id: 'image',
            title: 'Image URL'
        },
        {
            id: 'price',
            title: 'Price'
        },
        {
            id: 'rating',
            title: 'Rating (out of 5)'
        },
        {
            id: 'store',
            title: 'Store Name'
        }
    ]
});

const start = Date.now();
let products = [];
var duration = 0;
var product_found = true;

(async () => {
    console.log("Starting...")
    var twirlTimer = (function() {
        var P = ["\\", "|", "/", "-"];
        var x = 0;
        return setInterval(function() {
          process.stdout.write("\r" + P[x++]);
          x &= 3;
        }, 250);
      })();
    const browser = await puppeteer.launch({
        headless: true
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36');
    await page.goto(url.href);
    while (products.length <= target_number && product_found) {
        // activate lazyload
        await autoScroll(page);
        try {
            await page.waitForSelector('div[data-testid="divSRPContentProducts"] div.css-5wh65g', {
                timeout: 5000
            })
        } catch (error) {
            product_found = false;
            console.log("Product not found or too little.")
        }
        products = products.concat(
            await page.$$eval(
                'div[data-testid="divSRPContentProducts"] div.css-5wh65g',
                (products) => {
                return products
                    .map(el => {
                    const name = el.querySelector('span[class*="+tnoqZhn89+NHUA43BpiJg=="]')?.textContent?.trim();
                    if (!name) return null; // skip if name is empty

                    return {
                        name,
                        price: el.querySelector('div[class*="urMOIDHH7I0Iy1Dv2oFaNw=="]')?.textContent || '-',
                        store: el.querySelector('span[class*="si3CNdiG8AR0EaXvf6bFbQ=="]')?.textContent || '-',
                        desc: el.querySelector('a[class*="Ui5-B4CDAk4Cv-cjLm4o0g== XeGJAOdlJaxl4+UD3zEJLg=="]')?.href || '-',
                        rating: el.querySelector('span[class*="_2NfJxPu4JC-55aCJ8bEsyw=="]')?.textContent || '-',
                        image: el.querySelector('img[alt="product-image"]')?.src || '-'
                    };
                    })
                    .filter(Boolean); // remove nulls
                }
            )
        );
    }

    products = products.slice(0, target_number);

    if (products.length > 0) {
        var prod_time = [];
        for (prod in products) {
            var prod_start = Date.now();

            let url = new URL(products[prod].desc);
            // clean product link
            let togo = url.searchParams.get('r') ? url.searchParams.get('r') : url.href;
            await page.goto(togo.split("?")[0]);
            try {
                await page.waitForSelector('div[role="tabpanel"] div[data-testid="lblPDPDescriptionProduk"]');
                let node = await page.$('div[role="tabpanel"] div[data-testid="lblPDPDescriptionProduk"]');
                let desc = await node.evaluate(el => el.textContent);
                products[prod].desc = desc;
            } catch (error) {
                products[prod].desc = "-no description-";
            }

            duration = (Date.now() - prod_start) / 1000;
            prod_time.push(parseFloat(duration));
        }
        var sum = prod_time.reduce((a, b) => a + b);
        console.log("Average time per-product: " + sum / prod_time.length +" s");
        duration = (Date.now() - start) / 1000;
        console.log("Crawl time: " + duration + " s");

        csvWriter.writeRecords(products)
            .then(() => {
                duration = (Date.now() - start) / 1000;
                console.log('...File Created');
            });

        duration = (Date.now() - start) / 1000;
        console.log("Finish: " + duration + " s");
    }
    clearInterval(twirlTimer);

    await browser.close();
})();

async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve, reject) => {
            var totalHeight = 0;
            var distance = 100;
            var timer = setInterval(() => {
                var scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight - window.innerHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 10);
        });
    });
}