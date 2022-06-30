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

var page_num = 1;
var url = new URL('https://www.tokopedia.com/search');
url.searchParams.set('q', keyword);
url.searchParams.set('page', page_num);
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
    while (products.length <= target_number && product_found) {
        await page.goto(url.href);
        // activate lazyload
        await autoScroll(page);
        try {
            await page.waitForSelector('div[data-testid="divSRPContentProducts"]>div:nth-child(2)', {
                timeout: 5000
            })
        } catch (error) {
            product_found = false;
            console.log("Product not found or too little.")
        }
        products = products.concat(
            await page.$$eval('div[data-testid="divSRPContentProducts"] div[data-testid="divProductWrapper"]', products => {
                var prod = products.map(el => {
                    var rate_el = el.querySelector('div[data-testid="master-product-card"] i[aria-label="Rating Star"]+span');
                    var prod_url = el.querySelector('div[data-testid="master-product-card"] a').href;

                    return {
                        "name": el.querySelector('div[data-testid="master-product-card"] a>div[data-testid="spnSRPProdName"]').textContent,
                        "desc": prod_url,
                        "image": el.querySelector('div[data-testid="master-product-card"] div>img[data-testid="imgSRPProdMain"]').src,
                        "price": el.querySelector('div[data-testid="master-product-card"] a>div[data-testid="spnSRPProdPrice"]').textContent,
                        "rating": rate_el ? rate_el.textContent : "-",
                        "store": el.querySelector('div[data-testid="master-product-card"] div[data-testid="shopWrapper"] span[data-testid="spnSRPProdTabShopLoc"] + span').textContent,
                    };
                })
                return prod;
            })
        )
        page_num++;
        url.searchParams.set('page', page_num);
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