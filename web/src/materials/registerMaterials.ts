/**
 * 材质注册模块
 *
 * 提供统一的材质注册函数，将所有具体材质创建器注册到 MaterialFactory。
 *
 * @module materials/registerMaterials
 */

import { MaterialFactory } from './MaterialFactory';
import { createEyeClearCoatMaterial } from './EyeClearCoatMaterial';
import { createFireMaterial } from './FireMaterial';
import { createNonDirectionalMaterial } from './NonDirectionalMaterial';
import { createIkCharacterMaterial } from './IkCharacterMaterial';

/**
 * 注册所有具体材质创建器到 MaterialFactory
 *
 * 应在应用初始化时调用此函数，以确保所有材质类型都能被正确创建。
 *
 * @example
 * ```typescript
 * import { registerAllMaterials } from './materials';
 *
 * // 在应用启动时注册所有材质
 * registerAllMaterials();
 *
 * // 之后可以使用 MaterialFactory 创建任何已注册的材质
 * const material = await MaterialFactory.create(materialData, basePath);
 * ```
 */
export function registerAllMaterials(): void {
  // 注册 EyeClearCoat 材质（眼睛多层混合）
  // 支持 'EyeClearCoat' 和 'Eye' 两种 shader 名称
  MaterialFactory.register('EyeClearCoat', createEyeClearCoatMaterial);
  MaterialFactory.register('Eye', createEyeClearCoatMaterial);

  // 注册 Fire/Unlit 材质（自发光多层混合）
  MaterialFactory.register('Unlit', createFireMaterial);
  MaterialFactory.register('Fire', createFireMaterial);

  // 注册 NonDirectional 材质（烟雾效果）
  MaterialFactory.register('NonDirectional', createNonDirectionalMaterial);

  // 注册 IkCharacter 材质（多层 PBR）
  MaterialFactory.register('IkCharacter', createIkCharacterMaterial);
}

/**
 * 检查是否已注册所有材质
 *
 * @returns 是否所有预期的材质都已注册
 */
export function isAllMaterialsRegistered(): boolean {
  const expectedShaders = [
    'EyeClearCoat',
    'Eye',
    'Unlit',
    'Fire',
    'NonDirectional',
    'IkCharacter',
  ];

  return expectedShaders.every((shader) => MaterialFactory.isRegistered(shader));
}
