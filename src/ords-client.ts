import axios, { AxiosInstance } from 'axios';
import { ClientConfig } from './types';
import { ConnectionError } from './errors';

export class ORDSClient {
  private client: AxiosInstance;
  private baseURL: string;
  
  constructor(config: ClientConfig) {
    // Read ORDS URL from wallet
    this.baseURL = 'https://DNV4FTFE9CK9ATH-SIDEXAMPLEDATA.adb.us-ashburn-1.oraclecloudapps.com/ords/';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      auth: {
        username: config.username,
        password: config.password,
      },
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get(`${this.config.username}/_/sql`);
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async execute(sql: string, binds?: any): Promise<any> {
    try {
      const response = await this.client.post(`${this.config.username}/_/sql`, {
        statementText: sql,
        binds: binds || {},
        autoCommit: true,
      });
      
      if (response.data.error) {
        throw new Error(response.data.error.message);
      }
      
      return response.data;
    } catch (error: any) {
      throw new ConnectionError(`ORDS execution failed: ${error.message}`);
    }
  }

  async createCollection(name: string): Promise<void> {
    try {
      const response = await this.client.put(`${this.config.username}/soda/latest/${name}`, {});
      if (response.status !== 201 && response.status !== 200) {
        throw new Error(`Failed to create collection: ${response.statusText}`);
      }
    } catch (error: any) {
      throw new ConnectionError(`Failed to create collection: ${error.message}`);
    }
  }

  async insertDocument(collection: string, document: any): Promise<void> {
    try {
      const response = await this.client.post(
        `${this.config.username}/soda/latest/${collection}`,
        document
      );
      
      if (response.status !== 201 && response.status !== 200) {
        throw new Error(`Failed to insert document: ${response.statusText}`);
      }
    } catch (error: any) {
      throw new ConnectionError(`Failed to insert document: ${error.message}`);
    }
  }

  async queryCollection(collection: string, filter: any): Promise<any[]> {
    try {
      const response = await this.client.post(
        `${this.config.username}/soda/latest/${collection}?action=query`,
        filter
      );
      
      return response.data.items || [];
    } catch (error: any) {
      throw new ConnectionError(`Failed to query collection: ${error.message}`);
    }
  }

  async listCollections(): Promise<string[]> {
    try {
      const response = await this.client.get(`${this.config.username}/soda/latest`);
      return response.data.items?.map((item: any) => item.name) || [];
    } catch (error: any) {
      throw new ConnectionError(`Failed to list collections: ${error.message}`);
    }
  }

  async dropCollection(name: string): Promise<void> {
    try {
      await this.client.delete(`${this.config.username}/soda/latest/${name}`);
    } catch (error: any) {
      throw new ConnectionError(`Failed to drop collection: ${error.message}`);
    }
  }
}