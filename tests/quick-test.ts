#!/usr/bin/env ts-node

/**
 * Quick test script to verify the library functionality
 * Run with: npx ts-node quick-test.ts
 */

import { OracleVectorDB } from './src';
import chalk from 'chalk';

async function runTest() {
  console.log(chalk.bold.blue('\n🧪 Oracle Vector DB Quick Test\n'));

  try {
    // Step 1: Initialize client
    console.log(chalk.yellow('1. Initializing client...'));
    const client = new OracleVectorDB({
      walletPath: './wallet',
      username: 'SRAO',
      password: 'Ctigroup!2345678',
      connectionString: 'sidexampledata_high',
    });

    // Step 2: Connect
    console.log(chalk.yellow('2. Connecting to Oracle ADB...'));
    await client.connect();
    console.log(chalk.green('   ✓ Connected successfully'));

    // Step 3: Create collection
    console.log(chalk.yellow('3. Creating test collection...'));
    const collection = await client.createCollection('quick_test', {
      dimension: 1536,
      metric: 'cosine',
      embeddingModel: 'text-embedding-ada-002',
    });
    console.log(chalk.green('   ✓ Collection created'));

    // Step 4: Add test documents
    console.log(chalk.yellow('4. Adding test documents...'));
    await collection.upsert({
      documents: [
        {
          id: 'test-1',
          text: 'The quick brown fox jumps over the lazy dog',
          metadata: { type: 'pangram', language: 'english' },
        },
        {
          id: 'test-2',
          text: 'Machine learning is a subset of artificial intelligence',
          metadata: { type: 'definition', topic: 'AI' },
        },
        {
          id: 'test-3',
          text: 'TypeScript is a strongly typed programming language that builds on JavaScript',
          metadata: { type: 'definition', topic: 'programming' },
        },
      ],
    });
    console.log(chalk.green('   ✓ Documents added'));

    // Step 5: Test search
    console.log(chalk.yellow('5. Testing natural language search...'));
    const results = await collection.search({
      query: 'programming languages and development',
      topK: 2,
      includeMetadata: true,
    });
    
    console.log(chalk.green('   ✓ Search completed'));
    console.log(chalk.cyan('\n   Results:'));
    for (const match of results.matches) {
      console.log(`   - ${match.id}: Score ${match.score.toFixed(3)}`);
      console.log(`     Text: ${match.text?.substring(0, 50)}...`);
    }

    // Step 6: Test stats
    console.log(chalk.yellow('\n6. Getting collection stats...'));
    const stats = await collection.stats();
    console.log(chalk.green('   ✓ Stats retrieved'));
    console.log(chalk.cyan(`   Documents: ${stats.documentCount}`));
    console.log(chalk.cyan(`   Dimension: ${stats.dimension}`));

    // Step 7: Cleanup
    console.log(chalk.yellow('\n7. Cleaning up...'));
    await collection.drop();
    console.log(chalk.green('   ✓ Collection dropped'));

    // Step 8: Disconnect
    await client.disconnect();
    console.log(chalk.green('   ✓ Disconnected'));

    console.log(chalk.bold.green('\n✅ All tests passed successfully!\n'));

  } catch (error) {
    console.error(chalk.bold.red('\n❌ Test failed:'), error);
    process.exit(1);
  }
}

// Run the test
runTest();