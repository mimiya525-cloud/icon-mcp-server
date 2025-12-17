const express = require('express');
const cors = require('cors');
const { getElementPlusIcons, getAntDesignIcons } = require('./services/icons');
// const logger = require('./services/logger');
const app = express();
const PORT = process.env.PORT || 3000;

/**
 * 自定义 JSON 响应，确保 svg 和 rawSvg 字段不被转义
 */
function sendJsonResponse(res, data) {
  // 使用自定义的序列化方法
  const jsonString = JSON.stringify(data, null, 2);

  // 替换 svg 和 rawSvg 字段中的 Unicode 转义字符
  const unescapedJson = jsonString.replace(
    /"svg":\s*"((?:[^"\\]|\\.|\\u[0-9a-fA-F]{4})*)"/g,
    (match, escapedContent) => {
      if (!escapedContent.includes('\\u003C') && !escapedContent.includes('\\u003E')) {
        return match;
      }
      const unescaped = escapedContent
        .replace(/\\u003C/g, '<')
        .replace(/\\u003E/g, '>');
      return `"svg": "${unescaped}"`;
    }
  ).replace(
    /"rawSvg":\s*"((?:[^"\\]|\\.|\\u[0-9a-fA-F]{4})*)"/g,
    (match, escapedContent) => {
      if (!escapedContent.includes('\\u003C') && !escapedContent.includes('\\u003E')) {
        return match;
      }
      const unescaped = escapedContent
        .replace(/\\u003C/g, '<')
        .replace(/\\u003E/g, '>');
      return `"rawSvg": "${unescaped}"`;
    }
  );

  res.setHeader('Content-Type', 'application/json');
  res.send(unescapedJson);
}

// 中间件
app.use(cors());
app.use(express.json());

// 路由
app.get('/', (req, res) => {
  res.json({ message: 'Icon MCP Server is running!' });
});

// 根据名称模糊查询图标信息（支持多个名称，逗号分隔）
app.get('/api/icons/search', async (req, res) => {
  try {
    const { name, names, style } = req.query;

    // 支持 name 和 names 参数，names 优先级更高
    const searchTerms = names || name;

    // 记录请求开始
    // logger.info('Icon search request received', {
    //   searchTerms,
    //   style,
    //   timestamp: new Date().toISOString()
    // });

    if (!searchTerms) {
      // logger.error('Missing name/names parameter in search request');
      return res.status(400).json({ error: 'Name or names parameter is required' });
    }

    // 支持多个名称，用逗号分隔
    const nameArray = searchTerms
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (nameArray.length === 0) {
      return res.status(400).json({ error: 'At least one valid name is required' });
    }

    const allIcons = [];

    // 对每个名称进行搜索
    for (const searchName of nameArray) {
      try {
        // logger.debug('Fetching icons for name', { searchTerm: searchName, style });

        // 根据 style 参数决定搜索哪些图标库
        // style: 'element-plus' 只搜索 Element Plus
        // style: 'ant-design' 只搜索 Ant Design
        // 未指定或 'default' 则两者都搜索
        if (!style || style === 'default') {
          // 两者都搜索
          const elementPlusIcons = await getElementPlusIcons(searchName);
          const antDesignIcons = await getAntDesignIcons(searchName);
          allIcons.push(...elementPlusIcons, ...antDesignIcons);
        } else if (style === 'element-plus') {
          // 只搜索 Element Plus
          const elementPlusIcons = await getElementPlusIcons(searchName);
          allIcons.push(...elementPlusIcons);
        } else if (style === 'ant-design') {
          // 只搜索 Ant Design
          const antDesignIcons = await getAntDesignIcons(searchName);
          allIcons.push(...antDesignIcons);
        } else {
          // 无效的 style 参数，两者都搜索
          const elementPlusIcons = await getElementPlusIcons(searchName);
          const antDesignIcons = await getAntDesignIcons(searchName);
          allIcons.push(...elementPlusIcons, ...antDesignIcons);
        }

        // logger.debug('Icons fetched for name', {
        //   searchTerm: searchName,
        //   style,
        //   resultCount: allIcons.length
        // });
      } catch (error) {
        // logger.error(`Failed to fetch icons for ${searchName}`, {
        //   error: error.message
        // });
      }
    }

    // 去重（基于 source 和 name）
    const uniqueIcons = Array.from(
      new Map(allIcons.map((icon) => [`${icon.source}-${icon.name}`, icon])).values()
    );

    // 记录请求完成
    // logger.info('Icon search completed', {
    //   searchTerms: nameArray,
    //   style,
    //   totalResults: uniqueIcons.length,
    // });

    res.json(uniqueIcons);
  } catch (error) {
    // logger.error('Search error occurred', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * 处理图标生成的通用函数
 * @param {Object} params - 包含 description, style, model 的参数对象
 * @param {Object} res - Express 响应对象
 */
async function handleIconGeneration(params, res) {
  try {
    const { description, style = 'default', model = null } = params;

    // logger.info('Icon generation request received', {
    //   description,
    //   style,
    //   model,
    //   timestamp: new Date().toISOString(),
    // });

    if (!description) {
      // logger.error('Missing description parameter in generation request');
      return res.status(400).json({ error: 'Description parameter is required' });
    }

    const { generateIcon } = require('./services/iconGenerator');
    const generatedIcon = await generateIcon(description, style, model);

    // logger.info('Icon generation completed', {
    //   description,
    //   iconName: generatedIcon.name,
    //   model: generatedIcon.model,
    // });

    sendJsonResponse(res, generatedIcon);
  } catch (error) {
    // logger.error('Icon generation error occurred', {
    //   error: error.message,
    //   stack: error.stack,
    // });
    res.status(500).json({
      error: 'Failed to generate icon',
      message: error.message,
    });
  }
}

// 图标生成接口 - GET 方法支持
app.get('/api/icons/generate', async (req, res) => {
  const { description, style, model } = req.query;
  await handleIconGeneration({ description, style, model }, res);
});

// 图标生成接口 - POST 方法支持（保持向后兼容）
app.post('/api/icons/generate', async (req, res) => {
  await handleIconGeneration(req.body, res);
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  const ipAddress = Object.values(require('os').networkInterfaces())
    .flat()
    .find(iface => !iface.internal && iface.family === 'IPv4')?.address || 'localhost';

  // logger.info('Icon MCP Server started', { 
  //   port: PORT, 
  //   host: '0.0.0.0',
  //   ipAddress: `http://${ipAddress}:${PORT}`,
  //   localAccess: `http://localhost:${PORT}`
  // });
});