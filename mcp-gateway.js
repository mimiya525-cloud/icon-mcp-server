#!/usr/bin/env node

/**
 * MCP WebSocket Gateway
 * 为远程客户端提供通过WebSocket访问MCP服务器的能力
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');
// const logger = require('./services/logger');

// 创建Express应用和HTTP服务器
const app = express();
const server = http.createServer(app);

// 创建WebSocket服务器
const wss = new WebSocket.Server({ server });

// 获取端口，默认3001
const PORT = process.env.MCP_GATEWAY_PORT || 3001;

// 服务静态文件
app.use(express.static('public'));

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 主页
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>MCP WebSocket Gateway</title>
    </head>
    <body>
        <h1>MCP WebSocket Gateway</h1>
        <p>WebSocket endpoint: ws://localhost:${PORT}</p>
        <p>Connect to this endpoint to access the MCP server remotely.</p>
    </body>
    </html>
  `);
});

// 处理WebSocket连接
wss.on('connection', (ws, req) => {
  // logger.info('New WebSocket connection established');

  // 启动MCP服务器子进程
  const mcpServerPath = path.join(__dirname, 'mcp-server.js');
  const mcpProcess = spawn('node', [mcpServerPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // 将WebSocket消息转发到MCP进程的stdin
  ws.on('message', (message) => {
    try {
      mcpProcess.stdin.write(message + '\n');
    } catch (error) {
      // logger.error('Error writing to MCP process stdin:', error);
      ws.close();
    }
  });

  // 将MCP进程的stdout转发到WebSocket
  mcpProcess.stdout.on('data', (data) => {
    try {
      ws.send(data.toString());
    } catch (error) {
      // logger.error('Error sending data to WebSocket:', error);
    }
  });

  // 将MCP进程的stderr转发到WebSocket（如果有错误信息）
  mcpProcess.stderr.on('data', (data) => {
    // logger.error('MCP Process stderr:', { data: data.toString() });
  });

  // 处理MCP进程退出
  mcpProcess.on('close', (code) => {
    // logger.info(`MCP process exited with code ${code}`);
    ws.close();
  });

  // 处理WebSocket连接关闭
  ws.on('close', () => {
    // logger.info('WebSocket connection closed');
    mcpProcess.kill();
  });

  // 处理WebSocket错误
  ws.on('error', (error) => {
    // logger.error('WebSocket error:', error);
    mcpProcess.kill();
  });
});

// 启动服务器
server.listen(PORT, '0.0.0.0', () => {
  const ipAddress = Object.values(require('os').networkInterfaces())
    .flat()
    .find(iface => !iface.internal && iface.family === 'IPv4')?.address || 'localhost';

  // logger.info('MCP WebSocket Gateway is running', {
  //   port: PORT,
  //   host: '0.0.0.0',
  //   ipAddress: `ws://${ipAddress}:${PORT}`,
  //   httpEndpoint: `http://${ipAddress}:${PORT}`
  // });
});

// 优雅关闭
process.on('SIGTERM', () => {
  // logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  // logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});