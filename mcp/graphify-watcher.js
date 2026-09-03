#!/usr/bin/env node

/**
 * Graphify Auto-Watcher
 * Monitors src/ and server/ directories for changes
 * Auto-detects new files and regenerates architecture.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

class GraphifyWatcher {
  constructor() {
    this.projectRoot = projectRoot;
    this.srcDir = path.join(this.projectRoot, 'src');
    this.serverDir = path.join(this.projectRoot, 'server');
    this.flutterDir = path.join(this.projectRoot, 'erlbrew_app');
    this.flutterIgnoredDirectories = new Set([
      '.dart_tool',
      '.git',
      '.idea',
      'build',
      'functions',
      'node_modules'
    ]);
    this.graphFile = path.join(this.projectRoot, '.graph', 'architecture.json');
    this.watchers = [];
    this.debounceTimer = null;
    this.debounceDelay = 2000; // 2 seconds
  }

  /**
   * Scan src/components for React components
   */
  scanComponents() {
    const components = [];
    const componentsDir = path.join(this.srcDir, 'components');

    if (!fs.existsSync(componentsDir)) return components;

    try {
      fs.readdirSync(componentsDir).forEach(file => {
        if (file.endsWith('.tsx') || file.endsWith('.ts')) {
          const name = file.replace(/\.(tsx|ts)$/, '');
          components.push({
            id: `comp-${name.toLowerCase()}`,
            label: `${name}.tsx`,
            type: 'component',
            community: 'frontend',
            file: file
          });
        }
      });
    } catch (error) {
      console.error('Error scanning components:', error.message);
    }

    return components;
  }

  /**
   * Scan src/hooks for custom hooks
   */
  scanHooks() {
    const hooks = [];
    const hooksDir = path.join(this.srcDir, 'hooks');

    if (!fs.existsSync(hooksDir)) return hooks;

    try {
      fs.readdirSync(hooksDir).forEach(file => {
        if (file.startsWith('use') && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
          const name = file.replace(/\.(tsx|ts)$/, '');
          hooks.push({
            id: `hook-${name.toLowerCase()}`,
            label: `${name}.ts`,
            type: 'hook',
            community: 'frontend',
            file: file
          });
        }
      });
    } catch (error) {
      console.error('Error scanning hooks:', error.message);
    }

    return hooks;
  }

  /**
   * Scan server/src/routes for API endpoints
   */
  scanRoutes() {
    const routes = [];
    const routesDir = path.join(this.serverDir, 'src', 'routes');

    if (!fs.existsSync(routesDir)) return routes;

    try {
      fs.readdirSync(routesDir).forEach(file => {
        if (file.endsWith('.js')) {
          const name = file.replace(/\.js$/, '');
          routes.push({
            id: `route-${name.toLowerCase()}`,
            label: `routes/${name}.js`,
            type: 'endpoint',
            community: 'backend',
            file: file
          });
        }
      });
    } catch (error) {
      console.error('Error scanning routes:', error.message);
    }

    return routes;
  }

  /**
   * Scan src/types for TypeScript definitions
   */
  scanTypes() {
    const types = [];
    const typesDir = path.join(this.srcDir, 'types');

    if (!fs.existsSync(typesDir)) return types;

    try {
      fs.readdirSync(typesDir).forEach(file => {
        if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          const name = file.replace(/\.(tsx|ts)$/, '');
          types.push({
            id: `type-${name.toLowerCase()}`,
            label: `${name}.ts`,
            type: 'type',
            community: 'frontend',
            file: file
          });
        }
      });
    } catch (error) {
      console.error('Error scanning types:', error.message);
    }

    return types;
  }

  /**
   * Scan the complete Flutter project, excluding generated and dependency files
   */
  scanFlutterFiles() {
    const files = [];

    if (!fs.existsSync(this.flutterDir)) return files;

    const scanDirectory = (directory, relativeDirectory = '') => {
      fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => {
        if (entry.isDirectory() && this.flutterIgnoredDirectories.has(entry.name)) {
          return;
        }

        const fullPath = path.join(directory, entry.name);
        const relativePath = path.join(relativeDirectory, entry.name);

        if (entry.isDirectory()) {
          scanDirectory(fullPath, relativePath);
        } else if (entry.name !== '.flutter-plugins-dependencies') {
          const configFile = /\.(json|lock|rules|yaml|yml|gradle|properties|plist|xml)$/.test(entry.name);

          files.push({
            id: `flutter-${relativePath.replace(/[\\/]/g, '-').replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()}`,
            label: relativePath.replace(/\\/g, '/'),
            type: configFile ? 'config' : 'mobile',
            community: 'flutter',
            file: path.join('erlbrew_app', relativePath).replace(/\\/g, '/')
          });
        }
      });
    };

    try {
      scanDirectory(this.flutterDir);
    } catch (error) {
      console.error('Error scanning Flutter files:', error.message);
    }

    return files;
  }

  /**
   * Load the current architecture.json
   */
  loadCurrentGraph() {
    try {
      if (fs.existsSync(this.graphFile)) {
        return JSON.parse(fs.readFileSync(this.graphFile, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading graph:', error.message);
    }
    return null;
  }

  /**
   * Check if two graphs are different
   */
  graphsAreDifferent(oldGraph, newNodes) {
    if (!oldGraph) return true;
    
    const oldNodeCount = oldGraph.nodes ? oldGraph.nodes.length : 0;
    const newNodeCount = newNodes.length;
    
    return oldNodeCount !== newNodeCount;
  }

  /**
   * Regenerate architecture.json
   */
  regenerateGraph() {
    console.log('🔄 Regenerating graph...');

    // Load existing graph to preserve manual entries
    const currentGraph = this.loadCurrentGraph() || { nodes: [], edges: [], metadata: {} };

    // Scan all directories
    const newComponents = this.scanComponents();
    const newHooks = this.scanHooks();
    const newRoutes = this.scanRoutes();
    const newTypes = this.scanTypes();
    const newFlutterFiles = this.scanFlutterFiles();

    const autoDetectedNodes = [
      ...newComponents,
      ...newHooks,
      ...newRoutes,
      ...newTypes,
      ...newFlutterFiles
    ];

    // Keep manual nodes (those not auto-detected)
    const manualNodes = currentGraph.nodes.filter(node => 
      !['component', 'hook', 'endpoint', 'type', 'mobile'].includes(node.type) ||
      node.community === 'external' ||
      node.community === 'config' ||
      node.community === 'database'
    );

    // Merge auto-detected with manual
    const allNodeIds = new Set();
    const mergedNodes = [];

    autoDetectedNodes.forEach(node => {
      allNodeIds.add(node.id);
      mergedNodes.push(node);
    });

    manualNodes.forEach(node => {
      if (!allNodeIds.has(node.id)) {
        allNodeIds.add(node.id);
        mergedNodes.push(node);
      }
    });

    // Update metadata
    const updatedGraph = {
      nodes: mergedNodes,
      edges: currentGraph.edges || [],
      metadata: {
        projectName: 'erlbrew-pos',
        description: 'Restaurant POS System with Timekeeping & Print Integration',
        version: '1.0.0',
        components: newComponents.length,
        hooks: newHooks.length,
        routes: newRoutes.length,
        types: newTypes.length,
        flutter_files: newFlutterFiles.length,
        total_nodes: mergedNodes.length,
        total_edges: (currentGraph.edges || []).length,
        last_updated: new Date().toISOString(),
        auto_detected: true
      }
    };

    // Check if graph changed before writing
    if (this.graphsAreDifferent(currentGraph, mergedNodes)) {
      try {
        if (!fs.existsSync(path.join(this.projectRoot, '.graph'))) {
          fs.mkdirSync(path.join(this.projectRoot, '.graph'), { recursive: true });
        }

        fs.writeFileSync(this.graphFile, JSON.stringify(updatedGraph, null, 2));
        console.log(`✅ Graph updated! (${mergedNodes.length} nodes detected)`);
        console.log(`   - Components: ${newComponents.length}`);
        console.log(`   - Hooks: ${newHooks.length}`);
        console.log(`   - Routes: ${newRoutes.length}`);
        console.log(`   - Types: ${newTypes.length}`);
        console.log(`   - Flutter files: ${newFlutterFiles.length}`);
        return true;
      } catch (error) {
        console.error('❌ Error writing graph:', error.message);
      }
    }

    return false;
  }

  /**
   * Setup file watchers with debounce
   */
  setupWatchers() {
    const dirs = [this.srcDir, this.serverDir, this.flutterDir];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        console.log(`⚠️  Directory not found: ${dir}`);
        return;
      }

      const watcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
        const changedPath = filename ? filename.toString().replace(/\\/g, '/') : '';
        const isIgnoredChange = changedPath.split('/').some(part =>
          this.flutterIgnoredDirectories.has(part)
        );

        if (!isIgnoredChange && !changedPath.startsWith('.') && 
            (changedPath.endsWith('.ts') || changedPath.endsWith('.tsx') ||
             changedPath.endsWith('.js') || changedPath.endsWith('.dart') ||
             changedPath.endsWith('.yaml') || changedPath.endsWith('.json') ||
             changedPath.endsWith('.rules') || changedPath.endsWith('.kt') ||
             changedPath.endsWith('.gradle') || changedPath.endsWith('.xml') ||
             changedPath.endsWith('.plist') || changedPath.endsWith('.swift') ||
             changedPath.endsWith('.html') || changedPath.endsWith('.css'))) {
          
          // Debounce: clear previous timer and set new one
          clearTimeout(this.debounceTimer);
          this.debounceTimer = setTimeout(() => {
            this.regenerateGraph();
          }, this.debounceDelay);
        }
      });

      this.watchers.push(watcher);
      console.log(`👁️  Watching: ${dir}`);
    });
  }

  /**
   * Start the watcher
   */
  start() {
    console.log('🚀 Graphify Auto-Watcher Started\n');
    console.log('📁 Monitoring directories:');
    console.log(`   • ${this.srcDir}`);
    console.log(`   • ${this.serverDir}`);
    console.log(`   • ${this.flutterDir} (excluding generated/dependency folders)\n`);

    // Initial regeneration
    this.regenerateGraph();

    // Setup watchers
    this.setupWatchers();

    console.log('✅ Watcher is live! New files will auto-update the graph.\n');
    console.log('Press Ctrl+C to stop.\n');
  }

  /**
   * Stop the watcher
   */
  stop() {
    console.log('\n🛑 Stopping watcher...');
    this.watchers.forEach(watcher => watcher.close());
    process.exit(0);
  }
}

// Start the watcher
const watcher = new GraphifyWatcher();
watcher.start();

// Handle graceful shutdown
process.on('SIGINT', () => watcher.stop());
process.on('SIGTERM', () => watcher.stop());
