#!/usr/bin/env node
/**
 * generate-index.js - 根据 public/pokemon 目录结构生成 index.json 配置
 *
 * 用法: npm run generate-index
 *
 * 这个脚本会：
 * 1. 扫描 public/pokemon 目录下的所有 pmXXXX 文件夹
 * 2. 解析每个宝可梦的形态文件夹 (pmXXXX_YY_ZZ)
 * 3. 生成 index.json 配置文件
 */

const fs = require('fs');
const path = require('path');

// 配置
const POKEMON_DIR = path.join(__dirname, '..', 'public', 'pokemon');
const INDEX_FILE = path.join(POKEMON_DIR, 'index.json');

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
宝可梦索引生成器

用法: npm run generate-index

这个脚本会自动扫描 public/pokemon 目录结构并生成 index.json 配置文件。

目录结构要求：
- 宝可梦文件夹: pmXXXX (如 pm0001, pm0002)
- 形态文件夹: pmXXXX_YY_ZZ (如 pm0001_00_00, pm0003_01_00)

生成的 index.json 包含：
- id: 宝可梦ID (pmXXXX)
- number: 图鉴编号 (XXXX)
- forms: 形态列表，每个形态包含 formIndex、variantIndex 和 animations (动画名到文件列表的映射)
`);
}

/**
 * 解析宝可梦 ID (pmXXXX -> XXXX)
 */
function parsePokemonId(dirName) {
  const match = dirName.match(/^pm(\d{4})$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * 解析形态 ID (pmXXXX_YY_ZZ -> {formIndex: YY, variantIndex: ZZ})
 */
function parseFormId(dirName) {
  const match = dirName.match(/^pm\d{4}_(\d{2})_(\d{2})$/);
  if (!match) return null;

  return {
    formIndex: parseInt(match[1], 10),
    variantIndex: parseInt(match[2], 10)
  };
}

/**
 * 获取形态文件夹中的动画文件
 */
function getAnimationFiles(formPath) {
  const animations = {};

  try {
    const entries = fs.readdirSync(formPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && (entry.name.endsWith('.tranm') || entry.name.endsWith('.tracm'))) {
        // 提取动画名：去掉前缀 pmXXXX_YY_ZZ_ 和后缀 .tranm/.tracm
        const animationName = entry.name.replace(/^pm\d{4}_\d{2}_\d{2}_/, '').replace(/\.(tranm|tracm)$/, '');
        
        if (!animations[animationName]) {
          animations[animationName] = [];
        }
        animations[animationName].push(entry.name);
      }
    }
  } catch (error) {
    console.warn(`警告: 读取 ${formPath} 失败:`, error.message);
  }

  return animations;
}

/**
 * 获取宝可梦的所有形态
 */
function getPokemonForms(pokemonId, pokemonPath) {
  const forms = [];

  try {
    const entries = fs.readdirSync(pokemonPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const formId = entry.name;
      const formInfo = parseFormId(formId);

      if (formInfo) {
        const formPath = path.join(pokemonPath, formId);
        const animations = getAnimationFiles(formPath);

        forms.push({
          id: formId,
          formIndex: formInfo.formIndex,
          variantIndex: formInfo.variantIndex,
          animations: animations
        });
      }
    }
  } catch (error) {
    console.warn(`警告: 读取 ${pokemonPath} 失败:`, error.message);
  }

  // 按形态索引和变体索引排序
  return forms.sort((a, b) => {
    if (a.formIndex !== b.formIndex) {
      return a.formIndex - b.formIndex;
    }
    return a.variantIndex - b.variantIndex;
  });
}

/**
 * 生成 index.json
 */
function generateIndex() {
  console.log('🔍 开始扫描宝可梦目录...\n');

  if (!fs.existsSync(POKEMON_DIR)) {
    console.error(`❌ 错误: 找不到宝可梦目录 ${POKEMON_DIR}`);
    process.exit(1);
  }

  const pokemons = [];
  const entries = fs.readdirSync(POKEMON_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const pokemonId = entry.name;
    const number = parsePokemonId(pokemonId);

    if (number === null) {
      // 跳过不是 pmXXXX 格式的目录
      continue;
    }

    const pokemonPath = path.join(POKEMON_DIR, pokemonId);
    const forms = getPokemonForms(pokemonId, pokemonPath);

    if (forms.length === 0) {
      console.warn(`⚠️  警告: ${pokemonId} 没有找到有效的形态文件夹`);
      continue;
    }

    pokemons.push({
      id: pokemonId,
      number: number,
      forms: forms
    });

    console.log(`✅ 发现宝可梦: ${pokemonId} (编号: ${number}, 形态数: ${forms.length})`);
  }

  if (pokemons.length === 0) {
    console.error('❌ 错误: 没有找到任何有效的宝可梦数据');
    process.exit(1);
  }

  // 按宝可梦编号排序
  pokemons.sort((a, b) => a.number - b.number);

  const indexData = {
    pokemons: pokemons
  };

  // 写入 index.json
  fs.writeFileSync(INDEX_FILE, JSON.stringify(indexData, null, 2), 'utf8');

  console.log(`\n🎉 生成完成!`);
  console.log(`📊 共发现 ${pokemons.length} 个宝可梦`);
  console.log(`💾 配置文件已保存到: ${INDEX_FILE}`);
}

// 主函数
if (require.main === module) {
  // 检查命令行参数
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  try {
    generateIndex();
  } catch (error) {
    console.error('❌ 生成失败:', error.message);
    console.error('\n运行 npm run generate-index -- --help 查看帮助信息');
    process.exit(1);
  }
}

module.exports = { generateIndex };