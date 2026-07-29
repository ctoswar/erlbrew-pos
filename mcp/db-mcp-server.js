#!/usr/bin/env node

/**
 * MCP Server for Database Queries
 * Allows Copilot to query MySQL/SQLite directly
 */

import sqlite3 from 'sqlite3';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

class DatabaseMCPServer {
  constructor() {
    this.dbType = process.env.DB_TYPE || 'mysql';
    this.mysqlConfig = {
      host: process.env.DB_HOST || '192.168.75.101',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'gameclub11',
      database: process.env.DB_NAME || 'erlbrew_pos',
      port: process.env.DB_PORT || 3306
    };
    this.sqliteDb = null;
  }

  async initMySQL() {
    try {
      const connection = await mysql.createConnection(this.mysqlConfig);
      console.log('✓ MySQL connected');
      return connection;
    } catch (error) {
      console.error('✗ MySQL connection failed:', error.message);
      throw error;
    }
  }

  initSQLite() {
    const dbPath = path.join(projectRoot, 'erlbrew_pos.db');
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('✗ SQLite connection failed:', err.message);
          reject(err);
        } else {
          console.log('✓ SQLite connected');
          resolve(db);
        }
      });
    });
  }

  async queryMySQL(sql) {
    const connection = await this.initMySQL();
    try {
      const [results] = await connection.execute(sql);
      await connection.end();
      return results;
    } catch (error) {
      throw new Error(`Query failed: ${error.message}`);
    }
  }

  querySQLite(sql) {
    return new Promise((resolve, reject) => {
      if (!this.sqliteDb) {
        reject(new Error('SQLite database not initialized'));
        return;
      }
      this.sqliteDb.all(sql, (err, rows) => {
        if (err) reject(new Error(`Query failed: ${err.message}`));
        else resolve(rows);
      });
    });
  }

  async query(sql) {
    if (this.dbType === 'mysql') {
      return await this.queryMySQL(sql);
    } else {
      return await this.querySQLite(sql);
    }
  }

  // Common useful queries
  async getSchema() {
    if (this.dbType === 'mysql') {
      return await this.queryMySQL(`
        SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = '${this.mysqlConfig.database}'
        ORDER BY TABLE_NAME, ORDINAL_POSITION
      `);
    }
  }

  async getTables() {
    if (this.dbType === 'mysql') {
      return await this.queryMySQL(`
        SELECT TABLE_NAME, TABLE_ROWS, DATA_LENGTH
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = '${this.mysqlConfig.database}'
      `);
    }
  }

  async getForeignKeys() {
    if (this.dbType === 'mysql') {
      return await this.queryMySQL(`
        SELECT 
          CONSTRAINT_NAME,
          TABLE_NAME,
          COLUMN_NAME,
          REFERENCED_TABLE_NAME,
          REFERENCED_COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = '${this.mysqlConfig.database}'
        AND REFERENCED_TABLE_NAME IS NOT NULL
      `);
    }
  }

  static getInfo() {
    return {
      name: 'database-mcp',
      version: '1.0.0',
      capabilities: ['query', 'schema', 'audit'],
      description: 'MCP server for direct database queries (MySQL/SQLite)'
    };
  }
}

// Export for MCP usage
export default DatabaseMCPServer;

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new DatabaseMCPServer();
  
  if (process.argv[2] === 'schema') {
    const schema = await server.getSchema();
    console.log(JSON.stringify(schema, null, 2));
  } else if (process.argv[2] === 'tables') {
    const tables = await server.getTables();
    console.log(JSON.stringify(tables, null, 2));
  } else if (process.argv[2] === 'fk') {
    const fks = await server.getForeignKeys();
    console.log(JSON.stringify(fks, null, 2));
  } else if (process.argv[2]) {
    const result = await server.query(process.argv[2]);
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(DatabaseMCPServer.getInfo());
  }
}
