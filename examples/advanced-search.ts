import { OracleVectorDB } from '../src';

async function advancedSearchExample() {
  const client = new OracleVectorDB({
    walletPath: './wallet',
    username: 'SRAO',
    password: 'Ctigroup!2345678',
    connectionString: 'sidexampledata_high',
  });

  await client.connect();

  // Assume collection already exists
  const collection = await client.getCollection('knowledge_base');

  // Example 1: Simple semantic search with auto-embedding
  console.log('=== Simple Semantic Search ===');
  const simpleResults = await collection.search({
    query: 'How to implement authentication in Node.js?',
    topK: 5,
    includeMetadata: true,
  });

  // Example 2: Hybrid search with metadata filtering
  console.log('\n=== Hybrid Search with Filters ===');
  const hybridResults = await collection.search({
    query: 'database optimization techniques',
    topK: 10,
    filter: {
      type: 'article',
      difficulty: { $in: ['intermediate', 'advanced'] },
      year: { $gte: 2023 },
    },
    includeMetadata: true,
  });

  // Example 3: Multi-collection search
  console.log('\n=== Multi-Collection Search ===');
  const globalResults = await client.search(
    'machine learning best practices',
    ['knowledge_base', 'documentation', 'tutorials'],
    10
  );

  for (const collectionResult of globalResults) {
    console.log(`\nCollection: ${collectionResult.collection}`);
    console.log(`Found ${collectionResult.matches.length} matches`);
    
    for (const match of collectionResult.matches.slice(0, 3)) {
      console.log(`  - ${match.id}: ${match.score.toFixed(3)}`);
    }
  }

  // Example 4: Search with custom embeddings
  console.log('\n=== Search with Custom Vector ===');
  const customVector = new Array(1536).fill(0).map(() => Math.random());
  const vectorResults = await collection.search({
    vector: customVector,
    topK: 5,
    filter: {
      status: 'published',
    },
    includeValues: false,
    includeMetadata: true,
  });

  // Example 5: Namespace-specific search
  console.log('\n=== Namespace Search ===');
  const namespaceResults = await collection.search({
    query: 'security vulnerabilities',
    topK: 5,
    namespace: 'security-docs',
    includeMetadata: true,
  });

  await client.disconnect();
}

advancedSearchExample().catch(console.error);