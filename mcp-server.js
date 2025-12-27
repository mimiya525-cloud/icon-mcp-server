#!/usr/bin/env node
// 先导入基础模块
const { getElementPlusIcons, getAntDesignIcons } = require('./services/icons');
const { generateIcon } = require('./services/iconGenerator');
const z = require('zod');

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

/** Create server instance */
const server = new McpServer({
  name: 'icon-mcp-server',
  version: '1.1.0',
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}


/**
 * 将图标数组转换为 markdown 表格格式
 * @param {Array} icons - 图标数组
 * @returns {string} markdown 表格字符串
 */
function iconsToMarkdownTable(icons) {
  if (!icons || icons.length === 0) {
    return '';
  }

  // 表格头部
  let markdown = '| 图标来源 | 图标名称 | 图标 SVG 代码 |\n';
  markdown += '|---------|---------|-------------|\n';

  // 表格内容
  icons.forEach(icon => {
    const source = icon.source || '-';
    const name = icon.name || '-';
    // 使用 rawSvg（清理后的 SVG），直接输出原始 HTML，不做转义
    // 只处理换行符，将其替换为空格，以保持表格格式
    const svgCode = (icon.rawSvg || icon.svg || '-')
      .replace(/\n/g, '')     // 将换行符替换为空格
      .replace(/\r/g, '')      // 移除回车符
      .trim();

    // 直接输出 SVG 代码，不转义，以便在 markdown 中直接预览
    markdown += `| ${source} | ${name} | ${svgCode} |\n`;
  });

  return markdown;
}


// 5. 注册search_icons工具
server.tool(
  'search_icons',
  '根据名称搜索图标，支持多个名称（逗号分隔）。支持搜索 Element Plus 和 Ant Design 图标库。',
  {
    names: z.string().describe('图标名称，支持多个名称用逗号分隔，例如: "add,delete,edit"'),
    prefix: z.string().optional().describe('图标库前缀，可选值: "ant-design", "element-plus"。如果不指定，将同时查询两个图标库'),
    format: z.string().optional().describe('Ant Design图标格式，可选值: "outlined", "filled"。如果不指定，将返回两种格式的图标'),
    useLocal: z.boolean().optional().default(false).describe('是否使用本地资源'),
  },
  async ({ names, prefix, format, useLocal }) => {
    if (!names) {
      return {
        content: [{ type: "text", text: 'Names parameter is required' }],
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
        let iconsFound = [];

        // 检查名称是否包含空格
        if (name.includes(' ')) {
          // 先将空格替换为短横线进行查询
          const hyphenatedName = name.replace(/\s+/g, '-');

          if (prefix === 'element-plus') {
            iconsFound = await getElementPlusIcons(hyphenatedName, useLocal);
          } else if (prefix === 'ant-design') {
            iconsFound = await getAntDesignIcons(hyphenatedName, format, useLocal);
          } else {
            const elementPlusIcons = await getElementPlusIcons(hyphenatedName, useLocal);
            const antDesignIcons = await getAntDesignIcons(hyphenatedName, format, useLocal);
            iconsFound = [...elementPlusIcons, ...antDesignIcons];
          }

          // 如果没有找到结果，则分别查询每个单词
          if (iconsFound.length === 0) {
            const words = name.split(/\s+/).filter(word => word.length > 0);
            for (const word of words) {
              if (prefix === 'element-plus') {
                iconsFound.push(...(await getElementPlusIcons(word, useLocal)));
              } else if (prefix === 'ant-design') {
                iconsFound.push(...(await getAntDesignIcons(word, format, useLocal)));
              } else {
                const elementPlusIcons = await getElementPlusIcons(word, useLocal);
                const antDesignIcons = await getAntDesignIcons(word, format, useLocal);
                iconsFound.push(...elementPlusIcons, ...antDesignIcons);
              }
            }
          }
        } else {
          // 普通名称查询
          if (prefix === 'element-plus') {
            iconsFound = await getElementPlusIcons(name, useLocal);
          } else if (prefix === 'ant-design') {
            iconsFound = await getAntDesignIcons(name, format, useLocal);
          } else {
            const elementPlusIcons = await getElementPlusIcons(name, useLocal);
            const antDesignIcons = await getAntDesignIcons(name, format, useLocal);
            iconsFound = [...elementPlusIcons, ...antDesignIcons];
          }
        }

        allIcons.push(...iconsFound);
      } catch (error) { }
    }

    // 去重（基于 source 和 name）
    const uniqueIcons = Array.from(new Map(allIcons.map((icon) => [`${icon.source}-${icon.name}`, icon])).values());
    // 生成 markdown 表格
    const markdownTable = iconsToMarkdownTable(uniqueIcons);
    // 仅返回 markdown 表格，确保返回格式符合MCP协议要求
    return {
      content: [
        {
          type: "text",
          text: markdownTable
        }
      ],
      data: uniqueIcons,
      isError: false,
    };
  }
);

// 6. 注册generate_icon工具
server.tool(
  'generate_icon',
  '通过大模型生成图标，支持多种国产AI模型（通义千问、豆包等）',
  {
    description: z.string().describe('图标的描述，例如: "一个删除按钮图标"'),
    style: z.string().optional().default('default').describe('图标风格，可选值: "element-plus", "ant-design", "default"'),
    model: z.string().optional().describe('指定使用的AI模型，可选值: "tongyi", "doubao"。如果不指定，将自动选择可用的模型'),
  },
  async ({ description, style = 'default', model = null }) => {
    if (!description) {
      return {
        content: [{ type: "text", text: 'Description parameter is required' }],
        isError: true,
      };
    }

    try {
      const generatedIcons = await generateIcon(description, style, model);

      // 生成 markdown 表格
      let markdown = '| 图标来源 | 图标svg代码 |\n';
      markdown += '|---------|-------------|\n';

      // 添加表格内容
      generatedIcons.forEach(icon => {
        const source = icon.source || '-';
        const svgCode = (icon.rawSvg || icon.svg || '-')
          .replace(/\n/g, '')
          .replace(/\r/g, '')
          .trim();

        markdown += `| ${source} | ${svgCode} |\n`;
      });

      return {
        content: [
          {
            type: "text",
            text: markdown
          }
        ],
        data: generatedIcons,
        isError: false,
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `生成图标失败: ${error.message}` }],
        isError: true,
      };
    }
  }
);

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
