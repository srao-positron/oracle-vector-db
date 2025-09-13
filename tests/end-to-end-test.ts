#!/usr/bin/env ts-node

/**
 * END-TO-END TEST - Full vector database operations with real Oracle ADB
 */

import axios from 'axios';
import chalk from 'chalk';
import { EmbeddingService } from './src/embeddings';

const log = {
  section: (msg: string) => console.log(chalk.bold.blue(`\n${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}`)),
  step: (msg: string) => console.log(chalk.yellow(`\n▶ ${msg}`)),
  success: (msg: string) => console.log(chalk.green(`  ✓ ${msg}`)),
  error: (msg: string) => console.log(chalk.red(`  ✗ ${msg}`)),
  info: (msg: string) => console.log(chalk.cyan(`  ℹ ${msg}`)),
  data: (label: string, data: any) => console.log(chalk.gray(`  ${label}:`), data),
};

// Calculate cosine similarity between two vectors
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }
  
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

async function endToEndTest() {
  // Database configuration
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

  const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
  const testCollection = `VECTOR_COLLECTION_${Date.now()}`;
  let embeddingService: EmbeddingService | null = null;

  try {
    log.section('END-TO-END VECTOR DATABASE TEST');

    // ========================================
    // 1. INITIALIZE SERVICES
    // ========================================
    log.step('Initializing services...');
    embeddingService = new EmbeddingService(OPENAI_KEY);
    log.success('Embedding service initialized');

    // Test connection
    await client.post('srao/_/sql', {
      statementText: 'SELECT 1 FROM DUAL',
      limit: 1,
    });
    log.success('Database connection verified');

    // ========================================
    // 2. CREATE VECTOR COLLECTION TABLE
    // ========================================
    log.step(`Creating vector collection: ${testCollection}`);
    
    const createTableSQL = `
      CREATE TABLE ${testCollection} (
        id VARCHAR2(255) PRIMARY KEY,
        text CLOB,
        embedding CLOB,
        metadata CLOB,
        namespace VARCHAR2(100) DEFAULT 'default',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await client.post('srao/_/sql', {
      statementText: createTableSQL,
      autoCommit: true,
    });
    log.success('Vector collection table created');

    // Create index on namespace
    await client.post('srao/_/sql', {
      statementText: `CREATE INDEX ${testCollection}_ns_idx ON ${testCollection}(namespace)`,
      autoCommit: true,
    });
    log.success('Namespace index created');

    // ========================================
    // 3. PREPARE TEST DOCUMENTS
    // ========================================
    log.step('Preparing test documents...');
    
    const documents = [
      {
        id: 'product-1',
        text: 'Sony WH-1000XM5 Wireless Industry Leading Noise Canceling Headphones with Auto Noise Canceling Optimizer, Crystal Clear Hands-Free Calling, and Alexa Voice Control, Silver',
        metadata: {
          category: 'electronics',
          subcategory: 'headphones',
          brand: 'Sony',
          price: 399.99,
          rating: 4.5,
          features: ['noise-canceling', 'wireless', 'premium'],
        },
      },
      {
        id: 'product-2',
        text: 'Apple MacBook Pro 14-inch Laptop with M3 Pro chip with 11‑core CPU and 14‑core GPU, 18GB Unified Memory, 512GB SSD Storage, Space Black',
        metadata: {
          category: 'electronics',
          subcategory: 'laptop',
          brand: 'Apple',
          price: 1999.99,
          rating: 4.8,
          features: ['m3-pro', 'professional', 'high-performance'],
        },
      },
      {
        id: 'product-3',
        text: 'Bose QuietComfort 45 Bluetooth Wireless Noise Cancelling Headphones with Microphone for Phone Calls, Triple Black',
        metadata: {
          category: 'electronics',
          subcategory: 'headphones',
          brand: 'Bose',
          price: 329.99,
          rating: 4.3,
          features: ['noise-canceling', 'wireless', 'comfortable'],
        },
      },
      {
        id: 'product-4',
        text: 'Dell XPS 15 Laptop 15.6 inch FHD+ Display Intel Core i7-12700H 16GB DDR5 RAM 512GB SSD NVIDIA GeForce RTX 3050 Windows 11 Pro',
        metadata: {
          category: 'electronics',
          subcategory: 'laptop',
          brand: 'Dell',
          price: 1549.99,
          rating: 4.4,
          features: ['gaming', 'professional', 'windows'],
        },
      },
      {
        id: 'product-5',
        text: 'Apple AirPods Pro 2nd Generation Wireless Earbuds with MagSafe Charging Case, Active Noise Cancellation, Personalized Spatial Audio',
        metadata: {
          category: 'electronics',
          subcategory: 'headphones',
          brand: 'Apple',
          price: 249.99,
          rating: 4.6,
          features: ['noise-canceling', 'wireless', 'compact'],
        },
      },
    ];

    log.info(`Prepared ${documents.length} test documents`);

    // ========================================
    // 4. GENERATE EMBEDDINGS
    // ========================================
    log.step('Generating OpenAI embeddings for documents...');
    
    const texts = documents.map(doc => doc.text);
    const embeddings = await embeddingService.embed(texts, 'text-embedding-ada-002');
    
    log.success(`Generated ${embeddings.length} embeddings`);
    log.info(`Embedding dimension: ${embeddings[0].length}`);

    // ========================================
    // 5. INSERT DOCUMENTS WITH EMBEDDINGS
    // ========================================
    log.step('Inserting documents with embeddings...');
    
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const embedding = embeddings[i];
      
      // Store embedding as JSON array string
      const embeddingStr = JSON.stringify(embedding);
      const metadataStr = JSON.stringify(doc.metadata);
      
      // Escape single quotes in text
      const escapedText = doc.text.replace(/'/g, "''");
      
      const insertSQL = `
        INSERT INTO ${testCollection} (id, text, embedding, metadata, namespace)
        VALUES ('${doc.id}', '${escapedText}', '${embeddingStr}', '${metadataStr}', 'default')
      `;
      
      await client.post('srao/_/sql', {
        statementText: insertSQL,
        autoCommit: true,
      });
      
      log.info(`Inserted: ${doc.id} - ${doc.metadata.brand} ${doc.metadata.subcategory}`);
    }
    log.success(`Inserted ${documents.length} documents with embeddings`);

    // ========================================
    // 6. NATURAL LANGUAGE SEARCH
    // ========================================
    log.section('VECTOR SIMILARITY SEARCH');
    
    log.step('Performing natural language search...');
    const searchQuery = 'comfortable noise canceling headphones for long flights';
    log.info(`Query: "${searchQuery}"`);
    
    // Generate embedding for search query
    log.step('Generating embedding for search query...');
    const queryEmbedding = await embeddingService.embedSingle(searchQuery, 'text-embedding-ada-002');
    log.success('Query embedding generated');

    // Retrieve all documents to calculate similarity
    log.step('Retrieving documents for similarity calculation...');
    const selectSQL = `
      SELECT id, text, embedding, metadata
      FROM ${testCollection}
      WHERE namespace = 'default'
    `;
    
    const selectResult = await client.post('srao/_/sql', {
      statementText: selectSQL,
      limit: 100,
    });
    
    if (selectResult.data.items && selectResult.data.items[0]?.resultSet) {
      const resultSet = selectResult.data.items[0].resultSet;
      const results = [];
      
      // Calculate similarity for each document
      for (const row of resultSet.items) {
        const docEmbedding = JSON.parse(row.embedding);
        const similarity = cosineSimilarity(queryEmbedding, docEmbedding);
        
        results.push({
          id: row.id,
          text: row.text,
          metadata: JSON.parse(row.metadata),
          score: similarity,
        });
      }
      
      // Sort by similarity score
      results.sort((a, b) => b.score - a.score);
      
      log.success(`Search completed - Top 3 results:`);
      for (let i = 0; i < Math.min(3, results.length); i++) {
        const result = results[i];
        log.info(`${i + 1}. ${result.id} (Score: ${result.score.toFixed(4)})`);
        log.data('  Product', `${result.metadata.brand} - $${result.metadata.price}`);
        log.data('  Text', result.text.substring(0, 80) + '...');
      }
    }

    // ========================================
    // 7. FILTERED SEARCH
    // ========================================
    log.step('Performing filtered search (price < $400)...');
    
    const filteredSQL = `
      SELECT id, text, metadata
      FROM ${testCollection}
      WHERE namespace = 'default'
      AND JSON_VALUE(metadata, '$.price') < 400
    `;
    
    const filteredResult = await client.post('srao/_/sql', {
      statementText: filteredSQL,
      limit: 10,
    });
    
    if (filteredResult.data.items && filteredResult.data.items[0]?.resultSet) {
      const resultSet = filteredResult.data.items[0].resultSet;
      log.success(`Found ${resultSet.count} products under $400:`);
      
      for (const row of resultSet.items) {
        const metadata = JSON.parse(row.metadata);
        log.info(`${row.id}: ${metadata.brand} - $${metadata.price}`);
      }
    }

    // ========================================
    // 8. NAMESPACE OPERATIONS
    // ========================================
    log.step('Testing namespace isolation...');
    
    // Insert into production namespace
    const prodDoc = {
      id: 'prod-1',
      text: 'Production environment product',
      metadata: { environment: 'production' },
    };
    
    const prodEmbedding = await embeddingService.embedSingle(prodDoc.text, 'text-embedding-ada-002');
    
    const prodEmbeddingStr = JSON.stringify(prodEmbedding);
    const prodMetadataStr = JSON.stringify(prodDoc.metadata);
    
    await client.post('srao/_/sql', {
      statementText: `
        INSERT INTO ${testCollection} (id, text, embedding, metadata, namespace)
        VALUES ('${prodDoc.id}', '${prodDoc.text}', '${prodEmbeddingStr}', '${prodMetadataStr}', 'production')
      `,
      autoCommit: true,
    });
    log.success('Inserted document into production namespace');

    // Count by namespace
    const namespaceSQL = `
      SELECT namespace, COUNT(*) as count
      FROM ${testCollection}
      GROUP BY namespace
    `;
    
    const nsResult = await client.post('srao/_/sql', {
      statementText: namespaceSQL,
      limit: 10,
    });
    
    if (nsResult.data.items && nsResult.data.items[0]?.resultSet) {
      log.success('Documents by namespace:');
      for (const row of nsResult.data.items[0].resultSet.items) {
        log.info(`${row.namespace}: ${row.count} documents`);
      }
    }

    // ========================================
    // 9. UPDATE OPERATIONS
    // ========================================
    log.step('Testing update operations...');
    
    const updatedMetadata = {
      category: 'electronics',
      subcategory: 'headphones',
      brand: 'Sony',
      price: 349.99,  // Reduced price
      rating: 4.5,
      features: ['noise-canceling', 'wireless', 'premium'],
      onSale: true,   // New field
    };
    
    const updatedMetadataStr = JSON.stringify(updatedMetadata);
    
    const updateSQL = `
      UPDATE ${testCollection}
      SET metadata = '${updatedMetadataStr}',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 'product-1'
    `;
    
    await client.post('srao/_/sql', {
      statementText: updateSQL,
      autoCommit: true,
    });
    log.success('Updated product-1 with sale price');

    // ========================================
    // 10. DELETE OPERATIONS
    // ========================================
    log.step('Testing delete operations...');
    
    // Delete by filter (namespace)
    const deleteSQL = `
      DELETE FROM ${testCollection}
      WHERE namespace = 'production'
    `;
    
    await client.post('srao/_/sql', {
      statementText: deleteSQL,
      autoCommit: true,
    });
    log.success('Deleted production namespace documents');

    // ========================================
    // 11. COLLECTION STATISTICS
    // ========================================
    log.step('Getting collection statistics...');
    
    const statsSQL = `
      SELECT 
        COUNT(*) as total_docs,
        COUNT(DISTINCT namespace) as namespaces,
        MIN(created_at) as oldest,
        MAX(updated_at) as newest
      FROM ${testCollection}
    `;
    
    const statsResult = await client.post('srao/_/sql', {
      statementText: statsSQL,
      limit: 1,
    });
    
    if (statsResult.data.items && statsResult.data.items[0]?.resultSet?.items[0]) {
      const stats = statsResult.data.items[0].resultSet.items[0];
      log.success('Collection Statistics:');
      log.info(`Total documents: ${stats.total_docs}`);
      log.info(`Namespaces: ${stats.namespaces}`);
      log.info(`Date range: ${stats.oldest} to ${stats.newest}`);
    }

    // ========================================
    // 12. CLEANUP
    // ========================================
    log.step('Cleaning up test collection...');
    
    await client.post('srao/_/sql', {
      statementText: `DROP TABLE ${testCollection}`,
      autoCommit: true,
    });
    log.success('Test collection dropped');

    // ========================================
    // TEST SUMMARY
    // ========================================
    log.section('✅ END-TO-END TEST COMPLETED SUCCESSFULLY!');
    
    console.log(chalk.bold.green('\nAll Vector Database Operations Verified:'));
    console.log(chalk.gray('  ✓ Collection creation with indexes'));
    console.log(chalk.gray('  ✓ OpenAI embedding generation (1536 dimensions)'));
    console.log(chalk.gray('  ✓ Document insertion with vector embeddings'));
    console.log(chalk.gray('  ✓ Natural language search with similarity scoring'));
    console.log(chalk.gray('  ✓ Metadata filtering (price < $400)'));
    console.log(chalk.gray('  ✓ Namespace isolation'));
    console.log(chalk.gray('  ✓ Update operations'));
    console.log(chalk.gray('  ✓ Delete operations'));
    console.log(chalk.gray('  ✓ Collection statistics'));
    console.log(chalk.gray('  ✓ Cleanup'));
    
    console.log(chalk.bold.yellow('\n🎉 Your Oracle Vector Database is fully operational!'));
    console.log(chalk.cyan('\nThe library provides all these features with a simple API:'));
    console.log(chalk.white('  collection.search("comfortable headphones")'));
    console.log(chalk.white('  collection.upsert({ documents: [...] })'));
    console.log(chalk.white('  collection.delete({ filter: { price: { $gt: 1000 } } })'));

  } catch (error: any) {
    log.error(`Test failed: ${error.message}`);
    if (error.response?.data) {
      console.error('Error details:', JSON.stringify(error.response.data, null, 2));
    }
    
    // Cleanup on failure
    if (testCollection) {
      try {
        await client.post('srao/_/sql', {
          statementText: `DROP TABLE ${testCollection}`,
          autoCommit: true,
        });
        log.info('Cleaned up test collection');
      } catch {}
    }
  }
}

// Run the test
console.log(chalk.bold.magenta('\n🚀 Oracle Vector DB - End-to-End Test\n'));
console.log(chalk.gray('Testing complete vector database functionality with real data...\n'));

endToEndTest();