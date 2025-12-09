const axios = require('axios');

// Element Plus 图标仓库信息
const ELEMENT_PLUS_REPO_URL = 'https://api.github.com/repos/element-plus/element-plus-icons/contents/packages/svg';
// Ant Design 图标仓库信息
const ANT_DESIGN_REPO_URL = 'https://api.github.com/repos/ant-design/ant-design-icons/contents/packages/icons-svg/svg/filled';

/**
 * 将短横线命名转换为驼峰命名
 * @param {string} str - 短横线分隔的字符串
 * @returns {string} 驼峰命名的字符串
 */
function toCamelCase(str) {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase()).replace(/^./, (match) => match.toUpperCase());
}

/**
 * 移除SVG中的XML声明和其他可能干扰显示的内容，并设置默认宽高
 * @param {string} svgContent - 原始SVG内容
 * @returns {string} 清理后的SVG内容
 */
function cleanSvgContent(svgContent) {
  // 移除XML声明（如果存在）
  let cleanedSvg = svgContent.replace(/<\?xml[^>]*\?>/g, '').trim();

  // 检查是否已有width和height属性
  if (!cleanedSvg.includes('width=') && !cleanedSvg.includes('height=')) {
    // 在svg标签中添加默认的width和height属性
    cleanedSvg = cleanedSvg.replace(/<svg([^>]*)>/, `<svg$1 width="30px" height="30px">`);
  }

  return cleanedSvg;
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
        console.error(`Failed to fetch SVG for ${icon.name}:`, error.message);
      }
    }

    return icons;
  } catch (error) {
    console.error('Failed to fetch Element Plus icons:', error.message);
    return [];
  }
}

/**
 * 从Ant Design获取图标信息
 * @param {string} name - 图标名称（模糊匹配）
 * @returns {Promise<Array>} 匹配的图标数组
 */
async function getAntDesignIcons(name) {
  try {
    const response = await axios.get(ANT_DESIGN_REPO_URL);
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
          name: icon.name,
          svg: svgResponse.data,
          rawSvg: cleanedSvg
        });
      } catch (error) {
        console.error(`Failed to fetch SVG for ${icon.name}:`, error.message);
      }
    }

    return icons;
  } catch (error) {
    console.error('Failed to fetch Ant Design icons:', error.message);
    return [];
  }
}

module.exports = {
  getElementPlusIcons,
  getAntDesignIcons
};