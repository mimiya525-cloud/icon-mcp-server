# Icon MCP Server

[![NPM Version](https://img.shields.io/npm/v/icon-mcp-server.svg)](https://www.npmjs.com/package/icon-mcp-server)
[![License](https://img.shields.io/npm/l/icon-mcp-server.svg)](https://github.com/daytoy105/icon-mcp-server/blob/main/LICENSE)

A backend server that provides icon search and generation service, supporting fuzzy search for icons from multiple icon libraries and AI-powered icon generation.

一个提供图标搜索和生成服务的后端服务器，支持从多个图标库中根据名称模糊查询图标信息，以及通过大模型生成图标。

## 功能特性 (Features)

- ✅ 支持从 Element Plus 图标库搜索图标
- ✅ 支持从 Ant Design 图标库搜索图标
- ✅ 提供 RESTful API 接口
- ✅ 支持图标名称模糊查询
- ✅ **支持多个名称查询（逗号分隔）**
- ✅ **支持通过大模型生成图标**
- ✅ **支持 MCP (Model Context Protocol) 协议，可在 Cursor 中配置使用**
- 返回图标来源、名称和 SVG 代码

## Installation

### 作为 MCP 服务器使用（推荐）

无需安装，直接在 Cursor 中通过 `npx` 调用即可。详见下面的 [使用说明](#作为-mcp-服务器在-cursor-中使用)。

### 作为 HTTP 服务器使用

如果需要作为 HTTP 服务器运行，可以全局安装：

```bash
npm install -g icon-mcp-server
```

或本地安装：

```bash
npm install icon-mcp-server
```

### 发布到 npm（开发者）

如果你想发布自己的版本：

```bash
npm login
npm publish
```

发布后，其他人就可以通过 `npx -y icon-mcp-server` 使用你的包了。

## Usage

### 作为 MCP 服务器在 Cursor 中使用

#### 通过 npx 使用（推荐，无需本地安装）

1. **在 Cursor 中配置 mcp.json**

   在项目根目录或用户配置目录创建 `.cursor/mcp.json` 文件（或编辑现有的），添加以下配置：

   ```json
   {
     "mcpServers": {
       "icon-mcp-server": {
         "command": "npx",
         "args": ["-y", "icon-mcp-server"],
         "env": {
           "DASHSCOPE_API_KEY": "your_dashscope_api_key_here",
           "LOGGING_ENABLED": "true"
         }
       }
     }
   }
   ```

   **说明**:

   - `npx -y icon-mcp-server` 会自动下载并运行最新版本的包，无需本地安装
   - `-y` 参数表示自动确认，无需用户交互
   - 只需要配置你使用的 AI 模型的 API Key 即可

2. **重启 Cursor**

   保存配置后，重启 Cursor 编辑器，MCP 服务器将自动启动。

3. **使用 MCP 工具**

   在 Cursor 中，你可以使用以下工具：

   - `search_icons`: 搜索图标（支持多个名称，逗号分隔）
   - `generate_icon`: 生成图标

#### 启动服务器

直接启动服务器：

```bash
npx icon-mcp
```

或使用启动脚本：

```bash
npm start
```

服务器默认运行在 3000 端口。可以通过设置 `PORT` 环境变量来更改端口：

```bash
PORT=8080 npm start
```

#### 启用日志

要启用日志：

```bash
npm run start:logging
```

#### 开发模式

开发模式（自动重载）：

```bash
npm run dev
```

## API 接口

### 搜索图标

```
GET /api/icons/search?name={keyword}
GET /api/icons/search?names={keyword1,keyword2,keyword3}
```

#### 参数

- `name` (可选): 单个图标名称关键词，支持模糊匹配
- `names` (可选): 多个图标名称，用逗号分隔，例如: `add,delete,edit`

**注意**: `names` 参数优先级高于 `name` 参数

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

- `source`: 图标来源（Element Plus、Ant Design 或 AI Generated）
- `name`: 图标名称（采用驼峰命名法）
- `svg`: SVG 代码（JSON 转义格式，包含完整的 XML 声明）
- `rawSvg`: 原始 SVG 代码（移除了 XML 声明，并添加了默认的 width 和 height 属性，更适合直接在 HTML 中使用）

#### 示例

```bash
# 单个名称查询
curl "http://localhost:3000/api/icons/search?name=add"

# 多个名称查询
curl "http://localhost:3000/api/icons/search?names=add,delete,edit"
```

### 生成图标

```
POST /api/icons/generate
```

#### 请求体

```json
{
  "description": "一个红色的删除按钮图标",
  "style": "element-plus"
}
```

#### 参数

- `description` (必需): 图标的描述
- `style` (可选): 图标风格，可选值: `element-plus`, `ant-design`, `default`，默认为 `default`
- `model` (可选): 指定使用的 AI 模型，可选值: `openai`, `tongyi`, `wenxin`, `zhipu`, `kimi`, `doubao`。如果不指定，将自动选择可用的模型

#### 响应格式

```json
{
  "source": "AI Generated",
  "name": "生成的图标名称",
  "svg": "SVG代码",
  "rawSvg": "原始SVG代码",
  "description": "图标描述",
  "style": "图标风格"
}
```

#### 示例

````bash
# 自动选择模型
curl -X POST "http://localhost:3000/api/icons/generate" \
  -H "Content-Type: application/json" \
  -d '{"description": "一个红色的删除按钮图标", "style": "element-plus"}'

# 指定使用通义千问
curl -X POST "http://localhost:3000/api/icons/generate" \
  -H "Content-Type: application/json" \
  -d '{"description": "一个红色的删除按钮图标", "style": "element-plus", "model": "tongyi"}'

## MCP 工具

### search_icons

根据名称搜索图标，支持多个名称（逗号分隔）。

**参数**:

- `names` (string, 必需): 图标名称，支持多个名称用逗号分隔，例如: "add,delete,edit"

**返回**: 匹配的图标数组，格式与 API 接口一致

### generate_icon

通过大模型生成图标。

**参数**:

- `description` (string, 必需): 图标的描述，例如: "一个红色的删除按钮图标"
- `style` (string, 可选): 图标风格，可选值: "element-plus", "ant-design", "default"，默认为 "default"
- `model` (string, 可选): 指定使用的 AI 模型，可选值: "openai", "tongyi"。如果不指定，将自动选择可用的模型

**返回**: 生成的图标对象，格式与查询接口一致，包含 `model` 字段指示使用的模型

**快速配置示例**：

```bash
# 推荐：使用通义千问
export DASHSCOPE_API_KEY="your_dashscope_api_key"
````

系统会自动选择已配置的模型，如果指定模型失败会自动尝试其他模型。

## License

MIT © Your Name
