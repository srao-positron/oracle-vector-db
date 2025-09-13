# Oracle ADB Vector Database Library Design Document

## Overview
A TypeScript/Node.js library and CLI that provides Pinecone-like vector database capabilities on top of Oracle Autonomous Database (ADB), leveraging Oracle's JSON document support and native vector search capabilities.

## Architecture

### Core Components

1. **Connection Manager**
   - Handle Oracle wallet-based authentication
   - Manage connection pooling
   - Support both ORDS REST API and direct Oracle connections
   - Auto-reconnection and error handling

2. **Collection Manager**
   - Create/delete JSON document collections
   - Configure vector indexes with dimension settings
   - List and describe collections
   - Handle collection metadata

3. **Document Operations**
   - Upsert documents with automatic vector generation
   - Batch operations for efficiency
   - Update/delete by ID or metadata filters
   - Fetch documents with/without vectors

4. **Vector Engine**
   - Automatic embedding generation via OpenAI
   - Support for custom embedding models
   - Batch embedding for performance
   - Vector dimension validation

5. **Search Interface**
   - Vector similarity search (cosine, euclidean, dot product)
   - Hybrid search (vector + metadata filtering)
   - Natural language search with automatic embedding
   - Top-k retrieval with scores

6. **CLI Tool**
   - Interactive and command-based modes
   - Collection management commands
   - Data import/export utilities
   - Search and query interface

## API Design

### TypeScript Client API

```typescript
// Initialize client
const client = new OracleVectorDB({
  walletPath: './wallet',
  username: 'SRAO',
  password: 'password',
  connectionString: 'sidexampledata_high'
});

// Collection operations
const collection = await client.createCollection('products', {
  dimension: 1536, // OpenAI ada-002 dimension
  metric: 'cosine',
  embeddingModel: 'text-embedding-ada-002'
});

// Document operations
await collection.upsert([
  {
    id: 'product-1',
    metadata: { category: 'electronics', price: 299 },
    text: 'High-performance wireless headphones...'
  }
]);

// Vector search
const results = await collection.search({
  query: 'comfortable headphones for music',
  topK: 10,
  filter: { category: 'electronics', price: { $lte: 500 } }
});

// Natural language search (auto-embedding)
const smartResults = await collection.search('find me comfortable headphones');
```

### Oracle JSON Document Structure

```json
{
  "_id": "unique-id",
  "_vector": [0.123, 0.456, ...], // 1536-dim vector
  "_metadata": {
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "text": "original text content",
  "metadata": {
    // user-defined metadata
  }
}
```

## Technical Implementation

### Oracle ADB Features Utilized

1. **JSON Document Collections (SODA)**
   - Native JSON storage and indexing
   - Document versioning support
   - ACID compliance

2. **Vector Search Capabilities**
   - Oracle's native vector indexing (HNSW, IVF)
   - SQL/JSON functions for vector operations
   - Integrated with Oracle Text for hybrid search

3. **ORDS REST API**
   - RESTful interface for database operations
   - Batch operations support
   - Authentication via wallet

### Key Libraries

- `oracledb`: Node.js driver for Oracle Database
- `openai`: OpenAI API client for embeddings
- `commander`: CLI framework
- `zod`: Schema validation
- `p-queue`: Concurrent operation management

## Performance Optimizations

1. **Connection Pooling**
   - Reuse database connections
   - Configurable pool size

2. **Batch Operations**
   - Bulk insert/update/delete
   - Batch embedding generation

3. **Caching**
   - LRU cache for frequently accessed documents
   - Embedding cache to avoid re-computation

4. **Indexing Strategy**
   - Automatic index creation on vector columns
   - Metadata indexing for filtered searches

## CLI Commands

```bash
# Initialize configuration
oracle-vector init --wallet ./wallet

# Collection management
oracle-vector create-collection products --dimension 1536
oracle-vector list-collections
oracle-vector delete-collection products

# Document operations
oracle-vector upsert products --file data.json
oracle-vector fetch products --id product-1
oracle-vector delete products --id product-1

# Search
oracle-vector search products "wireless headphones" --top-k 10
oracle-vector search products --vector [0.1, 0.2, ...] --filter '{"category": "electronics"}'

# Export/Import
oracle-vector export products --output products.json
oracle-vector import products --input products.json
```

## Security Considerations

1. **Wallet Management**
   - Secure storage of Oracle wallet files
   - Environment variable support for credentials
   - No hardcoded credentials in code

2. **API Key Protection**
   - OpenAI API key stored in wallet
   - Support for key rotation
   - Rate limiting and usage tracking

3. **Data Privacy**
   - Client-side encryption option
   - Audit logging for operations
   - Role-based access control via Oracle

## Testing Strategy

1. **Unit Tests**
   - Mock Oracle connections
   - Test vector operations
   - Validate API contracts

2. **Integration Tests**
   - Real ADB connection tests
   - End-to-end workflows
   - Performance benchmarks

3. **CLI Tests**
   - Command validation
   - Error handling
   - Interactive mode testing

## Error Handling

1. **Connection Errors**
   - Automatic retry with exponential backoff
   - Graceful degradation
   - Clear error messages

2. **Validation Errors**
   - Schema validation for inputs
   - Dimension mismatch detection
   - Type checking

3. **API Errors**
   - OpenAI rate limiting handling
   - Oracle-specific error mapping
   - User-friendly error messages

## Future Enhancements

1. **Additional Embedding Models**
   - Support for Anthropic, Cohere, Voyage AI
   - Custom embedding functions
   - Multi-modal embeddings

2. **Advanced Search**
   - Semantic search with re-ranking
   - Multi-vector search
   - Faceted search capabilities

3. **Monitoring & Observability**
   - Performance metrics
   - Usage analytics
   - Query optimization insights

## Development Phases

### Phase 1: Foundation (Week 1)
- Project setup and configuration
- Oracle connection management
- Basic CRUD operations

### Phase 2: Vector Operations (Week 2)
- OpenAI integration
- Vector indexing
- Basic similarity search

### Phase 3: Advanced Features (Week 3)
- Filtered search
- Batch operations
- Performance optimizations

### Phase 4: CLI & Polish (Week 4)
- CLI implementation
- Documentation
- Testing and examples