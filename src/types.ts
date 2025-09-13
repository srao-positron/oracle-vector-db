import { z } from 'zod';

export const MetricSchema = z.enum(['cosine', 'euclidean', 'dot_product']);
export type Metric = z.infer<typeof MetricSchema>;

export const EmbeddingModelSchema = z.enum([
  'text-embedding-ada-002',
  'text-embedding-3-small',
  'text-embedding-3-large',
]);
export type EmbeddingModel = z.infer<typeof EmbeddingModelSchema>;

export const AIProviderSchema = z.enum([
  'openai',
  'anthropic',
  'cohere',
  'voyage',
  'gemini',
]);
export type AIProvider = z.infer<typeof AIProviderSchema>;

export interface ClientConfig {
  walletPath: string;
  username: string;
  password: string;
  connectionString?: string;
  poolMin?: number;
  poolMax?: number;
  poolIncrement?: number;
}

export interface CollectionConfig {
  dimension: number;
  metric?: Metric;
  embeddingModel?: EmbeddingModel;
  aiProvider?: AIProvider;
  indexType?: 'HNSW' | 'IVF';
  description?: string;
}

export interface Document {
  id: string;
  text?: string;
  metadata?: Record<string, any>;
  vector?: number[];
}

export interface UpsertRequest {
  documents: Document[];
  namespace?: string;
}

export interface QueryRequest {
  vector?: number[];
  query?: string;
  topK?: number;
  filter?: Record<string, any>;
  includeValues?: boolean;
  includeMetadata?: boolean;
  namespace?: string;
}

export interface QueryMatch {
  id: string;
  score: number;
  metadata?: Record<string, any>;
  vector?: number[];
  text?: string;
}

export interface QueryResponse {
  matches: QueryMatch[];
  namespace?: string;
}

export interface FetchRequest {
  ids: string[];
  namespace?: string;
}

export interface UpdateRequest {
  id: string;
  metadata?: Record<string, any>;
  text?: string;
  namespace?: string;
}

export interface DeleteRequest {
  ids?: string[];
  filter?: Record<string, any>;
  deleteAll?: boolean;
  namespace?: string;
}

export interface CollectionStats {
  documentCount: number;
  namespaces: Record<string, number>;
  dimension: number;
  indexFullness: number;
  totalDocuments: number;
}

export interface AIConfigOptions {
  provider: AIProvider;
  model: string;
  apiKey?: string;
  endpoint?: string;
  temperature?: number;
  maxTokens?: number;
}