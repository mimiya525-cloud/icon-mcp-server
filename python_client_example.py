#!/usr/bin/env python3
"""
Python 客户端示例 - 调用 Icon MCP Server API

注意：无论 API 服务器是用什么语言写的（Node.js、Python、Go 等），
都需要先启动服务器才能访问。这个示例展示了如何：
1. 检查服务器是否运行
2. 调用 API
3. 可选：自动启动服务器
"""

import requests
import subprocess
import time
import sys
import os
from pathlib import Path

# API 基础 URL
BASE_URL = "http://localhost:3000"
API_SEARCH = f"{BASE_URL}/api/icons/search"
API_GENERATE = f"{BASE_URL}/api/icons/generate"


def check_server_running(url=BASE_URL, timeout=2):
    """检查服务器是否正在运行"""
    try:
        response = requests.get(f"{url}/health", timeout=timeout)
        return response.status_code == 200
    except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
        return False


def start_server(server_path=None):
    """启动 Node.js 服务器（可选）"""
    if server_path is None:
        # 尝试找到服务器脚本
        current_dir = Path(__file__).parent
        server_path = current_dir / "index.js"
        
        if not server_path.exists():
            server_path = current_dir / "mcp-server.js"
    
    if not server_path.exists():
        print(f"错误：找不到服务器文件 {server_path}")
        return None
    
    print(f"正在启动服务器: {server_path}")
    # 使用 subprocess 启动服务器（后台运行）
    process = subprocess.Popen(
        ["node", str(server_path)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=str(server_path.parent)
    )
    
    # 等待服务器启动
    print("等待服务器启动...")
    for i in range(10):
        if check_server_running():
            print("服务器已启动！")
            return process
        time.sleep(0.5)
    
    print("警告：服务器可能启动失败")
    return process


def search_icons(name, names=None, style=None):
    """
    搜索图标
    
    Args:
        name: 单个图标名称
        names: 多个图标名称（逗号分隔）
        style: 图标风格（element-plus, ant-design, default）
    
    Returns:
        图标列表
    """
    params = {}
    
    if names:
        params['names'] = names
    elif name:
        params['name'] = name
    else:
        raise ValueError("必须提供 name 或 names 参数")
    
    if style:
        params['style'] = style
    
    try:
        response = requests.get(API_SEARCH, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"请求失败: {e}")
        return None


def generate_icon(description, style="default", model=None):
    """
    生成图标
    
    Args:
        description: 图标描述
        style: 图标风格（element-plus, ant-design, default）
        model: AI 模型（openai, tongyi, wenxin, zhipu, kimi, doubao）
    
    Returns:
        生成的图标对象
    """
    data = {
        "description": description,
        "style": style
    }
    
    if model:
        data["model"] = model
    
    try:
        response = requests.post(API_GENERATE, json=data, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"请求失败: {e}")
        return None


def main():
    """主函数示例"""
    print("=" * 50)
    print("Icon MCP Server - Python 客户端示例")
    print("=" * 50)
    
    # 检查服务器是否运行
    if not check_server_running():
        print("\n⚠️  服务器未运行！")
        print("\n请先启动服务器：")
        print("  cd icon-mcp-server-main")
        print("  npm install")
        print("  npm start")
        print("\n或者使用以下选项自动启动服务器：")
        
        choice = input("\n是否自动启动服务器？(y/n): ").strip().lower()
        if choice == 'y':
            process = start_server()
            if process:
                # 等待一下确保服务器完全启动
                time.sleep(2)
            else:
                print("无法启动服务器，请手动启动")
                sys.exit(1)
        else:
            print("请手动启动服务器后重试")
            sys.exit(1)
    else:
        print("✅ 服务器正在运行")
    
    print("\n" + "=" * 50)
    print("示例 1: 搜索单个图标")
    print("=" * 50)
    icons = search_icons(name="home")
    if icons:
        print(f"找到 {len(icons)} 个图标：")
        for icon in icons[:3]:  # 只显示前3个
            print(f"  - {icon.get('name')} ({icon.get('source')})")
    
    print("\n" + "=" * 50)
    print("示例 2: 搜索多个图标")
    print("=" * 50)
    icons = search_icons(names="home,user,settings")
    if icons:
        print(f"找到 {len(icons)} 个图标")
    
    print("\n" + "=" * 50)
    print("示例 3: 按风格搜索")
    print("=" * 50)
    icons = search_icons(name="add", style="element-plus")
    if icons:
        print(f"找到 {len(icons)} 个 Element Plus 图标")
    
    # 注意：生成图标需要配置 AI API Key
    # print("\n" + "=" * 50)
    # print("示例 4: 生成图标（需要配置 AI API Key）")
    # print("=" * 50)
    # icon = generate_icon(
    #     description="一个红色的删除按钮图标",
    #     style="element-plus"
    # )
    # if icon:
    #     print(f"生成成功: {icon.get('name')}")
    
    print("\n" + "=" * 50)
    print("完成！")
    print("=" * 50)


if __name__ == "__main__":
    # 检查依赖
    try:
        import requests
    except ImportError:
        print("错误：需要安装 requests 库")
        print("请运行: pip install requests")
        sys.exit(1)
    
    main()


