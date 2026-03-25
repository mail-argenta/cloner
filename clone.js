const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 🔥 Add as many URLs as you want
const TARGET_URLS = [
"https://stayawhile.com/destinations/68a3bb5491a9ad0049a236de"
];

const ALLOWED_DOMAIN = 'stayawhile.com';
const OUTPUT_DIR = path.join(__dirname, 'site-clone');

// Ensure directory exists
function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// Convert URL → local file path
function getFilePath(resourceUrl) {
    const parsed = url.parse(resourceUrl);
    let filePath = parsed.pathname;

    if (!filePath || filePath.endsWith('/')) {
        filePath += 'index.html';
    }

    return path.join(OUTPUT_DIR, filePath);
}

// Check allowed domain
function isAllowed(resourceUrl) {
    try {
        const parsed = new URL(resourceUrl);
        return parsed.hostname === ALLOWED_DOMAIN;
    } catch {
        return false;
    }
}

// Auto scroll
async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 300;

            const timer = setInterval(() => {
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= document.body.scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 300);
        });
    });
}

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox']
    });

    const page = await browser.newPage();
    await page.setRequestInterception(true);

    // Handle requests
    page.on('request', request => {
        if (isAllowed(request.url())) {
            request.continue();
        } else {
            request.abort();
        }
    });

    // Handle responses
    page.on('response', async (response) => {
        try {
            const resourceUrl = response.url();

            if (!isAllowed(resourceUrl)) return;

            const filePath = getFilePath(resourceUrl);

            // 🔥 Skip if already downloaded
            if (fs.existsSync(filePath)) {
                return;
            }

            const buffer = await response.buffer();

            ensureDir(filePath);
            fs.writeFileSync(filePath, buffer);

            console.log('Saved:', resourceUrl);
        } catch {
            console.log('Failed:', response.url());
        }
    });

    // 🔁 Loop through all URLs
    for (const target of TARGET_URLS) {
        console.log('\n🌐 Processing:', target);

        await page.goto(target, {
            waitUntil: 'networkidle2',
            timeout: 0
        });

        // Your scroll
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

        // Better scroll
        await autoScroll(page);

        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    console.log('\n✅ All pages processed. Files saved to:', OUTPUT_DIR);

    await browser.close();
})();