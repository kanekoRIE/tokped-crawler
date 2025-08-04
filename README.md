
# Tokopedia crawler

This project is created for my test assignment. Any kind of use is welcome but im not taking any responsibility. Use it with your own risk.

This project will crawl Tokopedia search result based on keyword provided with min and/or max price filter. It will crawl as many product item desired or until product not found. Then the crawl result will be exported to csv. Product crawl result contain name of product, product description, image url, price, rating and store name.
## Installation

use npm to install puppeteer for headless browser and csv-writer for csv file creation.

```bash
// in project root directory
  npm i puppeteer
  npm i csv-writer
```
    
## Usage/Examples

Run the program using node.

```
node tokped-crawler.js
```

Or run performance improved v2

```
node tokped-crawler-v2.js
```

add help argument to show useable arguments

```
node tokped-crawler.js help

// expected output
node tokped-crawler.js [keyword=\"handphone\"] [target item=100] [price min] [price max]
```
you can input desired keyword, crawled item, minimum price and maximum price for more specific search result. by default keyword is handphone, crawled item is 100 items, and no min max price filter.

## FAQ

#### Program stopped working in the middle of crawling

Sometime Tokopedia return error when accessed from headless browser. You can try to re-run the program. 

#### Different search result

Puppeteer doesnt store cookies or other user experience data. So each run will be like a new user accessing Tokopedia. You can imitate this situation by using incognito and refreshing the page.

