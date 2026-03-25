const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const TARGET_URL = "https://stayawhile.com/";
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
function getFilePath(resourceUrl, contentType) {
    const parsed = new URL(resourceUrl);
    let pathname = decodeURIComponent(parsed.pathname);

    // Remove query/hash
    pathname = pathname.split('?')[0].split('#')[0];

    // 🔥 Handle HTML documents
    if (contentType && contentType.includes('text/html')) {
        if (pathname.endsWith('/')) {
            return path.join(OUTPUT_DIR, pathname, 'index.html');
        } else {
            return path.join(OUTPUT_DIR, pathname + '.html');
        }
    }

    // 🔥 Handle assets
    if (pathname.endsWith('/')) {
        pathname += 'index';
    }

    return path.join(OUTPUT_DIR, pathname);
}

// Check allowed domain (supports subdomains)
function isAllowed(resourceUrl) {
    try {
        const parsed = new URL(resourceUrl);
        return parsed.hostname.includes(ALLOWED_DOMAIN);
    } catch {
        return false;
    }
}

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        devtools: false,
        args: ['--start-maximized', '--no-sandbox']
    });

    const page = await browser.newPage();

    await page.setRequestInterception(true);

    // Allow only target domain
    page.on('request', request => {
        if (isAllowed(request.url())) {
            request.continue();
        } else {
            request.abort();
        }
    });

    // Capture all responses
    page.on('response', async (response) => {
        const resourceUrl = response.url();

        if (!isAllowed(resourceUrl)) return;

        const contentType = response.headers()['content-type'] || '';
        const filePath = getFilePath(resourceUrl, contentType);

        try {
            if (fs.existsSync(filePath)) return;

            const buffer = await response.buffer();

            ensureDir(filePath);
            fs.writeFileSync(filePath, buffer);

            console.log('💾 Saved:', resourceUrl);
        } catch (err) {
            // 🔥 Fallback for HTML दस्त (Next.js, SSR, etc.)
            try {
                const request = response.request();

                if (request.resourceType() === 'document') {
                    const html = await response.text();

                    const fallbackPath = getFilePath(resourceUrl, 'text/html');

                    ensureDir(fallbackPath);
                    fs.writeFileSync(fallbackPath, html);

                    console.log('📝 Saved HTML (fallback):', resourceUrl);
                }
            } catch {}

            console.log('❌ Failed:', resourceUrl);
        }
    });

    console.log("\n🌐 Opening site...");
    await page.goto(TARGET_URL, {
        waitUntil: 'networkidle2',
        timeout: 0
    });

    console.log("\n🧠 MANUAL MODE ENABLED");
    console.log("👉 Scroll, click, navigate freely");
    console.log("👉 All loaded resources will be saved");
    console.log("👉 Press CTRL + C when done\n");

    // 🔁 Periodically save current HTML snapshot
    setInterval(async () => {
        try {
            const currentUrl = page.url();
            const html = await page.content();

            const filePath = getFilePath(currentUrl, 'text/html');

            ensureDir(filePath);
            fs.writeFileSync(filePath, html);

            console.log('📝 Snapshot saved:', currentUrl);
        } catch {}
    }, 10000);

})();