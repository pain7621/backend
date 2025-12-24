const express = require('express');
const app = express();
const port = 8000; 

// ==========================================
// IMPORTS
// ==========================================
// Importing from gateways/eastcoast_gate.js
// const { runGate } = require('./gateways/eastcoast_gate');

// Importing from gateways/killer1.js (Google Task - Commented out)
// const { runGoogleTask } = require('./gateways/killer1');

// Importing from gateways/killer2.js
const { runFujikuraTask } = require('./gateways/killer2');

// Importing from gateways/killer3.js
// const { runBuy4StoreTask } = require('./gateways/killer3');

// Middleware to parse JSON bodies
app.use(express.json());

// ==========================================
// ROUTES
// ==========================================

// Root Endpoint
app.get('/', (req, res) => {
    res.json({ Status: "Online" });
});

// Endpoint: /kill (EastCoast Gate - Multi-Task with Proxy)
// Usage: /kill?cc=xxxxx|xx|xxxx|xxx&proxy=user:pass@host:port
app.get('/kill', async (req, res) => {
    try {
        const { cc } = req.query;
        
        if (!cc) {
            return res.status(400).json({ error: "Missing 'cc' parameter. Format: cc|mm|yyyy|cvv" });
        }

    

        // Pass both CC and Proxy to the gate function
        const result = await runGate(cc);
        
        res.json(result);

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: /kd (Fujikura Task)
// Usage: /kd?cc=xxxxx&proxy=xxxxx
// app.get('/kd', async (req, res) => {
//     try {
//         const { cc, proxy } = req.query;

//         if (!cc) {
//             return res.status(400).json({ error: "Missing 'cc' parameter" });
//         }

//         // Call the logic located in killer2.js
//         const result = await runFujikuraTask(cc, proxy);
//         console.log("Final Results:", JSON.stringify(result, null, 2));
//         res.json(result);

//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

// Endpoint: /fk (Buy4Store Task - Placeholder)
// Usage: /fk?cc=xxxxx&proxy=xxxxx
// app.get('/fk', async (req, res) => {
//     try {
//         const { cc, proxy } = req.query;

//         if (!cc) {
//             return res.status(400).json({ error: "Missing 'cc' parameter" });
//         }

//         // Call the logic located in killer3.js (if enabled)
//         // const result = await runBuy4StoreTask(cc, proxy);
//         res.json({ status: "Maintenance", message: "Gateway temporarily disabled" });

//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

// ==========================================
// SERVER START
// ==========================================
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
