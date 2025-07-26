#!/bin/bash

echo "Running user search tests..."

# Run unit tests
echo "Running unit tests..."
pnpm test tests/unit/user-search.test.ts

# Run integration tests
echo "Running integration tests..."
pnpm test tests/integration/user-search.integration.test.ts

echo "All tests completed!"