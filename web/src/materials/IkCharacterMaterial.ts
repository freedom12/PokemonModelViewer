/**
 * IkCharacter 材质
 * 
 * IkCharacter 是一种多层 PBR 材质，使用 LayerMaskMap 的 RGBA 通道作为四层蒙版。
 * 每一层都有独立的颜色，支持法线贴图、AO 等 PBR 特性。
 * 主要用于角色皮肤、服装等需要多层颜色混合的部位。
 * 
 * 使用 onBeforeCompile 方式修改 fragment shader，保持 vertex shader 不变（用于蒙皮动画）。
 * 
 * @module materials/IkCharacterMaterial
 * 
 * @validates 需求 4.5: 使用 onBeforeCompile 方式修改 shader，保持默认顶点 shader 不变
 * @validates 需求 4.9: 支持 IkCharacter 材质（多层 PBR）
 */

import * as THREE from 'three'
import { MaterialData } from '../core/data'
import type { MaterialCreator } from './MaterialFactory'

/**
 * IkCharacter 材质参数接口
 */
export interface IkCharacterParams {
  /** 基础颜色 */
  baseColor: THREE.Vector4;
  /** 第一层基础颜色 */
  baseColorLayer1: THREE.Vector4;
  /** 第二层基础颜色 */
  baseColorLayer2: THREE.Vector4;
  /** 第三层基础颜色 */
  baseColorLayer3: THREE.Vector4;
  /** 第四层基础颜色 */
  baseColorLayer4: THREE.Vector4;
  /** 自发光强度 */
  emissionIntensity: number;
  /** UV 缩放和偏移 */
  uvScaleOffset: THREE.Vector4;
}

/**
 * 创建 IkCharacter 材质
 * 
 * @param data - 材质数据
 * @param basePath - 纹理文件基础路径
 * @param textureMap - 已加载的纹理映射表
 * @returns THREE.MeshStandardMaterial IkCharacter 材质
 */
export const createIkCharacterMaterial: MaterialCreator = (
  data: MaterialData,
  basePath: string,
  textureMap: Map<string, THREE.Texture>
): THREE.Material => {
  // 获取纹理
  const baseColorTexture = getTextureByName(data, textureMap, 'BaseColorMap')
  const normalTexture = getTextureByName(data, textureMap, 'NormalMap')
  const occlusionTexture = getTextureByName(data, textureMap, 'OcclusionMap')
  const layerMaskTexture = getTextureByName(data, textureMap, 'LayerMaskMap')

  // 获取各层的参数
  const baseColorLayer1 = data.getColorParam('BaseColorLayer1', new THREE.Vector4(1.0, 1.0, 1.0, 1.0))
  const baseColorLayer2 = data.getColorParam('BaseColorLayer2', new THREE.Vector4(1.0, 1.0, 1.0, 1.0))
  const baseColorLayer3 = data.getColorParam('BaseColorLayer3', new THREE.Vector4(1.0, 1.0, 1.0, 1.0))
  const baseColorLayer4 = data.getColorParam('BaseColorLayer4', new THREE.Vector4(1.0, 1.0, 1.0, 1.0))

  const baseColor = data.getColorParam('BaseColor', new THREE.Vector4(1.0, 1.0, 1.0, 1.0))
  const roughness = data.getFloatParam('Roughness', 0.7)
  const metalness = data.getFloatParam('Metallic', 0.0)
  const emissionIntensity = data.getFloatParam('EmissionIntensity', 1.0)

  // 获取 UV 缩放和偏移参数
  const uvScaleOffset = data.getColorParam('UVScaleOffset', new THREE.Vector4(1.0, 1.0, 0.0, 0.0))

  // 创建 MeshStandardMaterial
  const material = new THREE.MeshStandardMaterial({
    roughness,
    metalness,
    side: THREE.DoubleSide,
    transparent: data.isTransparent,
  })

  // 设置纹理和 UV 变换
  if (baseColorTexture) {
    material.map = baseColorTexture
    baseColorTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y)
    baseColorTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w)
  }
  if (normalTexture) {
    material.normalMap = normalTexture
    normalTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y)
    normalTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w)
  }
  if (occlusionTexture) {
    material.aoMap = occlusionTexture
    material.aoMapIntensity = 1.0
    occlusionTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y)
    occlusionTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w)
  }
  if (layerMaskTexture) {
    material.userData.layerMaskMap = layerMaskTexture
    layerMaskTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y)
    layerMaskTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w)
  }

  // 存储 IkCharacter 参数
  const ikCharacterParams: IkCharacterParams = {
    baseColor,
    baseColorLayer1,
    baseColorLayer2,
    baseColorLayer3,
    baseColorLayer4,
    emissionIntensity,
    uvScaleOffset,
  }
  material.userData.ikCharacterParams = ikCharacterParams

  // 如果有 LayerMaskMap，使用 onBeforeCompile 修改 fragment shader
  if (layerMaskTexture) {
    material.onBeforeCompile = (shader) => {
      // 添加 uniforms
      shader.uniforms.layerMaskMap = { value: layerMaskTexture || null }
      shader.uniforms.baseColor = { value: baseColor }
      shader.uniforms.baseColorLayer1 = { value: baseColorLayer1 }
      shader.uniforms.baseColorLayer2 = { value: baseColorLayer2 }
      shader.uniforms.baseColorLayer3 = { value: baseColorLayer3 }
      shader.uniforms.baseColorLayer4 = { value: baseColorLayer4 }
      shader.uniforms.emissionIntensity = { value: emissionIntensity }

      // uniform 声明和 varying
      const additions = `
        uniform sampler2D layerMaskMap;
        uniform vec4 baseColor;
        uniform vec4 baseColorLayer1;
        uniform vec4 baseColorLayer2;
        uniform vec4 baseColorLayer3;
        uniform vec4 baseColorLayer4;
        uniform float emissionIntensity;
        varying vec2 vUv;
      `

      // 在 fragment shader 中添加声明
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        '#include <common>\n' + additions
      )

      // 确保 vUv 在 vertex shader 中可用
      if (!shader.vertexShader.includes('varying vec2 vUv;')) {
        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          '#include <common>\nvarying vec2 vUv;'
        )
      }

      // 修改 fragment shader 的 main 函数
      const fragmentShader = shader.fragmentShader
      const mainFunctionRegex = /void main\(\) \{([\s\S]*?)\}/
      const mainFunctionMatch = fragmentShader.match(mainFunctionRegex)

      if (mainFunctionMatch) {
        let mainFunctionBody = mainFunctionMatch[1]

        // 查找 diffuseColor 的赋值
        const diffuseColorAssignmentRegex = /(diffuseColor\s*=.*;)/
        const diffuseColorMatch = mainFunctionBody.match(diffuseColorAssignmentRegex)

        if (diffuseColorMatch) {
          // IkCharacter 多层混合逻辑
          const ikCharacterLogic = `
            // IkCharacter 多层混合逻辑
            vec4 layerMask = texture2D(layerMaskMap, vUv);
            float weight1 = layerMask.r;
            float weight2 = layerMask.g;
            float weight3 = layerMask.b;
            float weight4 = layerMask.a;

            vec4 layerColor = baseColorLayer1 * weight1 +
                             baseColorLayer2 * weight2 +
                             baseColorLayer3 * weight3 +
                             baseColorLayer4 * weight4;

            // 应用层颜色到 diffuseColor
            diffuseColor *= layerColor;
          `

          mainFunctionBody = mainFunctionBody.replace(
            diffuseColorMatch[0],
            diffuseColorMatch[0] + ikCharacterLogic
          )
        }

        shader.fragmentShader = shader.fragmentShader.replace(
          mainFunctionMatch[0],
          `void main() {${mainFunctionBody}}`
        )
      }
    }
  }

  // 设置材质名称
  material.name = data.name

  return material
}

/**
 * 根据纹理名称从材质数据中查找纹理
 * 
 * @param data - 材质数据
 * @param textureMap - 已加载的纹理映射表
 * @param textureName - 纹理名称
 * @returns 纹理对象或 null
 */
function getTextureByName(
  data: MaterialData,
  textureMap: Map<string, THREE.Texture>,
  textureName: string
): THREE.Texture | null {
  const textureRef = data.getTextureByName(textureName)
  if (textureRef) {
    return textureMap.get(textureRef.filename) || null
  }
  return null
}

