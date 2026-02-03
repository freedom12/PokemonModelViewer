/**
 * Transparent 材质
 *
 * Transparent 是支持透明效果的高级 PBR 材质，具有多层混合、Fresnel 控制的透明度和折射效果。
 * 支持 LayerMaskMap 的 RGBA 通道用于四层蒙版混合。
 * 主要用于透明部件如眼球外层、玻璃材质等。
 *
 * @module materials/TransparentMaterial
 */

import * as THREE from 'three';
import { MaterialData } from '../core/data';
import type { MaterialCreator } from './MaterialFactory';

/**
 * Transparent 材质参数接口
 */
export interface TransparentParams {
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
  /** 自发光颜色 */
  emissionColor: THREE.Vector4;
  /** 第一层自发光颜色 */
  emissionColorLayer1: THREE.Vector4;
  /** 第二层自发光颜色 */
  emissionColorLayer2: THREE.Vector4;
  /** 第三层自发光颜色 */
  emissionColorLayer3: THREE.Vector4;
  /** 第四层自发光颜色 */
  emissionColorLayer4: THREE.Vector4;
  /** 自发光强度 */
  emissionIntensity: number;
  /** 第一层自发光强度 */
  emissionIntensityLayer1: number;
  /** 第二层自发光强度 */
  emissionIntensityLayer2: number;
  /** 第三层自发光强度 */
  emissionIntensityLayer3: number;
  /** 第四层自发光强度 */
  emissionIntensityLayer4: number;
  /** 金属度 */
  metallic: number;
  /** 第一层金属度 */
  metallicLayer1: number;
  /** 第二层金属度 */
  metallicLayer2: number;
  /** 第三层金属度 */
  metallicLayer3: number;
  /** 第四层金属度 */
  metallicLayer4: number;
  /** 粗糙度 */
  roughness: number;
  /** 第一层粗糙度 */
  roughnessLayer1: number;
  /** 第二层粗糙度 */
  roughnessLayer2: number;
  /** 第三层粗糙度 */
  roughnessLayer3: number;
  /** 第四层粗糙度 */
  roughnessLayer4: number;
  /** 第一层蒙版缩放 */
  layerMaskScale1: number;
  /** 第二层蒙版缩放 */
  layerMaskScale2: number;
  /** 第三层蒙版缩放 */
  layerMaskScale3: number;
  /** 第四层蒙版缩放 */
  layerMaskScale4: number;
  /** Fresnel 透明度最小值 */
  fresnelAlphaMin: number;
  /** Fresnel 透明度最大值 */
  fresnelAlphaMax: number;
  /** Fresnel 角度偏移 */
  fresnelAngleBias: number;
  /** 反射率 */
  reflectance: number;
  /** 法线高度 */
  normalHeight: number;
  /** UV 缩放和偏移 */
  uvScaleOffset: THREE.Vector4;
  /** 法线贴图 UV 缩放和偏移 */
  uvScaleOffsetNormal?: THREE.Vector4;
}

/**
 * 创建 Transparent 材质
 *
 * @param data - 材质数据
 * @param basePath - 纹理文件基础路径
 * @param textureMap - 已加载的纹理映射表
 * @returns THREE.MeshPhysicalMaterial Transparent 材质
 */
export const createTransparentMaterial: MaterialCreator = (
  data: MaterialData,
  basePath: string,
  textureMap: Map<string, THREE.Texture>
): THREE.Material => {
  // 获取纹理
  const baseColorTexture = getTextureByName(data, textureMap, 'BaseColorMap');
  const normalTexture = getTextureByName(data, textureMap, 'NormalMap');
  const metallicTexture = getTextureByName(data, textureMap, 'MetallicMap');
  const roughnessTexture = getTextureByName(data, textureMap, 'RoughnessMap');
  const aoTexture = getTextureByName(data, textureMap, 'AOMap');
  const emissionTexture = getTextureByName(data, textureMap, 'EmissionColorMap');
  const layerMaskTexture = getTextureByName(data, textureMap, 'LayerMaskMap');

  // 获取基础参数
  const baseColor = data.getColorParam('BaseColor', new THREE.Vector4(1.0, 1.0, 1.0, 1.0));
  const baseColorLayer1 = data.getColorParam(
    'BaseColorLayer1',
    new THREE.Vector4(1.0, 1.0, 1.0, 1.0)
  );
  const baseColorLayer2 = data.getColorParam(
    'BaseColorLayer2',
    new THREE.Vector4(1.0, 1.0, 1.0, 1.0)
  );
  const baseColorLayer3 = data.getColorParam(
    'BaseColorLayer3',
    new THREE.Vector4(1.0, 1.0, 1.0, 1.0)
  );
  const baseColorLayer4 = data.getColorParam(
    'BaseColorLayer4',
    new THREE.Vector4(1.0, 1.0, 1.0, 1.0)
  );

  // 获取自发光参数
  const emissionColor = data.getColorParam(
    'EmissionColor',
    new THREE.Vector4(1.0, 1.0, 1.0, 1.0)
  );
  const emissionColorLayer1 = data.getColorParam(
    'EmissionColorLayer1',
    new THREE.Vector4(1.0, 1.0, 1.0, 1.0)
  );
  const emissionColorLayer2 = data.getColorParam(
    'EmissionColorLayer2',
    new THREE.Vector4(1.0, 1.0, 1.0, 1.0)
  );
  const emissionColorLayer3 = data.getColorParam(
    'EmissionColorLayer3',
    new THREE.Vector4(1.0, 1.0, 1.0, 1.0)
  );
  const emissionColorLayer4 = data.getColorParam(
    'EmissionColorLayer4',
    new THREE.Vector4(1.0, 1.0, 1.0, 1.0)
  );

  const emissionIntensity = data.getFloatParam('EmissionIntensity', 0.0);
  const emissionIntensityLayer1 = data.getFloatParam('EmissionIntensityLayer1', 0.0);
  const emissionIntensityLayer2 = data.getFloatParam('EmissionIntensityLayer2', 0.0);
  const emissionIntensityLayer3 = data.getFloatParam('EmissionIntensityLayer3', 0.0);
  const emissionIntensityLayer4 = data.getFloatParam('EmissionIntensityLayer4', 0.0);

  // 获取金属度和粗糙度参数
  const metallic = data.getFloatParam('Metallic', 0.0);
  const metallicLayer1 = data.getFloatParam('MetallicLayer1', 0.0);
  const metallicLayer2 = data.getFloatParam('MetallicLayer2', 0.0);
  const metallicLayer3 = data.getFloatParam('MetallicLayer3', 0.0);
  const metallicLayer4 = data.getFloatParam('MetallicLayer4', 0.0);
  const roughness = data.getFloatParam('Roughness', 0.5);
  const roughnessLayer1 = data.getFloatParam('RoughnessLayer1', 0.5);
  const roughnessLayer2 = data.getFloatParam('RoughnessLayer2', 0.5);
  const roughnessLayer3 = data.getFloatParam('RoughnessLayer3', 0.5);
  const roughnessLayer4 = data.getFloatParam('RoughnessLayer4', 0.5);

  // 获取层混合参数
  const layerMaskScale1 = data.getFloatParam('LayerMaskScale1', 1.0);
  const layerMaskScale2 = data.getFloatParam('LayerMaskScale2', 1.0);
  const layerMaskScale3 = data.getFloatParam('LayerMaskScale3', 1.0);
  const layerMaskScale4 = data.getFloatParam('LayerMaskScale4', 1.0);

  // 获取 Fresnel 透明度参数
  const fresnelAlphaMin = data.getFloatParam('FresnelAlphaMin', 1.0);
  const fresnelAlphaMax = data.getFloatParam('FresnelAlphaMax', 1.0);
  const fresnelAngleBias = data.getFloatParam('FresnelAngleBias', 0.0);

  // 获取其他参数
  const reflectance = data.getFloatParam('Reflectance', 0.5);
  const normalHeight = data.getFloatParam('NormalHeight', 1.0);

  // 获取 UV 缩放和偏移参数
  const uvScaleOffset = data.getColorParam(
    'UVScaleOffset',
    new THREE.Vector4(1.0, 1.0, 0.0, 0.0)
  );
  const uvScaleOffsetNormal = data.getColorParam(
    'UVScaleOffsetNormal',
    new THREE.Vector4(1.0, 1.0, 0.0, 0.0)
  );

  // 创建 MeshPhysicalMaterial（支持透明和折射）
  const material = new THREE.MeshPhysicalMaterial({
    roughness: roughness,
    metalness: metallic,
    reflectivity: reflectance,
    transmission: 0.9, // 透明度传递
    thickness: 0.5, // 薄材质
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false, // 透明材质通常不写入深度
  });

  // 设置纹理和 UV 变换
  if (baseColorTexture) {
    material.map = baseColorTexture;
    baseColorTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    baseColorTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }
  if (normalTexture) {
    material.normalMap = normalTexture;
    material.normalScale = new THREE.Vector2(normalHeight, normalHeight);
    normalTexture.repeat.set(uvScaleOffsetNormal.x, uvScaleOffsetNormal.y);
    normalTexture.offset.set(uvScaleOffsetNormal.z, uvScaleOffsetNormal.w);
  }
  if (metallicTexture) {
    material.metalnessMap = metallicTexture;
    metallicTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    metallicTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }
  if (roughnessTexture) {
    material.roughnessMap = roughnessTexture;
    roughnessTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    roughnessTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }
  if (aoTexture) {
    material.aoMap = aoTexture;
    material.aoMapIntensity = 1.0;
    aoTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    aoTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }
  if (emissionTexture) {
    material.emissiveMap = emissionTexture;
    emissionTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    emissionTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }

  // 存储额外纹理到 userData
  if (layerMaskTexture) {
    material.userData.layerMaskMap = layerMaskTexture;
    layerMaskTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    layerMaskTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }

  // 存储 Transparent 参数
  const transparentParams: TransparentParams = {
    baseColor,
    baseColorLayer1,
    baseColorLayer2,
    baseColorLayer3,
    baseColorLayer4,
    emissionColor,
    emissionColorLayer1,
    emissionColorLayer2,
    emissionColorLayer3,
    emissionColorLayer4,
    emissionIntensity,
    emissionIntensityLayer1,
    emissionIntensityLayer2,
    emissionIntensityLayer3,
    emissionIntensityLayer4,
    metallic,
    metallicLayer1,
    metallicLayer2,
    metallicLayer3,
    metallicLayer4,
    roughness,
    roughnessLayer1,
    roughnessLayer2,
    roughnessLayer3,
    roughnessLayer4,
    layerMaskScale1,
    layerMaskScale2,
    layerMaskScale3,
    layerMaskScale4,
    fresnelAlphaMin,
    fresnelAlphaMax,
    fresnelAngleBias,
    reflectance,
    normalHeight,
    uvScaleOffset,
    uvScaleOffsetNormal,
  };
  material.userData.transparentParams = transparentParams;

  // 使用 onBeforeCompile 修改 shader 实现多层混合和 Fresnel 透明度
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
    shader.uniforms.emissionColor = { value: emissionColor };
    shader.uniforms.emissionColorLayer1 = { value: emissionColorLayer1 };
    shader.uniforms.emissionColorLayer2 = { value: emissionColorLayer2 };
    shader.uniforms.emissionColorLayer3 = { value: emissionColorLayer3 };
    shader.uniforms.emissionColorLayer4 = { value: emissionColorLayer4 };
    shader.uniforms.emissionIntensity = { value: emissionIntensity };
    shader.uniforms.emissionIntensityLayer1 = { value: emissionIntensityLayer1 };
    shader.uniforms.emissionIntensityLayer2 = { value: emissionIntensityLayer2 };
    shader.uniforms.emissionIntensityLayer3 = { value: emissionIntensityLayer3 };
    shader.uniforms.emissionIntensityLayer4 = { value: emissionIntensityLayer4 };
    shader.uniforms.metallicLayer1 = { value: metallicLayer1 };
    shader.uniforms.metallicLayer2 = { value: metallicLayer2 };
    shader.uniforms.metallicLayer3 = { value: metallicLayer3 };
    shader.uniforms.metallicLayer4 = { value: metallicLayer4 };
    shader.uniforms.roughnessLayer1 = { value: roughnessLayer1 };
    shader.uniforms.roughnessLayer2 = { value: roughnessLayer2 };
    shader.uniforms.roughnessLayer3 = { value: roughnessLayer3 };
    shader.uniforms.roughnessLayer4 = { value: roughnessLayer4 };
    shader.uniforms.layerMaskScale1 = { value: layerMaskScale1 };
    shader.uniforms.layerMaskScale2 = { value: layerMaskScale2 };
    shader.uniforms.layerMaskScale3 = { value: layerMaskScale3 };
    shader.uniforms.layerMaskScale4 = { value: layerMaskScale4 };
    shader.uniforms.fresnelAlphaMin = { value: fresnelAlphaMin };
    shader.uniforms.fresnelAlphaMax = { value: fresnelAlphaMax };
    shader.uniforms.fresnelAngleBias = { value: fresnelAngleBias };

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
      uniform vec4 emissionColor;
      uniform vec4 emissionColorLayer1;
      uniform vec4 emissionColorLayer2;
      uniform vec4 emissionColorLayer3;
      uniform vec4 emissionColorLayer4;
      uniform float emissionIntensity;
      uniform float emissionIntensityLayer1;
      uniform float emissionIntensityLayer2;
      uniform float emissionIntensityLayer3;
      uniform float emissionIntensityLayer4;
      uniform float metallicLayer1;
      uniform float metallicLayer2;
      uniform float metallicLayer3;
      uniform float metallicLayer4;
      uniform float roughnessLayer1;
      uniform float roughnessLayer2;
      uniform float roughnessLayer3;
      uniform float roughnessLayer4;
      uniform float layerMaskScale1;
      uniform float layerMaskScale2;
      uniform float layerMaskScale3;
      uniform float layerMaskScale4;
      uniform float fresnelAlphaMin;
      uniform float fresnelAlphaMax;
      uniform float fresnelAngleBias;
      varying vec2 vUv;
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
        // Transparent 材质逻辑
        const transparentLogic = `
          // Transparent 材质逻辑
          vec3 totalEmission = vec3(0.0);
          
          // 1. 采样 LayerMaskMap 获取各层权重
          vec4 layerMask = vec4(1.0, 0.0, 0.0, 0.0);
          if (hasLayerMaskMap > 0.5) {
            layerMask = texture2D(layerMaskMap, vUv);
          }
          float weight1 = layerMask.r * layerMaskScale1;
          float weight2 = layerMask.g * layerMaskScale2;
          float weight3 = layerMask.b * layerMaskScale3;
          float weight4 = layerMask.a * layerMaskScale4;

          // 2. 采样基础颜色纹理
          vec4 albedo = vec4(1.0);
          if (hasBaseColorMap > 0.5) {
            albedo = texture2D(baseColorMap, vUv);
          }
          
          // 3. 多层混合 - 基础颜色
          vec4 finalBaseColor = albedo * baseColor;
          finalBaseColor = mix(finalBaseColor, albedo * baseColorLayer1, weight1);
          finalBaseColor = mix(finalBaseColor, albedo * baseColorLayer2, weight2);
          finalBaseColor = mix(finalBaseColor, albedo * baseColorLayer3, weight3);
          finalBaseColor = mix(finalBaseColor, albedo * baseColorLayer4, weight4);
          
          // 4. 计算视角相关的 Fresnel 透明度
          vec3 viewDir = normalize(vViewPosition);
          vec3 surfaceNormal = normalize(vNormal);
          float NdotV = max(dot(surfaceNormal, viewDir), 0.0);
          
          // Fresnel 控制透明度
          float fresnelAngle = NdotV + fresnelAngleBias;
          fresnelAngle = clamp(fresnelAngle, 0.0, 1.0);
          float fresnelAlpha = mix(fresnelAlphaMin, fresnelAlphaMax, pow(1.0 - fresnelAngle, 3.0));
          
          // 5. 多层混合 - 自发光
          vec3 emissionLayer = emissionColor.rgb * emissionIntensity * (1.0 - weight1 - weight2 - weight3 - weight4);
          emissionLayer += emissionColorLayer1.rgb * emissionIntensityLayer1 * weight1;
          emissionLayer += emissionColorLayer2.rgb * emissionIntensityLayer2 * weight2;
          emissionLayer += emissionColorLayer3.rgb * emissionIntensityLayer3 * weight3;
          emissionLayer += emissionColorLayer4.rgb * emissionIntensityLayer4 * weight4;
          
          totalEmission = emissionLayer;
          
          // 6. 应用到 diffuseColor
          diffuseColor = finalBaseColor;
          diffuseColor.a *= fresnelAlpha;
        `;

        mainFunctionBody = mainFunctionBody.replace(
          diffuseColorMatch[0],
          diffuseColorMatch[0] + transparentLogic
        );

        // 在光照计算后添加自发光
        if (mainFunctionBody.includes('#include <emissivemap_fragment>')) {
          mainFunctionBody = mainFunctionBody.replace(
            '#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>
            // 添加自发光到最终输出
            totalEmissiveRadiance += totalEmission;`
          );
        }
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
