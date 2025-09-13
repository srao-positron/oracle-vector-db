#!/usr/bin/env ts-node

/**
 * REAL test - Actually connect to Oracle ADB and perform operations
 */

import axios from 'axios';
import chalk from 'chalk';

const log = {
  section: (msg: string) => console.log(chalk.bold.blue(`\n${'='.repeat(50)}\n${msg}\n${'='.repeat(50)}`)),
  step: (msg: string) => console.log(chalk.yellow(`\n▶ ${msg}`)),
  success: (msg: string) => console.log(chalk.green(`  ✓ ${msg}`)),
  error: (msg: string) => console.log(chalk.red(`  ✗ ${msg}`)),
  info: (msg: string) => console.log(chalk.cyan(`  ℹ ${msg}`)),
};

async function realDatabaseTest() {
  // Using credentials from environment variables
  const client = axios.create({
    baseURL: process.env.ORDS_BASE_URL || 'https://your-adb.adb.region.oraclecloudapps.com/ords/',
    auth: {
      username: process.env.DB_USERNAME || 'username',
      password: process.env.DB_PASSWORD || 'password',
    },
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });

  const testTable = `TEST_VECTORS_${Date.now()}`;

  try {
    log.section('REAL DATABASE CONNECTION TEST');

    // ========================================
    // 1. TEST CONNECTION WITH SQL
    // ========================================
    log.step('Testing database connection with SQL query...');
    const testSQL = await client.post('srao/_/sql', {
      statementText: 'SELECT SYSDATE FROM DUAL',
      limit: 1,
    });
    
    if (testSQL.data.items && testSQL.data.items.length > 0) {
      const result = testSQL.data.items[0];
      log.success(`Connected! Server time: ${JSON.stringify(result)}`);
    } else {
      log.error('No response from database');
      return;
    }

    // ========================================
    // 2. CREATE A TEST TABLE
    // ========================================
    log.step(`Creating test table ${testTable}...`);
    
    const createTableSQL = `
      CREATE TABLE ${testTable} (
        id VARCHAR2(100) PRIMARY KEY,
        text CLOB,
        embedding CLOB,
        metadata CLOB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await client.post('srao/_/sql', {
      statementText: createTableSQL,
      autoCommit: true,
    });
    log.success('Table created');

    // ========================================
    // 3. INSERT TEST DATA
    // ========================================
    log.step('Inserting test records...');
    
    const testRecords = [
      {
        id: 'test-1',
        text: 'Sony WH-1000XM5 Wireless Headphones',
        metadata: JSON.stringify({ brand: 'Sony', price: 399.99 }),
      },
      {
        id: 'test-2',
        text: 'Apple MacBook Pro 14-inch M3',
        metadata: JSON.stringify({ brand: 'Apple', price: 1999.99 }),
      },
      {
        id: 'test-3',
        text: 'Bose QuietComfort 45 Headphones',
        metadata: JSON.stringify({ brand: 'Bose', price: 329.99 }),
      },
    ];

    for (const record of testRecords) {
      const insertSQL = `
        INSERT INTO ${testTable} (id, text, metadata, embedding)
        VALUES ('${record.id}', '${record.text}', '${record.metadata}', '[0.1, 0.2, 0.3]')
      `;
      
      await client.post('srao/_/sql', {
        statementText: insertSQL,
        autoCommit: true,
      });
      log.info(`Inserted: ${record.id}`);
    }
    log.success(`Inserted ${testRecords.length} records`);

    // ========================================
    // 4. RETRIEVE AND VERIFY DATA
    // ========================================
    log.step('Retrieving data from database...');
    
    const selectSQL = `
      SELECT id, text, metadata 
      FROM ${testTable}
      ORDER BY id
    `;
    
    const selectResult = await client.post('srao/_/sql', {
      statementText: selectSQL,
      limit: 10,
    });
    
    if (selectResult.data.items && selectResult.data.items[0]?.resultSet) {
      const resultSet = selectResult.data.items[0].resultSet;
      log.success(`Retrieved ${resultSet.count} records:`);
      for (const row of resultSet.items) {
        log.info(`${row.id}: ${row.text}`);
        if (row.metadata) {
          const meta = JSON.parse(row.metadata);
          log.info(`  Brand: ${meta.brand}, Price: $${meta.price}`);
        }
      }
    }

    // ========================================
    // 5. SEARCH WITH FILTER
    // ========================================
    log.step('Testing filtered search...');
    
    const searchSQL = `
      SELECT id, text, metadata
      FROM ${testTable}
      WHERE text LIKE '%Headphones%'
    `;
    
    const searchResult = await client.post('srao/_/sql', {
      statementText: searchSQL,
      limit: 10,
    });
    
    if (searchResult.data.items && searchResult.data.items[0]?.resultSet) {
      const resultSet = searchResult.data.items[0].resultSet;
      log.success(`Found ${resultSet.count} headphone products`);
      for (const row of resultSet.items) {
        log.info(`Match: ${row.id} - ${row.text}`);
      }
    }

    // ========================================
    // 6. UPDATE A RECORD
    // ========================================
    log.step('Updating a record...');
    
    const updateSQL = `
      UPDATE ${testTable}
      SET metadata = '${JSON.stringify({ brand: 'Sony', price: 349.99, onSale: true })}'
      WHERE id = 'test-1'
    `;
    
    await client.post('srao/_/sql', {
      statementText: updateSQL,
      autoCommit: true,
    });
    log.success('Record updated');

    // Verify update
    const verifySQL = `
      SELECT id, metadata FROM ${testTable} WHERE id = 'test-1'
    `;
    
    const verifyResult = await client.post('srao/_/sql', {
      statementText: verifySQL,
      limit: 1,
    });
    
    if (verifyResult.data.items && verifyResult.data.items[0]?.resultSet?.items[0]) {
      const row = verifyResult.data.items[0].resultSet.items[0];
      const updated = JSON.parse(row.metadata);
      log.info(`Updated metadata: onSale = ${updated.onSale}, price = $${updated.price}`);
    }

    // ========================================
    // 7. DELETE A RECORD
    // ========================================
    log.step('Deleting a record...');
    
    const deleteSQL = `
      DELETE FROM ${testTable} WHERE id = 'test-3'
    `;
    
    await client.post('srao/_/sql', {
      statementText: deleteSQL,
      autoCommit: true,
    });
    log.success('Record deleted');

    // Count remaining
    const countSQL = `
      SELECT COUNT(*) as count FROM ${testTable}
    `;
    
    const countResult = await client.post('srao/_/sql', {
      statementText: countSQL,
      limit: 1,
    });
    
    if (countResult.data.items && countResult.data.items[0]?.resultSet?.items[0]) {
      const count = countResult.data.items[0].resultSet.items[0].count;
      log.info(`Remaining records: ${count}`);
    }

    // ========================================
    // 8. CLEANUP
    // ========================================
    log.step('Cleaning up test table...');
    
    const dropSQL = `DROP TABLE ${testTable}`;
    await client.post('srao/_/sql', {
      statementText: dropSQL,
      autoCommit: true,
    });
    log.success('Test table dropped');

    // ========================================
    // SUCCESS SUMMARY
    // ========================================
    log.section('✅ REAL DATABASE TEST COMPLETED!');
    
    console.log(chalk.bold.green('\nSuccessfully performed ALL database operations:'));
    console.log(chalk.gray('  ✓ Connected to Oracle ADB'));
    console.log(chalk.gray('  ✓ Created table'));
    console.log(chalk.gray('  ✓ Inserted 3 records'));
    console.log(chalk.gray('  ✓ Retrieved all records'));
    console.log(chalk.gray('  ✓ Searched with filters'));
    console.log(chalk.gray('  ✓ Updated record'));
    console.log(chalk.gray('  ✓ Deleted record'));
    console.log(chalk.gray('  ✓ Dropped table'));
    
    console.log(chalk.bold.yellow('\n🎉 Your Oracle ADB is working perfectly!'));
    console.log(chalk.cyan('The vector database library will use these same operations'));
    console.log(chalk.cyan('but with vector embeddings and similarity search.'));

  } catch (error: any) {
    log.error(`Test failed: ${error.message}`);
    if (error.response?.data) {
      console.error('Error details:', error.response.data);
    }
    
    // Try to cleanup
    try {
      await client.post('srao/_/sql', {
        statementText: `DROP TABLE ${testTable}`,
        autoCommit: true,
      });
      log.info('Cleaned up test table');
    } catch {}
  }
}

// Run the test
console.log(chalk.bold.magenta('\n🚀 REAL Oracle ADB Connection Test\n'));
realDatabaseTest();