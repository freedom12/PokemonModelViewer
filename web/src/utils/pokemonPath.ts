/**
 * 宝可梦目录路径解析工具模块
 *
 * 用于解析宝可梦目录结构中的各种命名格式
 *
 * 目录结构示例:
 * public/SCVI/
 * ├── pm0001/                    # 宝可梦类型目录 (pm{XXXX})
 * │   ├── pm0001_00_00/          # 形态目录 (pm{XXXX}_{YY}_{ZZ})
 * │   │   ├── pm0001_00_00_00.png   # 缩略图
 */

/**
 * 宝可梦 ID 解析结果
 */
export interface PokemonIdResult {
  /** 完整的宝可梦 ID，如 "pm0001" */
  id: string;
  /** 宝可梦图鉴编号，如 1 */
  number: number;
}

/**
 * 形态 ID 解析结果
 */
export interface FormIdResult {
  /** 完整的形态 ID，如 "pm0001_00_00" */
  id: string;
  /** 宝可梦图鉴编号，如 1 */
  pokemonNumber: number;
  /** 形态编号，如 0 */
  formIndex: number;
  /** 变体编号，如 0 */
  variantIndex: number;
}

/**
 * 宝可梦类型目录名正则表达式
 * 匹配格式: pm{XXXX}，其中 XXXX 为4位数字
 */
const POKEMON_ID_REGEX = /^pm(\d{4})$/

/**
 * 形态目录名正则表达式
 * 匹配格式: pm{XXXX}_{YY}_{ZZ}，其中 XXXX 为4位数字，YY 和 ZZ 为2位数字
 */
const FORM_ID_REGEX = /^pm(\d{4})_(\d{2})_(\d{2})$/

/**
 * 解析宝可梦类型目录名
 *
 * @param dirName - 目录名，如 "pm0001"
 * @returns 解析结果，如果格式不匹配则返回 null
 *
 * @example
 * parsePokemonId("pm0001") // { id: "pm0001", number: 1 }
 * parsePokemonId("pm0025") // { id: "pm0025", number: 25 }
 * parsePokemonId("invalid") // null
 *
 * @validates 需求 7.1: 识别 pm{XXXX} 格式的宝可梦类型目录
 */
export function parsePokemonId(dirName: string): PokemonIdResult | null {
  const match = dirName.match(POKEMON_ID_REGEX)

  if (!match) {
    return null
  }

  const numberStr = match[1]
  const number = parseInt(numberStr, 10)

  return {
    id: dirName,
    number,
  }
}

/**
 * 解析形态目录名
 *
 * @param dirName - 目录名，如 "pm0001_00_00"
 * @returns 解析结果，如果格式不匹配则返回 null
 *
 * @example
 * parseFormId("pm0001_00_00") // { id: "pm0001_00_00", pokemonNumber: 1, formIndex: 0, variantIndex: 0 }
 * parseFormId("pm0025_01_02") // { id: "pm0025_01_02", pokemonNumber: 25, formIndex: 1, variantIndex: 2 }
 * parseFormId("pm0001") // null (不是形态目录格式)
 *
 * @validates 需求 7.2: 识别 pm{XXXX}_{YY}_{ZZ} 格式的形态目录
 * @validates 需求 7.3: 解析形态目录时提取宝可梦编号、形态编号和变体编号
 */
export function parseFormId(dirName: string): FormIdResult | null {
  const match = dirName.match(FORM_ID_REGEX)

  if (!match) {
    return null
  }

  const pokemonNumberStr = match[1]
  const formIndexStr = match[2]
  const variantIndexStr = match[3]

  return {
    id: dirName,
    pokemonNumber: parseInt(pokemonNumberStr, 10),
    formIndex: parseInt(formIndexStr, 10),
    variantIndex: parseInt(variantIndexStr, 10),
  }
}

/**
 * 生成缩略图路径
 *
 * 根据形态 ID 生成对应的缩略图文件路径
 * 缩略图文件名格式: {formId}_00.png
 *
 * @param formId - 形态 ID，如 "pm0001_00_00"
 * @returns 缩略图路径，如 "pokemon/pm0001/pm0001_00_00/pm0001_00_00_00.png"
 *
 * @example
 * getThumbnailPath("pm0001_00_00") // "pokemon/pm0001/pm0001_00_00/pm0001_00_00_00.png"
 * getThumbnailPath("pm0025_01_02") // "pokemon/pm0025/pm0025_01_02/pm0025_01_02_00.png"
 *
 * @validates 需求 7.4: 使用目录中的缩略图（_00.png）作为列表显示图片
 */
export function getThumbnailPath(formId: string): string {
  // 从形态 ID 中提取宝可梦 ID
  // pm0001_00_00 -> pm0001
  const pokemonId = formId.substring(0, 6)

  // 构建缩略图路径
  // pokemon/{pokemonId}/{formId}/{formId}_00.png
  return `pokemon/${pokemonId}/${formId}/${formId}_00.png`
}

/**
 * 生成大尺寸缩略图路径
 *
 * 根据形态 ID 生成对应的大尺寸缩略图文件路径
 * 大尺寸缩略图文件名格式: {formId}_00_big.png
 *
 * @param formId - 形态 ID，如 "pm0001_00_00"
 * @returns 大尺寸缩略图路径，如 "pokemon/pm0001/pm0001_00_00/pm0001_00_00_00_big.png"
 *
 * @example
 * getBigThumbnailPath("pm0001_00_00") // "pokemon/pm0001/pm0001_00_00/pm0001_00_00_00_big.png"
 *
 * @validates 需求 7.4: 使用目录中的缩略图（_00_big.png）作为列表显示图片
 */
export function getBigThumbnailPath(formId: string): string {
  // 从形态 ID 中提取宝可梦 ID
  const pokemonId = formId.substring(0, 6)

  // 构建大尺寸缩略图路径
  return `pokemon/${pokemonId}/${formId}/${formId}_00_big.png`
}

/**
 * 从形态 ID 提取宝可梦 ID
 *
 * @param formId - 形态 ID，如 "pm0001_00_00"
 * @returns 宝可梦 ID，如 "pm0001"
 *
 * @example
 * getPokemonIdFromFormId("pm0001_00_00") // "pm0001"
 * getPokemonIdFromFormId("pm0025_01_02") // "pm0025"
 */
export function getPokemonIdFromFormId(formId: string): string {
  return formId.substring(0, 6)
}

/**
 * 验证是否为有效的宝可梦类型目录名
 *
 * @param dirName - 目录名
 * @returns 是否为有效的宝可梦类型目录名
 */
export function isValidPokemonId(dirName: string): boolean {
  return POKEMON_ID_REGEX.test(dirName)
}

/**
 * 验证是否为有效的形态目录名
 *
 * @param dirName - 目录名
 * @returns 是否为有效的形态目录名
 */
export function isValidFormId(dirName: string): boolean {
  return FORM_ID_REGEX.test(dirName)
}
