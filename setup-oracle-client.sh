#!/bin/bash

# Oracle Instant Client Setup Script for macOS
# This script downloads and installs Oracle Instant Client required for the Oracle Vector DB library

set -e

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}Oracle Instant Client Setup for macOS${NC}"
echo "========================================"
echo ""

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    echo "Detected Apple Silicon (M1/M2/M3) Mac"
    ORACLE_VERSION="19.8.0.0.0"
    DOWNLOAD_URL="https://download.oracle.com/otn_software/mac/instantclient/198000/instantclient-basic-macos.arm64-19.8.0.0.0dbru.zip"
    ZIP_FILE="instantclient-basic-macos.arm64.zip"
elif [ "$ARCH" = "x86_64" ]; then
    echo "Detected Intel Mac"
    ORACLE_VERSION="19.8.0.0.0"
    DOWNLOAD_URL="https://download.oracle.com/otn_software/mac/instantclient/198000/instantclient-basic-macos.x64-19.8.0.0.0dbru.zip"
    ZIP_FILE="instantclient-basic-macos.x64.zip"
else
    echo -e "${RED}Unsupported architecture: $ARCH${NC}"
    exit 1
fi

# Create directory for Oracle client
ORACLE_DIR="/usr/local/lib/oracle"
echo ""
echo "Creating Oracle directory at $ORACLE_DIR..."
sudo mkdir -p $ORACLE_DIR

# Download Oracle Instant Client
echo ""
echo "Downloading Oracle Instant Client..."
cd /tmp
curl -o $ZIP_FILE $DOWNLOAD_URL

# Extract and install
echo ""
echo "Extracting and installing..."
unzip -q $ZIP_FILE
sudo mv instantclient_* $ORACLE_DIR/instantclient

# Create symbolic links
echo ""
echo "Creating symbolic links..."
cd $ORACLE_DIR/instantclient
sudo ln -sf libclntsh.dylib.19.1 libclntsh.dylib
sudo ln -sf libocci.dylib.19.1 libocci.dylib

# Set up environment variables
echo ""
echo "Setting up environment variables..."

# Add to shell profile
SHELL_PROFILE=""
if [ -f "$HOME/.zshrc" ]; then
    SHELL_PROFILE="$HOME/.zshrc"
elif [ -f "$HOME/.bash_profile" ]; then
    SHELL_PROFILE="$HOME/.bash_profile"
else
    SHELL_PROFILE="$HOME/.profile"
fi

# Check if already added
if ! grep -q "ORACLE_CLIENT_LIB" "$SHELL_PROFILE"; then
    echo "" >> "$SHELL_PROFILE"
    echo "# Oracle Instant Client" >> "$SHELL_PROFILE"
    echo "export ORACLE_CLIENT_LIB=$ORACLE_DIR/instantclient" >> "$SHELL_PROFILE"
    echo "export DYLD_LIBRARY_PATH=$ORACLE_DIR/instantclient:\$DYLD_LIBRARY_PATH" >> "$SHELL_PROFILE"
    echo -e "${GREEN}Environment variables added to $SHELL_PROFILE${NC}"
else
    echo -e "${YELLOW}Environment variables already configured${NC}"
fi

# Create a .env file for the project
echo ""
echo "Creating .env file for the project..."
cat > .env << EOF
# Oracle Instant Client Configuration
ORACLE_CLIENT_LIB=$ORACLE_DIR/instantclient
DYLD_LIBRARY_PATH=$ORACLE_DIR/instantclient:\$DYLD_LIBRARY_PATH
EOF

# Clean up
echo ""
echo "Cleaning up temporary files..."
rm -f /tmp/$ZIP_FILE

echo ""
echo -e "${GREEN}✅ Oracle Instant Client installed successfully!${NC}"
echo ""
echo "Please run the following command to apply environment variables:"
echo -e "${YELLOW}source $SHELL_PROFILE${NC}"
echo ""
echo "Or restart your terminal session."
echo ""
echo "You can now run the tests with:"
echo "  npm test"
echo "  npx ts-node comprehensive-test.ts"