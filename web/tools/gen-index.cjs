#!/usr/bin/env node
/**
 * generate-index.js - 根据 public/[directory] 目录结构生成 index.json 配置
 *
 * 用法: node tools/gen-index.cjs [directory]
 *
 * 参数:
 *   directory: 宝可梦数据目录名 (默认: SCVI)
 *
 * 这个脚本会：
 * 1. 扫描 public/[directory] 目录下的所有 pmXXXX 文件夹
 * 2. 解析每个宝可梦的形态文件夹 (pmXXXX_YY_ZZ)
 * 3. 生成 index.json 配置文件
 */

const fs = require('fs');
const path = require('path');

// 配置
const args = process.argv.slice(2);
const targetDir = args.length > 0 && !args[0].startsWith('--') ? args[0] : 'SCVI';
const POKEMON_DIR = path.join(__dirname, '..', 'public', targetDir);
const INDEX_FILE = path.join(POKEMON_DIR, 'index.json');

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
宝可梦索引生成器

用法: node tools/gen-index.cjs [directory]

参数:
  directory: 宝可梦数据目录名 (默认: SCVI)

这个脚本会自动扫描 public/[directory] 目录结构并生成 index.json 配置文件。

目录结构要求：
- 宝可梦文件夹: pmXXXX (如 pm0001, pm0002)
- 形态文件夹: pmXXXX_YY_ZZ (如 pm0001_00_00, pm0003_01_00)

生成的配置文件：
- 外层 index.json: 包含 pokemonIds 列表
- 每个 pmXXXX/index.json: 包含该宝可梦的详细信息 (id, number, forms 等)
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
  console.log(`扫描形态目录: ${formPath}`);

  function scanDir(dirPath) {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          scanDir(path.join(dirPath, entry.name));
        } else if (entry.isFile() && (entry.name.endsWith('.tranm') || entry.name.endsWith('.tracm'))) {
          console.log(`Found animation file: ${entry.name} in ${dirPath}`);
          // 提取动画名：去掉前缀 pmXXXX_YY_ZZ_ 和后缀 .tranm/.tracm
          const animationName = entry.name.replace(/^pm\d{4}_\d{2}_\d{2}_/, '').replace(/\.(tranm|tracm)$/, '');
          
          if (!animations[animationName]) {
            animations[animationName] = [];
          }
          animations[animationName].push(path.relative(formPath, path.join(dirPath, entry.name)));
        }
      }
    } catch (error) {
      console.warn(`警告: 读取 ${dirPath} 失败:`, error.message);
    }
  }

  scanDir(formPath);
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

        // 查找实际存在的icon文件
        let iconPath = null;
        const iconDir = path.join(formPath, 'icon');
        if (fs.existsSync(iconDir)) {
          try {
            const iconFiles = fs.readdirSync(iconDir);
            // 优先选择_big.png文件，如果没有则选择第一个.png文件
            const bigIcon = iconFiles.find(f => f.endsWith('_big.png'));
            if (bigIcon) {
              iconPath = `icon/${bigIcon}`;
            } else {
              const pngFile = iconFiles.find(f => f.endsWith('.png'));
              if (pngFile) {
                iconPath = `icon/${pngFile}`;
              }
            }
          } catch (error) {
            console.warn(`警告: 读取icon目录失败 ${iconDir}:`, error.message);
          }
        }

        // 如果找不到icon文件，使用默认路径
        if (!iconPath) {
          iconPath = `icon/${pokemonId}_${formInfo.formIndex.toString().padStart(2,'0')}_${formInfo.variantIndex.toString().padStart(2,'0')}_00_big.png`;
          console.warn(`⚠️  警告: ${formId} 找不到icon文件，使用默认路径: ${iconPath}`);
        }

        forms.push({
          id: formId,
          formIndex: formInfo.formIndex,
          variantIndex: formInfo.variantIndex,
          icon: iconPath,
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

  const pokemonIds = [];
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

    // 生成每个宝可梦的 index.json
    const pokemonData = {
      id: pokemonId,
      number: number,
      forms: forms
    };

    const pokemonIndexFile = path.join(pokemonPath, 'index.json');
    fs.writeFileSync(pokemonIndexFile, JSON.stringify(pokemonData, null, 2), 'utf8');

    pokemonIds.push(pokemonId);

    console.log(`✅ 发现宝可梦: ${pokemonId} (编号: ${number}, 形态数: ${forms.length})`);
    console.log(`💾 生成: ${pokemonIndexFile}`);
  }

  if (pokemonIds.length === 0) {
    console.error('❌ 错误: 没有找到任何有效的宝可梦数据');
    process.exit(1);
  }

  // 按宝可梦编号排序
  pokemonIds.sort((a, b) => parsePokemonId(a) - parsePokemonId(b));

  // 收集所有宝可梦的详细信息
  const allPokemonData = [];
  for (const pokemonId of pokemonIds) {
    const pokemonPath = path.join(POKEMON_DIR, pokemonId);
    const pokemonIndexFile = path.join(pokemonPath, 'index.json');
    
    if (fs.existsSync(pokemonIndexFile)) {
      try {
        const pokemonData = JSON.parse(fs.readFileSync(pokemonIndexFile, 'utf8'));
        allPokemonData.push(pokemonData);
      } catch (error) {
        console.warn(`⚠️  警告: 无法读取 ${pokemonIndexFile}: ${error.message}`);
      }
    }
  }

  const indexData = {
    pokemonIds: pokemonIds
  };

  // 写入外层 index.json
  fs.writeFileSync(INDEX_FILE, JSON.stringify(indexData, null, 2), 'utf8');

  console.log(`\n🎉 生成完成!`);
  console.log(`📊 共发现 ${pokemonIds.length} 个宝可梦`);
  console.log(`💾 外层配置文件已保存到: ${INDEX_FILE}`);
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