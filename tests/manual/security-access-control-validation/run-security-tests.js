#!/usr/bin/env node

/**
 * Manual Security and Access Control Validation Script
 * 
 * This script performs comprehensive security testing of the application
 * including file upload validation, user ownership verification, rate limiting,
 * RLS policy enforcement, input sanitization, and authentication token validation.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log('\n' + '='.repeat(60), 'cyan');
  log(`  ${title}`, 'bright');
  log('='.repeat(60), 'cyan');
}

function logTest(testName, status, details = '') {
  const statusColor = status === 'PASS' ? 'green' : status === 'FAIL' ? 'red' : 'yellow';
  log(`  ${status.padEnd(6)} | ${testName}`, statusColor);
  if (details) {
    log(`         | ${details}`, 'reset');
  }
}

async function runSecurityTests() {
  log('Starting Security and Access Control Validation Tests', 'bright');
  log('This will test all security requirements from 6.1 to 6.7', 'blue');

  const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  };

  try {
    // Check if environment is properly configured
    logSection('Environment Validation');
    
    const requiredEnvVars = [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
      'SUPABASE_JWT_SECRET'
    ];

    let envValid = true;
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        logTest(`Environment Variable: ${envVar}`, 'FAIL', 'Missing required environment variable');
        envValid = false;
        testResults.failed++;
      } else {
        logTest(`Environment Variable: ${envVar}`, 'PASS');
        testResults.passed++;
      }
      testResults.total++;
    }

    if (!envValid) {
      log('\nEnvironment validation failed. Please check your .env files.', 'red');
      return testResults;
    }

    // Check if server is running
    logSection('Server Connectivity');
    try {
      execSync('curl -f http://localhost:5000/api/health', { stdio: 'pipe' });
      logTest('Server Health Check', 'PASS', 'Server is running and accessible');
      testResults.passed++;
    } catch (error) {
      logTest('Server Health Check', 'FAIL', 'Server is not running. Please start with: pnpm dev');
      testResults.failed++;
      return testResults;
    }
    testResults.total++;

    // Run the automated security tests
    logSection('Automated Security Test Suite');
    try {
      log('Running comprehensive security validation tests...', 'blue');
      
      const testCommand = 'npx vitest run tests/manual/security-access-control-validation/security-validation.test.ts --reporter=verbose';
      const output = execSync(testCommand, { 
        encoding: 'utf8',
        cwd: process.cwd()
      });
      
      log(output, 'reset');
      
      // Parse test results from vitest output
      const passMatches = output.match(/(\d+) passed/);
      const failMatches = output.match(/(\d+) failed/);
      
      if (passMatches) {
        const passed = parseInt(passMatches[1]);
        testResults.passed += passed;
        testResults.total += passed;
        logTest('Automated Security Tests', 'PASS', `${passed} tests passed`);
      }
      
      if (failMatches) {
        const failed = parseInt(failMatches[1]);
        testResults.failed += failed;
        testResults.total += failed;
        logTest('Automated Security Tests', 'FAIL', `${failed} tests failed`);
      }
      
    } catch (error) {
      logTest('Automated Security Tests', 'FAIL', 'Test execution failed');
      log(error.message, 'red');
      testResults.failed++;
      testResults.total++;
    }

    // Manual validation checks
    logSection('Manual Security Validation Checklist');
    
    const manualChecks = [
      {
        name: 'File Upload Client Validation',
        description: 'Verify file type and size validation in browser dev tools',
        requirement: '6.1'
      },
      {
        name: 'Network Tab Inspection',
        description: 'Check that sensitive data is not exposed in network requests',
        requirement: '6.6'
      },
      {
        name: 'Console Error Analysis',
        description: 'Verify no sensitive information is logged to browser console',
        requirement: '6.6'
      },
      {
        name: 'Cross-User Data Access',
        description: 'Manually verify users cannot access other users\' data',
        requirement: '6.2'
      },
      {
        name: 'Rate Limiting UI Feedback',
        description: 'Verify rate limiting shows appropriate user feedback',
        requirement: '6.3'
      }
    ];

    log('\nThe following checks should be performed manually:', 'yellow');
    manualChecks.forEach((check, index) => {
      log(`\n${index + 1}. ${check.name} (Requirement ${check.requirement})`, 'bright');
      log(`   ${check.description}`, 'reset');
    });

    // Security recommendations
    logSection('Security Recommendations');
    
    const recommendations = [
      'Regularly update dependencies to patch security vulnerabilities',
      'Implement Content Security Policy (CSP) headers',
      'Add request logging and monitoring for suspicious activity',
      'Consider implementing CAPTCHA for sensitive operations',
      'Regular security audits and penetration testing',
      'Implement proper session management and timeout policies',
      'Add input validation on all user inputs',
      'Implement proper error handling without information leakage'
    ];

    recommendations.forEach((rec, index) => {
      log(`${index + 1}. ${rec}`, 'blue');
    });

  } catch (error) {
    log(`\nUnexpected error during security testing: ${error.message}`, 'red');
    testResults.failed++;
    testResults.total++;
  }

  // Final results
  logSection('Security Test Results Summary');
  
  log(`Total Tests: ${testResults.total}`, 'bright');
  log(`Passed: ${testResults.passed}`, 'green');
  log(`Failed: ${testResults.failed}`, testResults.failed > 0 ? 'red' : 'green');
  log(`Skipped: ${testResults.skipped}`, 'yellow');
  
  const successRate = testResults.total > 0 ? (testResults.passed / testResults.total * 100).toFixed(1) : 0;
  log(`Success Rate: ${successRate}%`, successRate >= 90 ? 'green' : successRate >= 70 ? 'yellow' : 'red');

  if (testResults.failed === 0) {
    log('\n✅ All security tests passed! The application meets security requirements.', 'green');
  } else {
    log('\n❌ Some security tests failed. Please review and fix the issues above.', 'red');
  }

  return testResults;
}

// Run the tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSecurityTests()
    .then(results => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      log(`Fatal error: ${error.message}`, 'red');
      process.exit(1);
    });
}

export { runSecurityTests };