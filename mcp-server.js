#!/usr/bin/env node

/**
 * MCP Server for Icon Search and Generation
 * 支持在 Cursor 中通过 mcp.json 配置使用
 */

const path = require('path');

// 确保模块路径解析正确（支持从不同目录运行）
// 使用 __dirname 获取当前文件所在目录
const servicesPath = path.join(__dirname, 'services');

// 先导入基础模块
const logger = require(path.join(servicesPath, 'logger'));
const { getElementPlusIcons, getAntDesignIcons } = require(path.join(servicesPath, 'icons'));
const { generateIcon } = require(path.join(servicesPath, 'iconGenerator'));
const { z } = require('zod');

let McpServer, StdioServerTransport, ListToolsRequestSchema, CallToolRequestSchema, ToolSchema;

try {
  // 从子模块导入（与新版本 SDK 一致）
  const mcpModule = require('@modelcontextprotocol/sdk/server/index.js');
  const stdioModule = require('@modelcontextprotocol/sdk/server/stdio.js');
  const typesModule = require('@modelcontextprotocol/sdk/types.js');

  McpServer = mcpModule.Server;
  StdioServerTransport = stdioModule.StdioServerTransport;
  ListToolsRequestSchema = typesModule.ListToolsRequestSchema;
  CallToolRequestSchema = typesModule.CallToolRequestSchema;
  ToolSchema = typesModule.ToolSchema;

  if (!McpServer || !StdioServerTransport) {
    throw new Error('Server or StdioServerTransport not found in SDK');
  }
} catch (error) {
  // 使用 console.error 因为 logger 可能还没完全初始化
  console.error('Failed to import MCP SDK:', error.message);
  console.error('Please ensure @modelcontextprotocol/sdk is installed: npm install @modelcontextprotocol/sdk');
  process.exit(1);
}

/** Create server instance */
const server = new McpServer(
  {
    name: 'icon-mcp-server',
    version: '1.0.4',
  },
  {
    capabilities: {
      tools: {},
      logging: {},
    }
  }
);

// 存储已注册的工具
const registeredTools = new Map();

/**
 * 序列化图标数据，svg 和 rawSvg 字段保持未转义的 SVG 内容
 * @param {Array|Object} data - 图标数组或单个图标对象
 * @returns {string} 序列化后的 JSON 字符串
 */
function serializeIcons(data) {
  // 统一转换为数组处理
  const icons = Array.isArray(data) ? data : [data];

  // 先正常序列化
  let jsonString = JSON.stringify(icons, null, 2);

  // 替换 svg 和 rawSvg 字段中的 Unicode 转义字符（如果存在），使其直接显示 SVG 标签
  // 处理 svg 字段
  jsonString = jsonString.replace(
    /"svg":\s*"((?:[^"\\]|\\.|\\u[0-9a-fA-F]{4})*)"/g,
    (match, escapedContent) => {
      // 检查是否包含 Unicode 转义的 < 或 >
      if (!escapedContent.includes('\\u003C') && !escapedContent.includes('\\u003E')) {
        return match;
      }

      // 直接替换 Unicode 转义字符为原始字符
      const unescaped = escapedContent
        .replace(/\\u003C/g, '<')      // 还原 <
        .replace(/\\u003E/g, '>');     // 还原 >

      return `"svg": "${unescaped}"`;
    }
  );

  // 处理 rawSvg 字段
  jsonString = jsonString.replace(
    /"rawSvg":\s*"((?:[^"\\]|\\.|\\u[0-9a-fA-F]{4})*)"/g,
    (match, escapedContent) => {
      // 检查是否包含 Unicode 转义的 < 或 >
      if (!escapedContent.includes('\\u003C') && !escapedContent.includes('\\u003E')) {
        return match;
      }

      // 直接替换 Unicode 转义字符为原始字符
      const unescaped = escapedContent
        .replace(/\\u003C/g, '<')      // 还原 <
        .replace(/\\u003E/g, '>');     // 还原 >

      return `"rawSvg": "${unescaped}"`;
    }
  );

  // 如果输入是单个对象，移除数组包装
  if (!Array.isArray(data)) {
    jsonString = jsonString.replace(/^\[\s*|\s*\]$/g, '').trim();
  }

  return jsonString;
}

// 注册搜索图标工具
const searchIconsTool = {
  name: 'search_icons',
  description: '根据名称搜索图标，支持多个名称（逗号分隔）。支持搜索 Element Plus 和 Ant Design 图标库。',
  inputSchema: {
    names: z.string().describe('图标名称，支持多个名称用逗号分隔，例如: "add,delete,edit"'),
  },
};

// 将工具添加到注册表中
registeredTools.set(searchIconsTool.name, searchIconsTool);

// 处理搜索图标工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'search_icons') {
    const { names } = args || {};

    if (!names) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: 'Names parameter is required' }),
          },
        ],
        isError: true,
      };
    }

    // 支持多个名称，用逗号分隔
    const nameArray = names
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    logger.info('Icon search request received', {
      names: nameArray,
      timestamp: new Date().toISOString(),
    });

    const allIcons = [];

    // 对每个名称进行搜索
    for (const name of nameArray) {
      try {
        logger.debug('Fetching icons for name', { name });
        const elementPlusIcons = await getElementPlusIcons(name);
        const antDesignIcons = await getAntDesignIcons(name);

        allIcons.push(...elementPlusIcons, ...antDesignIcons);
      } catch (error) {
        logger.error(`Failed to search icons for ${name}`, { error: error.message });
      }
    }

    // 去重（基于 source 和 name）
    const uniqueIcons = Array.from(
      new Map(
        allIcons.map((icon) => [`${icon.source}-${icon.name}`, icon])
      ).values()
    );

    logger.info('Icon search completed', {
      names: nameArray,
      totalResults: uniqueIcons.length,
      timestamp: new Date().toISOString(),
    });

    try {
      return {
        content: [
          {
            type: 'text',
            text: serializeIcons(uniqueIcons),
          },
        ],
      };
    } catch (error) {
      logger.error('Serialization failed', { error: error.message, stack: error.stack });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: 'Serialization failed' }),
          },
        ],
        isError: true,
      };
    }
  }

  // 如果不是这个工具，抛出错误
  throw new Error(`Unknown tool: ${name}`);
});

// 注册生成图标工具
const generateIconTool = {
  name: 'generate_icon',
  description: '根据描述生成图标，支持多种 AI 模型和图标风格。',
  inputSchema: {
    description: z.string().describe('图标的描述，例如: "一个红色的删除按钮图标"'),
    style: z.enum(['element-plus', 'ant-design', 'default']).optional().default('default').describe('图标风格，可选值: "element-plus", "ant-design", "default"'),
    model: z.enum(['openai', 'tongyi', 'wenxin', 'zhipu', 'kimi', 'doubao']).optional().describe('指定使用的AI模型，可选值: "openai", "tongyi", "wenxin", "zhipu", "kimi", "doubao"。如果不指定，将自动选择可用的模型'),
  },
};

// 将工具添加到注册表中
registeredTools.set(generateIconTool.name, generateIconTool);

// 处理生成图标工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'generate_icon') {
    const { description, style, model } = args || {};

    logger.info('Icon generation request received', {
      description,
      style,
      model,
      timestamp: new Date().toISOString(),
    });

    try {
      const generatedIcon = await generateIcon(description, style, model);

      logger.info('Icon generation completed', {
        description,
        iconName: generatedIcon.name,
        model: generatedIcon.model,
      });

      return {
        content: [
          {
            type: 'text',
            text: serializeIcons(generatedIcon),
          },
        ],
      };
    } catch (error) {
      logger.error('Icon generation failed', { error: error.message, stack: error.stack });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }),
          },
        ],
        isError: true,
      };
    }
  }

  // 如果不是这个工具，抛出错误
  throw new Error(`Unknown tool: ${name}`);
});

// 处理工具列表请求
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = Array.from(registeredTools.values()).map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));

  return { tools };
});

/** Main function to start the server */
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // 不输出任何内容到 stdout，因为 MCP 服务器必须只通过 JSON-RPC 通信
  } catch (error) {
    // 只在严重错误时使用 console.error
    console.error(JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Failed to start MCP server',
        data: { error: error.message }
      }
    }));
    process.exit(1);
  }
}

// 错误处理
process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.close();
  process.exit(0);
});

// 如果直接运行此文件，启动服务器
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error in main():', error);
    process.exit(1);
  });
}

module.exports = server;
