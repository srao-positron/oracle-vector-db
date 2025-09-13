#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import { OracleVectorDB } from '../client';
import { ClientConfig, CollectionConfig } from '../types';

const program = new Command();
let client: OracleVectorDB | null = null;

async function loadConfig(): Promise<ClientConfig> {
  try {
    const configPath = path.join(process.env.HOME || '.', '.oracle-vector', 'config.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configData);
  } catch {
    console.log(chalk.yellow('No configuration found. Please run "oracle-vector init" first.'));
    process.exit(1);
  }
}

async function getClient(): Promise<OracleVectorDB> {
  if (!client) {
    const config = await loadConfig();
    client = new OracleVectorDB(config);
    await client.connect();
  }
  return client;
}

program
  .name('oracle-vector')
  .description('Oracle Vector Database CLI')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize Oracle Vector Database configuration')
  .option('-w, --wallet <path>', 'Path to Oracle wallet directory')
  .option('-u, --username <username>', 'Database username')
  .option('-p, --password <password>', 'Database password')
  .option('-c, --connection <string>', 'Connection string (default: sidexampledata_high)')
  .action(async (options) => {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'walletPath',
        message: 'Path to Oracle wallet directory:',
        default: options.wallet || './wallet',
      },
      {
        type: 'input',
        name: 'username',
        message: 'Database username:',
        default: options.username,
      },
      {
        type: 'password',
        name: 'password',
        message: 'Database password:',
        default: options.password,
      },
      {
        type: 'input',
        name: 'connectionString',
        message: 'Connection string:',
        default: options.connection || 'sidexampledata_high',
      },
    ]);

    const config: ClientConfig = {
      walletPath: answers.walletPath,
      username: answers.username,
      password: answers.password,
      connectionString: answers.connectionString,
    };

    const configDir = path.join(process.env.HOME || '.', '.oracle-vector');
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
      path.join(configDir, 'config.json'),
      JSON.stringify(config, null, 2)
    );

    console.log(chalk.green('✓ Configuration saved successfully'));
    
    const spinner = ora('Testing connection...').start();
    try {
      const testClient = new OracleVectorDB(config);
      await testClient.connect();
      await testClient.disconnect();
      spinner.succeed('Connection successful');
    } catch (error) {
      spinner.fail(`Connection failed: ${error}`);
    }
  });

program
  .command('create-collection <name>')
  .description('Create a new vector collection')
  .option('-d, --dimension <number>', 'Vector dimension', '1536')
  .option('-m, --metric <metric>', 'Distance metric (cosine, euclidean, dot_product)', 'cosine')
  .option('-e, --embedding-model <model>', 'Embedding model', 'text-embedding-ada-002')
  .action(async (name, options) => {
    const spinner = ora('Creating collection...').start();
    try {
      const db = await getClient();
      const config: CollectionConfig = {
        dimension: parseInt(options.dimension),
        metric: options.metric as any,
        embeddingModel: options.embeddingModel as any,
      };
      
      await db.createCollection(name, config);
      spinner.succeed(`Collection "${name}" created successfully`);
    } catch (error) {
      spinner.fail(`Failed to create collection: ${error}`);
    }
  });

program
  .command('list-collections')
  .description('List all collections')
  .action(async () => {
    const spinner = ora('Fetching collections...').start();
    try {
      const db = await getClient();
      const collections = await db.listCollections();
      spinner.stop();
      
      if (collections.length === 0) {
        console.log(chalk.yellow('No collections found'));
      } else {
        console.log(chalk.bold('\nCollections:'));
        for (const collection of collections) {
          const info = await db.describeCollection(collection);
          console.log(`  ${chalk.green('•')} ${collection} (${info.documentCount} documents, ${info.dimension}D)`);
        }
      }
    } catch (error) {
      spinner.fail(`Failed to list collections: ${error}`);
    }
  });

program
  .command('delete-collection <name>')
  .description('Delete a collection')
  .option('-f, --force', 'Skip confirmation')
  .action(async (name, options) => {
    if (!options.force) {
      const confirm = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: `Are you sure you want to delete collection "${name}"?`,
          default: false,
        },
      ]);
      
      if (!confirm.proceed) {
        console.log('Cancelled');
        return;
      }
    }

    const spinner = ora('Deleting collection...').start();
    try {
      const db = await getClient();
      await db.deleteCollection(name);
      spinner.succeed(`Collection "${name}" deleted successfully`);
    } catch (error) {
      spinner.fail(`Failed to delete collection: ${error}`);
    }
  });

program
  .command('upsert <collection>')
  .description('Upsert documents to a collection')
  .option('-f, --file <path>', 'JSON file containing documents')
  .option('-t, --text <text>', 'Text to upsert (with auto-generated ID)')
  .option('-i, --id <id>', 'Document ID (used with --text)')
  .action(async (collectionName, options) => {
    const spinner = ora('Upserting documents...').start();
    try {
      const db = await getClient();
      const collection = await db.getCollection(collectionName);
      
      let documents: any[] = [];
      
      if (options.file) {
        const data = await fs.readFile(options.file, 'utf-8');
        documents = JSON.parse(data);
        if (!Array.isArray(documents)) {
          documents = [documents];
        }
      } else if (options.text) {
        documents = [{
          id: options.id || `doc-${Date.now()}`,
          text: options.text,
        }];
      } else {
        spinner.fail('Please provide either --file or --text');
        return;
      }
      
      await collection.upsert({ documents });
      spinner.succeed(`Upserted ${documents.length} document(s) to "${collectionName}"`);
    } catch (error) {
      spinner.fail(`Failed to upsert documents: ${error}`);
    }
  });

program
  .command('search <collection> [query]')
  .description('Search a collection')
  .option('-k, --top-k <number>', 'Number of results', '10')
  .option('-f, --filter <json>', 'Metadata filter (JSON)')
  .option('-v, --vector <json>', 'Search by vector (JSON array)')
  .action(async (collectionName, query, options) => {
    const spinner = ora('Searching...').start();
    try {
      const db = await getClient();
      const collection = await db.getCollection(collectionName);
      
      const request: any = {
        topK: parseInt(options.topK),
        includeMetadata: true,
      };
      
      if (query) {
        request.query = query;
      } else if (options.vector) {
        request.vector = JSON.parse(options.vector);
      } else {
        spinner.fail('Please provide either a query or --vector');
        return;
      }
      
      if (options.filter) {
        request.filter = JSON.parse(options.filter);
      }
      
      const results = await collection.search(request);
      spinner.stop();
      
      console.log(chalk.bold(`\nSearch Results (${results.matches.length} matches):\n`));
      
      for (const match of results.matches) {
        console.log(chalk.green(`• ${match.id}`) + chalk.gray(` (score: ${match.score.toFixed(4)})`));
        if (match.text) {
          console.log(`  ${match.text.substring(0, 100)}...`);
        }
        if (match.metadata && Object.keys(match.metadata).length > 0) {
          console.log(chalk.gray(`  Metadata: ${JSON.stringify(match.metadata)}`));
        }
        console.log();
      }
    } catch (error) {
      spinner.fail(`Search failed: ${error}`);
    }
  });

program
  .command('stats <collection>')
  .description('Get collection statistics')
  .action(async (collectionName) => {
    const spinner = ora('Fetching statistics...').start();
    try {
      const db = await getClient();
      const collection = await db.getCollection(collectionName);
      const stats = await collection.stats();
      spinner.stop();
      
      console.log(chalk.bold(`\nCollection: ${collectionName}`));
      console.log(`Documents: ${stats.documentCount}`);
      console.log(`Dimension: ${stats.dimension}`);
      console.log(`Index Fullness: ${(stats.indexFullness * 100).toFixed(2)}%`);
      
      if (Object.keys(stats.namespaces).length > 0) {
        console.log('\nNamespaces:');
        for (const [ns, count] of Object.entries(stats.namespaces)) {
          console.log(`  ${ns}: ${count} documents`);
        }
      }
    } catch (error) {
      spinner.fail(`Failed to get statistics: ${error}`);
    }
  });

program
  .command('export <collection>')
  .description('Export collection data')
  .option('-o, --output <path>', 'Output file path', 'export.json')
  .option('-n, --namespace <namespace>', 'Namespace to export', 'default')
  .action(async (collectionName, _options) => {
    const spinner = ora('Exporting data...').start();
    try {
      const db = await getClient();
      await db.getCollection(collectionName);
      
      // This would need implementation of a fetchAll method
      spinner.warn('Export functionality not yet implemented');
    } catch (error) {
      spinner.fail(`Export failed: ${error}`);
    }
  });

program
  .command('setup-ai')
  .description('Setup AI provider configuration')
  .action(async () => {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'Select AI provider:',
        choices: ['openai', 'anthropic', 'cohere', 'voyage', 'gemini'],
      },
      {
        type: 'input',
        name: 'model',
        message: 'Model name:',
        default: (answers: any) => {
          const defaults: any = {
            openai: 'text-embedding-ada-002',
            anthropic: 'claude-3-haiku',
            cohere: 'embed-english-v3.0',
            voyage: 'voyage-2',
            gemini: 'embedding-001',
          };
          return defaults[answers.provider];
        },
      },
      {
        type: 'password',
        name: 'apiKey',
        message: 'API Key (leave empty to use wallet):',
      },
    ]);

    const spinner = ora('Setting up AI provider...').start();
    try {
      const db = await getClient();
      await db.setupAIProvider(answers.provider, answers.model, answers.apiKey || undefined);
      spinner.succeed('AI provider configured successfully');
    } catch (error) {
      spinner.fail(`Failed to setup AI provider: ${error}`);
    }
  });

program.parse(process.argv);