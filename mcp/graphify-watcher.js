#!/usr/bin/env node

/**
 * Graphify Auto-Watcher (Fixed)
 * Monitors src/ and server/ for architectural components only
 * Skips individual source files — only tracks components, hooks, routes, services
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
    this.graphFile = path.join(this.projectRoot, '.graph', 'architecture.json');
    this.watchers = [];
    this.debounceTimer = null;
    this.debounceDelay = 2000;
  }

  /**
   * Scan src/components for React components
   */
  scanComponents() {
    const components = [];
    const dir = path.join(this.srcDir, 'components');
    if (!fs.existsSync(dir)) return components;

    try {
      fs.readdirSync(dir).forEach(file => {
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
    } catch (e) { console.error('Error scanning components:', e.message); }
    return components;
  }

  /**
   * Scan src/hooks for custom hooks
   */
  scanHooks() {
    const hooks = [];
    const dir = path.join(this.srcDir, 'hooks');
    if (!fs.existsSync(dir)) return hooks;

    try {
      fs.readdirSync(dir).forEach(file => {
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
    } catch (e) { console.error('Error scanning hooks:', e.message); }
    return hooks;
  }

  /**
   * Scan src/utils for utility modules
   */
  scanUtils() {
    const utils = [];
    const dir = path.join(this.srcDir, 'utils');
    if (!fs.existsSync(dir)) return utils;

    try {
      fs.readdirSync(dir).forEach(file => {
        if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          const name = file.replace(/\.(tsx|ts)$/, '');
          utils.push({
            id: `util-${name.toLowerCase()}`,
            label: `${name}.ts`,
            type: 'util',
            community: 'frontend',
            file: file
          });
        }
      });
    } catch (e) { console.error('Error scanning utils:', e.message); }
    return utils;
  }

  /**
   * Scan server/src/routes for API endpoints
   */
  scanRoutes() {
    const routes = [];
    const dir = path.join(this.serverDir, 'src', 'routes');
    if (!fs.existsSync(dir)) return routes;

    try {
      fs.readdirSync(dir).forEach(file => {
        if (file.endsWith('.js')) {
          const name = file.replace(/\.js$/, '');
          routes.push({
            id: `route-${name.toLowerCase()}`,
            label: `routes/${name}.js`,
            type: 'route',
            community: 'backend',
            file: file
          });
        }
      });
    } catch (e) { console.error('Error scanning routes:', e.message); }
    return routes;
  }

  /**
   * Scan server/src/services
   */
  scanServices() {
    const services = [];
    const dir = path.join(this.serverDir, 'src', 'services');
    if (!fs.existsSync(dir)) return services;

    try {
      fs.readdirSync(dir).forEach(file => {
        if (file.endsWith('.js')) {
          const name = file.replace(/\.js$/, '');
          services.push({
            id: `service-${name.toLowerCase()}`,
            label: `services/${name}.js`,
            type: 'service',
            community: 'backend',
            file: file
          });
        }
      });
    } catch (e) { console.error('Error scanning services:', e.message); }
    return services;
  }

  /**
   * Scan Flutter lib/screens only (not every file)
   */
  scanFlutterScreens() {
    const screens = [];
    const screensDir = path.join(this.flutterDir, 'lib', 'screens');
    if (!fs.existsSync(screensDir)) return screens;

    const scanDir = (dir, prefix = '') => {
      try {
        fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
          if (entry.isDirectory()) {
            scanDir(path.join(dir, entry.name), `${prefix}${entry.name}/`);
          } else if (entry.name.endsWith('.dart')) {
            const name = entry.name.replace('.dart', '');
            screens.push({
              id: `flutter-${prefix.replace(/\//g, '-')}${name}`.toLowerCase(),
              label: `screens/${prefix}${name}.dart`,
              type: 'screen',
              community: 'mobile',
              file: `erlbrew_app/lib/screens/${prefix}${name}.dart`
            });
          }
        });
      } catch (e) {}
    };

    scanDir(screensDir);
    return screens;
  }

  /**
   * Load existing edges from architecture.json
   */
  loadCurrentGraph() {
    try {
      if (fs.existsSync(this.graphFile)) {
        return JSON.parse(fs.readFileSync(this.graphFile, 'utf8'));
      }
    } catch (e) { console.error('Error loading graph:', e.message); }
    return null;
  }

  /**
   * Regenerate architecture.json with only architectural nodes
   */
  regenerateGraph() {
    console.log('🔄 Regenerating graph...');

    const currentGraph = this.loadCurrentGraph() || { nodes: [], edges: [] };

    // Scan only architectural components
    const components = this.scanComponents();
    const hooks = this.scanHooks();
    const utils = this.scanUtils();
    const routes = this.scanRoutes();
    const services = this.scanServices();
    const flutterScreens = this.scanFlutterScreens();

    // Fixed architectural nodes (always include)
    const fixedNodes = [
      // Entry points
      { id: 'app', label: 'App.tsx', type: 'entry', community: 'frontend' },
      { id: 'server', label: 'server/index.js', type: 'server', community: 'backend' },
      { id: 'db', label: 'MySQL Database', type: 'database', community: 'data' },
      
      // Types
      { id: 'types', label: 'types/index.ts', type: 'types', community: 'frontend' },
      
      // Middleware
      { id: 'middleware-auth', label: 'middleware/auth.js', type: 'middleware', community: 'backend' },
      
      // Database tables
      { id: 'table-staff', label: 'staff', type: 'table', community: 'data' },
      { id: 'table-menu', label: 'menu_items', type: 'table', community: 'data' },
      { id: 'table-orders', label: 'orders', type: 'table', community: 'data' },
      { id: 'table-orderitems', label: 'order_items', type: 'table', community: 'data' },
      { id: 'table-inventory', label: 'inventory', type: 'table', community: 'data' },
      { id: 'table-inventorymovements', label: 'inventory_movements', type: 'table', community: 'data' },
      { id: 'table-recipes', label: 'recipes', type: 'table', community: 'data' },
      { id: 'table-cashdrawer', label: 'cash_drawer', type: 'table', community: 'data' },
      { id: 'table-cashdrawertransactions', label: 'cash_drawer_transactions', type: 'table', community: 'data' },
      { id: 'table-timerecords', label: 'time_records', type: 'table', community: 'data' },
      { id: 'table-companysettings', label: 'company_settings', type: 'table', community: 'data' },
      { id: 'table-supplierinvoices', label: 'supplier_invoices', type: 'table', community: 'data' },
      { id: 'table-auditlog', label: 'audit_log', type: 'table', community: 'data' },
      
      // Flutter entry
      { id: 'flutter-app', label: 'erlbrew_app (Flutter)', type: 'entry', community: 'mobile' },
    ];

    // Merge: fixed + auto-detected (deduplicate by id)
    const allNodes = new Map();
    fixedNodes.forEach(n => allNodes.set(n.id, n));
    [...components, ...hooks, ...utils, ...routes, ...services, ...flutterScreens].forEach(n => {
      if (!allNodes.has(n.id)) allNodes.set(n.id, n);
    });

    const mergedNodes = Array.from(allNodes.values());

    // Keep existing edges
    const edges = currentGraph.edges || [];

    const updatedGraph = {
      nodes: mergedNodes,
      edges: edges,
      metadata: {
        projectName: 'erlbrew-pos',
        description: 'Restaurant POS System with Timekeeping & Print Integration',
        version: '2.0.0',
        components: components.length,
        hooks: hooks.length,
        utils: utils.length,
        routes: routes.length,
        services: services.length,
        flutter_screens: flutterScreens.length,
        total_nodes: mergedNodes.length,
        total_edges: edges.length,
        last_updated: new Date().toISOString()
      }
    };

    try {
      if (!fs.existsSync(path.join(this.projectRoot, '.graph'))) {
        fs.mkdirSync(path.join(this.projectRoot, '.graph'), { recursive: true });
      }
      fs.writeFileSync(this.graphFile, JSON.stringify(updatedGraph, null, 2));
      console.log(`✅ Graph updated: ${mergedNodes.length} nodes, ${edges.length} edges`);
      console.log(`   Components: ${components.length} | Hooks: ${hooks.length} | Utils: ${utils.length}`);
      console.log(`   Routes: ${routes.length} | Services: ${services.length} | Flutter: ${flutterScreens.length}`);
      return true;
    } catch (e) {
      console.error('❌ Error writing graph:', e.message);
      return false;
    }
  }

  /**
   * Setup file watchers
   */
  setupWatchers() {
    const dirs = [
      path.join(this.srcDir, 'components'),
      path.join(this.srcDir, 'hooks'),
      path.join(this.srcDir, 'utils'),
      path.join(this.serverDir, 'src', 'routes'),
      path.join(this.serverDir, 'src', 'services'),
      path.join(this.flutterDir, 'lib', 'screens')
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) return;

      const watcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        const ext = path.extname(filename);
        if (['.ts', '.tsx', '.js', '.dart'].includes(ext)) {
          clearTimeout(this.debounceTimer);
          this.debounceTimer = setTimeout(() => this.regenerateGraph(), this.debounceDelay);
        }
      });

      this.watchers.push(watcher);
      console.log(`👁️  Watching: ${path.relative(this.projectRoot, dir)}`);
    });
  }

  start() {
    console.log('🚀 Graphify Auto-Watcher Started\n');
    this.regenerateGraph();
    this.setupWatchers();
    console.log('\n✅ Watcher is live! Press Ctrl+C to stop.\n');
  }

  stop() {
    this.watchers.forEach(w => w.close());
    process.exit(0);
  }
}

const watcher = new GraphifyWatcher();
watcher.start();
process.on('SIGINT', () => watcher.stop());
process.on('SIGTERM', () => watcher.stop());
