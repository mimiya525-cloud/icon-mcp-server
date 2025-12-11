#!/usr/bin/env node

/**
 * 测试脚本：查询图标 "home"
 * 演示如何使用 icon-mcp-server 搜索图标
 */

const axios = require('axios');

const API_URL = 'http://localhost:3000/api/icons/search';

async function searchIcon(name) {
  try {
    console.log(`\n正在搜索图标: "${name}"...\n`);
    
    const response = await axios.get(API_URL, {
      params: { name: name },
      timeout: 10000
    });
    
    const icons = response.data;
    
    if (icons && icons.length > 0) {
      console.log(`✅ 找到 ${icons.length} 个匹配的图标:\n`);
      
      icons.forEach((icon, index) => {
        console.log(`${index + 1}. ${icon.name} (${icon.source})`);
        console.log(`   名称: ${icon.name}`);
        console.log(`   来源: ${icon.source}`);
        console.log(`   SVG 预览: ${icon.rawSvg ? icon.rawSvg.substring(0, 100) + '...' : 'N/A'}`);
        console.log('');
      });
      
      // 显示第一个图标的完整 SVG
      if (icons[0].rawSvg) {
        console.log('第一个图标的完整 SVG:');
        console.log(icons[0].rawSvg);
        console.log('');
      }
    } else {
      console.log('❌ 未找到匹配的图标');
    }
    
    return icons;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ 错误: 无法连接到服务器');
      console.error('   请先启动服务器: npm start');
      console.error('   或运行: node index.js');
    } else {
      console.error('❌ 错误:', error.message);
      if (error.response) {
        console.error('   状态码:', error.response.status);
        console.error('   响应:', error.response.data);
      }
    }
    return null;
  }
}

// 主函数
async function main() {
  console.log('='.repeat(60));
  console.log('Icon MCP Server - 图标搜索测试');
  console.log('='.repeat(60));
  
  // 检查服务器是否运行
  try {
    await axios.get('http://localhost:3000/health', { timeout: 2000 });
    console.log('✅ 服务器正在运行\n');
  } catch (error) {
    console.error('❌ 服务器未运行！');
    console.error('\n请先启动服务器:');
    console.error('  1. cd icon-mcp-server-main');
    console.error('  2. npm start');
    console.error('  或运行: node index.js\n');
    process.exit(1);
  }
  
  // 搜索单个图标
  await searchIcon('home');
  
  // 搜索多个图标
  console.log('\n' + '='.repeat(60));
  console.log('搜索多个图标: home, user, settings');
  console.log('='.repeat(60));
  
  try {
    const response = await axios.get(API_URL, {
      params: { names: 'home,user,settings' },
      timeout: 10000
    });
    
    const icons = response.data;
    console.log(`\n✅ 找到 ${icons.length} 个图标\n`);
    
    // 按来源分组显示
    const bySource = {};
    icons.forEach(icon => {
      if (!bySource[icon.source]) {
        bySource[icon.source] = [];
      }
      bySource[icon.source].push(icon.name);
    });
    
    Object.keys(bySource).forEach(source => {
      console.log(`${source}: ${bySource[source].join(', ')}`);
    });
  } catch (error) {
    console.error('搜索失败:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('测试完成');
  console.log('='.repeat(60));
}

// 运行
if (require.main === module) {
  main().catch(error => {
    console.error('致命错误:', error);
    process.exit(1);
  });
}

module.exports = { searchIcon };

