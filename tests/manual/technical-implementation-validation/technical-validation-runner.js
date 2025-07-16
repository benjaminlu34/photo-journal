#!/usr/bin/env node

/**
 * Technical Implementation Validation Test Runner
 * 
 * This script runs the technical implementation validation tests
 * and generates a comprehensive report.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COLORS = {
  GREEN: '\x1b[32m',
  RED: '\x1b[31m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m'
};

function log(message, color = COLORS.RESET) {
  console.log(`${color}${message}${COLORS.RESET}`);
}

function logHeader(message) {
  log(`\n${COLORS.BOLD}${COLORS.BLUE}=== ${message} ===${COLORS.RESET}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, COLORS.GREEN);
}

function logError(message) {
  log(`❌ ${message}`, COLORS.RED);
}

function logWarning(message) {
  log(`⚠️  ${message}`, COLORS.YELLOW);
}

function runCommand(command, description) {
  try {
    log(`\nRunning: ${description}`);
    log(`Command: ${command}`, COLORS.YELLOW);
    
    const output = execSync(command, { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    logSuccess(`${description} completed successfully`);
    return { success: true, output };
  } catch (error) {
    logError(`${description} failed`);
    log(`Error: ${error.message}`, COLORS.RED);
    return { success: false, error: error.message, output: error.stdout };
  }
}

function generateReport(results) {
  const timestamp = new Date().toISOString();
  const reportPath = path.join(__dirname, 'technical-validation-report.md');
  
  let report = `# Technical Implementation Validation Report

**Generated:** ${timestamp}
**Test Suite:** Technical Implementation Validation

## Summary

`;

  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;

  report += `- **Total Tests:** ${totalTests}
- **Passed:** ${passedTests}
- **Failed:** ${failedTests}
- **Success Rate:** ${((passedTests / totalTests) * 100).toFixed(1)}%

## Test Results

`;

  results.forEach((result, index) => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    report += `### ${index + 1}. ${result.description}

**Status:** ${status}

`;

    if (result.output) {
      report += `**Output:**
\`\`\`
${result.output}
\`\`\`

`;
    }

    if (result.error) {
      report += `**Error:**
\`\`\`
${result.error}
\`\`\`

`;
    }
  });

  report += `## Recommendations

`;

  if (failedTests > 0) {
    report += `### Failed Tests
${failedTests} test(s) failed. Please review the errors above and:

1. Check the implementation against the requirements
2. Verify all dependencies are properly installed
3. Ensure the development environment is set up correctly
4. Run individual tests to isolate issues

`;
  }

  if (passedTests === totalTests) {
    report += `### All Tests Passed! 🎉

All technical implementation validation tests have passed successfully. The implementation meets all the specified requirements:

- Single user fetch per session ✅
- No JavaScript errors during auth flows ✅
- No "undefined user" errors in component rendering ✅
- Profile updates reflect immediately without page refresh ✅
- Auth redirects work smoothly without jarring transitions ✅
- React Query cache behavior and invalidation patterns ✅
- Error boundaries catch and handle component errors gracefully ✅
- Loading states prevent flickering and provide smooth UX ✅
- Retry mechanisms work for transient failures without infinite loops ✅

`;
  }

  fs.writeFileSync(reportPath, report);
  logSuccess(`Report generated: ${reportPath}`);
}

async function main() {
  logHeader('Technical Implementation Validation Test Runner');
  
  const results = [];
  
  // Test categories to run
  const testCategories = [
    {
      name: 'Single User Fetch Per Session',
      command: 'pnpm test tests/manual/technical-implementation-validation/technical-implementation-validation.test.tsx -t "Single User Fetch Per Session" --run',
      description: 'Testing single user fetch per session (Requirement 4.1)'
    },
    {
      name: 'No JavaScript Errors During Auth Flows',
      command: 'pnpm test tests/manual/technical-implementation-validation/technical-implementation-validation.test.tsx -t "No JavaScript Errors During Auth Flows" --run',
      description: 'Testing JavaScript error handling during auth flows (Requirement 4.2)'
    },
    {
      name: 'No Undefined User Errors',
      command: 'pnpm test tests/manual/technical-implementation-validation/technical-implementation-validation.test.tsx -t "undefined user" --run',
      description: 'Testing undefined user error handling (Requirement 4.3)'
    },
    {
      name: 'Profile Updates Reflect Immediately',
      command: 'pnpm test tests/manual/technical-implementation-validation/technical-implementation-validation.test.tsx -t "Profile Updates Reflect Immediately" --run',
      description: 'Testing immediate profile updates (Requirement 4.4)'
    },
    {
      name: 'React Query Cache Behavior',
      command: 'pnpm test tests/manual/technical-implementation-validation/technical-implementation-validation.test.tsx -t "React Query Cache Behavior" --run',
      description: 'Testing React Query cache behavior and invalidation (Requirement 4.6)'
    },
    {
      name: 'Error Boundaries',
      command: 'pnpm test tests/manual/technical-implementation-validation/technical-implementation-validation.test.tsx -t "Error Boundaries" --run',
      description: 'Testing error boundary functionality (Requirement 4.7)'
    },
    {
      name: 'Loading States',
      command: 'pnpm test tests/manual/technical-implementation-validation/technical-implementation-validation.test.tsx -t "Loading States" --run',
      description: 'Testing loading states and UX (Requirement 4.8)'
    },
    {
      name: 'Retry Mechanisms',
      command: 'pnpm test tests/manual/technical-implementation-validation/technical-implementation-validation.test.tsx -t "Retry Mechanisms" --run',
      description: 'Testing retry mechanisms and failure handling (Requirement 4.9)'
    }
  ];

  // Run all test categories
  for (const testCategory of testCategories) {
    logHeader(`Running ${testCategory.name}`);
    const result = runCommand(testCategory.command, testCategory.description);
    results.push({
      ...result,
      description: testCategory.description,
      category: testCategory.name
    });
  }

  // Run complete test suite
  logHeader('Running Complete Test Suite');
  const completeResult = runCommand(
    'pnpm test tests/manual/technical-implementation-validation/technical-implementation-validation.test.tsx --run',
    'Complete Technical Implementation Validation Test Suite'
  );
  
  results.push({
    ...completeResult,
    description: 'Complete Technical Implementation Validation Test Suite',
    category: 'Complete Suite'
  });

  // Generate report
  logHeader('Generating Report');
  generateReport(results);

  // Summary
  logHeader('Test Execution Summary');
  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;

  log(`Total Tests: ${totalTests}`);
  logSuccess(`Passed: ${passedTests}`);
  if (failedTests > 0) {
    logError(`Failed: ${failedTests}`);
  }
  log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (failedTests === 0) {
    logSuccess('\n🎉 All technical implementation validation tests passed!');
    logSuccess('The implementation meets all specified requirements.');
  } else {
    logWarning(`\n⚠️  ${failedTests} test(s) failed. Please review the report for details.`);
  }

  process.exit(failedTests > 0 ? 1 : 0);
}

// Handle script execution - always run main when this file is executed directly
main().catch(error => {
  logError(`Script execution failed: ${error.message}`);
  process.exit(1);
});

export { main };