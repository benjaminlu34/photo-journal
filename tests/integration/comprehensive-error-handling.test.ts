import { Logger } from './logger';
import { ErrorHandler } from './errorHandler';
import * as assert from 'assert';
import * as sinon from 'sinon';

describe('Error Handling and Logging Tests', () => {
  let logger: Logger;
  let errorHandler: ErrorHandler;
  let consoleLogSpy: sinon.SinonSpy;
  let consoleErrorSpy: sinon.SinonSpy;

  beforeEach(() => {
    // Setup spies for console methods
    consoleLogSpy = sinon.spy(console, 'log');
    consoleErrorSpy = sinon.spy(console, 'error');
    
    // Initialize logger and error handler
    logger = new Logger();
    errorHandler = new ErrorHandler(logger);
  });

  afterEach(() => {
    // Restore console methods
    consoleLogSpy.restore();
    consoleErrorSpy.restore();
  });

  describe('Logger', () => {
    it('should log info messages correctly', () => {
      const message = 'Test info message';
      logger.info(message);
      assert(consoleLogSpy.calledOnce);
      assert(consoleLogSpy.calledWithMatch(/INFO:/));
      assert(consoleLogSpy.calledWithMatch(message));
    });

    it('should log warning messages correctly', () => {
      const message = 'Test warning message';
      logger.warn(message);
      assert(consoleLogSpy.calledOnce);
      assert(consoleLogSpy.calledWithMatch(/WARNING:/));
      assert(consoleLogSpy.calledWithMatch(message));
    });

    it('should log error messages correctly', () => {
      const message = 'Test error message';
      logger.error(message);
      assert(consoleErrorSpy.calledOnce);
      assert(consoleErrorSpy.calledWithMatch(/ERROR:/));
      assert(consoleErrorSpy.calledWithMatch(message));
    });

    it('should sanitize log messages to prevent log injection', () => {
      const maliciousMessage = 'Malicious\n message \r with line breaks';
      logger.info(maliciousMessage);
      assert(consoleLogSpy.calledOnce);
      assert(!consoleLogSpy.calledWithMatch(/\n/));
      assert(!consoleLogSpy.calledWithMatch(/\r/));
    });
  });

  describe('ErrorHandler', () => {
    it('should handle and log operational errors', () => {
      const error = new Error('Operational error');
      error.name = 'OperationalError';
      
      errorHandler.handleError(error);
      
      assert(consoleErrorSpy.calledOnce);
      assert(consoleErrorSpy.calledWithMatch(/ERROR:/));
      assert(consoleErrorSpy.calledWithMatch(/Operational error/));
    });

    it('should handle and log programming errors', () => {
      const error = new TypeError('Programming error');
      
      errorHandler.handleError(error);
      
      assert(consoleErrorSpy.calledOnce);
      assert(consoleErrorSpy.calledWithMatch(/ERROR:/));
      assert(consoleErrorSpy.calledWithMatch(/Programming error/));
    });

    it('should handle errors with sensitive information', () => {
      const error = new Error('Error with password: secret123');
      
      errorHandler.handleError(error);
      
      assert(consoleErrorSpy.calledOnce);
      assert(consoleErrorSpy.calledWithMatch(/ERROR:/));
      assert(!consoleErrorSpy.calledWithMatch(/secret123/));
    });

    it('should handle errors with stack traces', () => {
      const error = new Error('Error with stack trace');
      
      errorHandler.handleError(error);
      
      assert(consoleErrorSpy.calledOnce);
      assert(consoleErrorSpy.calledWithMatch(/ERROR:/));
      assert(consoleErrorSpy.calledWithMatch(/Error with stack trace/));
      assert(consoleErrorSpy.calledWithMatch(/Stack:/));
    });

    it('should limit error message size to prevent DoS', () => {
      const largeMessage = 'a'.repeat(10000);
      const error = new Error(largeMessage);
      
      errorHandler.handleError(error);
      
      const call = consoleErrorSpy.getCall(0);
      assert(call.args[0].length < 1000, 'Error message should be truncated');
    });
  });

  describe('Security Hardening Requirements', () => {
    it('should not expose system paths in error messages', () => {
      const errorWithPath = new Error('Error in file C:\\Users\\admin\\app\\server.js');
      
      errorHandler.handleError(errorWithPath);
      
      assert(consoleErrorSpy.calledOnce);
      assert(!consoleErrorSpy.calledWithMatch(/C:\\Users\\admin/));
    });

    it('should not log sensitive environment variables', () => {
      process.env.DB_PASSWORD = 'supersecret';
      const error = new Error(`Failed to connect with ${process.env.DB_PASSWORD}`);
      
      errorHandler.handleError(error);
      
      assert(consoleErrorSpy.calledOnce);
      assert(!consoleErrorSpy.calledWithMatch(/supersecret/));
      delete process.env.DB_PASSWORD;
    });

    it('should handle uncaught exceptions gracefully', () => {
      const uncaughtHandler = process.listeners('uncaughtException')[0];
      assert(uncaughtHandler, 'Should have an uncaughtException handler');
      
      const error = new Error('Uncaught exception');
      const exitStub = sinon.stub(process, 'exit');
      
      // Simulate uncaught exception
      uncaughtHandler(error);
      
      assert(consoleErrorSpy.called);
      assert(consoleErrorSpy.calledWithMatch(/Uncaught exception/));
      assert(exitStub.called, 'Process should exit after uncaught exception');
      
      exitStub.restore();
    });

    it('should handle unhandled promise rejections', () => {
      const rejectionHandler = process.listeners('unhandledRejection')[0];
      assert(rejectionHandler, 'Should have an unhandledRejection handler');
      
      const reason = new Error('Unhandled rejection');
      const promise = Promise.reject(reason);
      const exitStub = sinon.stub(process, 'exit');
      
      // Simulate unhandled rejection
      rejectionHandler(reason, promise);
      
      assert(consoleErrorSpy.called);
      assert(consoleErrorSpy.calledWithMatch(/Unhandled rejection/));
      
      exitStub.restore();
    });
  });
});
