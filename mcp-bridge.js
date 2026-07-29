#!/usr/bin/env node

/**
 * MCP Server Bridge for Graphify + Obsidian
 * Allows Copilot CLI to interact with project graphs and documentation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MCPBridge {
  constructor() {
    this.projectRoot = __dirname;
    this.vaultPath = path.join(this.projectRoot, 'docs');
    this.graphPath = path.join(this.projectRoot, '.graph');
  }

  // Initialize graph data for project visualization
  initializeGraph() {
    const graph = {
      nodes: [
        { id: 'frontend', label: 'Frontend (React/Vite)', type: 'module' },
        { id: 'backend', label: 'Backend (Express/MySQL)', type: 'module' },
        { id: 'db', label: 'Database Schema', type: 'resource' },
        { id: 'api', label: 'REST API', type: 'interface' },
        { id: 'timekeeping', label: 'Timekeeping Feature', type: 'feature' },
        { id: 'receipts', label: 'Receipt Printing (57/58/80mm)', type: 'feature' },
        { id: 'sheets', label: 'Google Sheets Integration', type: 'service' }
      ],
      edges: [
        { from: 'frontend', to: 'api', label: 'HTTP' },
        { from: 'backend', to: 'api', label: 'Express Routes' },
        { from: 'backend', to: 'db', label: 'MySQL' },
        { from: 'api', to: 'timekeeping', label: 'Clock Endpoints' },
        { from: 'api', to: 'receipts', label: 'Print Endpoints' },
        { from: 'backend', to: 'sheets', label: 'Append Orders' },
        { from: 'receipts', to: 'db', label: 'Menu Data' }
      ],
      metadata: {
        projectName: 'erlbrew-pos',
        description: 'Restaurant POS System with Timekeeping & Print Integration',
        version: '1.0.0'
      }
    };

    if (!fs.existsSync(this.graphPath)) {
      fs.mkdirSync(this.graphPath, { recursive: true });
    }

    fs.writeFileSync(
      path.join(this.graphPath, 'architecture.json'),
      JSON.stringify(graph, null, 2)
    );

    return graph;
  }

  // List available documentation files
  getVaultDocs() {
    if (!fs.existsSync(this.vaultPath)) {
      fs.mkdirSync(this.vaultPath, { recursive: true });
    }

    const docs = fs.readdirSync(this.vaultPath)
      .filter(f => f.endsWith('.md'))
      .map(f => ({
        path: path.join(this.vaultPath, f),
        name: f.replace('.md', '')
      }));

    return docs;
  }

  // Export for MCP handlers
  static getInfo() {
    return {
      name: 'erlbrew-mcp-bridge',
      version: '1.0.0',
      capabilities: ['graphify', 'obsidian-vault'],
      description: 'MCP bridge for Graphify graph visualization and Obsidian vault integration'
    };
  }
}

export default MCPBridge;

// If run directly, initialize graph
if (import.meta.url === `file://${process.argv[1]}`) {
  const bridge = new MCPBridge();
  const graph = bridge.initializeGraph();
  console.log('✓ MCP Bridge initialized');
  console.log(`✓ Project graph created: ${path.join(bridge.graphPath, 'architecture.json')}`);
  console.log(`✓ Vault path: ${bridge.vaultPath}`);
}
