const axios = require('axios');
// const logger = require('./logger');
const { getElementPlusIcons, getAntDesignIcons } = require('./icons');

/**
 * 支持的 AI 模型类型
 */
const AI_MODELS = {
  OPENAI: 'openai',
  TONGYI: 'tongyi', // 通义千问（阿里云）
  WENXIN: 'wenxin', // 文心一言（百度）
  ZHIPU: 'zhipu', // 智谱AI（GLM）
  KIMI: 'kimi', // 月之暗面（Kimi）
  DOUBAO: 'doubao', // 豆包（字节跳动）
  HUGGINGFACE: 'huggingface', // Hugging Face（免费，无需 API Key）
};

/**
 * 通过大模型生成图标
 * @param {string} description - 图标描述
 * @param {string} style - 图标风格 (element-plus, ant-design, default)
 * @param {string} model - 指定使用的 AI 模型，如果不指定则自动选择
 * @returns {Promise<Object>} 生成的图标对象，格式与查询接口一致
 */
async function generateIcon(description, style = 'default', model = null) {
  try {
    // logger.info('Generating icon with AI model', { description, style, model });

    // 生成图标名称（基于描述）
    const iconName = generateIconName(description);

    // 尝试使用 AI 直接生成 SVG 代码
    let svgContent = null;
    let usedModel = model || 'fallback';

    try {
      // 使用 AI 生成 SVG 代码
      svgContent = await generateSVGCode(description, style, model);
      usedModel = model || selectAvailableModel();

      // 验证生成的 SVG 是否有效
      if (!svgContent || !isValidSVG(svgContent)) {
        throw new Error('Generated SVG is invalid');
      }

      // 生成成功
      const icon = {
        code: 0,
        source: 'AI Generated',
        name: iconName,
        svg: svgContent,
        rawSvg: cleanSvgContent(svgContent),
        description: description,
        style: style,
        model: usedModel,
      };

      // logger.info('Icon generated successfully', { iconName, style, model: usedModel });
      return icon;
    } catch (error) {
      // logger.error('Failed to generate SVG code', { error: error.message });
      // 生成失败，返回失败响应
      return {
        code: -1,
        source: 'AI Generated (Fallback)',
        name: iconName,
        svg: '',
        rawSvg: '',
        description: description,
        style: style,
        model: 'fallback',
      };
    }
  } catch (error) {
    // logger.error('Failed to generate icon', { error: error.message, stack: error.stack });
    // 如果所有模型都失败，返回失败响应
    const iconName = generateIconName(description);
    return {
      code: -1,
      source: 'AI Generated (Fallback)',
      name: iconName,
      svg: '',
      rawSvg: '',
      description: description,
      style: style,
      model: 'fallback',
    };
  }
}

/**
 * 自动选择可用的模型
 */
function selectAvailableModel() {
  // 按优先级检查可用的模型
  const modelPriority = [
    AI_MODELS.TONGYI,
    AI_MODELS.WENXIN,
    AI_MODELS.ZHIPU,
    AI_MODELS.KIMI,
    AI_MODELS.DOUBAO,
    AI_MODELS.OPENAI,
  ];

  for (const model of modelPriority) {
    if (hasApiKeyForModel(model)) {
      return model;
    }
  }

  // 如果都没有配置，使用免费的 Hugging Face（无需 API Key）
  return AI_MODELS.HUGGINGFACE;
}

/**
 * 检查是否有对应模型的 API Key
 */
function hasApiKeyForModel(model) {
  switch (model) {
    case AI_MODELS.OPENAI:
      return !!(process.env.OPENAI_API_KEY || process.env.AI_API_KEY);
    case AI_MODELS.TONGYI:
      return !!process.env.DASHSCOPE_API_KEY;
    case AI_MODELS.WENXIN:
      return !!(process.env.WENXIN_API_KEY && process.env.WENXIN_SECRET_KEY);
    case AI_MODELS.ZHIPU:
      return !!process.env.ZHIPU_API_KEY;
    case AI_MODELS.KIMI:
      return !!process.env.KIMI_API_KEY;
    case AI_MODELS.DOUBAO:
      return !!process.env.DOUBAO_API_KEY;
    case AI_MODELS.HUGGINGFACE:
      return true; // Hugging Face 免费，无需 API Key
    default:
      return false;
  }
}

/**
 * 尝试备用模型
 */
async function tryFallbackModels(failedModel, prompt) {
  const fallbackModels = [
    AI_MODELS.TONGYI,
    AI_MODELS.WENXIN,
    AI_MODELS.ZHIPU,
    AI_MODELS.KIMI,
    AI_MODELS.DOUBAO,
    AI_MODELS.OPENAI,
    AI_MODELS.HUGGINGFACE, // 免费备用方案
  ].filter((m) => m !== failedModel && hasApiKeyForModel(m));

  for (const model of fallbackModels) {
    try {
      // logger.info(`Trying fallback model: ${model}`);
      switch (model) {
        case AI_MODELS.OPENAI:
          return await generateWithOpenAI(prompt);
        case AI_MODELS.TONGYI:
          return await generateWithTongyi(prompt);
        case AI_MODELS.WENXIN:
          return await generateWithWenxin(prompt);
        case AI_MODELS.ZHIPU:
          return await generateWithZhipu(prompt);
        case AI_MODELS.KIMI:
          return await generateWithKimi(prompt);
        case AI_MODELS.DOUBAO:
          return await generateWithDoubao(prompt);
        case AI_MODELS.HUGGINGFACE:
          return await generateWithHuggingFace(prompt);
      }
    } catch (error) {
      // logger.info(`Fallback model ${model} also failed`, { error: error.message });
      continue;
    }
  }

  throw new Error('All AI models failed');
}

/**
 * 构建提示词（用于图像生成）
 */
function buildPrompt(description, style) {
  const stylePrompts = {
    'element-plus': 'Element Plus style icon, minimalist, clean, modern',
    'ant-design': 'Ant Design style icon, professional, consistent',
    default: 'Simple, clean, modern icon',
  };

  const stylePrompt = stylePrompts[style] || stylePrompts.default;
  return `${stylePrompt}, ${description}, SVG icon, single color, simple design, suitable for UI interface`;
}

/**
 * 构建 SVG 代码生成的提示词
 */
function buildSVGPrompt(description, style) {
  const styleGuidelines = {
    'element-plus': {
      style: 'Element Plus',
      characteristics: 'minimalist, clean lines, modern, simple geometric shapes, single color (currentColor), 24x24 viewBox',
      examples: 'Use simple paths, circles, rectangles. Avoid complex gradients. Use fill="currentColor" for single color icons.'
    },
    'ant-design': {
      style: 'Ant Design',
      characteristics: 'professional, consistent stroke width (1.5-2px), rounded corners, balanced proportions, 24x24 viewBox',
      examples: 'Use stroke-based design, consistent line width, rounded end caps. Use fill="none" and stroke="currentColor".'
    },
    default: {
      style: 'Simple',
      characteristics: 'clean, simple, modern, 24x24 viewBox, single color',
      examples: 'Use simple shapes, clear lines, fill="currentColor" or stroke="currentColor".'
    }
  };

  const guidelines = styleGuidelines[style] || styleGuidelines.default;

  return `Generate a ${guidelines.style} style SVG icon based on this description: "${description}"

Requirements:
- Style: ${guidelines.characteristics}
- ViewBox: 0 0 24 24
- ${guidelines.examples}
- The icon should be simple and recognizable
- Use only SVG elements: path, circle, rect, line, polygon, polyline
- Output ONLY the SVG code, no explanations, no markdown, no code blocks
- Start with <svg> and end with </svg>
- Width and height should be 24px
- Use currentColor for fill or stroke to support theme colors

Generate the SVG code now:`;
}

/**
 * 使用 AI 直接生成 SVG 代码
 */
async function generateSVGCode(description, style, model = null) {
  const prompt = buildSVGPrompt(description, style);

  try {
    // 如果指定了模型，使用指定的模型
    if (model) {
      if (model === AI_MODELS.OPENAI && hasApiKeyForModel(AI_MODELS.OPENAI)) {
        return await generateSVGWithOpenAI(prompt);
      }
      if (model === AI_MODELS.TONGYI) {
        return await generateSVGWithTongyi(prompt);
      }
    }

    // 优先尝试使用支持文本生成的模型（如 OpenAI GPT）
    if (hasApiKeyForModel(AI_MODELS.OPENAI)) {
      return await generateSVGWithOpenAI(prompt);
    }

    // 如果没有 OpenAI，尝试使用通义千问
    if (hasApiKeyForModel(AI_MODELS.TONGYI)) {
      return await generateSVGWithTongyi(prompt);
    }

    // 如果没有可用的文本生成模型，尝试从图标库查询
    // logger.info('No AI model available, trying to search icon library', { description, style });
    const svgFromSearch = await searchIconFromLibrary(description, style);
    if (svgFromSearch) {
      return svgFromSearch;
    }

    // 如果查询也没有结果，抛出错误（不再使用规则生成）
    throw new Error('No matching icon found in library and no AI model available');
  } catch (error) {
    // logger.error('Failed to generate SVG', { error: error.message });
    // 重新抛出错误，让上层处理失败情况
    throw error;
  }
}

/**
 * 从图标库查询图标（作为备用方案）
 */
async function searchIconFromLibrary(description, style) {
  try {
    // 从描述中提取关键词用于搜索
    const searchKeywords = extractSearchKeywords(description);

    if (searchKeywords.length === 0) {
      // logger.warn('No search keywords extracted from description', { description });
      return null;
    }

    // 根据 style 决定搜索哪些图标库
    let allIcons = [];

    if (!style || style === 'default') {
      // 两者都搜索
      for (const keyword of searchKeywords) {
        const elementPlusIcons = await getElementPlusIcons(keyword);
        const antDesignIcons = await getAntDesignIcons(keyword);
        allIcons.push(...elementPlusIcons, ...antDesignIcons);
      }
    } else if (style === 'element-plus') {
      // 只搜索 Element Plus
      for (const keyword of searchKeywords) {
        const elementPlusIcons = await getElementPlusIcons(keyword);
        allIcons.push(...elementPlusIcons);
      }
    } else if (style === 'ant-design') {
      // 只搜索 Ant Design
      for (const keyword of searchKeywords) {
        const antDesignIcons = await getAntDesignIcons(keyword);
        allIcons.push(...antDesignIcons);
      }
    }

    // 去重
    const uniqueIcons = Array.from(
      new Map(allIcons.map((icon) => [`${icon.source}-${icon.name}`, icon])).values()
    );

    if (uniqueIcons.length === 0) {
      // logger.info('No icons found in library', { description, style, keywords: searchKeywords });
      return null;
    }

    // 返回第一个匹配的图标的 rawSvg
    // logger.info('Found icon from library', {
    //   description,
    //   style,
    //   iconName: uniqueIcons[0].name,
    //   source: uniqueIcons[0].source
    // });
    return uniqueIcons[0].rawSvg || uniqueIcons[0].svg;
  } catch (error) {
    // logger.error('Failed to search icon from library', { error: error.message });
    return null;
  }
}

/**
 * 从描述中提取搜索关键词
 */
function extractSearchKeywords(description) {
  // 将描述转换为小写
  const lowerDesc = description.toLowerCase();

  // 常见图标关键词映射
  const keywordMap = {
    '删除': 'delete',
    'delete': 'delete',
    'remove': 'delete',
    '添加': 'add',
    'add': 'add',
    'plus': 'add',
    '编辑': 'edit',
    'edit': 'edit',
    '修改': 'edit',
    '保存': 'save',
    'save': 'save',
    '搜索': 'search',
    'search': 'search',
    '查找': 'search',
    '关闭': 'close',
    'close': 'close',
    '取消': 'cancel',
    'cancel': 'cancel',
    '确认': 'confirm',
    'confirm': 'confirm',
    '确定': 'confirm',
    '上传': 'upload',
    'upload': 'upload',
    '下载': 'download',
    'download': 'download',
    '设置': 'setting',
    'setting': 'setting',
    '配置': 'setting',
    '用户': 'user',
    'user': 'user',
    '主页': 'home',
    'home': 'home',
    '菜单': 'menu',
    'menu': 'menu',
    '更多': 'more',
    'more': 'more',
  };

  // 尝试匹配关键词
  const keywords = [];
  for (const [key, value] of Object.entries(keywordMap)) {
    if (lowerDesc.includes(key)) {
      keywords.push(value);
    }
  }

  // 如果没有匹配到关键词，尝试提取英文单词
  if (keywords.length === 0) {
    const words = description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 3);
    keywords.push(...words);
  }

  return keywords;
}

/**
 * 使用 OpenAI GPT 生成 SVG 代码
 */
async function generateSVGWithOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not found');
  }

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini', // 使用更便宜的模型
      messages: [
        {
          role: 'system',
          content: 'You are an expert SVG icon designer. Generate clean, simple SVG icons in the requested style. Output ONLY the SVG code, no explanations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 30000,
    }
  );

  const svgCode = response.data.choices[0].message.content.trim();
  // 清理可能的 markdown 代码块标记
  return svgCode.replace(/^```(?:svg|html)?\n?/i, '').replace(/\n?```$/i, '').trim();
}

/**
 * 使用通义千问生成 SVG 代码
 */
async function generateSVGWithTongyi(prompt) {
  const apiKey = process.env.DASHSCOPE_API_KEY
  if (!apiKey) {
    throw new Error('DashScope API key not found');
  }
  const response = await axios.post(
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    {
      model: 'qwen-turbo',
      input: {
        messages: [
          {
            role: 'system',
            content: 'You are an expert SVG icon designer. Generate clean, simple SVG icons in the requested style. Output ONLY the SVG code, no explanations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      parameters: {
        temperature: 0.7,
        max_tokens: 1000,
      }
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 30000,
    }
  );
  const svgCode = response.data.output.text.trim();
  // 清理可能的 markdown 代码块标记
  return svgCode.replace(/^```(?:svg|html)?\n?/i, '').replace(/\n?```$/i, '').trim();
}

/**
 * 基于规则生成 SVG（备用方案）
 */
function generateSVGByRules(description, style) {
  const iconName = generateIconName(description);
  const styleConfig = {
    'element-plus': {
      viewBox: '0 0 24 24',
      fill: 'currentColor',
      stroke: 'none'
    },
    'ant-design': {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: '2'
    },
    default: {
      viewBox: '0 0 24 24',
      fill: 'currentColor',
      stroke: 'none'
    }
  };

  const config = styleConfig[style] || styleConfig.default;

  // 根据描述生成简单的 SVG
  // 这里可以根据常见图标类型生成对应的 SVG
  const lowerDesc = description.toLowerCase();

  // 删除图标
  if (lowerDesc.includes('删除') || lowerDesc.includes('delete') || lowerDesc.includes('remove')) {
    return `<svg width="24" height="24" viewBox="${config.viewBox}" fill="${config.fill}" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/>
</svg>`;
  }

  // 添加图标
  if (lowerDesc.includes('添加') || lowerDesc.includes('add') || lowerDesc.includes('plus')) {
    return `<svg width="24" height="24" viewBox="${config.viewBox}" fill="${config.fill}" xmlns="http://www.w3.org/2000/svg">
  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
</svg>`;
  }

  // 编辑图标
  if (lowerDesc.includes('编辑') || lowerDesc.includes('edit') || lowerDesc.includes('修改')) {
    return `<svg width="24" height="24" viewBox="${config.viewBox}" fill="${config.fill}" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
</svg>`;
  }

  // 默认返回一个简单的图标
  return `<svg width="24" height="24" viewBox="${config.viewBox}" fill="${config.fill}" xmlns="http://www.w3.org/2000/svg">
  <rect width="24" height="24" fill="currentColor" opacity="0.1"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="currentColor">${iconName.substring(0, 2).toUpperCase()}</text>
</svg>`;
}

/**
 * 验证 SVG 代码是否有效
 */
function isValidSVG(svgCode) {
  if (!svgCode || typeof svgCode !== 'string') {
    return false;
  }

  // 检查是否包含基本的 SVG 标签
  if (!svgCode.includes('<svg') || !svgCode.includes('</svg>')) {
    return false;
  }

  // 检查是否包含 viewBox 或 width/height
  if (!svgCode.includes('viewBox') && !svgCode.includes('width') && !svgCode.includes('height')) {
    return false;
  }

  // 基本验证通过
  return true;
}

/**
 * 使用 OpenAI DALL-E 生成图像
 */
async function generateWithOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not found');
  }

  const response = await axios.post(
    'https://api.openai.com/v1/images/generations',
    {
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url',
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 30000,
    }
  );

  return response.data.data[0].url;
}

/**
 * 使用通义千问（阿里云）生成图像
 */
async function generateWithTongyi(prompt) {
  // 优先使用环境变量，如果没有则使用备用 key（仅用于测试）
  const apiKey = process.env.DASHSCOPE_API_KEY
  if (!apiKey) {
    throw new Error('DashScope API key not found. Please set DASHSCOPE_API_KEY environment variable.');
  }

  try {
    const response = await axios.post(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
      {
        model: 'wanx-v1', // 通义万相模型（标准版）
        input: {
          prompt: prompt,
        },
        parameters: {
          size: '1024*1024',
          n: 1,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 30000,
      }
    );

    // logger.debug('Tongyi API response', {
    //   hasOutput: !!response.data.output,
    //   hasResults: !!(response.data.output && response.data.output.results),
    //   resultCount: response.data.output?.results?.length || 0
    // });

    if (response.data.output && response.data.output.results && response.data.output.results.length > 0) {
      return response.data.output.results[0].url;
    }

    // 检查是否有错误信息
    if (response.data.code) {
      throw new Error(`Tongyi API error: ${response.data.message || response.data.code}`);
    }

    throw new Error('Tongyi API returned invalid response');
  } catch (error) {
    // 如果是 401 错误，提供更清晰的错误信息
    if (error.response && error.response.status === 401) {
      throw new Error('DashScope API key is invalid or expired. Please check your DASHSCOPE_API_KEY environment variable.');
    }
    // 如果是 400 错误，可能是请求格式问题
    if (error.response && error.response.status === 400) {
      const errorMsg = error.response.data?.message || error.response.data?.code || 'Bad request';
      throw new Error(`Tongyi API request error: ${errorMsg}`);
    }
    // 重新抛出其他错误
    throw error;
  }
}

/**
 * 使用文心一言（百度）生成图像
 */
async function generateWithWenxin(prompt) {
  const apiKey = process.env.WENXIN_API_KEY;
  const secretKey = process.env.WENXIN_SECRET_KEY;
  if (!apiKey || !secretKey) {
    throw new Error('Wenxin API key or secret key not found. Please set WENXIN_API_KEY and WENXIN_SECRET_KEY environment variables.');
  }

  // 获取 access_token
  const tokenResponse = await axios.post(
    `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`,
    {},
    {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }
  );

  const accessToken = tokenResponse.data.access_token;
  if (!accessToken) {
    throw new Error('Failed to get Wenxin access token');
  }

  // 调用文心一格 API
  const response = await axios.post(
    `https://aip.baidubce.com/rest/2.0/solution/v1/img_cheng/v1?access_token=${accessToken}`,
    {
      prompt: prompt,
      size: '1024x1024',
      n: 1,
      steps: 20,
      scale: 7.5,
    },
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 60000, // 文心一言可能需要更长时间
    }
  );

  if (response.data.data && response.data.data.length > 0) {
    return response.data.data[0].b64_image
      ? `data:image/png;base64,${response.data.data[0].b64_image}`
      : response.data.data[0].image;
  }
  throw new Error('Wenxin API returned invalid response');
}

/**
 * 使用智谱AI（GLM）生成图像
 */
async function generateWithZhipu(prompt) {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    throw new Error('Zhipu API key not found. Please set ZHIPU_API_KEY environment variable.');
  }

  // 智谱AI 目前主要通过 GLM 模型，图像生成可能需要使用其他服务
  // 这里提供一个基础实现，实际使用时可能需要调整
  const response = await axios.post(
    'https://open.bigmodel.cn/api/paas/v4/images/generations',
    {
      model: 'cogview-3',
      prompt: prompt,
      size: '1024x1024',
      n: 1,
      quality: 'standard',
      response_format: 'url',
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 30000,
    }
  );

  if (response.data.data && response.data.data.length > 0) {
    return response.data.data[0].url;
  }
  throw new Error('Zhipu API returned invalid response');
}

/**
 * 使用月之暗面（Kimi）生成图像
 */
async function generateWithKimi(prompt) {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) {
    throw new Error('Kimi API key not found. Please set KIMI_API_KEY environment variable.');
  }

  // Kimi 主要通过 Moonshot API，图像生成可能需要使用其他服务
  // 这里提供一个基础实现
  const response = await axios.post(
    'https://api.moonshot.cn/v1/images/generations',
    {
      model: 'moonshot-image',
      prompt: prompt,
      size: '1024x1024',
      n: 1,
      response_format: 'url',
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 30000,
    }
  );

  if (response.data.data && response.data.data.length > 0) {
    return response.data.data[0].url;
  }
  throw new Error('Kimi API returned invalid response');
}

/**
 * 使用豆包（字节跳动）生成图像
 * 注意：豆包 API 需要有效的 API Key，无法直接调用
 * 获取 API Key：访问 https://www.volcengine.com/ 注册并获取
 */
async function generateWithDoubao(prompt) {
  const apiKey = process.env.DOUBAO_API_KEY;
  if (!apiKey) {
    throw new Error('Doubao API key not found. Please set DOUBAO_API_KEY environment variable. Get API key from https://www.volcengine.com/');
  }

  try {
    // 豆包（字节跳动）图像生成 API
    // API 端点：火山引擎（Volcano Engine）
    const response = await axios.post(
      'https://ark.cn-beijing.volces.com/api/v3/images/generations',
      {
        model: 'doubao-seedream-4-0-250828', // 豆包图像生成模型
        prompt: prompt,
        size: '1024x1024',
        n: 1,
        response_format: 'url',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 30000,
      }
    );

    if (response.data.data && response.data.data.length > 0) {
      return response.data.data[0].url;
    }

    // 检查是否有错误信息
    if (response.data.error) {
      throw new Error(`Doubao API error: ${response.data.error.message || response.data.error.code}`);
    }

    throw new Error('Doubao API returned invalid response');
  } catch (error) {
    // 如果是 401 错误，提供更清晰的错误信息
    if (error.response && error.response.status === 401) {
      throw new Error('Doubao API key is invalid or expired. Please check your DOUBAO_API_KEY environment variable.');
    }
    // 如果是 400 错误，可能是请求格式问题
    if (error.response && error.response.status === 400) {
      const errorMsg = error.response.data?.error?.message || error.response.data?.message || 'Bad request';
      throw new Error(`Doubao API request error: ${errorMsg}`);
    }
    // 重新抛出其他错误
    throw error;
  }
}

/**
 * 使用 Hugging Face Inference API 生成图像（免费，无需 API Key）
 * 使用 Stable Diffusion 模型
 */
async function generateWithHuggingFace(prompt) {
  try {
    // 使用 Hugging Face Inference API（免费，无需 API Key）
    // 使用 Stable Diffusion 2.1 模型
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1',
      {
        inputs: prompt,
        parameters: {
          num_inference_steps: 20,
          guidance_scale: 7.5,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer', // 接收二进制数据
        timeout: 60000, // Hugging Face 可能需要更长时间
      }
    );

    // Hugging Face 返回的是图片的二进制数据，需要转换为 base64
    const imageBuffer = Buffer.from(response.data);
    const base64Image = imageBuffer.toString('base64');

    // 返回 base64 格式的图片 URL
    return `data:image/png;base64,${base64Image}`;
  } catch (error) {
    // Hugging Face API 可能返回 503（模型加载中），需要等待后重试
    if (error.response && error.response.status === 503) {
      const estimatedTime = error.response.data?.estimated_time || 20;
      // logger.info(`Hugging Face model is loading, estimated time: ${estimatedTime}s`);
      throw new Error(`Hugging Face model is loading, please try again in ${estimatedTime} seconds`);
    }

    // 如果是 429 错误（请求过多），提供提示
    if (error.response && error.response.status === 429) {
      throw new Error('Hugging Face API rate limit exceeded. Please try again later.');
    }

    // 重新抛出其他错误
    throw error;
  }
}

/**
 * 将图像转换为 SVG（简化实现）
 * 实际项目中可能需要使用图像识别和矢量化工具
 */
async function convertImageToSVG(imageUrl, description) {
  // 简化实现：返回一个基于描述的 SVG
  // 实际项目中应该：
  // 1. 下载图像
  // 2. 使用图像识别或矢量化工具转换为 SVG
  // 3. 优化 SVG 代码

  // 这里返回一个占位 SVG，实际项目中需要实现真正的转换
  return generateFallbackSVG(description);
}

/**
 * 生成备用 SVG（当 AI 服务不可用时）
 */
function generateFallbackSVG(description) {
  // 生成一个简单的 SVG 占位符
  // 实际项目中应该调用其他图标生成服务或使用模板
  const iconName = generateIconName(description);
  return `<svg width="30px" height="30px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="24" height="24" fill="currentColor" opacity="0.1"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="currentColor">${iconName.substring(0, 2).toUpperCase()}</text>
</svg>`;
}

/**
 * 生成图标名称
 */
function generateIconName(description) {
  // 简化实现：基于描述生成驼峰命名
  // 实际项目中可以使用 NLP 模型提取关键词
  const words = description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, 3);

  if (words.length === 0) {
    return 'GeneratedIcon';
  }

  return words
    .map((word, index) => {
      if (index === 0) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join('');
}

/**
 * 清理 SVG 内容
 */
function cleanSvgContent(svgContent) {
  let cleanedSvg = svgContent.replace(/<\?xml[^>]*\?>/g, '').trim();

  if (!cleanedSvg.includes('width=') && !cleanedSvg.includes('height=')) {
    cleanedSvg = cleanedSvg.replace(/<svg([^>]*)>/, `<svg$1 width="30px" height="30px">`);
  }

  return cleanedSvg;
}

module.exports = {
  generateIcon,
  AI_MODELS,
};

