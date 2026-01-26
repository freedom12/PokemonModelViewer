/**
 * 纹理类型映射工具模块
 * 
 * 用于根据纹理文件名后缀识别纹理类型，并映射到 Three.js 材质属性
 * 
 * 纹理类型映射表:
 * | 后缀   | 纹理类型              | Three.js 属性  |
 * |--------|----------------------|----------------|
 * | _alb   | Albedo/Diffuse       | map            |
 * | _nrm   | Normal               | normalMap      |
 * | _lym   | Emission/Luminance   | emissiveMap    |
 * | _ao    | Ambient Occlusion    | aoMap          |
 * | _msk   | Mask                 | alphaMap       |
 * | _rgn   | Region               | (自定义)       |
 */

/**
 * 纹理类型枚举
 */
export type TextureType = 
  | 'albedo'    // 漫反射贴图
  | 'normal'    // 法线贴图
  | 'emission'  // 自发光贴图
  | 'ao'        // 环境光遮蔽贴图
  | 'mask'      // 遮罩贴图
  | 'region'    // 区域贴图（自定义）
  | 'unknown'   // 未知类型

/**
 * Three.js 材质属性名
 */
export type MaterialPropertyName = 
  | 'map'           // 漫反射贴图
  | 'normalMap'     // 法线贴图
  | 'emissiveMap'   // 自发光贴图
  | 'aoMap'         // 环境光遮蔽贴图
  | 'alphaMap'      // 透明度贴图
  | null            // 无对应属性（如 region 或 unknown）

/**
 * 纹理后缀到类型的映射
 */
const TEXTURE_SUFFIX_MAP: Record<string, TextureType> = {
  '_alb': 'albedo',
  '_nrm': 'normal',
  '_lym': 'emission',
  '_ao': 'ao',
  '_msk': 'mask',
  '_rgn': 'region'
}

/**
 * 纹理类型到 Three.js 材质属性的映射
 */
const TEXTURE_TYPE_TO_PROPERTY: Record<TextureType, MaterialPropertyName> = {
  'albedo': 'map',
  'normal': 'normalMap',
  'emission': 'emissiveMap',
  'ao': 'aoMap',
  'mask': 'alphaMap',
  'region': null,
  'unknown': null
}

/**
 * 所有支持的纹理后缀列表
 */
export const TEXTURE_SUFFIXES = Object.keys(TEXTURE_SUFFIX_MAP)

/**
 * 根据文件名后缀获取纹理类型
 * 
 * 从文件名中提取后缀（如 _alb、_nrm 等），并返回对应的纹理类型
 * 
 * @param filename - 纹理文件名，如 "pm0001_00_00_alb.png"
 * @returns 纹理类型，如果无法识别则返回 'unknown'
 * 
 * @example
 * getTextureType("pm0001_00_00_alb.png") // 'albedo'
 * getTextureType("pm0001_00_00_nrm.png") // 'normal'
 * getTextureType("pm0001_00_00_lym.png") // 'emission'
 * getTextureType("pm0001_00_00_ao.png")  // 'ao'
 * getTextureType("pm0001_00_00_msk.png") // 'mask'
 * getTextureType("pm0001_00_00_rgn.png") // 'region'
 * getTextureType("pm0001_00_00.png")     // 'unknown'
 * 
 * @validates 需求 4.3: 材质包含 albedo（_alb）纹理时，将其应用为漫反射贴图
 * @validates 需求 4.4: 材质包含 normal（_nrm）纹理时，将其应用为法线贴图
 * @validates 需求 4.5: 材质包含 emission（_lym）纹理时，将其应用为自发光贴图
 */
export function getTextureType(filename: string): TextureType {
  // 移除文件扩展名以便分析
  // 例如: "pm0001_00_00_alb.png" -> "pm0001_00_00_alb"
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '')
  
  // 检查每个已知的纹理后缀
  for (const suffix of TEXTURE_SUFFIXES) {
    if (nameWithoutExt.endsWith(suffix)) {
      return TEXTURE_SUFFIX_MAP[suffix]
    }
  }
  
  return 'unknown'
}

/**
 * 将纹理类型映射到 Three.js 材质属性名
 * 
 * @param textureType - 纹理类型
 * @returns Three.js 材质属性名，如果无对应属性则返回 null
 * 
 * @example
 * mapToMaterialProperty('albedo')   // 'map'
 * mapToMaterialProperty('normal')   // 'normalMap'
 * mapToMaterialProperty('emission') // 'emissiveMap'
 * mapToMaterialProperty('ao')       // 'aoMap'
 * mapToMaterialProperty('mask')     // 'alphaMap'
 * mapToMaterialProperty('region')   // null
 * mapToMaterialProperty('unknown')  // null
 * 
 * @validates 需求 4.3: 材质包含 albedo（_alb）纹理时，将其应用为漫反射贴图
 * @validates 需求 4.4: 材质包含 normal（_nrm）纹理时，将其应用为法线贴图
 * @validates 需求 4.5: 材质包含 emission（_lym）纹理时，将其应用为自发光贴图
 */
export function mapToMaterialProperty(textureType: TextureType): MaterialPropertyName {
  return TEXTURE_TYPE_TO_PROPERTY[textureType]
}

/**
 * 便捷函数：直接从文件名获取 Three.js 材质属性名
 * 
 * 组合 getTextureType 和 mapToMaterialProperty 的功能
 * 
 * @param filename - 纹理文件名
 * @returns Three.js 材质属性名，如果无对应属性则返回 null
 * 
 * @example
 * getPropertyFromFilename("pm0001_00_00_alb.png") // 'map'
 * getPropertyFromFilename("pm0001_00_00_nrm.png") // 'normalMap'
 * getPropertyFromFilename("pm0001_00_00_lym.png") // 'emissiveMap'
 */
export function getPropertyFromFilename(filename: string): MaterialPropertyName {
  const textureType = getTextureType(filename)
  return mapToMaterialProperty(textureType)
}

/**
 * 检查文件名是否为已知的纹理类型
 * 
 * @param filename - 纹理文件名
 * @returns 是否为已知的纹理类型
 * 
 * @example
 * isKnownTextureType("pm0001_00_00_alb.png") // true
 * isKnownTextureType("pm0001_00_00.png")     // false
 */
export function isKnownTextureType(filename: string): boolean {
  return getTextureType(filename) !== 'unknown'
}

/**
 * 检查纹理类型是否有对应的 Three.js 材质属性
 * 
 * @param textureType - 纹理类型
 * @returns 是否有对应的材质属性
 * 
 * @example
 * hasMaterialProperty('albedo')  // true
 * hasMaterialProperty('region')  // false
 * hasMaterialProperty('unknown') // false
 */
export function hasMaterialProperty(textureType: TextureType): boolean {
  return mapToMaterialProperty(textureType) !== null
}
