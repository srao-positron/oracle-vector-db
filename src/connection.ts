import oracledb from 'oracledb';
import { ClientConfig } from './types';
import { ConnectionError } from './errors';
import path from 'path';
import fs from 'fs/promises';

export class OracleConnection {
  private pool: oracledb.Pool | null = null;
  private config: ClientConfig;
  private walletCredentials: Map<string, string> = new Map();

  constructor(config: ClientConfig) {
    this.config = config;
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
    oracledb.fetchAsString = [oracledb.CLOB];
    oracledb.autoCommit = true;
  }

  async initialize(): Promise<void> {
    try {
      await this.loadWalletCredentials();
      
      const walletLocation = path.resolve(this.config.walletPath);
      
      // Only initialize if not already done
      try {
        oracledb.initOracleClient({
          libDir: process.env.ORACLE_CLIENT_LIB || '/usr/local/lib/oracle',
        });
      } catch (err: any) {
        // Ignore if already initialized
        if (!err.message?.includes('already initialized')) {
          throw err;
        }
      }

      // Set the TNS_ADMIN to wallet location for connection
      process.env.TNS_ADMIN = walletLocation;

      this.pool = await oracledb.createPool({
        user: this.config.username,
        password: this.config.password,
        connectionString: this.config.connectionString || 'sidexampledata_high',
        poolMin: this.config.poolMin || 2,
        poolMax: this.config.poolMax || 10,
        poolIncrement: this.config.poolIncrement || 2,
        poolTimeout: 60,
      });

      console.log('Oracle connection pool established successfully');
    } catch (error) {
      throw new ConnectionError(`Failed to initialize Oracle connection: ${error}`);
    }
  }

  private async loadWalletCredentials(): Promise<void> {
    try {
      const walletPath = path.resolve(this.config.walletPath);
      
      const openaiKey = await fs.readFile(path.join(walletPath, 'openai'), 'utf-8');
      this.walletCredentials.set('openai', openaiKey.trim());
      
      const files = ['anthropic', 'cohere', 'voyage', 'gemini'];
      for (const file of files) {
        try {
          const key = await fs.readFile(path.join(walletPath, file), 'utf-8');
          this.walletCredentials.set(file, key.trim());
        } catch {
          // Optional credentials
        }
      }
    } catch (error) {
      throw new ConnectionError(`Failed to load wallet credentials: ${error}`);
    }
  }

  async getConnection(): Promise<oracledb.Connection> {
    if (!this.pool) {
      throw new ConnectionError('Connection pool not initialized');
    }
    
    try {
      return await this.pool.getConnection();
    } catch (error) {
      throw new ConnectionError(`Failed to get connection from pool: ${error}`);
    }
  }

  async execute<T = any>(
    sql: string,
    binds: any = {},
    options: oracledb.ExecuteOptions = {}
  ): Promise<oracledb.Result<T>> {
    const connection = await this.getConnection();
    try {
      return await connection.execute<T>(sql, binds, options);
    } finally {
      await connection.close();
    }
  }

  async executeMany<T = any>(
    sql: string,
    binds: any[],
    options: oracledb.ExecuteManyOptions = {}
  ): Promise<oracledb.Results<T>> {
    const connection = await this.getConnection();
    try {
      return await connection.executeMany<T>(sql, binds, options);
    } finally {
      await connection.close();
    }
  }

  getApiKey(provider: string): string | undefined {
    return this.walletCredentials.get(provider);
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.close(10);
      this.pool = null;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const result = await this.execute('SELECT 1 FROM DUAL');
      return result.rows?.length === 1;
    } catch {
      return false;
    }
  }
}