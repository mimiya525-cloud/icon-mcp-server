/**
 * 简单的日志追踪服务
 * For MCP server, logs are sent through the MCP protocol to avoid interfering with JSON-RPC communication
 */

// Global reference to the MCP server instance for sending notifications
let mcpServer = null;

// Set the MCP server instance for logging
function setMcpServer(server) {
  mcpServer = server;
}

class Logger {
  constructor() {
    this.isEnabled = process.env.LOGGING_ENABLED !== 'false';
  }

  /**
   * Send log message through MCP protocol if available, otherwise fallback to console
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {object} data - Additional data
   */
  sendLog(level, message, data = {}) {
    if (!this.isEnabled) return;
    
    const timestamp = new Date().toISOString();
    const logEntry = {
      level,
      timestamp,
      message,
      ...data
    };

    // If we have an MCP server instance, send log through the MCP protocol
    if (mcpServer && mcpServer.sendNotification) {
      try {
        // Send as a notification through MCP protocol
        mcpServer.sendNotification('log/message', logEntry);
        return;
      } catch (error) {
        // Fallback to console if MCP sending fails
        // This is safe because this is only used during initialization or error states
      }
    }
    
    // Fallback to console logging (safe for non-MCP contexts)
    console.log(JSON.stringify(logEntry));
  }

  /**
   * 记录info级别的日志
   * @param {string} message - 日志消息
   * @param {object} metadata - 元数据
   */
  info(message, metadata = {}) {
    this.sendLog('INFO', message, metadata);
  }

  /**
   * 记录error级别的日志
   * @param {string} message - 错误消息
   * @param {object} error - 错误对象
   */
  error(message, error = {}) {
    const errorData = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    };
    this.sendLog('ERROR', message, errorData);
  }

  /**
   * 记录debug级别的日志
   * @param {string} message - 调试消息
   * @param {object} metadata - 元数据
   */
  debug(message, metadata = {}) {
    if (!this.isEnabled || process.env.DEBUG !== 'true') return;
    this.sendLog('DEBUG', message, metadata);
  }

  /**
   * 记录warning级别的日志
   * @param {string} message - 警告消息
   * @param {object} metadata - 元数据
   */
  warn(message, metadata = {}) {
    this.sendLog('WARN', message, metadata);
  }
}

// Create singleton instance
const loggerInstance = new Logger();

// Export both the logger instance and the function to set the MCP server
module.exports = loggerInstance;
module.exports.setMcpServer = setMcpServer;