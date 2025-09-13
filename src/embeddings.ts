import OpenAI from 'openai';
import { EmbeddingModel } from './types';
import { EmbeddingError } from './errors';
import PQueue from 'p-queue';
import { LRUCache } from 'lru-cache';

export class EmbeddingService {
  private openai: OpenAI;
  private queue: PQueue;
  private cache: LRUCache<string, number[]>;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
    this.queue = new PQueue({ concurrency: 5, interval: 1000, intervalCap: 20 });
    this.cache = new LRUCache<string, number[]>({
      max: 1000,
      ttl: 1000 * 60 * 60, // 1 hour
    });
  }

  async embed(
    texts: string[],
    model: EmbeddingModel = 'text-embedding-ada-002'
  ): Promise<number[][]> {
    const results: number[][] = [];
    const toEmbed: { text: string; index: number }[] = [];

    for (let i = 0; i < texts.length; i++) {
      const cached = this.cache.get(`${model}:${texts[i]}`);
      if (cached) {
        results[i] = cached;
      } else {
        toEmbed.push({ text: texts[i], index: i });
      }
    }

    if (toEmbed.length > 0) {
      const batches = this.createBatches(toEmbed, 100);
      
      const embeddings = await Promise.all(
        batches.map(batch =>
          this.queue.add(async () => {
            try {
              const response = await this.openai.embeddings.create({
                model,
                input: batch.map(item => item.text),
              });
              
              return batch.map((item, idx) => ({
                index: item.index,
                embedding: response.data[idx].embedding,
              }));
            } catch (error) {
              throw new EmbeddingError(`Failed to generate embeddings: ${error}`);
            }
          })
        )
      );

      for (const batch of embeddings.flat()) {
        if (batch) {
          results[batch.index] = batch.embedding;
          this.cache.set(`${model}:${texts[batch.index]}`, batch.embedding);
        }
      }
    }

    return results;
  }

  async embedSingle(text: string, model: EmbeddingModel = 'text-embedding-ada-002'): Promise<number[]> {
    const cached = this.cache.get(`${model}:${text}`);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.queue.add(async () => {
        const result = await this.openai.embeddings.create({
          model,
          input: text,
        });
        return result.data[0].embedding;
      });

      if (response) {
        this.cache.set(`${model}:${text}`, response);
        return response;
      }
      
      throw new EmbeddingError('No embedding returned');
    } catch (error) {
      throw new EmbeddingError(`Failed to generate embedding: ${error}`);
    }
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  getDimension(model: EmbeddingModel): number {
    const dimensions: Record<EmbeddingModel, number> = {
      'text-embedding-ada-002': 1536,
      'text-embedding-3-small': 1536,
      'text-embedding-3-large': 3072,
    };
    return dimensions[model];
  }

  clearCache(): void {
    this.cache.clear();
  }
}