const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the project root directory
app.use(express.static(path.join(__dirname, '/')));

// Handle all routes by serving index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Forest module available at http://localhost:${PORT}/forest`);
  console.log(`Water module available at http://localhost:${PORT}/water`);
});