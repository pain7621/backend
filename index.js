const express = require('express');
const app = express();

// Use the port assigned by the host, or 8000 for local testing
const port = process.env.PORT || 8000; 

// Middleware
app.use(express.json());

// Import Gateway (Ensure the folder is named 'gateways' and file 'eastcoast_gate.js')
// Note: Case sensitivity matters on Linux servers!
const { runGate } = require('./gateways/eastcoast_gate');

// Health Check Endpoint
app.get('/', (req, res) => {
    res.json({ status: "Online", location: "USA Server" });
});

// Main Logic Endpoint
app.get('/kill', async (req, res) => {
    try {
        const { cc } = req.query;
        if (!cc) {
            return res.status(400).json({ error: "Missing 'cc' parameter." });
        }

        const result = await runGate(cc);
        res.json(result);
    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// REQUIRED for Vercel deployment
module.exports = app;
