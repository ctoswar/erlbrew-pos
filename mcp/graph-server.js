import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const app = express();

// Serve static files
app.use(express.static(path.join(projectRoot, 'public')));

// API endpoint to get graph data
app.get('/api/graph', (req, res) => {
  try {
    const graphPath = path.join(projectRoot, '.graph', 'architecture.json');
    const graphData = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
    res.json(graphData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load graph' });
  }
});

// Serve the graph visualization HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(projectRoot, 'public', 'index.html'));
});

const PORT = process.env.GRAPH_PORT || 5173;
app.listen(PORT, () => {
  console.log(`📊 Graph Dashboard running at http://localhost:${PORT}`);
  console.log(`📈 View architecture: http://localhost:${PORT}/graph`);
});
