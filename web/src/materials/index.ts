/**
 * 材质系统模块
 * 
 * 导出材质工厂和所有具体材质实现
 * 
 * @module materials
 */

// 导出材质工厂
export { MaterialFactory } from './MaterialFactory'
export type { MaterialCreator, TextureLoader } from './MaterialFactory'

// 导出具体材质实现
export { createEyeClearCoatMaterial } from './EyeClearCoatMaterial'
export type { EyeClearCoatParams } from './EyeClearCoatMaterial'

export { createFireMaterial } from './FireMaterial'
export type { FireParams } from './FireMaterial'

export { createNonDirectionalMaterial } from './NonDirectionalMaterial'
export type { NonDirectionalParams } from './NonDirectionalMaterial'

export { createIkCharacterMaterial } from './IkCharacterMaterial'
export type { IkCharacterParams } from './IkCharacterMaterial'

// 导出材质注册函数
export { registerAllMaterials } from './registerMaterials'

// 导出材质参数工具函数
export {
  getFloatParameter,
  getColorParameter,
  applyUVScaleOffset,
  getUVScaleOffset,
  applyUVScaleOffsetToAll,
  getColorParameterAsColor,
  getTextureByName,
  getTextureByType,
  setupTextureWithUV,
} from './materialUtils'
