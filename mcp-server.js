#!/usr/bin/env node
// 先导入基础模块
const { getElementPlusIcons, getAntDesignIcons } = require('./services/icons');
const { generateIcon } = require('./services/iconGenerator');
const { z } = require('zod');
let McpServer, StdioServerTransport;

// 声明全局变量
let server;

/**
 * 将图标数组转换为 markdown 表格格式
 * @param {Array} icons - 图标数组
 * @returns {string} markdown 表格字符串
 */
function iconsToMarkdownTable(icons) {
  if (!icons || icons.length === 0) {
    return '| 图标来源 | 图标名称 | 图标 SVG 代码 |\n|---------|---------|-------------|\n| - | - | - |';
  }

  // 表格头部
  let markdown = '| 图标来源 | 图标名称 | 图标 SVG 代码 |\n';
  markdown += '|---------|---------|-------------|\n';

  // 表格内容
  icons.forEach((icon) => {
    const source = icon.source || '-';
    const name = icon.name || '-';
    // 使用 rawSvg（清理后的 SVG），直接输出原始 HTML，不做转义
    // 只处理换行符，将其替换为空格，以保持表格格式
    const svgCode = (icon.rawSvg || icon.svg || '-')
      .replace(/\n/g, '') // 将换行符替换为空格
      .replace(/\r/g, '') // 移除回车符
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      // 移除多余转义符，并替换为空格
      .trim();

    // 直接输出 SVG 代码，不转义，以便在 markdown 中直接预览
    markdown += `| ${source} | ${name} | ${svgCode} |\n`;
  });

  return markdown;
}

/** Register tool for searching icons by name */

/** Main function to start the server */
async function main() {
  try {
    // 1. 使用动态import加载MCP SDK模块
    // 这种方式更可靠，并且能更好地处理ES模块和CommonJS的兼容性
    // 直接使用包名导入，确保在npx环境中也能正确解析
    try {
      // 直接使用包名导入，这是最可靠的方式
      const mcpModule = await import('@modelcontextprotocol/sdk/server/index.js');
      const stdioModule = await import('@modelcontextprotocol/sdk/server/stdio.js');

      // 解构所需的类
      McpServer = mcpModule.Server;
      StdioServerTransport = stdioModule.StdioServerTransport;
    } catch (error) {
      // 如果直接包名导入失败，尝试使用相对路径
      const path = require('path');
      const mcpModule = await import(path.resolve(__dirname, 'node_modules/@modelcontextprotocol/sdk/server/index.js'));
      const stdioModule = await import(
        path.resolve(__dirname, 'node_modules/@modelcontextprotocol/sdk/server/stdio.js')
      );

      // 解构所需的类
      McpServer = mcpModule.Server;
      StdioServerTransport = stdioModule.StdioServerTransport;
    }

    if (!McpServer || !StdioServerTransport) {
      throw new Error('McpServer or StdioServerTransport not found in SDK');
    }

    // 3. 创建MCP服务器实例
    server = new McpServer(
      // Server info
      {
        name: 'icon-mcp-server',
        version: '1.0.1',
      },
      // Options
      {
        capabilities: {
          protocolVersion: '1.0.0',
          tools: {
            listChanged: true,
          },
        },
      }
    );

    // 5. 注册search_icons工具
    server.registerTool(
      'search_icons',
      '根据名称搜索图标，支持多个名称（逗号分隔）。支持搜索 Element Plus 和 Ant Design 图标库。',
      {
        names: z.string().describe('图标名称，支持多个名称用逗号分隔，例如: "add,delete,edit"'),
      },
      async ({ names }) => {
        if (!names) {
          return {
            content: 'Names parameter is required',
            isError: true,
          };
        }

        // 支持多个名称，用逗号分隔
        const nameArray = names
          .split(',')
          .map((name) => name.trim())
          .filter((name) => name.length > 0);

        const allIcons = [];

        // 对每个名称进行搜索
        for (const name of nameArray) {
          try {
            const elementPlusIcons = await getElementPlusIcons(name);
            const antDesignIcons = await getAntDesignIcons(name);

            allIcons.push(...elementPlusIcons, ...antDesignIcons);
          } catch (error) { }
        }

        // 去重（基于 source 和 name）
        const uniqueIcons = Array.from(new Map(allIcons.map((icon) => [`${icon.source}-${icon.name}`, icon])).values());

        // 生成 markdown 表格
        const markdownTable = iconsToMarkdownTable(uniqueIcons);

        // 仅返回 markdown 表格
        return {
          content: markdownTable,
          isError: false,
        };
      }
    );

    // 6. 注册generate_icon工具
    server.registerTool(
      'generate_icon',
      '通过大模型生成图标，支持多种国产AI模型（通义千问、文心一言、智谱AI、Kimi、豆包等）',
      {
        description: z.string().describe('图标的描述，例如: "一个红色的删除按钮图标"'),
        style: z
          .enum(['element-plus', 'ant-design', 'default'])
          .optional()
          .default('default')
          .describe('图标风格，可选值: "element-plus", "ant-design", "default"'),
        model: z
          .enum(['openai', 'tongyi', 'wenxin', 'zhipu', 'kimi', 'doubao'])
          .optional()
          .describe(
            '指定使用的AI模型，可选值: "openai", "tongyi", "wenxin", "zhipu", "kimi", "doubao"。如果不指定，将自动选择可用的模型'
          ),
      },
      async ({ description, style = 'default', model = null }) => {
        if (!description) {
          return {
            content: '',
            isError: true,
          };
        }

        try {
          const generatedIcon = await generateIcon(description, style, model);

          return {
            content: JSON.stringify(generatedIcon),
          };
        } catch (error) {
          return {
            content: JSON.stringify({ error: error.message }),
            isError: true,
          };
        }
      }
    );

    // 9. 创建传输层并启动服务器
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // logger.info('Icon MCP Server started');
  } catch (error) {
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
    // 静默处理错误，仅通过退出码表示失败
    process.exit(1);
  });
}

// 导出server对象（在main函数中初始化）
module.exports = { server };
