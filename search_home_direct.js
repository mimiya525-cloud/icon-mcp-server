#!/usr/bin/env node

/**
 * 直接调用 search_icons 功能搜索图标 "home"
 * 不依赖 HTTP 服务器，直接使用底层函数
 */

const path = require('path');
const servicesPath = path.join(__dirname, 'services');
const { getElementPlusIcons, getAntDesignIcons } = require(path.join(servicesPath, 'icons'));

async function searchIcons(name) {
  console.log(`\n🔍 正在搜索图标: "${name}"...\n`);
  
  try {
    // 调用底层搜索函数
    const elementPlusIcons = await getElementPlusIcons(name);
    const antDesignIcons = await getAntDesignIcons(name);
    
    const allIcons = [...elementPlusIcons, ...antDesignIcons];
    
    // 去重（基于 source 和 name）
    const uniqueIcons = Array.from(
      new Map(allIcons.map((icon) => [`${icon.source}-${icon.name}`, icon])).values()
    );
    
    if (uniqueIcons.length === 0) {
      console.log('❌ 未找到匹配的图标\n');
      return [];
    }
    
    console.log(`✅ 找到 ${uniqueIcons.length} 个匹配的图标:\n`);
    console.log('='.repeat(80));
    
    uniqueIcons.forEach((icon, index) => {
      console.log(`\n${index + 1}. ${icon.name}`);
      console.log(`   来源: ${icon.source}`);
      console.log(`   名称: ${icon.name}`);
      
      // 显示 SVG 预览（前200个字符）
      if (icon.rawSvg) {
        const svgPreview = icon.rawSvg.length > 200 
          ? icon.rawSvg.substring(0, 200) + '...' 
          : icon.rawSvg;
        console.log(`   SVG 预览: ${svgPreview}`);
      }
      
      // 显示完整 SVG（仅第一个）
      if (index === 0 && icon.rawSvg) {
        console.log(`\n   完整 SVG:`);
        console.log(`   ${icon.rawSvg.split('\n').join('\n   ')}`);
      }
    });
    
    console.log('\n' + '='.repeat(80));
    console.log(`\n📊 统计:`);
    console.log(`   - Element Plus: ${elementPlusIcons.length} 个`);
    console.log(`   - Ant Design: ${antDesignIcons.length} 个`);
    console.log(`   - 总计（去重后）: ${uniqueIcons.length} 个\n`);
    
    return uniqueIcons;
  } catch (error) {
    console.error(`❌ 搜索失败: ${error.message}`);
    console.error(error.stack);
    return [];
  }
}

// 主函数
async function main() {
  console.log('='.repeat(80));
  console.log('Icon MCP Server - 直接搜索图标 "home"');
  console.log('='.repeat(80));
  
  const icons = await searchIcons('home');
  
  if (icons.length > 0) {
    console.log('\n✨ 搜索完成！');
    console.log('\n提示: 你可以使用这些图标的 rawSvg 字段直接在你的项目中使用。\n');
  }
}

// 运行
if (require.main === module) {
  main().catch(error => {
    console.error('致命错误:', error);
    process.exit(1);
  });
}

module.exports = { searchIcons };

