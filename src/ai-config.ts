import { OracleConnection } from './connection';
import { AIConfigOptions } from './types';
import { ConnectionError } from './errors';

export class AIConfig {
  constructor(private connection: OracleConnection) {}

  async setupOpenAI(): Promise<void> {
    const apiKey = this.connection.getApiKey('openai');
    if (!apiKey) {
      throw new ConnectionError('OpenAI API key not found in wallet');
    }

    try {
      await this.connection.execute(`
        BEGIN
          DBMS_CLOUD_AI.SET_PROFILE(
            profile_name => 'OPENAI_PROFILE',
            attributes => JSON_OBJECT(
              'provider' VALUE 'openai',
              'credential_name' VALUE 'OPENAI_CRED',
              'object_list' VALUE JSON_ARRAY(
                JSON_OBJECT(
                  'object_name' VALUE 'text-embedding-ada-002'
                ),
                JSON_OBJECT(
                  'object_name' VALUE 'text-embedding-3-small'
                ),
                JSON_OBJECT(
                  'object_name' VALUE 'text-embedding-3-large'
                )
              )
            )
          );
        END;
      `);

      await this.connection.execute(`
        BEGIN
          DBMS_CLOUD.CREATE_CREDENTIAL(
            credential_name => 'OPENAI_CRED',
            username => 'OPENAI',
            password => :apiKey
          );
        EXCEPTION
          WHEN OTHERS THEN
            IF SQLCODE = -20022 THEN
              DBMS_CLOUD.UPDATE_CREDENTIAL(
                credential_name => 'OPENAI_CRED',
                attribute => 'PASSWORD',
                value => :apiKey
              );
            ELSE
              RAISE;
            END IF;
        END;
      `, { apiKey });

      console.log('OpenAI AI profile configured successfully');
    } catch (error) {
      throw new ConnectionError(`Failed to setup OpenAI configuration: ${error}`);
    }
  }

  async setupProvider(options: AIConfigOptions): Promise<void> {
    const apiKey = options.apiKey || this.connection.getApiKey(options.provider);
    if (!apiKey) {
      throw new ConnectionError(`${options.provider} API key not found`);
    }

    const profileName = `${options.provider.toUpperCase()}_PROFILE`;
    const credentialName = `${options.provider.toUpperCase()}_CRED`;

    try {
      await this.connection.execute(`
        BEGIN
          DBMS_CLOUD.CREATE_CREDENTIAL(
            credential_name => :credentialName,
            username => :provider,
            password => :apiKey
          );
        EXCEPTION
          WHEN OTHERS THEN
            IF SQLCODE = -20022 THEN
              DBMS_CLOUD.UPDATE_CREDENTIAL(
                credential_name => :credentialName,
                attribute => 'PASSWORD',
                value => :apiKey
              );
            ELSE
              RAISE;
            END IF;
        END;
      `, { credentialName, provider: options.provider.toUpperCase(), apiKey });

      await this.connection.execute(`
        BEGIN
          DBMS_CLOUD_AI.SET_PROFILE(
            profile_name => :profileName,
            attributes => JSON_OBJECT(
              'provider' VALUE :provider,
              'credential_name' VALUE :credentialName,
              'object_list' VALUE JSON_ARRAY(
                JSON_OBJECT(
                  'object_name' VALUE :model
                )
              )
            )
          );
        END;
      `, {
        profileName,
        provider: options.provider,
        credentialName,
        model: options.model
      });

      console.log(`${options.provider} AI profile configured successfully`);
    } catch (error) {
      throw new ConnectionError(`Failed to setup ${options.provider} configuration: ${error}`);
    }
  }

  async enableVectorSearch(tableName: string, vectorColumn: string = 'embedding'): Promise<void> {
    try {
      await this.connection.execute(`
        CREATE SEARCH INDEX ${tableName}_vector_idx ON ${tableName} (${vectorColumn})
        FOR JSON
        PARAMETERS ('DISTANCE COSINE')
      `);
      
      console.log(`Vector search index created for ${tableName}.${vectorColumn}`);
    } catch (error) {
      if (error && typeof error === 'object' && 'errorNum' in error && error.errorNum === 955) {
        console.log(`Vector search index already exists for ${tableName}.${vectorColumn}`);
      } else {
        throw new ConnectionError(`Failed to enable vector search: ${error}`);
      }
    }
  }

  async createEmbeddingFunction(
    functionName: string,
    model: string = 'text-embedding-ada-002'
  ): Promise<void> {
    try {
      await this.connection.execute(`
        CREATE OR REPLACE FUNCTION ${functionName}(
          input_text CLOB
        ) RETURN CLOB
        IS
          embedding CLOB;
        BEGIN
          embedding := DBMS_CLOUD_AI.GENERATE_EMBEDDINGS(
            profile_name => 'OPENAI_PROFILE',
            object_name => '${model}',
            input_text => input_text
          );
          RETURN embedding;
        END ${functionName};
      `);
      
      console.log(`Embedding function ${functionName} created successfully`);
    } catch (error) {
      throw new ConnectionError(`Failed to create embedding function: ${error}`);
    }
  }

  async listProfiles(): Promise<any[]> {
    try {
      const result = await this.connection.execute(`
        SELECT profile_name, attributes
        FROM USER_CLOUD_AI_PROFILES
      `);
      return result.rows || [];
    } catch (error) {
      throw new ConnectionError(`Failed to list AI profiles: ${error}`);
    }
  }

  async deleteProfile(profileName: string): Promise<void> {
    try {
      await this.connection.execute(`
        BEGIN
          DBMS_CLOUD_AI.DROP_PROFILE(
            profile_name => :profileName
          );
        END;
      `, { profileName });
      
      console.log(`AI profile ${profileName} deleted successfully`);
    } catch (error) {
      throw new ConnectionError(`Failed to delete AI profile: ${error}`);
    }
  }
}