const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const START_URL = "https://stayawhile.com/owners";
const ALLOWED_DOMAIN = "stayawhile.com";
const OUTPUT_DIR = path.join(__dirname, "site-clone");

// Ensure directory exists
function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Convert URL → local path
function getFilePath(resourceUrl, contentType = '') {
    const parsed = new URL(resourceUrl);
    let pathname = decodeURIComponent(parsed.pathname);

    pathname = pathname.split('?')[0].split('#')[0];

    if (contentType.includes('text/html')) {
        if (pathname.endsWith('/')) {
            return path.join(OUTPUT_DIR, pathname, 'index.html');
        }
        return path.join(OUTPUT_DIR, pathname + '.html');
    }

    if (pathname.endsWith('/')) pathname += 'index';

    return path.join(OUTPUT_DIR, pathname);
}

// Convert URL → relative path for HTML rewrite
function toLocalPath(resourceUrl) {
    const parsed = new URL(resourceUrl);
    let pathname = decodeURIComponent(parsed.pathname);
    pathname = pathname.split('?')[0].split('#')[0];

    if (!path.extname(pathname)) {
        if (pathname.endsWith('/')) return pathname + 'index.html';
        return pathname + '.html';
    }

    return pathname;
}

// Domain filter
function isAllowed(u) {
    try {
        return new URL(u).hostname.includes(ALLOWED_DOMAIN);
    } catch {
        return false;
    }
}

// Rewrite HTML → local links
function rewriteHTML(html) {
    return html.replace(
        /(src|href)=["'](https?:\/\/[^"']+)["']/g,
        (match, attr, url) => {
            if (!isAllowed(url)) return match;
            return `${attr}="${toLocalPath(url)}"`;
        }
    );
}

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized', '--no-sandbox']
    });

    const page = await browser.newPage();
    await page.setRequestInterception(true);

    // Request filter
    page.on('request', req => {
        if (isAllowed(req.url())) req.continue();
        else req.abort();
    });

    // Capture resources
    page.on('response', async (res) => {
        const url = res.url();

        if (!isAllowed(url)) return;

        // ❌ Skip RSC streams
        if (url.includes('_rsc=')) return;

        // ❌ Skip video (optional)
        if (url.endsWith('.mp4')) return;

        const contentType = res.headers()['content-type'] || '';
        const filePath = getFilePath(url, contentType);

        try {
            if (fs.existsSync(filePath)) return;

            const buffer = await res.buffer();

            ensureDir(filePath);
            fs.writeFileSync(filePath, buffer);

            console.log('💾', url);
        } catch {
            console.log('❌', url);
        }
    });

    await page.goto(START_URL, { waitUntil: 'networkidle2', timeout: 0 });

    console.log("\n🧠 MANUAL MODE");
    console.log("👉 Browse freely");
    console.log("👉 Press CTRL+C when done\n");

    // Save + rewrite HTML snapshot
    setInterval(async () => {
        try {
            const currentUrl = page.url();
            const rawHTML = await page.content();

            const rewritten = rewriteHTML(rawHTML);

            const filePath = getFilePath(currentUrl, 'text/html');

            ensureDir(filePath);
            fs.writeFileSync(filePath, rewritten);

            console.log("📝 Saved page:", currentUrl);
        } catch {}
    }, 8000);
})();