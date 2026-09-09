#!/usr/bin/env node

/**
 * Graphify MCP Server (Custom)
 * Reads .graph/architecture.json and renders Mermaid diagrams
 * Does NOT scan source code — uses pre-built JSON only
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ARCH_FILE = path.join(PROJECT_ROOT, '.graph', 'architecture.json');

// MCP Server implementation
const server = {
  name: 'graphify',
  version: '1.0.0',
};

// Read architecture.json
function loadArchitecture() {
  try {
    if (fs.existsSync(ARCH_FILE)) {
      return JSON.parse(fs.readFileSync(ARCH_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading architecture:', e.message);
  }
  return null;
}

// Convert architecture.json to Mermaid flowchart
function toMermaid(arch) {
  if (!arch || !arch.nodes) return 'graph LR\n  A[No architecture data]';

  const lines = ['graph LR'];

  // Define nodes with styles
  const communityStyles = {
    frontend: 'fill:#3b82f6,stroke:#1e40af,color:#fff',
    backend: 'fill:#10b981,stroke:#047857,color:#fff',
    data: 'fill:#f59e0b,stroke:#b45309,color:#000',
    mobile: 'fill:#8b5cf6,stroke:#6d28d9,color:#fff',
  };

  const nodeTypeShapes = {
    entry: '([{}])',
    server: '([[{}]])',
    database: '{{{}}}',
    table: '{{{}}}',
    component: '[[]]',
    hook: '[([])]',
    util: '[[{}]]',
    route: '[/{}]',
    service: '[({})]',
    middleware: '[({})]',
    types: '[[{}]]',
    screen: '[[]]',
  };

  // Add node definitions
  for (const node of arch.nodes) {
    const shape = nodeTypeShapes[node.type] || '[]';
    const [open, close] = [shape[0], shape.slice(-1)];
    const inner = node.label;
    lines.push(`  ${node.id}${open}"${inner}"${close}`);
  }

  // Add edges
  if (arch.edges) {
    for (const edge of arch.edges) {
      const label = edge.label ? `|${edge.label}|` : '';
      lines.push(`  ${edge.from} -->${label} ${edge.to}`);
    }
  }

  return lines.join('\n');
}

// Convert to clickable Mermaid (for Mermaid Live)
function toMermaidClickable(arch) {
  if (!arch || !arch.nodes) return 'graph LR\n  A[No architecture data]';

  const lines = ['graph LR'];

  // Node type shapes
  const nodeTypeShapes = {
    entry: '([{}])',
    server: '([[{}]])',
    database: '{{{}}}',
    table: '{{{}}}',
    component: '[[]]',
    hook: '[([])]',
    util: '[[{}]]',
    route: '[/{}]',
    service: '[({})]',
    middleware: '[({})]',
    types: '[[{}]]',
    screen: '[[]]',
  };

  // Add node definitions
  for (const node of arch.nodes) {
    const shape = nodeTypeShapes[node.type] || '[]';
    const [open, close] = [shape[0], shape.slice(-1)];
    const inner = node.label;
    lines.push(`  ${node.id}${open}"${inner}"${close}`);
  }

  // Add edges
  if (arch.edges) {
    for (const edge of arch.edges) {
      const label = edge.label ? `|${edge.label}|` : '';
      lines.push(`  ${edge.from} -->${label} ${edge.to}`);
    }
  }

  // Add clickable links (Mermaid Live compatible)
  for (const node of arch.nodes) {
    if (node.file) {
      const filePath = node.file.replace(/\\/g, '/');
      lines.push(`  click ${node.id} href "https://github.com/ctoswar/erlbrew-pos/blob/main/${filePath}" "Open ${node.label}"`);
    }
  }

  return lines.join('\n');
}

// Text summary of the graph
function summarize(arch) {
  if (!arch) return 'No architecture data available.';

  const communities = {};
  for (const node of arch.nodes || []) {
    const c = node.community || 'unknown';
    communities[c] = (communities[c] || 0) + 1;
  }

  const types = {};
  for (const node of arch.nodes || []) {
    const t = node.type || 'unknown';
    types[t] = (types[t] || 0) + 1;
  }

  let summary = `## Architecture Summary\n\n`;
  summary += `**Nodes:** ${arch.nodes?.length || 0} | **Edges:** ${arch.edges?.length || 0}\n\n`;

  summary += `### Communities\n`;
  for (const [c, count] of Object.entries(communities)) {
    summary += `- ${c}: ${count} nodes\n`;
  }

  summary += `\n### Node Types\n`;
  for (const [t, count] of Object.entries(types)) {
    summary += `- ${t}: ${count}\n`;
  }

  return summary;
}

// MCP request handler
async function handleRequest(request) {
  const { method, params, id } = request;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: false },
          },
          serverInfo: server,
        },
      };

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: [
            {
              name: 'get_schema',
              description: 'Get the architecture schema (nodes and edges) as JSON',
              inputSchema: {
                type: 'object',
                properties: {},
              },
            },
            {
              name: 'get_context',
              description: 'Get a text summary of the architecture',
              inputSchema: {
                type: 'object',
                properties: {},
              },
            },
            {
              name: 'graphify',
              description: 'Generate a Mermaid diagram of the architecture with clickable links',
              inputSchema: {
                type: 'object',
                properties: {
                  format: {
                    type: 'string',
                    enum: ['mermaid', 'mermaid-clickable', 'summary'],
                    description: 'Output format (default: mermaid-clickable)',
                  },
                },
              },
            },
          ],
        },
      };

    case 'tools/call': {
      const { name, arguments: args } = params;

      switch (name) {
        case 'get_schema': {
          const arch = loadArchitecture();
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(arch, null, 2),
                },
              ],
            },
          };
        }

        case 'get_context': {
          const arch = loadArchitecture();
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: summarize(arch),
                },
              ],
            },
          };
        }

        case 'graphify': {
          const arch = loadArchitecture();
          const format = args?.format || 'mermaid-clickable';

          let output;
          switch (format) {
            case 'mermaid':
              output = toMermaid(arch);
              break;
            case 'mermaid-clickable':
              output = toMermaidClickable(arch);
              break;
            case 'summary':
              output = summarize(arch);
              break;
            default:
              output = toMermaidClickable(arch);
          }

          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: output,
                },
              ],
            },
          };
        }

        default:
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Unknown tool: ${name}` },
          };
      }
    }

    case 'notifications/initialized':
      // No response needed for notifications
      return null;

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Unknown method: ${method}` },
      };
  }
}

// Main: Read from stdin, write to stdout
async function main() {
  let buffer = '';

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buffer += chunk;

    // Process complete messages
    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;

      const header = buffer.slice(0, headerEnd);
      const contentLengthMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!contentLengthMatch) break;

      const contentLength = parseInt(contentLengthMatch[1], 10);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + contentLength;

      if (buffer.length < bodyEnd) break;

      const body = buffer.slice(bodyStart, bodyEnd);
      buffer = buffer.slice(bodyEnd);

      try {
        const request = JSON.parse(body);
        handleRequest(request).then((response) => {
          if (response) {
            const responseStr = JSON.stringify(response);
            const responseMsg = `Content-Length: ${Buffer.byteLength(responseStr)}\r\n\r\n${responseStr}`;
            process.stdout.write(responseMsg);
          }
        });
      } catch (e) {
        console.error('Error parsing request:', e.message);
      }
    }
  });

  process.stdin.on('end', () => {
    process.exit(0);
  });
}

main();
