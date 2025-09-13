import { OracleVectorDB } from '../src';

async function main() {
  // Initialize the client
  const client = new OracleVectorDB({
    walletPath: './wallet',
    username: 'SRAO',
    password: 'Ctigroup!2345678',
    connectionString: 'sidexampledata_high',
  });

  // Connect to Oracle ADB
  await client.connect();

  // Create a collection
  const collection = await client.createCollection('products', {
    dimension: 1536, // OpenAI ada-002 dimension
    metric: 'cosine',
    embeddingModel: 'text-embedding-ada-002',
  });

  // Upsert documents with automatic embedding generation
  await collection.upsert({
    documents: [
      {
        id: 'product-1',
        text: 'Sony WH-1000XM5 Wireless Noise Canceling Headphones with Auto Noise Canceling Optimizer, Crystal Clear Hands-Free Calling, and Alexa Voice Control',
        metadata: {
          category: 'electronics',
          subcategory: 'headphones',
          brand: 'Sony',
          price: 399.99,
          rating: 4.5,
        },
      },
      {
        id: 'product-2',
        text: 'Bose QuietComfort 45 Bluetooth Wireless Noise Cancelling Headphones with Voice Assistant Support',
        metadata: {
          category: 'electronics',
          subcategory: 'headphones',
          brand: 'Bose',
          price: 329.99,
          rating: 4.3,
        },
      },
      {
        id: 'product-3',
        text: 'Apple MacBook Pro 14-inch with M3 Pro chip, 18GB RAM, 512GB SSD, Space Black',
        metadata: {
          category: 'electronics',
          subcategory: 'laptop',
          brand: 'Apple',
          price: 1999.99,
          rating: 4.8,
        },
      },
    ],
  });

  // Search with natural language query (automatic embedding)
  const searchResults = await collection.search({
    query: 'comfortable noise canceling headphones for long flights',
    topK: 3,
    filter: {
      category: 'electronics',
      price: { $lte: 500 },
    },
    includeMetadata: true,
  });

  console.log('Search Results:');
  for (const match of searchResults.matches) {
    console.log(`\n${match.id} (Score: ${match.score.toFixed(3)})`);
    console.log(`  Text: ${match.text?.substring(0, 100)}...`);
    console.log(`  Metadata:`, match.metadata);
  }

  // Fetch specific documents
  const documents = await collection.fetch({
    ids: ['product-1', 'product-2'],
  });

  console.log('\nFetched Documents:', documents.length);

  // Update a document
  await collection.update({
    id: 'product-1',
    metadata: {
      category: 'electronics',
      subcategory: 'headphones',
      brand: 'Sony',
      price: 349.99, // Updated price
      rating: 4.6,
      onSale: true,
    },
  });

  // Get collection statistics
  const stats = await collection.stats();
  console.log('\nCollection Statistics:');
  console.log(`  Total documents: ${stats.documentCount}`);
  console.log(`  Vector dimension: ${stats.dimension}`);
  console.log(`  Namespaces:`, stats.namespaces);

  // Clean up
  await client.disconnect();
}

main().catch(console.error);