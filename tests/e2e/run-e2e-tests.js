#!/usr/bin/env node

/**
 * End-to-End Test Runner
 * Executes all E2E test scenarios for Phase 3 validation
 * Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Test suites to run
const testSuites = [
  {
    name: 'User Journey Tests',
    file: 'user-journey.test.ts',
    description: 'Complete user flows from signup to profile management',
  },
  {
    name: 'Cross-Browser Compatibility Tests',
    file: 'cross-browser-compatibility.test.ts',
    description: 'Profile functionality across different browser environments',
  },
  {
    name: 'Mobile Responsiveness Tests',
    file: 'mobile-responsiveness.test.ts',
    description: 'Profile components on different screen sizes and devices',
  },
  {
    name: 'Accessibility Compliance Tests',
    file: 'accessibility-compliance.test.ts',
    description: 'WCAG 2.1 compliance and accessibility features',
  },
  {
    name: 'Authentication-Profile Integration Tests',
    file: 'auth-profile-integration.test.ts',
    description: 'Integration between authentication and profile management',
  },
  {
    name: 'Data Flow Validation Tests',
    file: 'data-flow-validation.test.ts',
    description: 'Complete data flow from frontend to Supabase Storage',
  },
  {
    name: 'Rollback and Error Recovery Tests',
    file: 'rollback-error-recovery.test.ts',
    description: 'System recovery from various failure scenarios',
  },
];

// Test results tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  suites: [],
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  log('', 'reset');
  log('='.repeat(80), 'cyan');
  log(message, 'bright');
  log('='.repeat(80), 'cyan');
  log('', 'reset');
}

function logSubHeader(message) {
  log('', 'reset');
  log('-'.repeat(60), 'blue');
  log(message, 'blue');
  log('-'.repeat(60), 'blue');
}

function runTestSuite(suite) {
  logSubHeader(`Running: ${suite.name}`);
  log(`Description: ${suite.description}`, 'yellow');
  log(`File: ${suite.file}`, 'magenta');
  log('', 'reset');

  const testPath = path.join(__dirname, suite.file);
  
  if (!fs.existsSync(testPath)) {
    log(`❌ Test file not found: ${suite.file}`, 'red');
    results.suites.push({
      name: suite.name,
      status: 'error',
      error: 'Test file not found',
    });
    return false;
  }

  try {
    const startTime = Date.now();
    
    // Run the test suite
    const output = execSync(
      `npx vitest run ${testPath} --reporter=verbose`,
      { 
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 60000, // 60 second timeout
      }
    );
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Parse test results from output
    const testResults = parseTestOutput(output);
    
    log(`✅ ${suite.name} completed successfully`, 'green');
    log(`   Duration: ${duration}ms`, 'cyan');
    log(`   Tests: ${testResults.total} total, ${testResults.passed} passed, ${testResults.failed} failed`, 'cyan');
    
    results.total += testResults.total;
    results.passed += testResults.passed;
    results.failed += testResults.failed;
    results.skipped += testResults.skipped;
    
    results.suites.push({
      name: suite.name,
      status: 'passed',
      duration,
      tests: testResults,
    });
    
    return true;
  } catch (error) {
    log(`❌ ${suite.name} failed`, 'red');
    log(`   Error: ${error.message}`, 'red');
    
    // Try to parse partial results
    const testResults = parseTestOutput(error.stdout || '');
    
    results.total += testResults.total;
    results.passed += testResults.passed;
    results.failed += testResults.failed;
    results.skipped += testResults.skipped;
    
    results.suites.push({
      name: suite.name,
      status: 'failed',
      error: error.message,
      tests: testResults,
    });
    
    return false;
  }
}

function parseTestOutput(output) {
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
  };
  
  // Simple parsing - in a real implementation, you'd use a proper test reporter
  const lines = output.split('\n');
  
  for (const line of lines) {
    if (line.includes('✓') || line.includes('PASS')) {
      results.passed++;
      results.total++;
    } else if (line.includes('✗') || line.includes('FAIL')) {
      results.failed++;
      results.total++;
    } else if (line.includes('SKIP')) {
      results.skipped++;
      results.total++;
    }
  }
  
  return results;
}

function generateReport() {
  logHeader('End-to-End Test Results Summary');
  
  log(`Total Tests: ${results.total}`, 'bright');
  log(`Passed: ${results.passed}`, 'green');
  log(`Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  log(`Skipped: ${results.skipped}`, 'yellow');
  
  const successRate = results.total > 0 ? ((results.passed / results.total) * 100).toFixed(1) : 0;
  log(`Success Rate: ${successRate}%`, successRate >= 90 ? 'green' : successRate >= 70 ? 'yellow' : 'red');
  
  log('', 'reset');
  log('Suite Results:', 'bright');
  
  for (const suite of results.suites) {
    const statusIcon = suite.status === 'passed' ? '✅' : suite.status === 'failed' ? '❌' : '⚠️';
    const statusColor = suite.status === 'passed' ? 'green' : suite.status === 'failed' ? 'red' : 'yellow';
    
    log(`  ${statusIcon} ${suite.name}`, statusColor);
    
    if (suite.tests) {
      log(`     Tests: ${suite.tests.total} total, ${suite.tests.passed} passed, ${suite.tests.failed} failed`, 'cyan');
    }
    
    if (suite.duration) {
      log(`     Duration: ${suite.duration}ms`, 'cyan');
    }
    
    if (suite.error) {
      log(`     Error: ${suite.error}`, 'red');
    }
  }
  
  // Generate recommendations
  log('', 'reset');
  log('Recommendations:', 'bright');
  
  if (results.failed > 0) {
    log('  • Review failed tests and fix underlying issues', 'yellow');
    log('  • Check error logs for specific failure details', 'yellow');
  }
  
  if (successRate < 90) {
    log('  • Improve test coverage and reliability', 'yellow');
    log('  • Consider adding more robust error handling', 'yellow');
  }
  
  if (results.skipped > 0) {
    log('  • Review skipped tests and enable if applicable', 'yellow');
  }
  
  if (successRate >= 90) {
    log('  • Excellent test coverage! Consider this phase complete', 'green');
  }
  
  // Save detailed report
  const reportPath = path.join(__dirname, 'e2e-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  log('', 'reset');
  log(`Detailed report saved to: ${reportPath}`, 'cyan');
}

function checkPrerequisites() {
  logHeader('Checking Prerequisites');
  
  try {
    // Check if vitest is available
    execSync('npx vitest --version', { stdio: 'pipe' });
    log('✅ Vitest is available', 'green');
  } catch (error) {
    log('❌ Vitest is not available. Please install dependencies.', 'red');
    return false;
  }
  
  try {
    // Check if test files exist
    const testDir = __dirname;
    const testFiles = testSuites.map(suite => path.join(testDir, suite.file));
    
    for (const file of testFiles) {
      if (!fs.existsSync(file)) {
        log(`❌ Test file missing: ${path.basename(file)}`, 'red');
        return false;
      }
    }
    
    log(`✅ All ${testSuites.length} test files found`, 'green');
  } catch (error) {
    log('❌ Error checking test files', 'red');
    return false;
  }
  
  return true;
}

function main() {
  logHeader('Phase 3 End-to-End Testing Suite');
  log('Testing complete user journey scenarios for profile features', 'yellow');
  log('Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1', 'yellow');
  
  // Check prerequisites
  if (!checkPrerequisites()) {
    log('❌ Prerequisites not met. Exiting.', 'red');
    process.exit(1);
  }
  
  // Run all test suites
  let allPassed = true;
  
  for (const suite of testSuites) {
    const passed = runTestSuite(suite);
    if (!passed) {
      allPassed = false;
    }
  }
  
  // Generate final report
  generateReport();
  
  // Exit with appropriate code
  if (allPassed && results.failed === 0) {
    log('', 'reset');
    log('🎉 All end-to-end tests completed successfully!', 'green');
    process.exit(0);
  } else {
    log('', 'reset');
    log('⚠️  Some tests failed. Please review the results above.', 'yellow');
    process.exit(1);
  }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: node run-e2e-tests.js [options]

Options:
  --help, -h     Show this help message
  --suite <name> Run only a specific test suite
  --list         List available test suites

Available test suites:
${testSuites.map(suite => `  • ${suite.name}: ${suite.description}`).join('\n')}
`);
  process.exit(0);
}

if (process.argv.includes('--list')) {
  console.log('Available test suites:');
  testSuites.forEach((suite, index) => {
    console.log(`${index + 1}. ${suite.name}`);
    console.log(`   File: ${suite.file}`);
    console.log(`   Description: ${suite.description}`);
    console.log('');
  });
  process.exit(0);
}

// Check for specific suite
const suiteIndex = process.argv.indexOf('--suite');
if (suiteIndex !== -1 && process.argv[suiteIndex + 1]) {
  const suiteName = process.argv[suiteIndex + 1];
  const suite = testSuites.find(s => 
    s.name.toLowerCase().includes(suiteName.toLowerCase()) ||
    s.file.includes(suiteName)
  );
  
  if (suite) {
    logHeader(`Running Single Test Suite: ${suite.name}`);
    const passed = runTestSuite(suite);
    generateReport();
    process.exit(passed ? 0 : 1);
  } else {
    log(`❌ Test suite not found: ${suiteName}`, 'red');
    log('Use --list to see available suites', 'yellow');
    process.exit(1);
  }
}

// Run main function
main();