#!/bin/bash

echo "Oracle Vector DB CLI Test Script"
echo "================================="
echo ""

# First, let's install dependencies
echo "Installing dependencies..."
npm install

# Build the TypeScript code
echo "Building TypeScript..."
npm run build

# Make the CLI executable
chmod +x dist/cli/index.js

# Create a symlink for easier testing
npm link

echo ""
echo "Testing CLI Commands:"
echo "--------------------"

# 1. Initialize configuration
echo "1. Initializing configuration..."
oracle-vector init \
  --wallet ./wallet \
  --username SRAO \
  --password "Ctigroup!2345678" \
  --connection sidexampledata_high

# 2. Setup AI provider
echo ""
echo "2. Setting up OpenAI provider..."
echo "openai" | oracle-vector setup-ai

# 3. Create a test collection
echo ""
echo "3. Creating test collection..."
oracle-vector create-collection test_products \
  --dimension 1536 \
  --metric cosine \
  --embedding-model text-embedding-ada-002

# 4. List collections
echo ""
echo "4. Listing collections..."
oracle-vector list-collections

# 5. Create a test data file
echo ""
echo "5. Creating test data..."
cat > test_data.json << 'EOF'
[
  {
    "id": "laptop-1",
    "text": "Dell XPS 15 with Intel Core i7, 16GB RAM, 512GB SSD, and NVIDIA GeForce graphics card",
    "metadata": {
      "category": "electronics",
      "subcategory": "laptop",
      "brand": "Dell",
      "price": 1599.99
    }
  },
  {
    "id": "laptop-2",
    "text": "MacBook Pro 14-inch with M3 Pro chip, 18GB unified memory, 512GB SSD storage",
    "metadata": {
      "category": "electronics",
      "subcategory": "laptop",
      "brand": "Apple",
      "price": 1999.99
    }
  },
  {
    "id": "headphones-1",
    "text": "Sony WH-1000XM5 wireless noise canceling headphones with 30-hour battery life",
    "metadata": {
      "category": "electronics",
      "subcategory": "headphones",
      "brand": "Sony",
      "price": 399.99
    }
  }
]
EOF

# 6. Upsert documents
echo ""
echo "6. Upserting documents from file..."
oracle-vector upsert test_products --file test_data.json

# 7. Get collection stats
echo ""
echo "7. Getting collection statistics..."
oracle-vector stats test_products

# 8. Search with natural language
echo ""
echo "8. Searching for 'powerful laptop for programming'..."
oracle-vector search test_products "powerful laptop for programming" --top-k 2

# 9. Search with filter
echo ""
echo "9. Searching with price filter..."
oracle-vector search test_products "laptop" \
  --filter '{"price": {"$lte": 1700}}' \
  --top-k 2

# 10. Upsert single document
echo ""
echo "10. Adding a single document..."
oracle-vector upsert test_products \
  --text "Bose QuietComfort 45 Bluetooth wireless noise cancelling headphones" \
  --id "headphones-2"

# 11. Final stats
echo ""
echo "11. Final collection statistics..."
oracle-vector stats test_products

echo ""
echo "================================="
echo "CLI Test Complete!"
echo ""
echo "You can now use these commands:"
echo "  oracle-vector --help                    # Show all commands"
echo "  oracle-vector search test_products <query>  # Search the collection"
echo "  oracle-vector delete-collection test_products  # Clean up"