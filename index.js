// Top of the file
const express = require('express');
const app = express();
const port = process.env.PORT || 8000; // This lets the platform pick the port

// ... rest of your code ...

// Bottom of the file
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// IMPORTANT for Vercel:
module.exports = app;
