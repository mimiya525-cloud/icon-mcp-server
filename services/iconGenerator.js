const axios = require('axios');
// const logger = require('./logger');
const { getElementPlusIcons, getAntDesignIcons } = require('./icons');

/**
 * 支持的 AI 模型类型
 */
const AI_MODELS = {
  TONGYI: 'tongyi', // 通义千问（阿里云）
  DOUBAO: 'doubao', // 豆包（字节跳动）
};

/**
 * 通过大模型生成图标
 * @param {string} description - 图标描述或类别
 * @param {string} prefix - 图标库前缀 (element-plus, ant-design, default)
 * @param {string} model - 指定使用的 AI 模型，如果不指定则自动选择
 * @param {string} name - 图标名称，可选，用于本地图标库查询
 * @returns {Promise<Array>} 生成的图标数组，格式与查询接口一致
 */
async function generateIcon(description, prefix = 'default', model = null, name = null) {
  try {
    const allIcons = [];
    let searchName = name || generateIconName(description);

    // 1. 优先使用名称从本地图标库查询
    if (searchName) {
      let localIcons = [];
      
      // 根据 prefix 决定搜索哪些图标库
      if (prefix === 'element-plus') {
        // 只搜索 Element Plus
        localIcons = await getElementPlusIcons(searchName, true);
      } else if (prefix === 'ant-design') {
        // 只搜索 Ant Design
        localIcons = await getAntDesignIcons(searchName, undefined, true);
      } else {
        // 搜索两个图标库
        const elementPlusIcons = await getElementPlusIcons(searchName, true);
        const antDesignIcons = await getAntDesignIcons(searchName, undefined, true);
        
        // 分别取一个匹配的图标
        if (elementPlusIcons.length > 0) {
          localIcons.push(elementPlusIcons[0]);
        }
        if (antDesignIcons.length > 0) {
          localIcons.push(antDesignIcons[0]);
        }
      }

      // 添加本地图标到结果列表
      if (localIcons.length > 0) {
        allIcons.push(...localIcons.map(icon => ({
          code: 0,
          source: icon.source === 'Ant Design' ? 'Ant Design' : 'Element Plus',
          name: icon.name,
          svg: icon.svg,
          rawSvg: icon.rawSvg || cleanSvgContent(icon.svg),
          description: description,
          style: prefix,
          model: 'local',
        })));
      }
    }

    // 2. 如果本地图标库没有结果，尝试使用 AI 生成图标
    if (allIcons.length === 0) {
      let aiIcon = null;
      try {
        // 使用 AI 生成 SVG 代码
        const svgContent = await generateSVGCode(description, prefix, model);
        const usedModel = model || selectAvailableModel();

        // 验证生成的 SVG 是否有效
        if (svgContent && isValidSVG(svgContent)) {
          aiIcon = {
            code: 0,
            source: 'AI生成',
            name: searchName,
            svg: svgContent,
            rawSvg: cleanSvgContent(svgContent),
            description: description,
            style: prefix,
            model: usedModel,
          };
          allIcons.push(aiIcon);
        }
      } catch (error) {
        // AI 生成失败，忽略并继续使用 Iconify
      }
    }

    // 3. 如果仍然没有结果，从 Iconify 搜索图标
    if (allIcons.length === 0) {
      const iconifyIcons = await searchIconFromIconify(name || description);
      if (iconifyIcons.length > 0) {
        allIcons.push(...iconifyIcons);
      }
    }

    // 4. 如果还是没有结果，使用规则生成默认图标
    if (allIcons.length === 0) {
      const defaultSvg = generateSVGByRules(description, prefix);
      const defaultIcon = {
        code: -1,
        source: 'AI生成',
        name: searchName,
        svg: defaultSvg,
        rawSvg: cleanSvgContent(defaultSvg),
        description: description,
        style: prefix,
        model: 'default',
      };
      allIcons.push(defaultIcon);
    }

    // 返回所有找到的图标，不需要强制补全 3 个
    return allIcons;
  } catch (error) {
    // logger.error('Failed to generate icon', { error: error.message, stack: error.stack });
    // 如果所有方法都失败，返回默认图标
    const searchName = name || generateIconName(description);
    const defaultSvg = generateSVGByRules(description, prefix);
    return [
      {
        code: -1,
        source: 'AI生成',
        name: searchName,
        svg: defaultSvg,
        rawSvg: cleanSvgContent(defaultSvg),
        description: description,
        style: prefix,
        model: 'default',
      }
    ];
  }
}

/**
 * 根据类别批量生成图标
 * @param {string} category - 图标类别
 * @param {number} count - 生成数量
 * @param {string} prefix - 图标库前缀
 * @param {string} model - AI 模型
 * @returns {Promise<Array>} 生成的图标数组
 */
async function generateIconsByCategory(category, count = 3, prefix = 'default', model = null) {
  try {
    // 使用 AI 生成该类别下的具体图标关键词
    const iconKeywords = await generateIconKeywords(category, count);
    const allIcons = [];

    // 为每个关键词生成图标
    for (const keyword of iconKeywords) {
      const iconDescription = `${category}图标：${keyword}`;
      try {
        // 生成单个图标
        const generatedIcons = await generateIcon(iconDescription, prefix, model, keyword);
        if (generatedIcons && generatedIcons.length > 0) {
          // 取第一个生成的图标
          allIcons.push(generatedIcons[0]);
        }
      } catch (error) {
        console.error(`生成${keyword}图标失败:`, error);
        continue;
      }

      // 如果已经生成了足够数量的图标，停止
      if (allIcons.length >= count) {
        break;
      }
    }

    // 如果生成的图标数量不足，使用默认图标补充
    while (allIcons.length < count) {
      const defaultSvg = generateSVGByRules(category, prefix);
      const defaultIcon = {
        code: -1,
        source: 'AI生成',
        name: `${generateIconName(category)}-${allIcons.length + 1}`,
        svg: defaultSvg,
        rawSvg: cleanSvgContent(defaultSvg),
        description: `${category}图标`,
        style: prefix,
        model: 'default',
      };
      allIcons.push(defaultIcon);
    }

    return allIcons;
  } catch (error) {
    console.error('批量生成图标失败:', error);
    // 返回默认图标
    const defaultIcons = [];
    for (let i = 0; i < count; i++) {
      const defaultSvg = generateSVGByRules(category, prefix);
      defaultIcons.push({
        code: -1,
        source: 'AI生成',
        name: `${generateIconName(category)}-default-${i + 1}`,
        svg: defaultSvg,
        rawSvg: cleanSvgContent(defaultSvg),
        description: `${category}图标`,
        style: prefix,
        model: 'default',
      });
    }
    return defaultIcons;
  }
}

/**
 * 自动选择可用的模型
 */
function selectAvailableModel() {
  // 按优先级检查可用的模型
  const modelPriority = [
    AI_MODELS.TONGYI,
    AI_MODELS.DOUBAO,
  ];

  for (const model of modelPriority) {
    if (hasApiKeyForModel(model)) {
      return model;
    }
  }

  // 如果都没有配置，返回 null
  return null;
}

/**
 * 检查是否有对应模型的 API Key
 */
function hasApiKeyForModel(model) {
  switch (model) {
    case AI_MODELS.TONGYI:
      return !!process.env.DASHSCOPE_API_KEY;
    case AI_MODELS.DOUBAO:
      return !!process.env.DOUBAO_API_KEY;
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
    AI_MODELS.DOUBAO,
  ].filter((m) => m !== failedModel && hasApiKeyForModel(m));

  for (const model of fallbackModels) {
    try {
      // logger.info(`Trying fallback model: ${model}`);
      switch (model) {
        case AI_MODELS.TONGYI:
          return await generateWithTongyi(prompt);
        case AI_MODELS.DOUBAO:
          return await generateWithDoubao(prompt);
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
      if (model === AI_MODELS.TONGYI) {
        return await generateSVGWithTongyi(prompt);
      }
      if (model === AI_MODELS.DOUBAO) {
        return await generateSVGWithDoubao(prompt);
      }
    }

    // 优先尝试使用通义千问
    if (hasApiKeyForModel(AI_MODELS.TONGYI)) {
      return await generateSVGWithTongyi(prompt);
    }

    // 如果没有通义千问，尝试使用豆包
    if (hasApiKeyForModel(AI_MODELS.DOUBAO)) {
      return await generateSVGWithDoubao(prompt);
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
 * 从 Iconify 搜索图标
 */
async function searchIconFromIconify(description) {
  try {
    // 从描述中提取关键词
    const searchKeywords = extractSearchKeywords(description);
    if (searchKeywords.length === 0) return [];

    // 使用第一个关键词进行搜索
    const keyword = searchKeywords[0];

    // 构造搜索 URL
    const searchUrl = `https://api.iconify.design/search?query=${encodeURIComponent(keyword)}&limit=10`;

    // 发送请求
    const response = await axios.get(searchUrl, {
      timeout: 30000,
    });

    const results = response.data?.results || [];

    // 处理结果，获取前 5 个图标
    const icons = [];
    for (const result of results.slice(0, 5)) {
      try {
        // 获取图标详情
        const iconInfo = result?.icon;
        if (!iconInfo) continue;

        // 获取图标的 SVG 代码
        const svgUrl = `https://api.iconify.design/${iconInfo.prefix}/${iconInfo.name}.svg`;
        const svgResponse = await axios.get(svgUrl, {
          timeout: 10000,
        });

        const svgContent = svgResponse.data;
        if (!svgContent) continue;

        // 清理 SVG 内容
        const cleanedSvg = cleanSvgContent(svgContent);

        // 添加到结果列表
        icons.push({
          source: `Iconify (${iconInfo.prefix})`,
          name: iconInfo.name,
          svg: svgContent,
          rawSvg: cleanedSvg,
        });

        // 如果已经有 5 个图标，停止
        if (icons.length >= 5) break;
      } catch (error) {
        // 单个图标获取失败，继续处理下一个
        continue;
      }
    }

    return icons;
  } catch (error) {
    // 搜索失败，返回空数组
    return [];
  }
}

/**
 * 从图标库查询图标（作为备用方案）
 * @param {string} description - 图标描述
 * @param {string} style - 图标风格
 * @param {boolean} returnAll - 是否返回所有匹配的图标（默认为false，只返回第一个）
 * @returns {Promise<Array|string|null>} 如果returnAll为true，返回图标对象数组；否则返回第一个图标的SVG字符串
 */
async function searchIconFromLibrary(description, style, returnAll = false) {
  try {
    // 从描述中提取关键词用于搜索
    const searchKeywords = extractSearchKeywords(description);

    if (searchKeywords.length === 0) {
      // logger.warn('No search keywords extracted from description', { description });
      return returnAll ? [] : null;
    }

    // 根据 style 决定搜索哪些图标库
    let allIcons = [];

    if (!style || style === 'default') {
      // 两者都搜索
      for (const keyword of searchKeywords) {
        const elementPlusIcons = await getElementPlusIcons(keyword, true); // 强制使用本地 Element Plus 图标
        const antDesignIcons = await getAntDesignIcons(keyword, undefined, true); // 强制使用本地 Ant Design 图标
        allIcons.push(...elementPlusIcons, ...antDesignIcons);
      }
    } else if (style === 'element-plus') {
      // 只搜索 Element Plus
      for (const keyword of searchKeywords) {
        const elementPlusIcons = await getElementPlusIcons(keyword, true); // 强制使用本地 Element Plus 图标
        allIcons.push(...elementPlusIcons);
      }
    } else if (style === 'ant-design') {
      // 只搜索 Ant Design
      for (const keyword of searchKeywords) {
        const antDesignIcons = await getAntDesignIcons(keyword, undefined, true); // 强制使用本地 Ant Design 图标
        allIcons.push(...antDesignIcons);
      }
    }

    // 去重
    const uniqueIcons = Array.from(
      new Map(allIcons.map((icon) => [`${icon.source}-${icon.name}`, icon])).values()
    );

    if (uniqueIcons.length === 0) {
      // logger.info('No icons found in library', { description, style, keywords: searchKeywords });
      return returnAll ? [] : null;
    }

    if (returnAll) {
      // 返回所有匹配的图标对象
      return uniqueIcons;
    } else {
      // 返回第一个匹配的图标的 rawSvg
      // logger.info('Found icon from library', {
      //   description,
      //   style,
      //   iconName: uniqueIcons[0].name,
      //   source: uniqueIcons[0].source
      // });
      return uniqueIcons[0].rawSvg || uniqueIcons[0].svg;
    }
  } catch (error) {
    // logger.error('Failed to search icon from library', { error: error.message });
    return returnAll ? [] : null;
  }
}

/**
 * 清理 SVG 内容
 */
function cleanSvgContent(svgContent) {
  if (!svgContent) return '';

  // 移除转义符
  let cleanedSvg = svgContent.replace(/\\"/g, '"').replace(/\\'/g, "'");

  // 移除 XML 声明（如果存在）
  cleanedSvg = cleanedSvg.replace(/<\?xml[^>]*\?>/g, '').trim();

  // 移除现有的 width 和 height 属性（如果存在）
  cleanedSvg = cleanedSvg.replace(/width=["']?[^"'>\s]+["']?\s*/g, '');
  cleanedSvg = cleanedSvg.replace(/height=["']?[^"'>\s]+["']?\s*/g, '');

  // 在 svg 标签中添加固定的 width 和 height 属性（30x30像素）
  cleanedSvg = cleanedSvg.replace(/<svg([^>]*)>/, `<svg$1 width="30px" height="30px">`);

  // 确保 SVG 可以在 Markdown 中正确预览
  // 添加 style 属性确保图标居中显示
  if (!cleanedSvg.includes('style=')) {
    cleanedSvg = cleanedSvg.replace(/<svg([^>]*)>/, `<svg$1 style="display: inline-block; vertical-align: middle;">`);
  }

  // 移除可能存在的 DOCTYPE 声明
  cleanedSvg = cleanedSvg.replace(/<!DOCTYPE[^>]*>/g, '').trim();

  // 处理换行符和多余空格
  cleanedSvg = cleanedSvg
    .replace(/\n/g, '')
    .replace(/\r/g, '')
    .trim();

  return cleanedSvg;
}

/**
 * 解析用户输入，提取图标类别、数量和其他参数
 */
function parseUserInput(input) {
  // 默认值
  const result = {
    category: '',
    count: 1,
    style: 'default',
    model: null
  };

  // 将输入转换为小写
  const lowerInput = input.toLowerCase();

  // 提取数量
  const countMatch = lowerInput.match(/(\d+)个/);
  if (countMatch) {
    result.count = parseInt(countMatch[1]);
  }

  // 提取风格
  if (lowerInput.includes('element-plus') || lowerInput.includes('element plus')) {
    result.style = 'element-plus';
  } else if (lowerInput.includes('ant-design') || lowerInput.includes('ant design')) {
    result.style = 'ant-design';
  }

  // 提取模型
  if (lowerInput.includes('tongyi') || lowerInput.includes('通义')) {
    result.model = 'tongyi';
  } else if (lowerInput.includes('doubao') || lowerInput.includes('豆包')) {
    result.model = 'doubao';
  }

  // 提取类别（移除数量和其他参数）
  result.category = lowerInput
    .replace(/\d+个/g, '') // 移除数量
    .replace(/element\-?plus/g, '') // 移除风格
    .replace(/ant\-?design/g, '') // 移除风格
    .replace(/tongyi|通义|doubao|豆包/g, '') // 移除模型
    .replace(/(图标|icon)/g, '') // 移除图标字样
    .trim();

  return result;
}

/**
 * 使用AI理解大类描述并生成相关图标关键词
 */
async function generateIconKeywords(category, count = 3) {
  try {
    const prompt = `请将"${category}"这个图标类别扩展为${count}个具体的图标名称，要求：
1. 每个图标名称简洁明了
2. 直接相关于${category}
3. 只需要中文名称，不需要英文
4. 用逗号分隔
5. 不要添加任何解释

例如：
类别：办公类
输出：文件,编辑,保存,删除,新建,搜索,打印,设置,用户,菜单`;

    // 选择可用的AI模型
    const model = selectAvailableModel();
    let keywordsText = '';

    if (model === AI_MODELS.TONGYI) {
      keywordsText = await generateWithTongyi(prompt);
    } else if (model === AI_MODELS.DOUBAO) {
      keywordsText = await generateWithDoubao(prompt);
    } else {
      // 如果没有可用的AI模型，返回默认关键词
      return ['默认图标'];
    }

    // 解析生成的关键词
    const keywords = keywordsText
      .split(',')
      .map(keyword => keyword.trim())
      .filter(keyword => keyword.length > 0)
      .slice(0, count);

    return keywords;
  } catch (error) {
    console.error('生成图标关键词失败:', error);
    return ['默认图标'];
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
 * 使用豆包生成 SVG 代码
 */
async function generateSVGWithDoubao(prompt) {
  const apiKey = process.env.DOUBAO_API_KEY;
  if (!apiKey) {
    throw new Error('Doubao API key not found');
  }
  const response = await axios.post(
    'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    {
      model: 'doubao-pro',
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
  // 移除转义符
  let cleanedSvg = svgContent.replace(/\\"/g, '"').replace(/\\'/g, "'");

  // 移除 XML 声明（如果存在）
  cleanedSvg = cleanedSvg.replace(/<\?xml[^>]*\?>/g, '').trim();

  // 移除现有的 width 和 height 属性（如果存在）
  cleanedSvg = cleanedSvg.replace(/width=["']?[^"'>\s]+["']?\s*/g, '');
  cleanedSvg = cleanedSvg.replace(/height=["']?[^"'>\s]+["']?\s*/g, '');

  // 在 svg 标签中添加固定的 width 和 height 属性（30x30像素）
  cleanedSvg = cleanedSvg.replace(/<svg([^>]*)>/, `<svg$1 width="30px" height="30px">`);

  // 确保 SVG 可以在 Markdown 中正确预览
  // 添加 style 属性确保图标居中显示
  if (!cleanedSvg.includes('style=')) {
    cleanedSvg = cleanedSvg.replace(/<svg([^>]*)>/, `<svg$1 style="display: inline-block; vertical-align: middle;">`);
  }

  // 移除可能存在的 DOCTYPE 声明
  cleanedSvg = cleanedSvg.replace(/<!DOCTYPE[^>]*>/g, '').trim();

  // 处理换行符和多余空格
  cleanedSvg = cleanedSvg
    .replace(/\n/g, '')
    .replace(/\r/g, '')
    .trim();

  return cleanedSvg;
}

/**
 * 根据类别批量搜索图标
 * @param {string} category - 图标类别
 * @param {number} count - 搜索数量
 * @param {string} style - 图标风格
 * @param {string} prefix - 图标库前缀（element-plus, ant-design）
 * @param {string} format - Ant Design图标格式（outlined, filled）
 * @param {boolean} useLocal - 是否使用本地资源
 * @returns {Promise<Array>} 搜索到的图标数组
 */
async function searchIconsByCategory(category, count = 10, style = 'default', prefix = null, format = null, useLocal = false) {
  try {
    // 使用 AI 生成该类别下的具体图标关键词
    const iconKeywords = await generateIconKeywords(category, count);
    const allIcons = [];
    const usedKeywords = new Set();

    // 为每个关键词搜索图标
    for (const keyword of iconKeywords) {
      if (usedKeywords.has(keyword)) {
        continue;
      }
      usedKeywords.add(keyword);

      try {
        // 根据风格和前缀确定搜索的图标库
        let iconsFound = [];
        const searchDescription = `${category} ${keyword}`;

        // 1. 先从本地图标库搜索
        if (prefix === 'element-plus' || style === 'element-plus') {
          iconsFound = await getElementPlusIcons(keyword, useLocal);
        } else if (prefix === 'ant-design' || style === 'ant-design') {
          iconsFound = await getAntDesignIcons(keyword, format, useLocal);
        } else {
          // 搜索两个图标库
          const elementPlusIcons = await getElementPlusIcons(keyword, useLocal);
          const antDesignIcons = await getAntDesignIcons(keyword, format, useLocal);
          iconsFound = [...elementPlusIcons, ...antDesignIcons];
        }

        // 2. 如果本地图标库没有找到，尝试从 Iconify 搜索
        if (iconsFound.length === 0) {
          const iconifyIcons = await searchIconFromIconify(searchDescription);
          iconsFound = iconifyIcons.map(icon => ({
            ...icon,
            code: 0,
            description: searchDescription,
            style: style,
            model: 'iconify'
          }));
        }

        // 添加到结果列表
        allIcons.push(...iconsFound);

        // 如果已经找到足够数量的图标，停止
        if (allIcons.length >= count) {
          break;
        }
      } catch (error) {
        console.error(`搜索${keyword}图标失败:`, error);
        continue;
      }
    }

    // 去重（基于 source 和 name）
    const uniqueIcons = Array.from(new Map(allIcons.map((icon) => [`${icon.source}-${icon.name}`, icon])).values());

    // 返回指定数量的图标
    return uniqueIcons.slice(0, count);
  } catch (error) {
    console.error('批量搜索图标失败:', error);
    return [];
  }
}

module.exports = {
  generateIcon,
  searchIconsByCategory,
  AI_MODELS,
  searchIconFromLibrary,
  searchIconFromIconify,
};

