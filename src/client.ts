import { OracleConnection } from './connection';
import { Collection } from './collection';
import { AIConfig } from './ai-config';
import { ClientConfig, CollectionConfig } from './types';
import { OracleVectorDBError } from './errors';

export class OracleVectorDB {
  private connection: OracleConnection;
  private aiConfig: AIConfig;
  private collections: Map<string, Collection> = new Map();
  private initialized = false;

  constructor(config: ClientConfig) {
    this.connection = new OracleConnection(config);
    this.aiConfig = new AIConfig(this.connection);
  }

  async connect(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.connection.initialize();
    await this.aiConfig.setupOpenAI();
    this.initialized = true;
    
    console.log('OracleVectorDB connected and configured');
  }

  async createCollection(name: string, config: CollectionConfig): Promise<Collection> {
    if (!this.initialized) {
      await this.connect();
    }

    const collection = new Collection(name, this.connection, config);
    await collection.create();
    
    if (config.embeddingModel) {
      await this.aiConfig.enableVectorSearch(name, 'embedding');
    }
    
    this.collections.set(name, collection);
    return collection;
  }

  async getCollection(name: string): Promise<Collection> {
    if (!this.initialized) {
      await this.connect();
    }

    if (this.collections.has(name)) {
      return this.collections.get(name)!;
    }

    const config = await this.getCollectionConfig(name);
    const collection = new Collection(name, this.connection, config);
    this.collections.set(name, collection);
    
    return collection;
  }

  async listCollections(): Promise<string[]> {
    if (!this.initialized) {
      await this.connect();
    }

    try {
      const result = await this.connection.execute<any>(`
        SELECT table_name 
        FROM user_tables 
        WHERE table_name NOT LIKE 'SYS_%'
        AND table_name NOT LIKE 'APEX_%'
        ORDER BY table_name
      `);
      
      return (result.rows || []).map((row: any) => row.TABLE_NAME);
    } catch (error) {
      throw new OracleVectorDBError(`Failed to list collections: ${error}`);
    }
  }

  async deleteCollection(name: string): Promise<void> {
    if (!this.initialized) {
      await this.connect();
    }

    const collection = await this.getCollection(name);
    await collection.drop();
    this.collections.delete(name);
  }

  async describeCollection(name: string): Promise<any> {
    if (!this.initialized) {
      await this.connect();
    }

    try {
      const result = await this.connection.execute<any>(`
        SELECT 
          column_name,
          data_type,
          data_length,
          nullable
        FROM user_tab_columns
        WHERE table_name = UPPER(:name)
        ORDER BY column_id
      `, { name });

      const columns = result.rows || [];
      
      const vectorCol = columns.find((col: any) => 
        col.DATA_TYPE === 'VECTOR'
      );

      const stats = await this.connection.execute<any>(`
        SELECT COUNT(*) as count
        FROM ${name}
      `);

      return {
        name,
        columns,
        dimension: vectorCol ? this.extractDimension(vectorCol) : null,
        documentCount: stats.rows?.[0]?.COUNT || 0,
      };
    } catch (error) {
      throw new OracleVectorDBError(`Failed to describe collection: ${error}`);
    }
  }

  async search(query: string, collections?: string[], topK: number = 10): Promise<any[]> {
    if (!this.initialized) {
      await this.connect();
    }

    const targetCollections = collections || await this.listCollections();
    const results: any[] = [];

    for (const collectionName of targetCollections) {
      try {
        const collection = await this.getCollection(collectionName);
        const response = await collection.search({
          query,
          topK,
          includeMetadata: true,
        });
        
        results.push({
          collection: collectionName,
          matches: response.matches,
        });
      } catch (error) {
        console.error(`Search failed for collection ${collectionName}: ${error}`);
      }
    }

    return results;
  }

  async setupAIProvider(provider: string, model: string, apiKey?: string): Promise<void> {
    if (!this.initialized) {
      await this.connect();
    }

    await this.aiConfig.setupProvider({
      provider: provider as any,
      model,
      apiKey,
    });
  }

  async disconnect(): Promise<void> {
    await this.connection.close();
    this.initialized = false;
    this.collections.clear();
  }

  private async getCollectionConfig(name: string): Promise<CollectionConfig> {
    const description = await this.describeCollection(name);
    
    return {
      dimension: description.dimension || 1536,
      metric: 'cosine',
      embeddingModel: 'text-embedding-ada-002',
    };
  }

  private extractDimension(_vectorColumn: any): number {
    // Extract dimension from VECTOR column definition
    // This would need proper parsing of Oracle's VECTOR type
    return 1536; // Default for now
  }
}