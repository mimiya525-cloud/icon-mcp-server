# Icon MCP Server

一个提供图标搜索服务的后端服务器，支持从多个图标库中根据名称模糊查询图标信息。

## 功能特性

- 支持从 Element Plus 图标库搜索图标
- 支持从 Ant Design 图标库搜索图标
- 提供 RESTful API 接口
- 支持图标名称模糊查询
- 返回图标来源、名称和 SVG 代码

## API 接口

### 搜索图标

```
GET /api/icons/search?name={keyword}
```

#### 参数

- `name` (必需): 图标名称关键词，支持模糊匹配

#### 响应格式

```json
[
  {
    "source": "图标来源",
    "name": "图标名称",
    "svg": "SVG代码（JSON转义格式）",
    "rawSvg": "原始SVG代码（移除了XML声明）"
  }
]
```

字段说明：

- `source`: 图标来源（Element Plus 或 Ant Design）
- `name`: 图标名称（采用驼峰命名法）
- `svg`: SVG 代码（JSON 转义格式，包含完整的 XML 声明）
- `rawSvg`: 原始 SVG 代码（移除了 XML 声明，并添加了默认的 width 和 height 属性，更适合直接在 HTML 中使用）

#### 示例

```bash
curl "http://localhost:3000/api/icons/search?name=add"
```

响应示例：

```json
[
  {
    "source": "Element Plus",
    "name": "AddLocation",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1024 1024\">...</svg>",
    "rawSvg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1024 1024\" width=\"30px\" height=\"30px\">...</svg>"
  },
  {
    "source": "Ant Design",
    "name": "FileAdd",
    "svg": "<?xml version=\"1.0\" standalone=\"no\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" class=\"icon\" viewBox=\"0 0 1024 1024\">...</svg>\n",
    "rawSvg": "<svg xmlns=\"http://www.w3.org/2000/svg\" class=\"icon\" viewBox=\"0 0 1024 1024\" width=\"30px\" height=\"30px\">...</svg>"
  }
]
```

## 安装与运行

1. 安装依赖：

```bash
npm install
```

2. 启动开发服务器：

```bash
npm run dev
```

3. 或者启动生产服务器：

```bash
npm start
```

服务器默认运行在 `http://localhost:3000`。

## 部署到 GitHub

1. 在 GitHub 上创建一个新的仓库
2. 将本地代码推送到 GitHub：

```bash
git remote add origin https://github.com/yourusername/your-repo-name.git
git branch -M main
git push -u origin main
```

## 使用 npx 调用

安装后，可以使用 npx 直接调用服务：

```bash
npx icon-mcp-server
```

这将在端口 3000 上启动服务器，然后您可以访问 `http://localhost:3000/api/icons/search?name={keyword}` 来搜索图标。
