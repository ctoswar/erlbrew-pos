#!/usr/bin/env node

import mysql from 'mysql2/promise';

async function testConnection() {
  try {
    console.log('🔍 Testing MySQL connection to 192.168.75.101:3306...\n');
    
    const connection = await mysql.createConnection({
      host: '192.168.75.101',
      user: 'root',
      password: 'gameclub11',
      database: 'erlbrew_pos',
      port: 3306
    });

    console.log('✅ Connected successfully!\n');

    // Test 1: List all tables
    console.log('📊 Tables in database:');
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME, TABLE_ROWS FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = 'erlbrew_pos'
    `);
    console.table(tables);

    // Test 2: Get schema
    console.log('\n📋 Database Schema:');
    const [schema] = await connection.execute(`
      SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'erlbrew_pos'
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);
    console.table(schema);

    // Test 3: Recent orders
    console.log('\n📦 Last 5 Orders:');
    const [orders] = await connection.execute(`
      SELECT id, customer_name, total, status, created_at 
      FROM orders 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    console.table(orders);

    // Test 4: Staff info
    console.log('\n👥 Staff Members:');
    const [staff] = await connection.execute(`
      SELECT id, name, role, rfid FROM staff
    `);
    console.table(staff);

    // Test 5: Time records today
    console.log('\n⏰ Time Records (Last 5):');
    const [timeRecords] = await connection.execute(`
      SELECT id, staff_id, clock_in, clock_out, total_hours 
      FROM time_records 
      ORDER BY clock_in DESC 
      LIMIT 5
    `);
    console.table(timeRecords);

    await connection.end();
    console.log('\n✅ All tests passed!\n');

  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Is MySQL running on Raspberry Pi?');
    console.error('2. Is the password correct (gameclub11)?');
    console.error('3. Is the database named erlbrew_pos?');
    console.error('4. Is firewall allowing port 3306?');
  }
}

testConnection();
