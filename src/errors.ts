export class OracleVectorDBError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'OracleVectorDBError';
  }
}

export class ConnectionError extends OracleVectorDBError {
  constructor(message: string) {
    super(message, 'CONNECTION_ERROR');
    this.name = 'ConnectionError';
  }
}

export class CollectionError extends OracleVectorDBError {
  constructor(message: string) {
    super(message, 'COLLECTION_ERROR');
    this.name = 'CollectionError';
  }
}

export class ValidationError extends OracleVectorDBError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class EmbeddingError extends OracleVectorDBError {
  constructor(message: string) {
    super(message, 'EMBEDDING_ERROR');
    this.name = 'EmbeddingError';
  }
}

export class SearchError extends OracleVectorDBError {
  constructor(message: string) {
    super(message, 'SEARCH_ERROR');
    this.name = 'SearchError';
  }
}