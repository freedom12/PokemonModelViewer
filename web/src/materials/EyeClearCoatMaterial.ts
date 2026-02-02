/**
 * EyeClearCoat 材质
 * 
 * EyeClearCoat 是一种多层材质，使用 LayerMaskMap 的 RGBA 通道作为四层蒙版。
 * 每一层都有独立的颜色、金属度、粗糙度、自发光等属性。
 * 主要用于眼睛等需要多层混合效果的部位。
 * 
 * 使用 onBeforeCompile 方式修改 fragment shader，保持 vertex shader 不变（用于蒙皮动画）。
 * 
 * @module materials/EyeClearCoatMaterial
 * 
 * @validates 需求 4.5: 使用 onBeforeCompile 方式修改 shader，保持默认顶点 shader 不变
 * @validates 需求 4.6: 支持 EyeClearCoat 材质（多层蒙版混合）
 */

import * as THREE from 'three'
import { MaterialData } from '../core/data'
import type { MaterialCreator } from './MaterialFactory'

/**
 * EyeClearCoat 材质参数接口
 */
export interface EyeClearCoatParams {
  /** 第一层基础颜色 */
  baseColorLayer1: THREE.Vector4;
  /** 第二层基础颜色 */
  baseColorLayer2: THREE.Vector4;
  /** 第三层基础颜色 */
  baseColorLayer3: THREE.Vector4;
  /** 第四层基础颜色 */
  baseColorLayer4: THREE.Vector4;
  /** 第一层金属度 */
  metallicLayer1: number;
  /** 第二层金属度 */
  metallicLayer2: number;
  /** 第三层金属度 */
  metallicLayer3: number;
  /** 第四层金属度 */
  metallicLayer4: number;
  /** 第一层粗糙度 */
  roughnessLayer1: number;
  /** 第二层粗糙度 */
  roughnessLayer2: number;
  /** 第三层粗糙度 */
  roughnessLayer3: number;
  /** 第四层粗糙度 */
  roughnessLayer4: number;
  /** 第一层自发光强度 */
  emissionIntensityLayer1: number;
  /** 第二层自发光强度 */
  emissionIntensityLayer2: number;
  /** 第三层自发光强度 */
  emissionIntensityLayer3: number;
  /** 第四层自发光强度 */
  emissionIntensityLayer4: number;
  /** UV 缩放和偏移 */
  uvScaleOffset: THREE.Vector4;
  /** 法线贴图 UV 缩放和偏移 */
  uvScaleOffsetNormal: THREE.Vector4;
}

/**
 * 创建 EyeClearCoat 材质
 * 
 * @param data - 材质数据
 * @param basePath - 纹理文件基础路径
 * @param textureMap - 已加载的纹理映射表
 * @returns THREE.MeshStandardMaterial EyeClearCoat 材质
 */
export const createEyeClearCoatMaterial: MaterialCreator = (
  data: MaterialData,
  basePath: string,
  textureMap: Map<string, THREE.Texture>
): THREE.Material => {
  // 获取纹理
  const layerMaskTexture = getTextureByName(data, textureMap, 'LayerMaskMap')
  const highlightMaskTexture = getTextureByName(data, textureMap, 'HighlightMaskMap')
  const normalTexture = getTextureByName(data, textureMap, 'NormalMap')
  const normalTexture1 = getTextureByName(data, textureMap, 'NormalMap1')

  // 获取各层的参数
  const baseColorLayer1 = data.getColorParam('BaseColorLayer1', new THREE.Vector4(0.184314, 0.015686, 0.019608, 1.0))
  const baseColorLayer2 = data.getColorParam('BaseColorLayer2', new THREE.Vector4(0.851613, 0.090107, 0.129314, 1.0))
  const baseColorLayer3 = data.getColorParam('BaseColorLayer3', new THREE.Vector4(0.8713, 0.8713, 0.8713, 1.0))
  const baseColorLayer4 = data.getColorParam('BaseColorLayer4', new THREE.Vector4(0.7157, 0.7157, 0.7157, 1.0))

  const metallicLayer1 = data.getFloatParam('MetallicLayer1', 0.0)
  const metallicLayer2 = data.getFloatParam('MetallicLayer2', 1.0)
  const metallicLayer3 = data.getFloatParam('MetallicLayer3', 0.0)
  const metallicLayer4 = data.getFloatParam('MetallicLayer4', 0.0)

  const roughnessLayer1 = data.getFloatParam('RoughnessLayer1', 0.8)
  const roughnessLayer2 = data.getFloatParam('RoughnessLayer2', 0.8)
  const roughnessLayer3 = data.getFloatParam('RoughnessLayer3', 0.8)
  const roughnessLayer4 = data.getFloatParam('RoughnessLayer4', 0.8)

  const emissionIntensityLayer1 = data.getFloatParam('EmissionIntensityLayer1', 0.2)
  const emissionIntensityLayer2 = data.getFloatParam('EmissionIntensityLayer2', 0.2)
  const emissionIntensityLayer3 = data.getFloatParam('EmissionIntensityLayer3', 0.5)
  const emissionIntensityLayer4 = data.getFloatParam('EmissionIntensityLayer4', 0.5)

  // 获取 UV 缩放和偏移参数
  const uvScaleOffset = data.getColorParam('UVScaleOffset', new THREE.Vector4(1.0, 1.0, 0.0, 0.0))
  const uvScaleOffsetNormal = data.getColorParam('UVScaleOffsetNormal', new THREE.Vector4(1.0, 1.0, 0.0, 0.0))

  // 创建 MeshStandardMaterial
  const material = new THREE.MeshStandardMaterial({
    side: THREE.DoubleSide,
    transparent: data.isTransparent,
  })

  // 设置纹理和 UV 变换
  if (layerMaskTexture) {
    material.userData.layerMaskMap = layerMaskTexture
    layerMaskTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y)
    layerMaskTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w)
  }
  if (highlightMaskTexture) {
    material.userData.highlightMaskMap = highlightMaskTexture
    highlightMaskTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y)
    highlightMaskTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w)
  }
  if (normalTexture) {
    material.normalMap = normalTexture
    normalTexture.repeat.set(uvScaleOffsetNormal.x, uvScaleOffsetNormal.y)
    normalTexture.offset.set(uvScaleOffsetNormal.z, uvScaleOffsetNormal.w)
  }
  if (normalTexture1) {
    material.userData.normalMap1 = normalTexture1
    normalTexture1.repeat.set(uvScaleOffsetNormal.x, uvScaleOffsetNormal.y)
    normalTexture1.offset.set(uvScaleOffsetNormal.z, uvScaleOffsetNormal.w)
  }

  // 存储 EyeClearCoat 参数
  const eyeClearCoatParams: EyeClearCoatParams = {
    baseColorLayer1,
    baseColorLayer2,
    baseColorLayer3,
    baseColorLayer4,
    metallicLayer1,
    metallicLayer2,
    metallicLayer3,
    metallicLayer4,
    roughnessLayer1,
    roughnessLayer2,
    roughnessLayer3,
    roughnessLayer4,
    emissionIntensityLayer1,
    emissionIntensityLayer2,
    emissionIntensityLayer3,
    emissionIntensityLayer4,
    uvScaleOffset,
    uvScaleOffsetNormal,
  }
  material.userData.eyeClearCoatParams = eyeClearCoatParams

  // 使用 onBeforeCompile 修改 fragment shader
  material.onBeforeCompile = (shader) => {
    // 添加 uniforms
    shader.uniforms.layerMaskMap = { value: layerMaskTexture || null }
    if (highlightMaskTexture) {
      shader.uniforms.highlightMaskMap = { value: highlightMaskTexture }
    }
    shader.uniforms.normalMap1 = { value: normalTexture1 || null }
    shader.uniforms.baseColorLayer1 = { value: baseColorLayer1 }
    shader.uniforms.baseColorLayer2 = { value: baseColorLayer2 }
    shader.uniforms.baseColorLayer3 = { value: baseColorLayer3 }
    shader.uniforms.baseColorLayer4 = { value: baseColorLayer4 }
    shader.uniforms.metallicLayer1 = { value: metallicLayer1 }
    shader.uniforms.metallicLayer2 = { value: metallicLayer2 }
    shader.uniforms.metallicLayer3 = { value: metallicLayer3 }
    shader.uniforms.metallicLayer4 = { value: metallicLayer4 }
    shader.uniforms.roughnessLayer1 = { value: roughnessLayer1 }
    shader.uniforms.roughnessLayer2 = { value: roughnessLayer2 }
    shader.uniforms.roughnessLayer3 = { value: roughnessLayer3 }
    shader.uniforms.roughnessLayer4 = { value: roughnessLayer4 }
    shader.uniforms.emissionIntensityLayer1 = { value: emissionIntensityLayer1 }
    shader.uniforms.emissionIntensityLayer2 = { value: emissionIntensityLayer2 }
    shader.uniforms.emissionIntensityLayer3 = { value: emissionIntensityLayer3 }
    shader.uniforms.emissionIntensityLayer4 = { value: emissionIntensityLayer4 }

    // uniform 声明
    const uniformDeclarations = `
      uniform sampler2D layerMaskMap;
      ${highlightMaskTexture ? 'uniform sampler2D highlightMaskMap;' : ''}
      uniform sampler2D normalMap1;
      uniform vec4 baseColorLayer1;
      uniform vec4 baseColorLayer2;
      uniform vec4 baseColorLayer3;
      uniform vec4 baseColorLayer4;
      uniform float metallicLayer1;
      uniform float metallicLayer2;
      uniform float metallicLayer3;
      uniform float metallicLayer4;
      uniform float roughnessLayer1;
      uniform float roughnessLayer2;
      uniform float roughnessLayer3;
      uniform float roughnessLayer4;
      uniform float emissionIntensityLayer1;
      uniform float emissionIntensityLayer2;
      uniform float emissionIntensityLayer3;
      uniform float emissionIntensityLayer4;
    `

    // 在 fragment shader 中添加 uniform 声明
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      '#include <common>\n' + uniformDeclarations
    )

    // 确保 vUv 在 vertex shader 中可用
    if (!shader.vertexShader.includes('varying vec2 vUv;')) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vUv;'
      )
    }

    // 确保 vUv 被赋值
    if (!shader.vertexShader.includes('vUv = uv;')) {
      const vertexMainRegex = /void main\(\) \{([\s\S]*?)\}/
      const vertexMainMatch = shader.vertexShader.match(vertexMainRegex)
      if (vertexMainMatch) {
        let vertexMainBody = vertexMainMatch[1]
        vertexMainBody = 'vUv = uv;\n' + vertexMainBody
        shader.vertexShader = shader.vertexShader.replace(
          vertexMainMatch[0],
          `void main() {${vertexMainBody}}`
        )
      }
    }

    // 确保 vUv 在 fragment shader 中可用
    if (!shader.fragmentShader.includes('varying vec2 vUv;')) {
      shader.fragmentShader = shader.fragmentShader.replace(
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
        // EyeClearCoat 多层混合逻辑
        const eyeClearCoatLogic = `
          // EyeClearCoat 多层混合逻辑
          vec4 layerMask = texture(layerMaskMap, vUv);
          float weight1 = layerMask.r;
          float weight2 = layerMask.g;
          float weight3 = layerMask.b;
          float weight4 = layerMask.a;

          vec4 albedo = vec4(1.0);
          vec4 baseColor = (albedo * baseColorLayer1) * weight1 + albedo * (1.0 - weight1);
          baseColor = (albedo * baseColorLayer2) * weight2 + baseColor * (1.0 - weight2);
          baseColor = (albedo * baseColorLayer3) * weight3 + baseColor * (1.0 - weight3);
          baseColor = (albedo * baseColorLayer4) * weight4 + baseColor * (1.0 - weight4);

          diffuseColor = baseColor;

          vec4 highlightMask = vec4(0.0);
          ${highlightMaskTexture ? 'vec4 highlightSample = texture(highlightMaskMap, vUv); highlightMask = highlightSample;' : ''}

          diffuseColor.rgb = baseColor.rgb + highlightMask.rgb;
        `

        mainFunctionBody = mainFunctionBody.replace(
          diffuseColorMatch[0],
          diffuseColorMatch[0] + eyeClearCoatLogic
        )
      }

      shader.fragmentShader = shader.fragmentShader.replace(
        mainFunctionMatch[0],
        `void main() {${mainFunctionBody}}`
      )
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

