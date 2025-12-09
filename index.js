const express = require('express');
const cors = require('cors');
const { getElementPlusIcons, getAntDesignIcons } = require('./services/icons');
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 路由
app.get('/', (req, res) => {
  res.json({ message: 'Icon MCP Server is running!' });
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
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});