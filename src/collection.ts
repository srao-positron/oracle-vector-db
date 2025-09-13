import { OracleConnection } from './connection';
import { EmbeddingService } from './embeddings';
import {
  CollectionConfig,
  Document,
  QueryRequest,
  QueryResponse,
  QueryMatch,
  UpsertRequest,
  FetchRequest,
  UpdateRequest,
  DeleteRequest,
  CollectionStats,
} from './types';
import { CollectionError, ValidationError, SearchError } from './errors';

export class Collection {
  private embeddingService: EmbeddingService | null = null;

  constructor(
    public name: string,
    private connection: OracleConnection,
    private config: CollectionConfig
  ) {
    const apiKey = connection.getApiKey('openai');
    if (apiKey && config.embeddingModel) {
      this.embeddingService = new EmbeddingService(apiKey);
    }
  }

  async create(): Promise<void> {
    try {
      await this.connection.execute(`
        CREATE TABLE IF NOT EXISTS ${this.name} (
          id VARCHAR2(255) PRIMARY KEY,
          embedding VECTOR(${this.config.dimension}),
          text CLOB,
          metadata JSON,
          namespace VARCHAR2(255) DEFAULT 'default',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.connection.execute(`
        CREATE INDEX IF NOT EXISTS ${this.name}_ns_idx 
        ON ${this.name}(namespace)
      `);

      await this.connection.execute(`
        CREATE VECTOR INDEX ${this.name}_vector_idx 
        ON ${this.name}(embedding)
        DISTANCE ${this.config.metric?.toUpperCase() || 'COSINE'}
        WITH TARGET ACCURACY 95
      `);

      console.log(`Collection ${this.name} created successfully`);
    } catch (error) {
      throw new CollectionError(`Failed to create collection: ${error}`);
    }
  }

  async upsert(request: UpsertRequest): Promise<void> {
    const namespace = request.namespace || 'default';
    const documents = request.documents;

    if (!documents || documents.length === 0) {
      throw new ValidationError('No documents provided');
    }

    const embeddings: number[][] = [];
    
    if (this.embeddingService && this.config.embeddingModel) {
      const textsToEmbed = documents.map(doc => doc.text || JSON.stringify(doc.metadata || {}));
      const generated = await this.embeddingService.embed(textsToEmbed, this.config.embeddingModel);
      embeddings.push(...generated);
    }

    const binds: any[] = [];
    
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const vector = doc.vector || embeddings[i];
      
      if (!vector || vector.length !== this.config.dimension) {
        throw new ValidationError(
          `Vector dimension mismatch for document ${doc.id}. Expected ${this.config.dimension}, got ${vector?.length || 0}`
        );
      }

      binds.push({
        id: doc.id,
        embedding: `[${vector.join(',')}]`,
        text: doc.text || null,
        metadata: JSON.stringify(doc.metadata || {}),
        namespace: namespace,
      });
    }

    try {
      await this.connection.executeMany(
        `MERGE INTO ${this.name} t
         USING (SELECT :id as id FROM dual) s
         ON (t.id = s.id)
         WHEN MATCHED THEN
           UPDATE SET 
             embedding = TO_VECTOR(:embedding),
             text = :text,
             metadata = JSON(:metadata),
             namespace = :namespace,
             updated_at = CURRENT_TIMESTAMP
         WHEN NOT MATCHED THEN
           INSERT (id, embedding, text, metadata, namespace)
           VALUES (:id, TO_VECTOR(:embedding), :text, JSON(:metadata), :namespace)`,
        binds
      );

      console.log(`Upserted ${documents.length} documents to ${this.name}`);
    } catch (error) {
      throw new CollectionError(`Failed to upsert documents: ${error}`);
    }
  }

  async search(request: QueryRequest): Promise<QueryResponse> {
    let queryVector: number[] | undefined = request.vector;
    
    if (!queryVector && request.query) {
      if (!this.embeddingService || !this.config.embeddingModel) {
        throw new SearchError('Embedding service not configured for text queries');
      }
      queryVector = await this.embeddingService.embedSingle(request.query, this.config.embeddingModel);
    }

    if (!queryVector) {
      throw new ValidationError('Either vector or query must be provided');
    }

    const topK = request.topK || 10;
    const namespace = request.namespace || 'default';

    let sql = `
      SELECT 
        id,
        VECTOR_DISTANCE(embedding, TO_VECTOR(:queryVector), ${this.config.metric?.toUpperCase() || 'COSINE'}) as score,
        text,
        metadata,
        embedding
      FROM ${this.name}
      WHERE namespace = :namespace
    `;

    const binds: any = {
      queryVector: `[${queryVector.join(',')}]`,
      namespace: namespace,
    };

    if (request.filter) {
      const filterConditions = this.buildFilterConditions(request.filter);
      if (filterConditions) {
        sql += ` AND ${filterConditions}`;
      }
    }

    sql += ` ORDER BY score ASC FETCH FIRST :topK ROWS ONLY`;
    binds.topK = topK;

    try {
      const result = await this.connection.execute<any>(sql, binds);
      
      const matches: QueryMatch[] = (result.rows || []).map((row: any) => ({
        id: row.ID,
        score: 1 - row.SCORE, // Convert distance to similarity
        text: request.includeMetadata ? row.TEXT : undefined,
        metadata: request.includeMetadata ? JSON.parse(row.METADATA) : undefined,
        vector: request.includeValues ? this.parseVector(row.EMBEDDING) : undefined,
      }));

      return {
        matches,
        namespace,
      };
    } catch (error) {
      throw new SearchError(`Search failed: ${error}`);
    }
  }

  async fetch(request: FetchRequest): Promise<Document[]> {
    const namespace = request.namespace || 'default';
    
    try {
      const placeholders = request.ids.map((_, i) => `:id${i}`).join(',');
      const binds: any = { namespace };
      request.ids.forEach((id, i) => {
        binds[`id${i}`] = id;
      });

      const result = await this.connection.execute<any>(
        `SELECT id, text, metadata, embedding 
         FROM ${this.name}
         WHERE namespace = :namespace AND id IN (${placeholders})`,
        binds
      );

      return (result.rows || []).map((row: any) => ({
        id: row.ID,
        text: row.TEXT,
        metadata: JSON.parse(row.METADATA),
        vector: this.parseVector(row.EMBEDDING),
      }));
    } catch (error) {
      throw new CollectionError(`Failed to fetch documents: ${error}`);
    }
  }

  async update(request: UpdateRequest): Promise<void> {
    const namespace = request.namespace || 'default';
    const updates: string[] = [];
    const binds: any = {
      id: request.id,
      namespace: namespace,
    };

    if (request.metadata) {
      updates.push('metadata = JSON(:metadata)');
      binds.metadata = JSON.stringify(request.metadata);
    }

    if (request.text) {
      updates.push('text = :text');
      binds.text = request.text;
      
      if (this.embeddingService && this.config.embeddingModel) {
        const embedding = await this.embeddingService.embedSingle(request.text, this.config.embeddingModel);
        updates.push('embedding = TO_VECTOR(:embedding)');
        binds.embedding = `[${embedding.join(',')}]`;
      }
    }

    if (updates.length === 0) {
      throw new ValidationError('No updates provided');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    try {
      await this.connection.execute(
        `UPDATE ${this.name} 
         SET ${updates.join(', ')}
         WHERE id = :id AND namespace = :namespace`,
        binds
      );
    } catch (error) {
      throw new CollectionError(`Failed to update document: ${error}`);
    }
  }

  async delete(request: DeleteRequest): Promise<void> {
    const namespace = request.namespace || 'default';

    if (request.deleteAll) {
      try {
        await this.connection.execute(
          `DELETE FROM ${this.name} WHERE namespace = :namespace`,
          { namespace }
        );
        return;
      } catch (error) {
        throw new CollectionError(`Failed to delete all documents: ${error}`);
      }
    }

    if (request.ids && request.ids.length > 0) {
      const placeholders = request.ids.map((_, i) => `:id${i}`).join(',');
      const binds: any = { namespace };
      request.ids.forEach((id, i) => {
        binds[`id${i}`] = id;
      });

      try {
        await this.connection.execute(
          `DELETE FROM ${this.name} 
           WHERE namespace = :namespace AND id IN (${placeholders})`,
          binds
        );
      } catch (error) {
        throw new CollectionError(`Failed to delete documents: ${error}`);
      }
    }

    if (request.filter) {
      const filterConditions = this.buildFilterConditions(request.filter);
      if (filterConditions) {
        try {
          await this.connection.execute(
            `DELETE FROM ${this.name} 
             WHERE namespace = :namespace AND ${filterConditions}`,
            { namespace }
          );
        } catch (error) {
          throw new CollectionError(`Failed to delete documents by filter: ${error}`);
        }
      }
    }
  }

  async stats(): Promise<CollectionStats> {
    try {
      const result = await this.connection.execute<any>(`
        SELECT 
          COUNT(*) as total,
          namespace,
          COUNT(*) as ns_count
        FROM ${this.name}
        GROUP BY namespace
      `);

      const namespaces: Record<string, number> = {};
      let totalDocuments = 0;

      (result.rows || []).forEach((row: any) => {
        namespaces[row.NAMESPACE] = row.NS_COUNT;
        totalDocuments += row.NS_COUNT;
      });

      return {
        documentCount: totalDocuments,
        namespaces,
        dimension: this.config.dimension,
        indexFullness: totalDocuments / 1000000, // Assuming 1M max docs
        totalDocuments,
      };
    } catch (error) {
      throw new CollectionError(`Failed to get collection stats: ${error}`);
    }
  }

  async drop(): Promise<void> {
    try {
      await this.connection.execute(`DROP TABLE ${this.name} CASCADE CONSTRAINTS`);
      console.log(`Collection ${this.name} dropped successfully`);
    } catch (error) {
      throw new CollectionError(`Failed to drop collection: ${error}`);
    }
  }

  private buildFilterConditions(filter: Record<string, any>): string {
    const conditions: string[] = [];
    
    for (const [key, value] of Object.entries(filter)) {
      if (typeof value === 'object' && value !== null) {
        for (const [op, val] of Object.entries(value)) {
          switch (op) {
            case '$eq':
              conditions.push(`JSON_VALUE(metadata, '$.${key}') = '${val}'`);
              break;
            case '$ne':
              conditions.push(`JSON_VALUE(metadata, '$.${key}') != '${val}'`);
              break;
            case '$gt':
              conditions.push(`JSON_VALUE(metadata, '$.${key}') > '${val}'`);
              break;
            case '$gte':
              conditions.push(`JSON_VALUE(metadata, '$.${key}') >= '${val}'`);
              break;
            case '$lt':
              conditions.push(`JSON_VALUE(metadata, '$.${key}') < '${val}'`);
              break;
            case '$lte':
              conditions.push(`JSON_VALUE(metadata, '$.${key}') <= '${val}'`);
              break;
            case '$in':
              const values = (val as any[]).map(v => `'${v}'`).join(',');
              conditions.push(`JSON_VALUE(metadata, '$.${key}') IN (${values})`);
              break;
          }
        }
      } else {
        conditions.push(`JSON_VALUE(metadata, '$.${key}') = '${value}'`);
      }
    }
    
    return conditions.join(' AND ');
  }

  private parseVector(vectorString: string): number[] {
    if (!vectorString) return [];
    const cleaned = vectorString.replace(/[\[\]]/g, '');
    return cleaned.split(',').map(v => parseFloat(v.trim()));
  }
}