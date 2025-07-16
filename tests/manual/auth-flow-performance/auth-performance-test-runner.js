/**
 * Authentication Flow Performance Test Runner
 * 
 * This script provides automated testing capabilities for authentication
 * performance requirements 3.1-3.8 in Phase 3 testing validation.
 * 
 * Usage:
 * 1. Open browser DevTools console on the application
 * 2. Copy and paste this script
 * 3. Run: const runner = new AuthPerformanceTestRunner(); runner.runAllTests();
 */

class AuthPerformanceTestRunner {
  constructor() {
    this.results = {
      testSuite: 'Authentication Flow Performance',
      timestamp: new Date().toISOString(),
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        warnings: 0
      }
    };
    
    this.thresholds = {
      initialLoadTime: 2000, // 2 seconds
      authStateSync: 2000,   // 2 seconds
      cacheInvalidation: 500, // 500ms
      errorRecovery: 1000    // 1 second
    };
    
    console.log('🚀 Auth Performance Test Runner initialized');
    console.log('Thresholds:', this.thresholds);
  }

  /**
   * Run all authentication performance tests
   */
  async runAllTests() {
    console.log('\n📊 Starting Authentication Flow Performance Tests...\n');
    
    try {
      await this.test3_1_InitialPageLoadTime();
      await this.test3_2_AuthStateVisualStability();
      await this.test3_3_CacheInvalidation();
      await this.test3_4_MultiTabAuthSync();
      await this.test3_5_UnauthorizedResponseHandling();
      await this.test3_6_NetworkFailureHandling();
      await this.test3_7_ConcurrentAuthOperations();
      await this.test3_8_RapidAuthCycles();
      
      this.generateReport();
    } catch (error) {
      console.error('❌ Test suite execution failed:', error);
      this.addResult('Test Suite Execution', false, `Suite failed: ${error.message}`);
    }
  }

  /**
   * Test 3.1: Initial Page Load Time Measurement
   */
  async test3_1_InitialPageLoadTime() {
    console.log('🔍 Test 3.1: Initial Page Load Time Measurement');
    
    try {
      const performanceMetrics = this.getPerformanceMetrics();
      const loadTime = performanceMetrics.loadComplete - performanceMetrics.navigationStart;
      const domContentLoadedTime = performanceMetrics.domContentLoaded - performanceMetrics.navigationStart;
      
      console.log(`📈 Load metrics:
        - Total load time: ${loadTime}ms
        - DOM Content Loaded: ${domContentLoadedTime}ms
        - First Contentful Paint: ${performanceMetrics.firstContentfulPaint}ms
        - Time to Interactive: ${performanceMetrics.timeToInteractive}ms`);
      
      const passed = loadTime < this.thresholds.initialLoadTime;
      const details = `Load time: ${loadTime}ms (threshold: ${this.thresholds.initialLoadTime}ms)`;
      
      this.addResult('3.1 Initial Page Load Time', passed, details);
      
      if (!passed) {
        console.warn(`⚠️ Load time ${loadTime}ms exceeds ${this.thresholds.initialLoadTime}ms threshold`);
      }
      
    } catch (error) {
      console.error('❌ Test 3.1 failed:', error);
      this.addResult('3.1 Initial Page Load Time', false, `Error: ${error.message}`);
    }
  }

  /**
   * Test 3.2: Auth State Change Visual Stability
   */
  async test3_2_AuthStateVisualStability() {
    console.log('🔍 Test 3.2: Auth State Change Visual Stability');
    
    try {
      // Monitor for layout shifts during auth state changes
      let layoutShifts = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
            layoutShifts += entry.value;
          }
        }
      });
      
      observer.observe({ entryTypes: ['layout-shift'] });
      
      // Simulate auth state change if possible
      const authStateElement = document.querySelector('[data-auth-state]');
      const profileIcon = document.querySelector('[data-testid="profile-icon"]');
      
      let visualStabilityScore = 1.0;
      
      if (layoutShifts > 0.1) {
        visualStabilityScore -= layoutShifts;
      }
      
      const passed = visualStabilityScore > 0.9;
      const details = `Visual stability score: ${visualStabilityScore.toFixed(3)} (layout shifts: ${layoutShifts.toFixed(3)})`;
      
      this.addResult('3.2 Auth State Visual Stability', passed, details);
      
      observer.disconnect();
      
    } catch (error) {
      console.error('❌ Test 3.2 failed:', error);
      this.addResult('3.2 Auth State Visual Stability', false, `Error: ${error.message}`);
    }
  }

  /**
   * Test 3.3: Cache Invalidation After Profile Updates
   */
  async test3_3_CacheInvalidation() {
    console.log('🔍 Test 3.3: Cache Invalidation After Profile Updates');
    
    try {
      const startTime = performance.now();
      
      // Check if React Query is available
      const queryClient = window.queryClient || window.__REACT_QUERY_CLIENT__;
      
      if (!queryClient) {
        console.warn('⚠️ React Query client not found, testing basic cache behavior');
      }
      
      // Monitor network requests for cache invalidation
      const originalFetch = window.fetch;
      let cacheInvalidationDetected = false;
      let invalidationTime = 0;
      
      window.fetch = async (...args) => {
        const url = args[0];
        if (typeof url === 'string' && url.includes('/api/profile')) {
          if (!cacheInvalidationDetected) {
            cacheInvalidationDetected = true;
            invalidationTime = performance.now() - startTime;
          }
        }
        return originalFetch(...args);
      };
      
      // Simulate profile update trigger
      const profileForm = document.querySelector('form[data-testid="profile-form"]');
      if (profileForm) {
        // Trigger a form submission or update
        const event = new Event('submit', { bubbles: true });
        profileForm.dispatchEvent(event);
      }
      
      // Wait for potential cache invalidation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Restore original fetch
      window.fetch = originalFetch;
      
      const passed = cacheInvalidationDetected && invalidationTime < this.thresholds.cacheInvalidation;
      const details = cacheInvalidationDetected 
        ? `Cache invalidation time: ${invalidationTime.toFixed(2)}ms`
        : 'No cache invalidation detected';
      
      this.addResult('3.3 Cache Invalidation', passed, details);
      
    } catch (error) {
      console.error('❌ Test 3.3 failed:', error);
      this.addResult('3.3 Cache Invalidation', false, `Error: ${error.message}`);
    }
  }

  /**
   * Test 3.4: Multi-Tab Auth State Synchronization
   */
  async test3_4_MultiTabAuthSync() {
    console.log('🔍 Test 3.4: Multi-Tab Auth State Synchronization');
    
    try {
      // This test requires manual verification or browser automation
      // We'll test the storage event mechanism
      
      const startTime = performance.now();
      let syncDetected = false;
      let syncTime = 0;
      
      const storageListener = (event) => {
        if (event.key && (event.key.includes('auth') || event.key.includes('user'))) {
          if (!syncDetected) {
            syncDetected = true;
            syncTime = performance.now() - startTime;
          }
        }
      };
      
      window.addEventListener('storage', storageListener);
      
      // Simulate auth state change in localStorage
      const currentAuth = localStorage.getItem('supabase.auth.token');
      localStorage.setItem('supabase.auth.token', JSON.stringify({ 
        ...JSON.parse(currentAuth || '{}'), 
        timestamp: Date.now() 
      }));
      
      // Wait for sync detection
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      window.removeEventListener('storage', storageListener);
      
      const passed = syncDetected && syncTime < this.thresholds.authStateSync;
      const details = syncDetected 
        ? `Auth sync time: ${syncTime.toFixed(2)}ms`
        : 'No auth sync detected (may require multiple tabs)';
      
      this.addResult('3.4 Multi-Tab Auth Sync', passed, details);
      
    } catch (error) {
      console.error('❌ Test 3.4 failed:', error);
      this.addResult('3.4 Multi-Tab Auth Sync', false, `Error: ${error.message}`);
    }
  }

  /**
   * Test 3.5: 401 Unauthorized Response Handling
   */
  async test3_5_UnauthorizedResponseHandling() {
    console.log('🔍 Test 3.5: 401 Unauthorized Response Handling');
    
    try {
      let errorHandled = false;
      let gracefulHandling = true;
      
      // Monitor for unhandled errors
      const errorHandler = (event) => {
        if (event.error && event.error.message.includes('401')) {
          gracefulHandling = false;
        }
      };
      
      window.addEventListener('error', errorHandler);
      
      // Simulate 401 response
      try {
        const response = await fetch('/api/profile', {
          headers: {
            'Authorization': 'Bearer invalid-token-for-testing'
          }
        });
        
        if (response.status === 401) {
          errorHandled = true;
          console.log('✅ 401 response received and handled');
        }
      } catch (fetchError) {
        // Check if error was handled gracefully
        errorHandled = true;
      }
      
      window.removeEventListener('error', errorHandler);
      
      // Check for error boundaries or error states in UI
      const errorBoundary = document.querySelector('.error-boundary');
      const errorMessage = document.querySelector('[data-testid="error-message"]');
      
      const hasErrorUI = errorBoundary || errorMessage;
      
      const passed = errorHandled && gracefulHandling;
      const details = `Error handled: ${errorHandled}, Graceful: ${gracefulHandling}, UI feedback: ${!!hasErrorUI}`;
      
      this.addResult('3.5 401 Response Handling', passed, details);
      
    } catch (error) {
      console.error('❌ Test 3.5 failed:', error);
      this.addResult('3.5 401 Response Handling', false, `Error: ${error.message}`);
    }
  }

  /**
   * Test 3.6: Network Failure Graceful Degradation
   */
  async test3_6_NetworkFailureHandling() {
    console.log('🔍 Test 3.6: Network Failure Graceful Degradation');
    
    try {
      let retryAttempts = 0;
      let gracefulDegradation = true;
      
      // Mock network failure
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        retryAttempts++;
        if (retryAttempts <= 2) {
          throw new Error('Network failure simulation');
        }
        return originalFetch(...args);
      };
      
      try {
        // Attempt a network request that should trigger retry
        await fetch('/api/profile');
      } catch (networkError) {
        // Expected to fail, check if handled gracefully
        console.log('Network error caught:', networkError.message);
      }
      
      // Restore original fetch
      window.fetch = originalFetch;
      
      // Check for offline indicators or error messages
      const offlineIndicator = document.querySelector('[data-testid="offline-indicator"]');
      const networkErrorMessage = document.querySelector('[data-testid="network-error"]');
      
      const hasOfflineHandling = offlineIndicator || networkErrorMessage;
      
      const passed = retryAttempts > 1 && gracefulDegradation;
      const details = `Retry attempts: ${retryAttempts}, Offline handling: ${!!hasOfflineHandling}`;
      
      this.addResult('3.6 Network Failure Handling', passed, details);
      
    } catch (error) {
      console.error('❌ Test 3.6 failed:', error);
      this.addResult('3.6 Network Failure Handling', false, `Error: ${error.message}`);
    }
  }

  /**
   * Test 3.7: Concurrent Auth Operations
   */
  async test3_7_ConcurrentAuthOperations() {
    console.log('🔍 Test 3.7: Concurrent Auth Operations');
    
    try {
      const concurrentRequests = 5;
      const promises = [];
      let raceConditionDetected = false;
      
      // Create concurrent auth-related requests
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          fetch('/api/profile', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          }).catch(error => {
            console.log(`Concurrent request ${i} error:`, error.message);
            return { error: error.message };
          })
        );
      }
      
      const startTime = performance.now();
      const results = await Promise.all(promises);
      const endTime = performance.now();
      
      // Check for race conditions (inconsistent results)
      const successfulResults = results.filter(r => !r.error);
      if (successfulResults.length > 1) {
        // Compare response consistency
        const firstResponse = JSON.stringify(successfulResults[0]);
        raceConditionDetected = successfulResults.some(r => 
          JSON.stringify(r) !== firstResponse
        );
      }
      
      const passed = !raceConditionDetected && results.length === concurrentRequests;
      const details = `Concurrent requests: ${concurrentRequests}, Race conditions: ${raceConditionDetected}, Duration: ${(endTime - startTime).toFixed(2)}ms`;
      
      this.addResult('3.7 Concurrent Auth Operations', passed, details);
      
    } catch (error) {
      console.error('❌ Test 3.7 failed:', error);
      this.addResult('3.7 Concurrent Auth Operations', false, `Error: ${error.message}`);
    }
  }

  /**
   * Test 3.8: Rapid Sign-in/Sign-out Cycles
   */
  async test3_8_RapidAuthCycles() {
    console.log('🔍 Test 3.8: Rapid Sign-in/Sign-out Cycles');
    
    try {
      const cycles = 5; // Reduced for browser testing
      const startMemory = performance.memory?.usedJSHeapSize || 0;
      let systemStable = true;
      
      console.log(`Starting ${cycles} rapid auth cycles...`);
      
      for (let i = 0; i < cycles; i++) {
        try {
          console.log(`Cycle ${i + 1}/${cycles}`);
          
          // Simulate auth state changes
          const authEvent = new CustomEvent('auth-state-change', {
            detail: { type: 'signin', cycle: i }
          });
          window.dispatchEvent(authEvent);
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const signoutEvent = new CustomEvent('auth-state-change', {
            detail: { type: 'signout', cycle: i }
          });
          window.dispatchEvent(signoutEvent);
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (cycleError) {
          console.error(`Cycle ${i + 1} failed:`, cycleError);
          systemStable = false;
        }
      }
      
      const endMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryIncrease = endMemory - startMemory;
      const memoryThreshold = 10 * 1024 * 1024; // 10MB
      
      const memoryStable = memoryIncrease < memoryThreshold;
      
      console.log(`Memory usage change: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      
      const passed = systemStable && memoryStable;
      const details = `Cycles: ${cycles}, System stable: ${systemStable}, Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`;
      
      this.addResult('3.8 Rapid Auth Cycles', passed, details);
      
    } catch (error) {
      console.error('❌ Test 3.8 failed:', error);
      this.addResult('3.8 Rapid Auth Cycles', false, `Error: ${error.message}`);
    }
  }

  /**
   * Get performance metrics from browser
   */
  getPerformanceMetrics() {
    const timing = performance.timing;
    const paintEntries = performance.getEntriesByType('paint');
    
    return {
      navigationStart: timing.navigationStart,
      domContentLoaded: timing.domContentLoadedEventEnd,
      loadComplete: timing.loadEventEnd,
      firstContentfulPaint: paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0,
      timeToInteractive: timing.domInteractive - timing.navigationStart
    };
  }

  /**
   * Add test result to results collection
   */
  addResult(testName, passed, details) {
    const result = {
      test: testName,
      status: passed ? 'PASS' : 'FAIL',
      details: details,
      timestamp: new Date().toISOString()
    };
    
    this.results.tests.push(result);
    this.results.summary.total++;
    
    if (passed) {
      this.results.summary.passed++;
      console.log(`✅ ${testName}: PASSED - ${details}`);
    } else {
      this.results.summary.failed++;
      console.log(`❌ ${testName}: FAILED - ${details}`);
    }
  }

  /**
   * Generate comprehensive test report
   */
  generateReport() {
    console.log('\n📊 Authentication Flow Performance Test Report\n');
    console.log('='.repeat(60));
    
    console.log(`\n📈 Summary:
    Total Tests: ${this.results.summary.total}
    Passed: ${this.results.summary.passed}
    Failed: ${this.results.summary.failed}
    Success Rate: ${((this.results.summary.passed / this.results.summary.total) * 100).toFixed(1)}%`);
    
    console.log('\n📋 Detailed Results:');
    this.results.tests.forEach(test => {
      const status = test.status === 'PASS' ? '✅' : '❌';
      console.log(`${status} ${test.test}: ${test.details}`);
    });
    
    console.log('\n🎯 Performance Thresholds:');
    Object.entries(this.thresholds).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}ms`);
    });
    
    // Store results globally for external access
    window.authPerformanceTestResults = this.results;
    
    console.log('\n💾 Results stored in window.authPerformanceTestResults');
    console.log('='.repeat(60));
    
    // Recommendations based on results
    this.generateRecommendations();
  }

  /**
   * Generate recommendations based on test results
   */
  generateRecommendations() {
    const failedTests = this.results.tests.filter(test => test.status === 'FAIL');
    
    if (failedTests.length === 0) {
      console.log('\n🎉 All tests passed! Authentication flow performance meets requirements.');
      return;
    }
    
    console.log('\n🔧 Recommendations for Failed Tests:');
    
    failedTests.forEach(test => {
      console.log(`\n❌ ${test.test}:`);
      
      if (test.test.includes('Load Time')) {
        console.log('  • Consider code splitting and lazy loading');
        console.log('  • Optimize bundle size and remove unused dependencies');
        console.log('  • Implement service worker caching');
      }
      
      if (test.test.includes('Visual Stability')) {
        console.log('  • Add skeleton loaders for auth state transitions');
        console.log('  • Use CSS transforms instead of layout changes');
        console.log('  • Implement smooth loading states');
      }
      
      if (test.test.includes('Cache')) {
        console.log('  • Review React Query cache configuration');
        console.log('  • Implement proper cache invalidation strategies');
        console.log('  • Consider optimistic updates');
      }
      
      if (test.test.includes('Multi-Tab')) {
        console.log('  • Implement localStorage/sessionStorage sync');
        console.log('  • Use BroadcastChannel API for tab communication');
        console.log('  • Add storage event listeners');
      }
      
      if (test.test.includes('401')) {
        console.log('  • Implement automatic token refresh');
        console.log('  • Add proper error boundaries');
        console.log('  • Improve error message UX');
      }
      
      if (test.test.includes('Network')) {
        console.log('  • Implement retry mechanisms with exponential backoff');
        console.log('  • Add offline detection and handling');
        console.log('  • Show appropriate loading/error states');
      }
      
      if (test.test.includes('Concurrent')) {
        console.log('  • Implement request deduplication');
        console.log('  • Add proper race condition handling');
        console.log('  • Use optimistic locking for updates');
      }
      
      if (test.test.includes('Rapid')) {
        console.log('  • Add debouncing for rapid operations');
        console.log('  • Implement proper cleanup in useEffect hooks');
        console.log('  • Monitor for memory leaks');
      }
    });
  }
}

// Export for global access
window.AuthPerformanceTestRunner = AuthPerformanceTestRunner;

console.log(`
🚀 Authentication Performance Test Runner Loaded!

Usage:
  const runner = new AuthPerformanceTestRunner();
  runner.runAllTests();

Individual tests:
  runner.test3_1_InitialPageLoadTime();
  runner.test3_2_AuthStateVisualStability();
  // ... etc

Results will be stored in window.authPerformanceTestResults
`);