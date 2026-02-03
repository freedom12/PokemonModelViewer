/**
 * Fire/Unlit 材质
 *
 * Fire 是一种 Unlit 多层材质，使用 LayerMaskMap 的 RGBA 通道作为四层蒙版。
 * 每一层都有独立的颜色，支持位移贴图（但在 fragment 中不处理以保证顶点动画正常）。
 * 主要用于火焰、光效等自发光效果。
 *
 * 使用 onBeforeCompile 方式修改 fragment shader，保持 vertex shader 不变（用于蒙皮动画）。
 *
 * @module materials/FireMaterial
 *
 * @validates 需求 4.5: 使用 onBeforeCompile 方式修改 shader，保持默认顶点 shader 不变
 * @validates 需求 4.7: 支持 Fire/Unlit 材质（自发光多层混合）
 */

import * as THREE from 'three';
import { MaterialData } from '../core/data';
import type { MaterialCreator } from './MaterialFactory';

/**
 * Fire 材质参数接口
 */
export interface FireParams {
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
 * 创建 Fire/Unlit 材质
 *
 * @param data - 材质数据
 * @param basePath - 纹理文件基础路径
 * @param textureMap - 已加载的纹理映射表
 * @returns THREE.MeshBasicMaterial Fire 材质
 */
export const createFireMaterial: MaterialCreator = (
  data: MaterialData,
  basePath: string,
  textureMap: Map<string, THREE.Texture>
): THREE.Material => {
  // 获取纹理
  const baseColorTexture = getTextureByName(data, textureMap, 'BaseColorMap');
  const layerMaskTexture = getTextureByName(data, textureMap, 'LayerMaskMap');
  const displacementTexture = getTextureByName(data, textureMap, 'DisplacementMap');

  // 获取各层的参数
  const baseColorLayer1 = data.getColorParam(
    'BaseColorLayer1',
    new THREE.Vector4(5.0, 0.075, 0.0295, 1.0)
  );
  const baseColorLayer2 = data.getColorParam(
    'BaseColorLayer2',
    new THREE.Vector4(4.0, 0.8, 0.18, 1.0)
  );
  const baseColorLayer3 = data.getColorParam(
    'BaseColorLayer3',
    new THREE.Vector4(1.0, 1.0, 1.0, 1.0)
  );
  const baseColorLayer4 = data.getColorParam(
    'BaseColorLayer4',
    new THREE.Vector4(1.0, 1.0, 1.0, 1.0)
  );

  const baseColor = data.getColorParam(
    'BaseColor',
    new THREE.Vector4(1.0, 1.0, 1.0, 1.0)
  );
  const emissionIntensity = data.getFloatParam('EmissionIntensity', 1.0);

  // 获取 UV 缩放和偏移参数
  const uvScaleOffset = data.getColorParam(
    'UVScaleOffset',
    new THREE.Vector4(1.0, 1.0, 0.0, 0.0)
  );

  // 创建 MeshBasicMaterial（Unlit 材质）
  const material = new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide,
    transparent: data.isTransparent,
  });

  // 设置纹理和 UV 变换
  if (baseColorTexture) {
    material.map = baseColorTexture;
    baseColorTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    baseColorTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }
  if (layerMaskTexture) {
    material.userData.layerMaskMap = layerMaskTexture;
    layerMaskTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    layerMaskTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }
  if (displacementTexture) {
    material.userData.displacementMap = displacementTexture;
    displacementTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    displacementTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }

  // 存储 Fire 参数
  const fireParams: FireParams = {
    baseColor,
    baseColorLayer1,
    baseColorLayer2,
    baseColorLayer3,
    baseColorLayer4,
    emissionIntensity,
    uvScaleOffset,
  };
  material.userData.fireParams = fireParams;

  // 使用 onBeforeCompile 修改 fragment shader
  material.onBeforeCompile = (shader) => {
    // 添加 uniforms
    shader.uniforms.layerMaskMap = { value: layerMaskTexture || null };
    shader.uniforms.hasLayerMaskMap = { value: layerMaskTexture ? 1.0 : 0.0 };
    shader.uniforms.baseColorMap = { value: baseColorTexture || null };
    shader.uniforms.hasBaseColorMap = { value: baseColorTexture ? 1.0 : 0.0 };
    shader.uniforms.baseColor = { value: baseColor };
    shader.uniforms.baseColorLayer1 = { value: baseColorLayer1 };
    shader.uniforms.baseColorLayer2 = { value: baseColorLayer2 };
    shader.uniforms.baseColorLayer3 = { value: baseColorLayer3 };
    shader.uniforms.baseColorLayer4 = { value: baseColorLayer4 };
    shader.uniforms.emissionIntensity = { value: emissionIntensity };

    // uniform 声明
    const uniformDeclarations = `
      uniform sampler2D layerMaskMap;
      uniform float hasLayerMaskMap;
      uniform sampler2D baseColorMap;
      uniform float hasBaseColorMap;
      uniform vec4 baseColor;
      uniform vec4 baseColorLayer1;
      uniform vec4 baseColorLayer2;
      uniform vec4 baseColorLayer3;
      uniform vec4 baseColorLayer4;
      uniform float emissionIntensity;
    `;

    // 在 fragment shader 中添加 uniform 声明
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      '#include <common>\n' + uniformDeclarations
    );

    // 确保 vUv 在 vertex shader 中可用
    if (!shader.vertexShader.includes('varying vec2 vUv;')) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vUv;'
      );
    }

    // 确保 vUv 被赋值
    if (!shader.vertexShader.includes('vUv = uv;')) {
      const vertexMainRegex = /void main\(\) \{([\s\S]*?)\}/;
      const vertexMainMatch = shader.vertexShader.match(vertexMainRegex);
      if (vertexMainMatch) {
        let vertexMainBody = vertexMainMatch[1];
        vertexMainBody = 'vUv = uv;\n' + vertexMainBody;
        shader.vertexShader = shader.vertexShader.replace(
          vertexMainMatch[0],
          `void main() {${vertexMainBody}}`
        );
      }
    }

    // 确保 vUv 在 fragment shader 中可用
    if (!shader.fragmentShader.includes('varying vec2 vUv;')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vUv;'
      );
    }

    // 修改 fragment shader 的 main 函数
    const fragmentShader = shader.fragmentShader;
    const mainFunctionRegex = /void main\(\) \{([\s\S]*?)\}/;
    const mainFunctionMatch = fragmentShader.match(mainFunctionRegex);

    if (mainFunctionMatch) {
      let mainFunctionBody = mainFunctionMatch[1];

      // 查找 diffuseColor 的赋值
      const diffuseColorAssignmentRegex = /(diffuseColor\s*=.*;)/;
      const diffuseColorMatch = mainFunctionBody.match(diffuseColorAssignmentRegex);

      if (diffuseColorMatch) {
        // Fire 多层混合逻辑
        const fireLogic = `
          // Fire 多层混合逻辑
          vec4 layerMask = vec4(1.0, 0.0, 0.0, 0.0);
          if (hasLayerMaskMap > 0.5) {
            layerMask = texture2D(layerMaskMap, vUv);
          }
          float weight1 = layerMask.r;
          float weight2 = layerMask.g;
          float weight3 = layerMask.b;
          float weight4 = layerMask.a;

          vec4 layerColor = baseColorLayer1 * weight1 +
                           baseColorLayer2 * weight2 +
                           baseColorLayer3 * weight3 +
                           baseColorLayer4 * weight4;

          // 应用基础颜色纹理
          vec4 baseColorTex = vec4(1.0);
          if (hasBaseColorMap > 0.5) {
            baseColorTex = texture2D(baseColorMap, vUv);
          }
          vec4 finalColor = baseColor * baseColorTex * layerColor;

          // 应用自发光强度
          finalColor.rgb *= emissionIntensity;

          diffuseColor = finalColor;
        `;

        mainFunctionBody = mainFunctionBody.replace(
          diffuseColorMatch[0],
          diffuseColorMatch[0] + fireLogic
        );
      }

      shader.fragmentShader = shader.fragmentShader.replace(
        mainFunctionMatch[0],
        `void main() {${mainFunctionBody}}`
      );
    }
  };

  // 设置材质名称
  material.name = data.name;

  return material;
};

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
  const textureRef = data.getTextureByName(textureName);
  if (textureRef) {
    return textureMap.get(textureRef.filename) || null;
  }
  return null;
}
