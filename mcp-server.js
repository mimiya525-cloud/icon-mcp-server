#!/usr/bin/env node
// 先导入基础模块
const { getElementPlusIcons, getAntDesignIcons } = require('./services/icons');
const { generateIcon } = require('./services/iconGenerator');

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

/** Create server instance */
const server = new McpServer({
  name: 'pickapicon-mcp',
  version: '1.0.15',
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// 5. 注册search_icons工具
server.tool(
  'search_icons',
  '根据名称搜索图标，支持多个名称（逗号分隔）。支持搜索 Element Plus 和 Ant Design 图标库。',
  {
    names: { description: '图标名称，支持多个名称用逗号分隔，例如: "add,delete,edit"' },
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
      } catch (error) {}
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
server.tool(
  'generate_icon',
  '通过大模型生成图标，支持多种国产AI模型（通义千问、文心一言、智谱AI、Kimi、豆包等）',
  {
    description: { description: '图标的描述，例如: "一个红色的删除按钮图标"' },
    style: { description: '图标风格，可选值: "element-plus", "ant-design", "default"' },
    model: {
      description:
        '指定使用的AI模型，可选值: "openai", "tongyi", "wenxin", "zhipu", "kimi", "doubao"。如果不指定，将自动选择可用的模型',
    },
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

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
