#!/usr/bin/env node

/**
 * Filesystem MCP Server
 * Direct read/write access to project files and directories
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class FileSystemMCP {
  constructor() {
    this.projectRoot = __dirname;
    this.allowedPaths = [
      path.join(this.projectRoot, 'src'),
      path.join(this.projectRoot, 'server'),
      path.join(this.projectRoot, 'docs'),
      path.join(this.projectRoot, 'public'),
      this.projectRoot
    ];
  }

  /**
   * Check if path is within allowed directories
   */
  isPathAllowed(filePath) {
    const resolved = path.resolve(filePath);
    return this.allowedPaths.some(allowedPath => 
      resolved.startsWith(path.resolve(allowedPath))
    );
  }

  /**
   * Read file contents
   */
  readFile(filePath) {
    if (!this.isPathAllowed(filePath)) {
      throw new Error(`Access denied: ${filePath}`);
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return {
        path: filePath,
        size: content.length,
        content: content,
        mimeType: this.getMimeType(filePath)
      };
    } catch (error) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  /**
   * List directory contents
   */
  listDirectory(dirPath) {
    if (!this.isPathAllowed(dirPath)) {
      throw new Error(`Access denied: ${dirPath}`);
    }

    try {
      const files = fs.readdirSync(dirPath, { withFileTypes: true });
      return files.map(file => ({
        name: file.name,
        type: file.isDirectory() ? 'directory' : 'file',
        path: path.join(dirPath, file.name),
        size: file.isDirectory() ? null : fs.statSync(path.join(dirPath, file.name)).size
      }));
    } catch (error) {
      throw new Error(`Failed to list directory: ${error.message}`);
    }
  }

  /**
   * Get MIME type
   */
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.js': 'application/javascript',
      '.ts': 'text/typescript',
      '.tsx': 'text/typescript',
      '.json': 'application/json',
      '.md': 'text/markdown',
      '.html': 'text/html',
      '.css': 'text/css',
      '.sql': 'text/plain',
      '.txt': 'text/plain'
    };
    return mimeTypes[ext] || 'text/plain';
  }

  /**
   * Search files by pattern
   */
  searchFiles(pattern, dirPath = this.projectRoot) {
    const results = [];
    const regex = new RegExp(pattern, 'i');

    const search = (dir) => {
      try {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        files.forEach(file => {
          const fullPath = path.join(dir, file.name);
          
          if (file.isDirectory() && !file.name.startsWith('.') && file.name !== 'node_modules') {
            search(fullPath);
          } else if (file.isFile() && regex.test(file.name)) {
            results.push(fullPath);
          }
        });
      } catch (error) {
        // Skip permission errors
      }
    };

    search(dirPath);
    return results;
  }

  static getInfo() {
    return {
      name: 'filesystem-mcp',
      version: '1.0.0',
      capabilities: ['read', 'list', 'search'],
      description: 'MCP server for direct filesystem access to project files'
    };
  }
}

export default FileSystemMCP;

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const mcp = new FileSystemMCP();
  
  if (process.argv[2] === 'list') {
    const dir = process.argv[3] || mcp.projectRoot;
    const files = mcp.listDirectory(dir);
    console.log(JSON.stringify(files, null, 2));
  } else if (process.argv[2] === 'read') {
    const file = process.argv[3];
    const content = mcp.readFile(file);
    console.log(JSON.stringify(content, null, 2));
  } else if (process.argv[2] === 'search') {
    const pattern = process.argv[3];
    const results = mcp.searchFiles(pattern);
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(FileSystemMCP.getInfo());
  }
}
