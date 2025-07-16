/**
 * Profile Feature Manual Test Runner
 * 
 * This script provides automated checks for profile functionality
 * that can be run in the browser console for live testing.
 */

class ProfileTestRunner {
  constructor() {
    this.results = [];
    this.testCount = 0;
    this.passCount = 0;
    this.failCount = 0;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'pass' ? '✅' : type === 'fail' ? '❌' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async test(name, testFn) {
    this.testCount++;
    this.log(`Running: ${name}`);
    
    try {
      const result = await testFn();
      if (result) {
        this.passCount++;
        this.log(`PASS: ${name}`, 'pass');
        this.results.push({ name, status: 'PASS', details: result });
      } else {
        this.failCount++;
        this.log(`FAIL: ${name}`, 'fail');
        this.results.push({ name, status: 'FAIL', details: 'Test returned false' });
      }
    } catch (error) {
      this.failCount++;
      this.log(`FAIL: ${name} - ${error.message}`, 'fail');
      this.results.push({ name, status: 'FAIL', details: error.message });
    }
  }

  async runAllTests() {
    this.log('Starting Profile Feature Test Suite');
    this.log('=====================================');

    // Test 1: Check if profile page is accessible
    await this.test('Profile Page Accessibility', async () => {
      const currentPath = window.location.pathname;
      if (currentPath !== '/profile') {
        // Navigate to profile page
        if (window.history && window.history.pushState) {
          window.history.pushState({}, '', '/profile');
          // Trigger route change if using wouter or similar
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      }
      
      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if profile elements exist
      const profileElements = {
        title: document.querySelector('h2:contains("Profile")') || document.querySelector('[data-testid="profile-title"]'),
        editButton: document.querySelector('button:contains("Edit Profile")') || document.querySelector('[data-testid="edit-profile-btn"]'),
        profileInfo: document.querySelector('[data-testid="profile-info"]') || document.querySelector('.space-y-6')
      };
      
      return Object.values(profileElements).some(el => el !== null);
    });

    // Test 2: Check if edit modal can be opened
    await this.test('Edit Profile Modal', async () => {
      const editButton = Array.from(document.querySelectorAll('button')).find(btn => 
        btn.textContent.includes('Edit Profile') || btn.textContent.includes('Edit')
      );
      
      if (!editButton) return false;
      
      // Click edit button
      editButton.click();
      
      // Wait for modal to appear
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Check if modal is visible
      const modal = document.querySelector('[role="dialog"]') || 
                   document.querySelector('.modal') ||
                   document.querySelector('[data-testid="edit-profile-modal"]');
      
      return modal && modal.offsetParent !== null;
    });

    // Test 3: Check profile picture component
    await this.test('Profile Picture Component', async () => {
      const profilePicture = document.querySelector('[data-testid="profile-picture"]') ||
                           document.querySelector('.avatar') ||
                           document.querySelector('img[alt*="Profile"]') ||
                           document.querySelector('[class*="Avatar"]');
      
      return profilePicture !== null;
    });

    // Test 4: Check for user data display
    await this.test('User Data Display', async () => {
      // Look for email pattern
      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
      const pageText = document.body.textContent;
      
      // Check if email is displayed
      const hasEmail = emailRegex.test(pageText);
      
      // Check for name fields or labels
      const hasNameFields = pageText.includes('First Name') || 
                           pageText.includes('Last Name') ||
                           pageText.includes('firstName') ||
                           pageText.includes('lastName');
      
      return hasEmail || hasNameFields;
    });

    // Test 5: Check for error handling elements
    await this.test('Error Handling UI', async () => {
      // Check if toast/notification system is available
      const toastContainer = document.querySelector('[data-testid="toast"]') ||
                           document.querySelector('.toast') ||
                           document.querySelector('[class*="Toaster"]') ||
                           document.querySelector('[id*="toast"]');
      
      return toastContainer !== null;
    });

    // Test 6: Check network requests (basic)
    await this.test('Network Request Capability', async () => {
      // Check if fetch is available and working
      try {
        const response = await fetch('/api/auth/user', {
          method: 'GET',
          credentials: 'include'
        });
        
        // Don't care about the response status, just that we can make requests
        return true;
      } catch (error) {
        return false;
      }
    });

    // Test 7: Check for React Query or similar state management
    await this.test('State Management', async () => {
      // Check if React Query is available
      const hasReactQuery = window.React && window.React.version;
      
      // Check for query client or similar
      const hasQueryClient = window.__REACT_QUERY_CLIENT__ || 
                           window.queryClient ||
                           document.querySelector('[data-testid*="query"]');
      
      // Check for React DevTools
      const hasReactDevTools = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      
      return hasReactQuery || hasQueryClient || hasReactDevTools;
    });

    this.printSummary();
  }

  printSummary() {
    this.log('=====================================');
    this.log('Test Suite Complete');
    this.log(`Total Tests: ${this.testCount}`);
    this.log(`Passed: ${this.passCount}`, 'pass');
    this.log(`Failed: ${this.failCount}`, this.failCount > 0 ? 'fail' : 'info');
    this.log(`Success Rate: ${((this.passCount / this.testCount) * 100).toFixed(1)}%`);
    
    if (this.failCount > 0) {
      this.log('Failed Tests:');
      this.results.filter(r => r.status === 'FAIL').forEach(result => {
        this.log(`  - ${result.name}: ${result.details}`, 'fail');
      });
    }
    
    // Store results globally for inspection
    window.profileTestResults = this.results;
    this.log('Results stored in window.profileTestResults');
  }
}

// Usage instructions
console.log(`
Profile Feature Test Runner
===========================

To run the test suite, execute:
  const runner = new ProfileTestRunner();
  runner.runAllTests();

Or run individual tests:
  const runner = new ProfileTestRunner();
  runner.test('Test Name', async () => {
    // Your test logic here
    return true; // or false
  });

Make sure you're on the profile page or the tests will navigate there automatically.
`);

// Auto-run if requested
if (window.location.search.includes('autotest=true')) {
  const runner = new ProfileTestRunner();
  runner.runAllTests();
}

// Export for manual use
window.ProfileTestRunner = ProfileTestRunner;