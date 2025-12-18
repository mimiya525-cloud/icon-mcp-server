const axios = require('axios');

// Element Plus 图标仓库信息
const ELEMENT_PLUS_REPO_URL = 'https://api.github.com/repos/element-plus/element-plus-icons/contents/packages/svg';
// Ant Design 图标仓库信息
const ANT_DESIGN_REPO_URL = 'https://api.github.com/repos/ant-design/ant-design-icons/contents/packages/icons-svg/svg/outlined';
// Ant Design 图标仓库信息 FIlled
const ANT_DESIGN_REPO_URL2 = 'https://api.github.com/repos/ant-design/ant-design-icons/contents/packages/icons-svg/svg/filled';
/**
 * 将短横线命名转换为驼峰命名
 * @param {string} str - 短横线分隔的字符串
 * @returns {string} 驼峰命名的字符串
 */
function toCamelCase(str) {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase()).replace(/^./, (match) => match.toUpperCase());
}

/**
 * 移除SVG中的XML声明和其他可能干扰显示的内容，并设置默认宽高和样式
 * @param {string} svgContent - 原始SVG内容
 * @returns {string} 清理后的SVG内容
 */
function cleanSvgContent(svgContent) {
  // 移除转义符
  let cleanedSvg = svgContent.replace(/\\"/g, '"').replace(/\\'/g, "'");

  // 移除XML声明（如果存在）
  cleanedSvg = cleanedSvg.replace(/<\?xml[^>]*\?>/g, '').trim();

  // 检查是否已有width和height属性
  if (!cleanedSvg.includes('width=') && !cleanedSvg.includes('height=')) {
    // 在svg标签中添加默认的width和height属性
    cleanedSvg = cleanedSvg.replace(/<svg([^>]*)>/, `<svg$1 width="30px" height="30px">`);
  }

  // 确保SVG可以在Markdown中正确预览
  // 添加style属性确保图标居中显示
  if (!cleanedSvg.includes('style=')) {
    cleanedSvg = cleanedSvg.replace(/<svg([^>]*)>/, `<svg$1 style="display: inline-block; vertical-align: middle;">`);
  }

  // 移除可能存在的DOCTYPE声明
  cleanedSvg = cleanedSvg.replace(/<!DOCTYPE[^>]*>/g, '').trim();

  return cleanedSvg;
}

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
  icons.forEach(icon => {
    const source = icon.source || '-';
    const name = icon.name || '-';
    // 使用 rawSvg（清理后的 SVG），直接输出原始 HTML，不做转义
    // 只处理换行符，将其替换为空格，以保持表格格式
    const svgCode = (icon.rawSvg || icon.svg || '-')
      .replace(/\n/g, '')     // 将换行符替换为空格
      .replace(/\r/g, '')      // 移除回车符
      .replace(/\\"/g, '"').replace(/\\'/g, "'")    // 移除多余转义符，并替换为空格
      .trim();

    // 直接输出 SVG 代码，不转义，以便在 markdown 中直接预览
    markdown += `| ${source} | ${name} | ${svgCode} |\n`;
  });

  return markdown;
}

/**
 * 从Element Plus获取图标信息
 * @param {string} name - 图标名称（模糊匹配）
 * @returns {Promise<Array>} 匹配的图标数组
 */
async function getElementPlusIcons(name) {
  try {
    const response = await axios.get(ELEMENT_PLUS_REPO_URL);
    const files = response.data;

    // 过滤出SVG文件并进行模糊匹配
    const matchedIcons = files
      .filter(file => file.name.endsWith('.svg') && file.name.toLowerCase().includes(name.toLowerCase()))
      .map(file => ({
        source: 'Element Plus',
        name: toCamelCase(file.name.replace('.svg', '')),
        svgUrl: file.download_url
      }));



    // 获取SVG内容
    const icons = [];
    for (const icon of matchedIcons) {
      try {
        const svgResponse = await axios.get(icon.svgUrl);
        const cleanedSvg = cleanSvgContent(svgResponse.data);
        icons.push({
          source: icon.source,
          name: icon.name,
          svg: svgResponse.data,
          rawSvg: cleanedSvg
        });
      } catch (error) {
      }
    }



    // 直接返回图标数组，不添加冗余的content字段
    return icons;
  } catch (error) {
    return [];
  }
}

/**
 * 从Ant Design特定格式获取图标信息
 * @param {string} name - 图标名称（模糊匹配）
 * @param {string} url - 图标库URL
 * @param {string} format - 图标格式（Outlined/Filled）
 * @returns {Promise<Array>} 匹配的图标数组
 */
async function getAntDesignIconsByFormat(name, url, format) {
  try {
    const response = await axios.get(url);
    const files = response.data;

    // 过滤出SVG文件并进行模糊匹配
    const matchedIcons = files
      .filter(file => file.name.endsWith('.svg') && file.name.toLowerCase().includes(name.toLowerCase()))
      .map(file => ({
        source: 'Ant Design',
        name: toCamelCase(file.name.replace('.svg', '')),
        svgUrl: file.download_url
      }));

    // 获取SVG内容
    const icons = [];
    for (const icon of matchedIcons) {
      try {
        const svgResponse = await axios.get(icon.svgUrl);
        const cleanedSvg = cleanSvgContent(svgResponse.data);
        icons.push({
          source: icon.source,
          name: icon.name + format,
          svg: svgResponse.data,
          rawSvg: cleanedSvg
        });
      } catch (error) {
      }
    }

    return icons;
  } catch (error) {
    return [];
  }
}

/**
 * 从Ant Design获取图标信息
 * @param {string} name - 图标名称（模糊匹配）
 * @param {string} format - 图标格式，可选值: "outlined", "filled"。如果不指定，将返回两种格式的图标
 * @returns {Promise<Array>} 匹配的图标数组
 */
async function getAntDesignIcons(name, format) {
  try {
    // 根据format参数决定获取哪些格式的图标
    if (format === 'outlined') {
      // 只获取outlined格式的图标
      const outlinedIcons = await getAntDesignIconsByFormat(name, ANT_DESIGN_REPO_URL, 'Outlined');
      return outlinedIcons;
    } else if (format === 'filled') {
      // 只获取filled格式的图标
      const filledIcons = await getAntDesignIconsByFormat(name, ANT_DESIGN_REPO_URL2, 'Filled');
      return filledIcons;
    } else {
      // 同时获取outlined和filled格式的图标
      const [outlinedIcons, filledIcons] = await Promise.all([
        getAntDesignIconsByFormat(name, ANT_DESIGN_REPO_URL, 'Outlined'),
        getAntDesignIconsByFormat(name, ANT_DESIGN_REPO_URL2, 'Filled')
      ]);

      // 合并两种格式的图标
      return [...outlinedIcons, ...filledIcons];
    }
  } catch (error) {
    return [];
  }
}

module.exports = {
  getElementPlusIcons,
  getAntDesignIcons,
  iconsToMarkdownTable
};