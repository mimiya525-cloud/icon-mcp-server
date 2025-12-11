#!/usr/bin/env python3
"""
Python 包装器 - 直接调用 Node.js 服务器（无需手动启动）

这个脚本可以：
1. 自动启动 Node.js 服务器
2. 提供 Python API 接口
3. 管理服务器生命周期
"""

import subprocess
import requests
import time
import atexit
import signal
import sys
from pathlib import Path
from typing import Optional, List, Dict, Any


class IconMCPServer:
    """Icon MCP Server 的 Python 包装器"""
    
    def __init__(self, server_path: Optional[str] = None, port: int = 3000, auto_start: bool = True):
        """
        初始化服务器包装器
        
        Args:
            server_path: Node.js 服务器脚本路径（默认自动查找）
            port: 服务器端口
            auto_start: 是否自动启动服务器
        """
        self.port = port
        self.base_url = f"http://localhost:{port}"
        self.process = None
        
        if server_path is None:
            # 自动查找服务器文件
            current_dir = Path(__file__).parent
            for filename in ["index.js", "mcp-server.js"]:
                path = current_dir / filename
                if path.exists():
                    server_path = str(path)
                    break
        
        self.server_path = server_path
        
        if auto_start:
            self.start()
        
        # 注册退出时清理
        atexit.register(self.stop)
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """处理退出信号"""
        self.stop()
        sys.exit(0)
    
    def start(self) -> bool:
        """启动服务器"""
        if self.is_running():
            print("服务器已在运行")
            return True
        
        if not self.server_path or not Path(self.server_path).exists():
            raise FileNotFoundError(f"找不到服务器文件: {self.server_path}")
        
        print(f"正在启动服务器: {self.server_path}")
        self.process = subprocess.Popen(
            ["node", self.server_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=str(Path(self.server_path).parent)
        )
        
        # 等待服务器启动
        for _ in range(20):
            if self.is_running():
                print("✅ 服务器已启动")
                return True
            time.sleep(0.5)
        
        print("❌ 服务器启动失败")
        return False
    
    def stop(self):
        """停止服务器"""
        if self.process:
            print("正在停止服务器...")
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
            self.process = None
            print("服务器已停止")
    
    def is_running(self) -> bool:
        """检查服务器是否运行"""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=2)
            return response.status_code == 200
        except:
            return False
    
    def search_icons(self, name: Optional[str] = None, names: Optional[str] = None, 
                    style: Optional[str] = None) -> Optional[List[Dict[str, Any]]]:
        """
        搜索图标
        
        Args:
            name: 单个图标名称
            names: 多个图标名称（逗号分隔）
            style: 图标风格
        
        Returns:
            图标列表
        """
        if not self.is_running():
            if not self.start():
                return None
        
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
            response = requests.get(f"{self.base_url}/api/icons/search", params=params, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"搜索失败: {e}")
            return None
    
    def generate_icon(self, description: str, style: str = "default", 
                     model: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        生成图标
        
        Args:
            description: 图标描述
            style: 图标风格
            model: AI 模型
        
        Returns:
            生成的图标对象
        """
        if not self.is_running():
            if not self.start():
                return None
        
        data = {"description": description, "style": style}
        if model:
            data["model"] = model
        
        try:
            response = requests.post(f"{self.base_url}/api/icons/generate", json=data, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"生成失败: {e}")
            return None


# 使用示例
if __name__ == "__main__":
    # 创建服务器实例（自动启动）
    server = IconMCPServer(auto_start=True)
    
    try:
        # 搜索图标
        print("\n搜索图标 'home':")
        icons = server.search_icons(name="home")
        if icons:
            print(f"找到 {len(icons)} 个图标")
            for icon in icons[:3]:
                print(f"  - {icon.get('name')} ({icon.get('source')})")
        
        # 搜索多个图标
        print("\n搜索多个图标:")
        icons = server.search_icons(names="home,user,settings")
        if icons:
            print(f"找到 {len(icons)} 个图标")
        
    finally:
        # 退出时自动停止服务器
        server.stop()


