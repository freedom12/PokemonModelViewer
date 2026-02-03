/**
 * NonDirectional 材质
 *
 * NonDirectional 是一种用于烟雾效果的多层材质，使用 LayerMaskMap 的 RGBA 通道作为四层蒙版。
 * 每一层都有独立的颜色和蒙版缩放，支持位移贴图和透明度控制。
 * 主要用于烟雾、云雾等半透明效果。
 *
 * 使用 onBeforeCompile 方式修改 fragment shader，保持 vertex shader 不变（用于蒙皮动画）。
 *
 * @module materials/NonDirectionalMaterial
 *
 * @validates 需求 4.5: 使用 onBeforeCompile 方式修改 shader，保持默认顶点 shader 不变
 * @validates 需求 4.8: 支持 NonDirectional 材质（烟雾效果）
 */

import * as THREE from 'three';
import { MaterialData } from '../core/data';
import type { MaterialCreator } from './MaterialFactory';

/**
 * NonDirectional 材质参数接口
 */
export interface NonDirectionalParams {
  /** 第一层基础颜色 */
  baseColorLayer1: THREE.Vector4;
  /** 第二层基础颜色 */
  baseColorLayer2: THREE.Vector4;
  /** 第三层基础颜色 */
  baseColorLayer3: THREE.Vector4;
  /** 第四层基础颜色 */
  baseColorLayer4: THREE.Vector4;
  /** 第一层蒙版缩放 */
  layerMaskScale1: number;
  /** 第二层蒙版缩放 */
  layerMaskScale2: number;
  /** 第三层蒙版缩放 */
  layerMaskScale3: number;
  /** 第四层蒙版缩放 */
  layerMaskScale4: number;
  /** 位移高度 */
  displacementHeight: number;
  /** 自发光强度 */
  emissionIntensity: number;
  /** 丢弃阈值 */
  discardValue: number;
  /** UV 缩放和偏移 */
  uvScaleOffset: THREE.Vector4;
}

/**
 * 创建 NonDirectional 材质
 *
 * @param data - 材质数据
 * @param basePath - 纹理文件基础路径
 * @param textureMap - 已加载的纹理映射表
 * @returns THREE.MeshBasicMaterial NonDirectional 材质
 */
export const createNonDirectionalMaterial: MaterialCreator = (
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
    new THREE.Vector4(0.205198, 0.141264, 0.216, 1.0)
  );
  const baseColorLayer2 = data.getColorParam(
    'BaseColorLayer2',
    new THREE.Vector4(0.23086, 0.138408, 0.292, 1.0)
  );
  const baseColorLayer3 = data.getColorParam(
    'BaseColorLayer3',
    new THREE.Vector4(0.230895, 0.141328, 0.292, 1.0)
  );
  const baseColorLayer4 = data.getColorParam(
    'BaseColorLayer4',
    new THREE.Vector4(0.127488, 0.08235, 0.15, 1.0)
  );

  const layerMaskScale1 = data.getFloatParam('LayerMaskScale1', 1.0);
  const layerMaskScale2 = data.getFloatParam('LayerMaskScale2', 1.0);
  const layerMaskScale3 = data.getFloatParam('LayerMaskScale3', 1.0);
  const layerMaskScale4 = data.getFloatParam('LayerMaskScale4', 1.0);

  const displacementHeight = data.getFloatParam('DisplacementHeight', 0.3);
  const emissionIntensity = data.getFloatParam('EmissionIntensity', 1.0);
  const discardValue = data.getFloatParam('DiscardValue', 0.0);

  // 获取 UV 缩放和偏移参数
  const uvScaleOffset = data.getColorParam(
    'UVScaleOffset',
    new THREE.Vector4(1.0, 1.0, 0.0, 0.0)
  );

  // 创建 MeshBasicMaterial（烟雾材质需要透明）
  const material = new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide,
    transparent: true, // 烟雾材质需要透明
    depthWrite: false, // 不写入深度缓冲，允许其他物体渲染在烟雾上
    depthTest: true, // 进行深度测试
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

  // 存储 NonDirectional 参数
  const nonDirectionalParams: NonDirectionalParams = {
    baseColorLayer1,
    baseColorLayer2,
    baseColorLayer3,
    baseColorLayer4,
    layerMaskScale1,
    layerMaskScale2,
    layerMaskScale3,
    layerMaskScale4,
    displacementHeight,
    emissionIntensity,
    discardValue,
    uvScaleOffset,
  };
  material.userData.nonDirectionalParams = nonDirectionalParams;

  // 使用 onBeforeCompile 修改 fragment shader
  material.onBeforeCompile = (shader) => {
    // 添加 uniforms
    shader.uniforms.layerMaskMap = { value: layerMaskTexture || null };
    shader.uniforms.displacementMap = { value: displacementTexture || null };
    shader.uniforms.baseColorLayer1 = { value: baseColorLayer1 };
    shader.uniforms.baseColorLayer2 = { value: baseColorLayer2 };
    shader.uniforms.baseColorLayer3 = { value: baseColorLayer3 };
    shader.uniforms.baseColorLayer4 = { value: baseColorLayer4 };
    shader.uniforms.layerMaskScale1 = { value: layerMaskScale1 };
    shader.uniforms.layerMaskScale2 = { value: layerMaskScale2 };
    shader.uniforms.layerMaskScale3 = { value: layerMaskScale3 };
    shader.uniforms.layerMaskScale4 = { value: layerMaskScale4 };
    shader.uniforms.displacementHeight = { value: displacementHeight };
    shader.uniforms.emissionIntensity = { value: emissionIntensity };
    shader.uniforms.discardValue = { value: discardValue };

    // uniform 声明
    const uniformDeclarations = `
      uniform sampler2D layerMaskMap;
      uniform sampler2D displacementMap;
      uniform vec4 baseColorLayer1;
      uniform vec4 baseColorLayer2;
      uniform vec4 baseColorLayer3;
      uniform vec4 baseColorLayer4;
      uniform float layerMaskScale1;
      uniform float layerMaskScale2;
      uniform float layerMaskScale3;
      uniform float layerMaskScale4;
      uniform float displacementHeight;
      uniform float emissionIntensity;
      uniform float discardValue;
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
        // NonDirectional 多层混合逻辑
        const nonDirectionalLogic = `
          // NonDirectional 多层混合逻辑
          vec4 layerMask = texture2D(layerMaskMap, vUv);
          float weight1 = layerMask.r * layerMaskScale1;
          float weight2 = layerMask.g * layerMaskScale2;
          float weight3 = layerMask.b * layerMaskScale3;
          float weight4 = layerMask.a * layerMaskScale4;

          // 应用位移贴图（如果存在）
          float displacement = texture2D(displacementMap, vUv).r * displacementHeight;

          vec4 layerColor = baseColorLayer1 * weight1 +
                           baseColorLayer2 * weight2 +
                           baseColorLayer3 * weight3 +
                           baseColorLayer4 * weight4;

          // 应用基础颜色纹理
          vec4 baseColorTex = texture2D(map, vUv);
          vec4 finalColor = baseColorTex * layerColor;

          // 应用自发光强度
          finalColor.rgb *= emissionIntensity;

          // 应用位移影响（简单的高度映射）
          finalColor.rgb += vec3(displacement * 0.1);

          diffuseColor = finalColor;
        `;

        mainFunctionBody = mainFunctionBody.replace(
          diffuseColorMatch[0],
          diffuseColorMatch[0] + nonDirectionalLogic
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
