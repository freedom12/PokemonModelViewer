#!/usr/bin/env node
/**
 * gen-parsers.js - 生成所有 FlatBuffers schema 的 TypeScript 解析器
 *
 * 用法: npm run gen-parsers
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// 配置
const FLATC_PATH = path.join(__dirname, "flatc.exe");
const OUTPUT_DIR = path.join(__dirname, "..", "src", "parsers", "generated");

// 确保输出目录存在
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// 生成解析器的函数
function generateParser(schemaPath, outputDir) {
  const schemaName = path.basename(schemaPath, ".fbs");
  console.log(`生成 ${schemaName} 解析器...`);

  try {
    const command = `"${FLATC_PATH}" --ts -o "${outputDir}" "${schemaPath}"`;
    execSync(command, { stdio: "inherit" });
    console.log(`✓ ${schemaName} 解析器生成完成`);
  } catch (error) {
    console.error(`✗ ${schemaName} 解析器生成失败:`, error.message);
  }
}

// 主函数
function main() {
  console.log("开始生成所有 FlatBuffers 解析器...\n");

  // 模型相关的 schema
  const modelSchemas = [
    "model/trmdl.fbs",
    "model/trmsh.fbs",
    "model/trmbf.fbs",
    "model/trmtr.fbs",
    "model/trmmt.fbs",
    "model/trskl.fbs",
  ];

  // 动画相关的 schema
  const animationSchemas = ["animation/tracm.fbs", "animation/tranm.fbs"];
  //删除output目录
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  }
  // 生成模型解析器
  console.log("生成模型解析器:");
  modelSchemas.forEach((schema) => {
    const schemaPath = path.join(__dirname, "scheme", schema);
    const outputDir = path.join(OUTPUT_DIR);
    ensureDir(outputDir);
    generateParser(schemaPath, outputDir);
  });

  console.log("\n生成动画解析器:");
  animationSchemas.forEach((schema) => {
    const schemaPath = path.join(__dirname, "scheme", schema);
    const outputDir = path.join(OUTPUT_DIR);
    ensureDir(outputDir);
    generateParser(schemaPath, outputDir);
  });

  console.log("\n✓ 所有解析器生成完成！");
}

// 运行主函数
main();
