#!/usr/bin/env node
/**
 * gen-json.js - 将宝可梦模型数据转换为 JSON 格式
 *
 * 用法: node tools/gen-json.cjs [directory] <pokemon_id> [form_id] [--with-animation]
 *
 * 参数:
 *   directory: 宝可梦数据目录名 (默认: SCVI)
 *   pokemon_id: 宝可梦 ID (如 pm0001)
 *   form_id: 形态 ID (可选，如 pm0001_00_00)
 *   --with-animation: 包含动画数据 (可选)
 *
 * 示例:
 *   node tools/gen-json.cjs pm0001              # 转换 SCVI/pm0001 的默认形态（不包含动画）
 *   node tools/gen-json.cjs LZA pm0001          # 转换 LZA/pm0001 的所有形态（不包含动画）
 *   node tools/gen-json.cjs pm0001 pm0001_00_00 # 转换指定形态（不包含动画）
 *   node tools/gen-json.cjs pm0004 --with-animation # 转换 pm0004（包含动画数据）
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// 配置
const FLATC_PATH = path.join(
  __dirname,
  process.platform === "win32" ? "flatc.exe" : "flatc",
);
const SCHEMA_DIR = path.join(__dirname, "scheme", "model");
let POKEMON_DIR;
let OUTPUT_DIR;

// 模型文件类型和对应的 schema
const MODEL_FILE_TYPES = [
  { ext: "trmdl", schema: "trmdl.fbs" },
  { ext: "trmsh", schema: "trmsh.fbs" },
  { ext: "trmbf", schema: "trmbf.fbs" },
  { ext: "trmtr", schema: "trmtr.fbs" },
  { ext: "trmmt", schema: "trmmt.fbs" },
  { ext: "trskl", schema: "trskl.fbs" },
  { ext: "trpokecfg", schema: "trpokecfg.fbs" },
];

// 动画文件类型和对应的 schema
const ANIMATION_FILE_TYPES = [
  { ext: "tracm", schema: "tracm.fbs" },
  { ext: "tranm", schema: "tranm.fbs" },
];

/**
 * 确保输出目录存在
 */
function ensureOutputDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 获取宝可梦的所有形态目录
 */
function getFormDirs(pokemonId) {
  const pokemonPath = path.join(POKEMON_DIR, pokemonId);

  if (!fs.existsSync(pokemonPath)) {
    console.error(`错误: 找不到宝可梦目录 ${pokemonPath}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(pokemonPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(pokemonId))
    .map((entry) => entry.name);
}

/**
 * 转换单个文件为 JSON
 * 输出文件名保留原始扩展名，如 pm0004_00_00.trmsh -> pm0004_00_00.trmsh.json
 */
function convertToJson(
  inputFile,
  schemaFile,
  outputDir,
  schemaDir = SCHEMA_DIR,
) {
  const schemaPath = path.join(schemaDir, schemaFile);

  if (!fs.existsSync(schemaPath)) {
    console.warn(`  警告: Schema 文件不存在 ${schemaFile}`);
    return false;
  }

  if (!fs.existsSync(inputFile)) {
    return false;
  }

  try {
    const cmd = `"${FLATC_PATH}" --json --raw-binary -o "${outputDir}" -I "${SCHEMA_DIR}" "${schemaPath}" -- "${inputFile}"`;
    execSync(cmd, { stdio: "pipe" });

    // flatc 输出的文件名是去掉扩展名后加 .json
    // 我们需要重命名为保留原始扩展名的格式
    const baseName = path.basename(inputFile);
    const nameWithoutExt = baseName.substring(0, baseName.lastIndexOf("."));
    const flatcOutput = path.join(outputDir, `${nameWithoutExt}.json`);
    const desiredOutput = path.join(outputDir, `${baseName}.json`);

    if (fs.existsSync(flatcOutput) && flatcOutput !== desiredOutput) {
      fs.renameSync(flatcOutput, desiredOutput);
    }

    return true;
  } catch (error) {
    console.warn(`  警告: 转换失败 ${path.basename(inputFile)}`);
    return false;
  }
}

/**
 * 转换指定形态的所有模型文件
 */
function convertForm(pokemonId, formId, withAnimation = false) {
  const formDir = path.join(POKEMON_DIR, pokemonId, formId);
  const outputFormDir = path.join(OUTPUT_DIR, pokemonId, formId);

  if (!fs.existsSync(formDir)) {
    console.error(`错误: 找不到形态目录 ${formDir}`);
    return;
  }

  ensureOutputDir(outputFormDir);

  console.log(`\n转换形态: ${formId}`);
  console.log(`  输入目录: ${formDir}`);
  console.log(`  输出目录: ${outputFormDir}`);

  let convertedCount = 0;

  // 转换主要模型文件
  for (const { ext, schema } of MODEL_FILE_TYPES) {
    const inputFile = path.join(formDir, `${formId}.${ext}`);

    if (convertToJson(inputFile, schema, outputFormDir)) {
      console.log(`  ✓ ${formId}.${ext}`);
      convertedCount++;
    }
  }

  // 转换 LOD 文件
  for (let lod = 1; lod <= 3; lod++) {
    const lodMsh = path.join(formDir, `${formId}_lod${lod}.trmsh`);
    if (fs.existsSync(lodMsh)) {
      if (convertToJson(lodMsh, "trmsh.fbs", outputFormDir)) {
        console.log(`  ✓ ${formId}_lod${lod}.trmsh`);
        convertedCount++;
      }
    }
  }

  // 转换 rare 材质文件
  const rareTrmtr = path.join(formDir, `${formId}_rare.trmtr`);
  if (fs.existsSync(rareTrmtr)) {
    if (convertToJson(rareTrmtr, "trmtr.fbs", outputFormDir)) {
      console.log(`  ✓ ${formId}_rare.trmtr`);
      convertedCount++;
    }
  }

  // 转换动画文件
  if (withAnimation) {
    const animationSchemaDir = path.join(__dirname, "scheme", "animation");
    for (const { ext, schema } of ANIMATION_FILE_TYPES) {
      const files = fs
        .readdirSync(formDir)
        .filter((file) => file.startsWith(formId) && file.endsWith("." + ext));
      for (const file of files) {
        const inputFile = path.join(formDir, file);
        if (
          convertToJson(inputFile, schema, outputFormDir, animationSchemaDir)
        ) {
          console.log(`  ✓ ${file}`);
          convertedCount++;
        }
      }
    }
  } else {
    console.log(`  跳过动画文件转换`);
  }

  console.log(`  共转换 ${convertedCount} 个文件`);
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(
      "用法: node tools/gen-json.cjs [directory] <pokemon_id> [form_id] [--with-animation]",
    );
    console.log("");
    console.log("参数:");
    console.log("  directory: 宝可梦数据目录名 (默认: SCVI)");
    console.log("  pokemon_id: 宝可梦 ID (如 pm0001)");
    console.log("  form_id: 形态 ID (可选，如 pm0001_00_00)");
    console.log("  --with-animation: 包含动画数据 (可选)");
    console.log("");
    console.log("示例:");
    console.log(
      "  node tools/gen-json.cjs pm0001              # 转换 SCVI/pm0001 的所有形态（不包含动画）",
    );
    console.log(
      "  node tools/gen-json.cjs LZA pm0001          # 转换 LZA/pm0001 的所有形态（不包含动画）",
    );
    console.log(
      "  node tools/gen-json.cjs pm0001 pm0001_00_00 # 转换指定形态（不包含动画）",
    );
    console.log(
      "  node tools/gen-json.cjs pm0004 --with-animation # 转换 pm0004（包含动画数据）",
    );
    console.log(
      "  node tools/gen-json.cjs LZA pm0001 --with-animation # 转换 LZA/pm0001（包含动画文件）",
    );
    process.exit(0);
  }

  // 解析参数
  let pokemonDirArg = "SCVI"; // 默认
  let pokemonId = null;
  let formId = null;
  let withAnimation = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--with-animation") {
      withAnimation = true;
    } else if (!pokemonId && arg.startsWith("pm")) {
      pokemonId = arg;
    } else if (!formId && pokemonId && arg.startsWith("pm")) {
      formId = arg;
    } else if (!pokemonId && !arg.startsWith("pm") && !arg.startsWith("--")) {
      pokemonDirArg = arg;
    }
  }

  // 设置 POKEMON_DIR
  POKEMON_DIR = path.join(__dirname, "..", "..", "assets", "remote", "models", pokemonDirArg);
  OUTPUT_DIR = path.join(__dirname, "json_output", pokemonDirArg);

  if (!pokemonId) {
    console.log(
      "用法: node tools/gen-json.cjs [directory] <pokemon_id> [form_id] [--with-animation]",
    );
    process.exit(1);
  }

  // 检查 flatc 是否存在
  if (!fs.existsSync(FLATC_PATH)) {
    console.error(`错误: 找不到 flatc.exe: ${FLATC_PATH}`);
    process.exit(1);
  }

  console.log("=".repeat(50));
  console.log("宝可梦模型数据 JSON 转换工具");
  console.log("=".repeat(50));

  ensureOutputDir(OUTPUT_DIR);

  if (formId) {
    // 转换指定形态
    convertForm(pokemonId, formId, withAnimation);
  } else {
    // 转换所有形态
    const forms = getFormDirs(pokemonId);

    if (forms.length === 0) {
      console.error(`错误: 找不到 ${pokemonId} 的任何形态`);
      process.exit(1);
    }

    console.log(`找到 ${forms.length} 个形态: ${forms.join(", ")}`);

    for (const form of forms) {
      convertForm(pokemonId, form, withAnimation);
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log("转换完成！");
  console.log(`输出目录: ${OUTPUT_DIR}`);
  console.log("=".repeat(50));
}

main();
