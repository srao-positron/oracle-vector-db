# Oracle Vector Database Library

A TypeScript/Node.js library providing Pinecone-like vector database capabilities on Oracle Autonomous Database (ADB). This library leverages Oracle's native JSON document support and vector search capabilities to provide a seamless vector database experience.

## Features

- 🚀 **Pinecone-compatible API** - Familiar interface for vector operations
- 🔍 **Native Oracle Vector Search** - Leverages Oracle's built-in vector indexing (HNSW, IVF)
- 🤖 **Automatic Embeddings** - Built-in OpenAI integration for automatic text embedding
- 📦 **JSON Document Storage** - Native Oracle JSON/SODA support
- 🔐 **Secure Wallet Authentication** - Oracle wallet-based connection management
- 💼 **Enterprise Ready** - ACID compliance, high availability, and Oracle security
- 🛠️ **CLI Tool** - Command-line interface for database operations
- ⚡ **High Performance** - Connection pooling, batch operations, and caching

## Installation

```bash
npm install oracle-vector-db

# For macOS users, install Oracle Instant Client:
bash setup-oracle-client.sh

# Or manually download from:
# https://www.oracle.com/database/technologies/instant-client/downloads.html
```

## Quick Start

### 1. Environment Setup

Copy `.env.example` to `.env` and configure your credentials:

```bash
cp .env.example .env
# Edit .env with your Oracle ADB and OpenAI credentials
```

### 2. Setup Your Oracle Wallet

Place your Oracle Autonomous Database wallet files in a directory (e.g., `./wallet`) with:
- Connection files (`tnsnames.ora`, `sqlnet.ora`, etc.)
- API keys in text files (`openai`, `anthropic`, etc.)

### 3. Initialize the Client

```typescript
import { OracleVectorDB } from 'oracle-vector-db';

const client = new OracleVectorDB({
  walletPath: './wallet',
  username: 'YOUR_USERNAME',
  password: 'YOUR_PASSWORD',
  connectionString: 'your_db_high' // Optional, defaults to sidexampledata_high
});

await client.connect();
```

### 4. Create a Collection

```typescript
const collection = await client.createCollection('products', {
  dimension: 1536,           // OpenAI ada-002 dimension
  metric: 'cosine',          // cosine, euclidean, or dot_product
  embeddingModel: 'text-embedding-ada-002'
});
```

### 5. Add Documents

```typescript
await collection.upsert({
  documents: [
    {
      id: 'doc-1',
      text: 'High-performance wireless headphones with noise canceling',
      metadata: { 
        category: 'electronics', 
        price: 299.99 
      }
    }
  ]
});
```

### 6. Search

```typescript
// Natural language search with automatic embedding
const results = await collection.search({
  query: 'comfortable headphones for travel',
  topK: 10,
  filter: { 
    category: 'electronics',
    price: { $lte: 500 }
  }
});
```

## CLI Usage

### Setup

```bash
# Initialize configuration
oracle-vector init --wallet ./wallet

# Setup AI provider
oracle-vector setup-ai
```

### Collection Management

```bash
# Create collection
oracle-vector create-collection products --dimension 1536 --metric cosine

# List collections
oracle-vector list-collections

# Get collection stats
oracle-vector stats products

# Delete collection
oracle-vector delete-collection products
```

### Document Operations

```bash
# Upsert documents from file
oracle-vector upsert products --file data.json

# Upsert single document
oracle-vector upsert products --text "Laptop with 16GB RAM" --id laptop-1

# Search
oracle-vector search products "gaming laptop" --top-k 5
oracle-vector search products --filter '{"category": "electronics"}' --top-k 10
```

## API Reference

### Client

#### `new OracleVectorDB(config)`
Create a new Oracle Vector Database client.

#### `connect()`
Establish connection to Oracle ADB and setup AI configuration.

#### `createCollection(name, config)`
Create a new vector collection with specified configuration.

#### `getCollection(name)`
Get an existing collection.

#### `listCollections()`
List all available collections.

#### `search(query, collections?, topK?)`
Search across multiple collections.

### Collection

#### `upsert(request)`
Insert or update documents in the collection.

#### `search(request)`
Search for similar documents using vector similarity.

#### `fetch(request)`
Retrieve documents by ID.

#### `update(request)`
Update document metadata or text.

#### `delete(request)`
Delete documents by ID or filter.

#### `stats()`
Get collection statistics.

## Advanced Features

### Metadata Filtering

```typescript
const results = await collection.search({
  query: 'laptop',
  filter: {
    brand: 'Apple',
    price: { $gte: 1000, $lte: 3000 },
    category: { $in: ['electronics', 'computers'] }
  }
});
```

### Batch Operations

```typescript
// Batch upsert for performance
const documents = Array.from({ length: 1000 }, (_, i) => ({
  id: `doc-${i}`,
  text: `Document ${i} content...`,
  metadata: { index: i }
}));

await collection.upsert({ documents });
```

### Namespaces

```typescript
// Organize documents in namespaces
await collection.upsert({
  documents: [...],
  namespace: 'production'
});

const results = await collection.search({
  query: 'search query',
  namespace: 'production'
});
```

### Custom Embeddings

```typescript
// Use your own embeddings
await collection.upsert({
  documents: [{
    id: 'custom-1',
    vector: [0.1, 0.2, ...], // Your 1536-dim vector
    metadata: { source: 'custom' }
  }]
});
```

## Oracle-Specific Features

### AI Configuration

The library automatically configures Oracle's built-in AI capabilities:

```typescript
// Setup happens automatically on connect()
// But you can also configure additional providers:
await client.setupAIProvider('cohere', 'embed-english-v3.0');
```

### Vector Indexing

Oracle's native vector indexes are automatically created:
- HNSW (Hierarchical Navigable Small World) for fast approximate search
- IVF (Inverted File) for exact search
- Automatic index optimization based on data characteristics

## Performance Optimization

- **Connection Pooling**: Configurable pool size for concurrent operations
- **Batch Embeddings**: Automatic batching of embedding requests
- **LRU Caching**: Smart caching of frequently used embeddings
- **Parallel Processing**: Concurrent operations with rate limiting

## Requirements

- Oracle Autonomous Database (19c or later)
- Node.js 16+
- Oracle Instant Client (for oracledb driver)
- OpenAI API key (or other embedding provider)

## Environment Variables

```bash
# Optional Oracle Client location
export ORACLE_CLIENT_LIB=/opt/oracle/instantclient

# Optional configuration
export ORACLE_POOL_MIN=2
export ORACLE_POOL_MAX=10
```

## Error Handling

```typescript
import { 
  OracleVectorDBError,
  ConnectionError,
  ValidationError,
  EmbeddingError 
} from 'oracle-vector-db';

try {
  await collection.search({ query: 'test' });
} catch (error) {
  if (error instanceof EmbeddingError) {
    console.error('Embedding generation failed:', error);
  } else if (error instanceof ConnectionError) {
    console.error('Database connection issue:', error);
  }
}
```

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## License

MIT

## Support

For issues and questions:
- GitHub Issues: [oracle-vector-db/issues](https://github.com/yourusername/oracle-vector-db/issues)
- Documentation: [Full API Documentation](https://docs.oracle-vector-db.com)