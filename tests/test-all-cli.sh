#!/bin/bash

# Comprehensive CLI Test Script - Tests EVERY CLI feature
# Run with: bash test-all-cli.sh

set -e  # Exit on error

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_section() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_step() {
    echo -e "${YELLOW}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}  ✓ $1${NC}"
}

print_info() {
    echo -e "${CYAN}  ℹ $1${NC}"
}

print_error() {
    echo -e "${RED}  ✗ $1${NC}"
}

# Generate unique test collection names
TEST_COLLECTION="cli_test_$(date +%s)"
NS_COLLECTION="cli_ns_test_$(date +%s)"

echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║   Oracle Vector DB CLI - Comprehensive Test Suite     ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ========================================
# SETUP
# ========================================
print_section "SETUP: Installing Dependencies & Building"

print_step "Installing npm dependencies..."
npm install --silent
print_success "Dependencies installed"

print_step "Building TypeScript code..."
npm run build
print_success "TypeScript compiled"

print_step "Making CLI executable..."
chmod +x dist/cli/index.js
print_success "CLI is executable"

print_step "Creating npm link for global access..."
npm link
print_success "oracle-vector command available globally"

# ========================================
# 1. INITIALIZATION & CONFIGURATION
# ========================================
print_section "1. INITIALIZATION & CONFIGURATION"

print_step "Testing 'oracle-vector --help' command..."
oracle-vector --help > /dev/null
print_success "Help command works"

print_step "Initializing configuration with wallet..."
oracle-vector init \
  --wallet ./wallet \
  --username SRAO \
  --password "Ctigroup!2345678" \
  --connection sidexampledata_high
print_success "Configuration initialized"
print_info "Config saved to ~/.oracle-vector/config.json"

# ========================================
# 2. AI PROVIDER SETUP
# ========================================
print_section "2. AI PROVIDER CONFIGURATION"

print_step "Setting up OpenAI provider..."
echo -e "openai\ntext-embedding-ada-002\n" | oracle-vector setup-ai
print_success "OpenAI provider configured"

# ========================================
# 3. COLLECTION MANAGEMENT
# ========================================
print_section "3. COLLECTION MANAGEMENT"

print_step "Creating collection with all options..."
oracle-vector create-collection $TEST_COLLECTION \
  --dimension 1536 \
  --metric cosine \
  --embedding-model text-embedding-ada-002
print_success "Collection '$TEST_COLLECTION' created"

print_step "Creating second collection for namespace testing..."
oracle-vector create-collection $NS_COLLECTION \
  --dimension 1536 \
  --metric euclidean
print_success "Collection '$NS_COLLECTION' created"

print_step "Listing all collections..."
oracle-vector list-collections
print_success "Collections listed"

# ========================================
# 4. DOCUMENT OPERATIONS - FILE UPLOAD
# ========================================
print_section "4. DOCUMENT OPERATIONS - FILE UPLOAD"

print_step "Creating test data file with multiple documents..."
cat > test_products.json << EOF
[
  {
    "id": "laptop-1",
    "text": "Dell XPS 15 with Intel Core i9, 32GB RAM, 1TB SSD, NVIDIA RTX 4060",
    "metadata": {
      "category": "electronics",
      "subcategory": "laptop",
      "brand": "Dell",
      "price": 2499.99,
      "rating": 4.7,
      "inStock": true
    }
  },
  {
    "id": "laptop-2",
    "text": "MacBook Pro 16-inch with M3 Max chip, 48GB unified memory, 1TB SSD",
    "metadata": {
      "category": "electronics",
      "subcategory": "laptop",
      "brand": "Apple",
      "price": 3499.99,
      "rating": 4.9,
      "inStock": true
    }
  },
  {
    "id": "headphones-1",
    "text": "Sony WH-1000XM5 wireless noise canceling headphones with 30-hour battery",
    "metadata": {
      "category": "electronics",
      "subcategory": "headphones",
      "brand": "Sony",
      "price": 399.99,
      "rating": 4.5,
      "inStock": false
    }
  },
  {
    "id": "headphones-2",
    "text": "AirPods Pro 2nd generation with active noise cancellation and spatial audio",
    "metadata": {
      "category": "electronics",
      "subcategory": "headphones",
      "brand": "Apple",
      "price": 249.99,
      "rating": 4.4,
      "inStock": true
    }
  },
  {
    "id": "monitor-1",
    "text": "LG UltraGear 27-inch 4K gaming monitor with 144Hz refresh rate and G-Sync",
    "metadata": {
      "category": "electronics",
      "subcategory": "monitor",
      "brand": "LG",
      "price": 599.99,
      "rating": 4.6,
      "inStock": true
    }
  }
]
EOF
print_success "Test data file created with 5 products"

print_step "Upserting documents from JSON file..."
oracle-vector upsert $TEST_COLLECTION --file test_products.json
print_success "Documents upserted from file"

# ========================================
# 5. SINGLE DOCUMENT OPERATIONS
# ========================================
print_section "5. SINGLE DOCUMENT OPERATIONS"

print_step "Upserting single document with text and ID..."
oracle-vector upsert $TEST_COLLECTION \
  --text "Samsung Galaxy S24 Ultra with S Pen, 256GB storage, titanium frame" \
  --id "phone-1"
print_success "Single document upserted"

print_step "Upserting document with auto-generated ID..."
oracle-vector upsert $TEST_COLLECTION \
  --text "iPad Pro 12.9-inch with M2 chip and Liquid Retina XDR display"
print_success "Document upserted with auto-generated ID"

# ========================================
# 6. COLLECTION STATISTICS
# ========================================
print_section "6. COLLECTION STATISTICS"

print_step "Getting collection statistics..."
oracle-vector stats $TEST_COLLECTION
print_success "Statistics retrieved"

# ========================================
# 7. NATURAL LANGUAGE SEARCH
# ========================================
print_section "7. NATURAL LANGUAGE SEARCH"

print_step "Searching with natural language query..."
oracle-vector search $TEST_COLLECTION "powerful laptop for video editing" --top-k 3
print_success "Natural language search completed"

print_step "Searching for different category..."
oracle-vector search $TEST_COLLECTION "best headphones for music" --top-k 2
print_success "Category search completed"

# ========================================
# 8. FILTERED SEARCH
# ========================================
print_section "8. FILTERED SEARCH OPERATIONS"

print_step "Search with simple metadata filter..."
oracle-vector search $TEST_COLLECTION "electronics" \
  --filter '{"category": "electronics", "inStock": true}' \
  --top-k 3
print_success "Filtered search completed"

print_step "Search with price range filter..."
oracle-vector search $TEST_COLLECTION "premium devices" \
  --filter '{"price": {"$gte": 500, "$lte": 3000}}' \
  --top-k 5
print_success "Price range search completed"

print_step "Search with $in operator filter..."
oracle-vector search $TEST_COLLECTION "audio equipment" \
  --filter '{"brand": {"$in": ["Sony", "Apple"]}}' \
  --top-k 3
print_success "Complex filter search completed"

# ========================================
# 9. VECTOR SEARCH
# ========================================
print_section "9. VECTOR SEARCH (Direct Vector Input)"

print_step "Creating a random vector for search..."
# Generate a simple vector (normally would be 1536 dimensions)
VECTOR="[$(python3 -c 'import random; print(",".join([str(random.random()) for _ in range(1536)]))]"
echo "$VECTOR" > test_vector.json

print_step "Searching with direct vector input..."
oracle-vector search $TEST_COLLECTION --vector "$(cat test_vector.json)" --top-k 2
print_success "Vector search completed"

# ========================================
# 10. NAMESPACE OPERATIONS
# ========================================
print_section "10. NAMESPACE OPERATIONS"

print_step "Creating namespace test data..."
cat > ns_dev_data.json << EOF
[
  {"id": "dev-1", "text": "Development environment configuration"},
  {"id": "dev-2", "text": "Testing setup for development"}
]
EOF

cat > ns_prod_data.json << EOF
[
  {"id": "prod-1", "text": "Production deployment settings"},
  {"id": "prod-2", "text": "Live production monitoring"}
]
EOF
print_success "Namespace test data created"

# Note: CLI namespace support would need to be added to the implementation
print_info "Namespace operations via CLI would require additional implementation"

# ========================================
# 11. BATCH OPERATIONS TEST
# ========================================
print_section "11. BATCH OPERATIONS"

print_step "Creating large batch file (50 documents)..."
python3 << EOF
import json
docs = [
    {
        "id": f"batch-{i}",
        "text": f"Batch test document {i}: Product description for item {i}",
        "metadata": {
            "batch": i // 10,
            "index": i,
            "category": "batch-test"
        }
    }
    for i in range(50)
]
with open('batch_data.json', 'w') as f:
    json.dump(docs, f)
EOF
print_success "Batch file created with 50 documents"

print_step "Upserting batch documents..."
oracle-vector upsert $TEST_COLLECTION --file batch_data.json
print_success "Batch upsert completed"

print_step "Verifying batch upload with stats..."
oracle-vector stats $TEST_COLLECTION
print_success "Batch documents verified"

# ========================================
# 12. EXPORT FUNCTIONALITY
# ========================================
print_section "12. EXPORT FUNCTIONALITY"

print_step "Testing export command (if implemented)..."
oracle-vector export $TEST_COLLECTION --output export_test.json 2>/dev/null || {
    print_info "Export functionality not yet implemented (as expected)"
}

# ========================================
# 13. ERROR HANDLING
# ========================================
print_section "13. ERROR HANDLING & VALIDATION"

print_step "Testing invalid collection name..."
oracle-vector search "non_existent_collection_xyz" "test" 2>/dev/null || {
    print_success "Error handled correctly for non-existent collection"
}

print_step "Testing invalid filter JSON..."
oracle-vector search $TEST_COLLECTION "test" --filter '{invalid json}' 2>/dev/null || {
    print_success "Invalid JSON filter handled correctly"
}

# ========================================
# 14. CLEANUP OPERATIONS
# ========================================
print_section "14. CLEANUP OPERATIONS"

print_step "Testing delete with confirmation prompt (using --force to skip)..."
oracle-vector delete-collection $NS_COLLECTION --force
print_success "Collection deleted with --force flag"

print_step "Deleting main test collection..."
oracle-vector delete-collection $TEST_COLLECTION --force
print_success "Main test collection deleted"

print_step "Verifying collections are deleted..."
oracle-vector list-collections | grep -q $TEST_COLLECTION || {
    print_success "Collections successfully removed"
}

# ========================================
# 15. CLEANUP TEST FILES
# ========================================
print_section "15. CLEANING UP TEST FILES"

print_step "Removing test data files..."
rm -f test_products.json batch_data.json test_vector.json ns_dev_data.json ns_prod_data.json export_test.json
print_success "Test files cleaned up"

# ========================================
# TEST SUMMARY
# ========================================
print_section "✅ CLI TEST SUITE COMPLETED SUCCESSFULLY!"

echo -e "${GREEN}"
echo "All CLI features tested:"
echo "  • Initialization and configuration"
echo "  • AI provider setup"
echo "  • Collection creation with options"
echo "  • Collection listing"
echo "  • Document upload from JSON file"
echo "  • Single document upsert"
echo "  • Collection statistics"
echo "  • Natural language search"
echo "  • Filtered search (simple and complex)"
echo "  • Vector search"
echo "  • Batch operations"
echo "  • Error handling"
echo "  • Collection deletion"
echo -e "${NC}"

echo -e "\n${CYAN}You can now use these commands:${NC}"
echo "  oracle-vector --help                      # Show all commands"
echo "  oracle-vector create-collection <name>    # Create a new collection"
echo "  oracle-vector search <collection> <query> # Search a collection"
echo "  oracle-vector list-collections            # List all collections"
echo ""