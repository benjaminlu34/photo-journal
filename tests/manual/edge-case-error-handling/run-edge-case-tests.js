#!/usr/bin/env node

/**
 * Edge Case and Error Handling Test Runner
 * 
 * This script executes all edge case and error handling tests for Phase 3
 * testing validation, providing comprehensive reporting and validation.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Test configuration
const testConfig = {
  automated: [
    'tests/manual/edge-case-error-handling/edge-case-error-handling.test.ts',
    'tests/unit/profile-form-validation.test.ts'
  ],
  manual: [
    'tests/manual/edge-case-error-handling/manual-edge-case-testing.md'
  ]
};

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logHeader(message) {
  log(`\n${colors.bold}${colors.blue}=== ${message} ===${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

// Test execution functions
function runAutomatedTests() {
  logHeader('Running Automated Edge Case Tests');
  
  const results = {
    passed: 0,
    failed: 0,
    total: 0,
    details: []
  };

  for (const testFile of testConfig.automated) {
    logInfo(`Running: ${testFile}`);
    
    try {
      const output = execSync(`pnpm test "${testFile}" --run`, { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      // Parse test results from output
      const passedMatch = output.match(/Tests\s+(\d+)\s+passed\s+\((\d+)\)/);
      const failedMatch = output.match(/Tests\s+(\d+)\s+failed/);
      
      const passed = passedMatch ? parseInt(passedMatch[1]) : 0;
      const total = passedMatch ? parseInt(passedMatch[2]) : 0;
      const failed = failedMatch ? parseInt(failedMatch[1]) : 0;
      
      results.passed += passed;
      results.failed += failed;
      results.total += total;
      
      results.details.push({
        file: testFile,
        passed,
        failed,
        total,
        status: failed === 0 ? 'PASS' : 'FAIL'
      });
      
      if (failed === 0) {
        logSuccess(`${testFile}: ${passed}/${total} tests passed`);
      } else {
        logError(`${testFile}: ${failed}/${total} tests failed`);
      }
      
    } catch (error) {
      logError(`Failed to run ${testFile}: ${error.message}`);
      results.details.push({
        file: testFile,
        passed: 0,
        failed: 1,
        total: 1,
        status: 'ERROR',
        error: error.message
      });
      results.failed += 1;
      results.total += 1;
    }
  }
  
  return results;
}

function validateManualTestDocumentation() {
  logHeader('Validating Manual Test Documentation');
  
  const results = {
    valid: 0,
    invalid: 0,
    total: 0,
    details: []
  };
  
  for (const docFile of testConfig.manual) {
    logInfo(`Validating: ${docFile}`);
    
    try {
      if (!fs.existsSync(docFile)) {
        throw new Error('File does not exist');
      }
      
      const content = fs.readFileSync(docFile, 'utf8');
      
      // Validate documentation structure
      const requiredSections = [
        'Prerequisites',
        'Test Files Preparation',
        'Test Scenarios',
        'Error Message Quality Checklist',
        'Performance Monitoring',
        'Success Criteria'
      ];
      
      const missingSections = requiredSections.filter(section => 
        !content.includes(section)
      );
      
      if (missingSections.length === 0) {
        logSuccess(`${docFile}: All required sections present`);
        results.valid += 1;
        results.details.push({
          file: docFile,
          status: 'VALID',
          sections: requiredSections.length
        });
      } else {
        logWarning(`${docFile}: Missing sections: ${missingSections.join(', ')}`);
        results.invalid += 1;
        results.details.push({
          file: docFile,
          status: 'INCOMPLETE',
          missingSections
        });
      }
      
    } catch (error) {
      logError(`Failed to validate ${docFile}: ${error.message}`);
      results.invalid += 1;
      results.details.push({
        file: docFile,
        status: 'ERROR',
        error: error.message
      });
    }
    
    results.total += 1;
  }
  
  return results;
}

function generateTestReport(automatedResults, manualResults) {
  logHeader('Test Execution Summary');
  
  // Automated tests summary
  log(`\n${colors.bold}Automated Tests:${colors.reset}`);
  log(`  Total Tests: ${automatedResults.total}`);
  log(`  Passed: ${automatedResults.passed}`, colors.green);
  log(`  Failed: ${automatedResults.failed}`, automatedResults.failed > 0 ? colors.red : colors.green);
  
  // Manual tests summary
  log(`\n${colors.bold}Manual Test Documentation:${colors.reset}`);
  log(`  Total Documents: ${manualResults.total}`);
  log(`  Valid: ${manualResults.valid}`, colors.green);
  log(`  Invalid: ${manualResults.invalid}`, manualResults.invalid > 0 ? colors.red : colors.green);
  
  // Overall status
  const overallSuccess = automatedResults.failed === 0 && manualResults.invalid === 0;
  log(`\n${colors.bold}Overall Status:${colors.reset}`);
  if (overallSuccess) {
    logSuccess('All edge case and error handling tests are ready for execution');
  } else {
    logError('Some tests failed or documentation is incomplete');
  }
  
  // Detailed results
  log(`\n${colors.bold}Detailed Results:${colors.reset}`);
  
  automatedResults.details.forEach(detail => {
    const status = detail.status === 'PASS' ? '✅' : '❌';
    log(`  ${status} ${detail.file}: ${detail.passed}/${detail.total} passed`);
    if (detail.error) {
      log(`    Error: ${detail.error}`, colors.red);
    }
  });
  
  manualResults.details.forEach(detail => {
    const status = detail.status === 'VALID' ? '✅' : '⚠️';
    log(`  ${status} ${detail.file}: ${detail.status}`);
    if (detail.missingSections) {
      log(`    Missing: ${detail.missingSections.join(', ')}`, colors.yellow);
    }
  });
  
  return overallSuccess;
}

function generateExecutionInstructions() {
  logHeader('Next Steps - Manual Test Execution');
  
  log(`\n${colors.bold}To execute manual edge case tests:${colors.reset}`);
  log('1. Review the manual testing guide:');
  log(`   ${colors.blue}tests/manual/edge-case-error-handling/manual-edge-case-testing.md${colors.reset}`);
  log('2. Prepare test files as specified in the guide');
  log('3. Start the application in development mode');
  log('4. Execute each test scenario systematically');
  log('5. Document results and any issues found');
  
  log(`\n${colors.bold}Test Coverage Areas:${colors.reset}`);
  const testAreas = [
    '5.1 Profile Picture Upload Failure - File Size >2MB',
    '5.2 Invalid File Type Upload',
    '5.3 Profile Updates with Missing Required Fields',
    '5.4 Network Connectivity Loss Simulation',
    '5.5 Concurrent Profile Updates',
    '5.6 Supabase Service Unavailability',
    '5.7 JWT Token Expiration',
    '5.8 Storage Quota Limits'
  ];
  
  testAreas.forEach(area => {
    log(`  • ${area}`);
  });
  
  log(`\n${colors.bold}Success Criteria:${colors.reset}`);
  log('✅ All error messages are user-friendly and actionable');
  log('✅ System handles edge cases gracefully without crashes');
  log('✅ Users can recover from all error states');
  log('✅ No data loss occurs during error scenarios');
  log('✅ Performance remains acceptable during error handling');
}

// Main execution
function main() {
  log(`${colors.bold}${colors.blue}Edge Case and Error Handling Test Suite${colors.reset}`);
  log('Phase 3 Testing Validation - Task 5 Execution\n');
  
  try {
    // Run automated tests
    const automatedResults = runAutomatedTests();
    
    // Validate manual test documentation
    const manualResults = validateManualTestDocumentation();
    
    // Generate comprehensive report
    const success = generateTestReport(automatedResults, manualResults);
    
    // Provide execution instructions
    generateExecutionInstructions();
    
    // Exit with appropriate code
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    logError(`Test execution failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
main();

export {
  runAutomatedTests,
  validateManualTestDocumentation,
  generateTestReport
};