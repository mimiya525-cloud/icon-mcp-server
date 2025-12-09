#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const path = require('path');
const { getElementPlusIcons, getAntDesignIcons } = require('./services/icons');

const app = express();
const PORT = process.env.PORT || 3000;

// 添加CORS支持
app.use(cors());

// 添加健康检查端点
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 根据名称模糊查询图标信息
app.get('/api/icons/search', async (req, res) => {
  try {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({ error: 'Name parameter is required' });
    }

    // 从两个源获取图标
    const elementPlusIcons = await getElementPlusIcons(name);
    const antDesignIcons = await getAntDesignIcons(name);

    // 合并结果
    const icons = [...elementPlusIcons, ...antDesignIcons];

    res.json(icons);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 启动服务器
const server = app.listen(PORT, () => {
  console.log(`Icon MCP Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API endpoint: http://localhost:${PORT}/api/icons/search?name={keyword}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});