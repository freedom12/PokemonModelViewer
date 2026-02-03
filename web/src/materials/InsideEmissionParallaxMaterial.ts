/**
 * InsideEmissionParallax 材质
 *
 * InsideEmissionParallax 是一种高级多层 PBR 材质，支持内部自发光视差效果。
 * 使用 LayerMaskMap 的 RGBA 通道作为四层蒙版，支持视差贴图、边缘自发光等高级效果。
 * 主要用于宝可梦身体部位，创造内部发光的半透明效果。
 *
 * 使用 onBeforeCompile 方式修改 shader，保持 vertex shader 不变（用于蒙皮动画）。
 *
 * @module materials/InsideEmissionParallaxMaterial
 */

import * as THREE from 'three';
import { MaterialData } from '../core/data';
import type { MaterialCreator } from './MaterialFactory';

/**
 * InsideEmissionParallax 材质参数接口
 */
export interface InsideEmissionParallaxParams {
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
  /** 边缘自发光颜色 */
  emissionRimColor: THREE.Vector4;
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
  /** 第一层蒙版缩放 */
  layerMaskScale1: number;
  /** 第二层蒙版缩放 */
  layerMaskScale2: number;
  /** 第三层蒙版缩放 */
  layerMaskScale3: number;
  /** 第四层蒙版缩放 */
  layerMaskScale4: number;
  /** 第一层启用 IEP 纹理 */
  enableIEPTexture1: number;
  /** 第二层启用 IEP 纹理 */
  enableIEPTexture2: number;
  /** 第三层启用 IEP 纹理 */
  enableIEPTexture3: number;
  /** 第四层启用 IEP 纹理 */
  enableIEPTexture4: number;
  /** 边缘自发光 F0 */
  emissionRimF0: number;
  /** 边缘自发光 F90 */
  emissionRimF90: number;
  /** 边缘自发光比率 */
  emissionRimRate: number;
  /** 边缘自发光阈值 */
  emissionRimThreshold: number;
  /** 边缘自发光曲线 */
  emissionRimCurve: number;
  /** 内部自发光视差强度 */
  insideEmissionParallaxIntensity: number;
  /** 内部自发光视差偏移 */
  insideEmissionParallaxOffset: number;
  /** 内部自发光视差高度 */
  insideEmissionParallaxHeight: number;
  /** 内部自发光视差 F0 */
  insideEmissionParallaxF0: number;
  /** 内部自发光视差 F90 */
  insideEmissionParallaxF90: number;
  /** 内部自发光视差强度贴图网格 U */
  insideEmissionParallaxIntensityMapLatticeU: number;
  /** 内部自发光视差强度贴图网格 V */
  insideEmissionParallaxIntensityMapLatticeV: number;
  /** 内部自发光视差强度贴图范围避免边缘 */
  insideEmissionParallaxIntensityMapRangeAvoidEdge: number;
  /** 法线高度 */
  normalHeight: number;
  /** UV 缩放和偏移 */
  uvScaleOffset: THREE.Vector4;
  /** 内部自发光视差强度贴图 UV 缩放和偏移 */
  uvScaleOffsetInsideEmissionParallaxIntensity: THREE.Vector4;
  /** 内部自发光视差高度贴图 UV 缩放和偏移 */
  uvScaleOffsetInsideEmissionParallaxHeight: THREE.Vector4;
}

/**
 * 创建 InsideEmissionParallax 材质
 *
 * @param data - 材质数据
 * @param basePath - 纹理文件基础路径
 * @param textureMap - 已加载的纹理映射表
 * @returns THREE.MeshStandardMaterial InsideEmissionParallax 材质
 */
export const createInsideEmissionParallaxMaterial: MaterialCreator = (
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
  const layerMaskTexture = getTextureByName(data, textureMap, 'LayerMaskMap');
  const parallaxTexture = getTextureByName(data, textureMap, 'ParallaxMap');
  const insideEmissionParallaxIntensityTexture = getTextureByName(
    data,
    textureMap,
    'InsideEmissionParallaxIntensityMap'
  );

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
  const emissionRimColor = data.getColorParam(
    'EmissionRimColor',
    new THREE.Vector4(1.0, 1.0, 1.0, 1.0)
  );

  const emissionIntensity = data.getFloatParam('EmissionIntensity', 1.0);
  const emissionIntensityLayer1 = data.getFloatParam('EmissionIntensityLayer1', 0.0);
  const emissionIntensityLayer2 = data.getFloatParam('EmissionIntensityLayer2', 0.0);
  const emissionIntensityLayer3 = data.getFloatParam('EmissionIntensityLayer3', 0.0);
  const emissionIntensityLayer4 = data.getFloatParam('EmissionIntensityLayer4', 0.0);

  // 获取金属度和粗糙度参数
  const metallicLayer1 = data.getFloatParam('MetallicLayer1', 0.0);
  const metallicLayer2 = data.getFloatParam('MetallicLayer2', 0.0);
  const metallicLayer3 = data.getFloatParam('MetallicLayer3', 0.0);
  const metallicLayer4 = data.getFloatParam('MetallicLayer4', 0.0);
  const roughnessLayer1 = data.getFloatParam('RoughnessLayer1', 0.5);
  const roughnessLayer2 = data.getFloatParam('RoughnessLayer2', 0.5);
  const roughnessLayer3 = data.getFloatParam('RoughnessLayer3', 0.5);
  const roughnessLayer4 = data.getFloatParam('RoughnessLayer4', 0.5);

  // 获取层混合参数
  const layerMaskScale1 = data.getFloatParam('LayerMaskScale1', 1.0);
  const layerMaskScale2 = data.getFloatParam('LayerMaskScale2', 1.0);
  const layerMaskScale3 = data.getFloatParam('LayerMaskScale3', 1.0);
  const layerMaskScale4 = data.getFloatParam('LayerMaskScale4', 1.0);

  // 获取 IEP 纹理启用参数
  const enableIEPTexture1 = data.getFloatParam('EnableIEPTexture1', 1.0);
  const enableIEPTexture2 = data.getFloatParam('EnableIEPTexture2', 1.0);
  const enableIEPTexture3 = data.getFloatParam('EnableIEPTexture3', 1.0);
  const enableIEPTexture4 = data.getFloatParam('EnableIEPTexture4', 1.0);

  // 获取边缘自发光参数
  const emissionRimF0 = data.getFloatParam('EmissionRimF0', 0.0);
  const emissionRimF90 = data.getFloatParam('EmissionRimF90', 1.0);
  const emissionRimRate = data.getFloatParam('EmissionRimRate', 1.0);
  const emissionRimThreshold = data.getFloatParam('EmissionRimThreshold', 0.0);
  const emissionRimCurve = data.getFloatParam('EmissionRimCurve', 1.0);

  // 获取内部自发光视差参数
  const insideEmissionParallaxIntensity = data.getFloatParam(
    'InsideEmissionParallaxIntensity',
    1.0
  );
  const insideEmissionParallaxOffset = data.getFloatParam('InsideEmissionParallaxOffset', 0.0);
  const insideEmissionParallaxHeight = data.getFloatParam('InsideEmissionParallaxHeight', 0.0);
  const insideEmissionParallaxF0 = data.getFloatParam('InsideEmissionParallaxF0', 1.0);
  const insideEmissionParallaxF90 = data.getFloatParam('InsideEmissionParallaxF90', 0.0);
  const insideEmissionParallaxIntensityMapLatticeU = data.getFloatParam(
    'InsideEmissionParallaxIntensityMapLatticeU',
    1.0
  );
  const insideEmissionParallaxIntensityMapLatticeV = data.getFloatParam(
    'InsideEmissionParallaxIntensityMapLatticeV',
    1.0
  );
  const insideEmissionParallaxIntensityMapRangeAvoidEdge = data.getFloatParam(
    'InsideEmissionParallaxIntensityMapRangeAvoidEdge',
    0.0
  );

  // 获取其他参数
  const normalHeight = data.getFloatParam('NormalHeight', 1.0);

  // 获取 UV 缩放和偏移参数
  const uvScaleOffset = data.getColorParam(
    'UVScaleOffset',
    new THREE.Vector4(1.0, 1.0, 0.0, 0.0)
  );
  const uvScaleOffsetInsideEmissionParallaxIntensity = data.getColorParam(
    'UVScaleOffsetInsideEmissionParallaxIntensity',
    new THREE.Vector4(1.0, 1.0, 0.0, 0.0)
  );
  const uvScaleOffsetInsideEmissionParallaxHeight = data.getColorParam(
    'UVScaleOffsetInsideEmissionParallaxHeight',
    new THREE.Vector4(1.0, 1.0, 0.0, 0.0)
  );

  // 创建 MeshStandardMaterial（基础 PBR 材质）
  const material = new THREE.MeshStandardMaterial({
    roughness: roughnessLayer1,
    metalness: metallicLayer1,
    side: THREE.DoubleSide,
    transparent: data.isTransparent,
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
    normalTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    normalTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
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

  // 存储额外纹理到 userData
  if (layerMaskTexture) {
    material.userData.layerMaskMap = layerMaskTexture;
    layerMaskTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    layerMaskTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }
  if (parallaxTexture) {
    material.userData.parallaxMap = parallaxTexture;
    parallaxTexture.repeat.set(
      uvScaleOffsetInsideEmissionParallaxHeight.x,
      uvScaleOffsetInsideEmissionParallaxHeight.y
    );
    parallaxTexture.offset.set(
      uvScaleOffsetInsideEmissionParallaxHeight.z,
      uvScaleOffsetInsideEmissionParallaxHeight.w
    );
  }
  if (insideEmissionParallaxIntensityTexture) {
    material.userData.insideEmissionParallaxIntensityMap = insideEmissionParallaxIntensityTexture;
    insideEmissionParallaxIntensityTexture.repeat.set(
      uvScaleOffsetInsideEmissionParallaxIntensity.x,
      uvScaleOffsetInsideEmissionParallaxIntensity.y
    );
    insideEmissionParallaxIntensityTexture.offset.set(
      uvScaleOffsetInsideEmissionParallaxIntensity.z,
      uvScaleOffsetInsideEmissionParallaxIntensity.w
    );
  }

  // 存储 InsideEmissionParallax 参数
  const iepParams: InsideEmissionParallaxParams = {
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
    emissionRimColor,
    emissionIntensity,
    emissionIntensityLayer1,
    emissionIntensityLayer2,
    emissionIntensityLayer3,
    emissionIntensityLayer4,
    metallicLayer1,
    metallicLayer2,
    metallicLayer3,
    metallicLayer4,
    roughnessLayer1,
    roughnessLayer2,
    roughnessLayer3,
    roughnessLayer4,
    layerMaskScale1,
    layerMaskScale2,
    layerMaskScale3,
    layerMaskScale4,
    enableIEPTexture1,
    enableIEPTexture2,
    enableIEPTexture3,
    enableIEPTexture4,
    emissionRimF0,
    emissionRimF90,
    emissionRimRate,
    emissionRimThreshold,
    emissionRimCurve,
    insideEmissionParallaxIntensity,
    insideEmissionParallaxOffset,
    insideEmissionParallaxHeight,
    insideEmissionParallaxF0,
    insideEmissionParallaxF90,
    insideEmissionParallaxIntensityMapLatticeU,
    insideEmissionParallaxIntensityMapLatticeV,
    insideEmissionParallaxIntensityMapRangeAvoidEdge,
    normalHeight,
    uvScaleOffset,
    uvScaleOffsetInsideEmissionParallaxIntensity,
    uvScaleOffsetInsideEmissionParallaxHeight,
  };
  material.userData.insideEmissionParallaxParams = iepParams;

  // 使用 onBeforeCompile 修改 shader
  material.onBeforeCompile = (shader) => {
    // 添加 uniforms
    shader.uniforms.layerMaskMap = { value: layerMaskTexture || null };
    shader.uniforms.hasLayerMaskMap = { value: layerMaskTexture ? 1.0 : 0.0 };
    shader.uniforms.parallaxMap = { value: parallaxTexture || null };
    shader.uniforms.hasParallaxMap = { value: parallaxTexture ? 1.0 : 0.0 };
    shader.uniforms.insideEmissionParallaxIntensityMap = {
      value: insideEmissionParallaxIntensityTexture || null,
    };
    shader.uniforms.hasInsideEmissionParallaxIntensityMap = {
      value: insideEmissionParallaxIntensityTexture ? 1.0 : 0.0,
    };
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
    shader.uniforms.emissionRimColor = { value: emissionRimColor };
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
    shader.uniforms.enableIEPTexture1 = { value: enableIEPTexture1 };
    shader.uniforms.enableIEPTexture2 = { value: enableIEPTexture2 };
    shader.uniforms.enableIEPTexture3 = { value: enableIEPTexture3 };
    shader.uniforms.enableIEPTexture4 = { value: enableIEPTexture4 };
    shader.uniforms.emissionRimF0 = { value: emissionRimF0 };
    shader.uniforms.emissionRimF90 = { value: emissionRimF90 };
    shader.uniforms.emissionRimRate = { value: emissionRimRate };
    shader.uniforms.emissionRimThreshold = { value: emissionRimThreshold };
    shader.uniforms.emissionRimCurve = { value: emissionRimCurve };
    shader.uniforms.insideEmissionParallaxIntensity = { value: insideEmissionParallaxIntensity };
    shader.uniforms.insideEmissionParallaxOffset = { value: insideEmissionParallaxOffset };
    shader.uniforms.insideEmissionParallaxHeight = { value: insideEmissionParallaxHeight };
    shader.uniforms.insideEmissionParallaxF0 = { value: insideEmissionParallaxF0 };
    shader.uniforms.insideEmissionParallaxF90 = { value: insideEmissionParallaxF90 };
    shader.uniforms.insideEmissionParallaxIntensityMapLatticeU = {
      value: insideEmissionParallaxIntensityMapLatticeU,
    };
    shader.uniforms.insideEmissionParallaxIntensityMapLatticeV = {
      value: insideEmissionParallaxIntensityMapLatticeV,
    };
    shader.uniforms.insideEmissionParallaxIntensityMapRangeAvoidEdge = {
      value: insideEmissionParallaxIntensityMapRangeAvoidEdge,
    };

    // uniform 声明
    const uniformDeclarations = `
      uniform sampler2D layerMaskMap;
      uniform float hasLayerMaskMap;
      uniform sampler2D parallaxMap;
      uniform float hasParallaxMap;
      uniform sampler2D insideEmissionParallaxIntensityMap;
      uniform float hasInsideEmissionParallaxIntensityMap;
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
      uniform vec4 emissionRimColor;
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
      uniform float enableIEPTexture1;
      uniform float enableIEPTexture2;
      uniform float enableIEPTexture3;
      uniform float enableIEPTexture4;
      uniform float emissionRimF0;
      uniform float emissionRimF90;
      uniform float emissionRimRate;
      uniform float emissionRimThreshold;
      uniform float emissionRimCurve;
      uniform float insideEmissionParallaxIntensity;
      uniform float insideEmissionParallaxOffset;
      uniform float insideEmissionParallaxHeight;
      uniform float insideEmissionParallaxF0;
      uniform float insideEmissionParallaxF90;
      uniform float insideEmissionParallaxIntensityMapLatticeU;
      uniform float insideEmissionParallaxIntensityMapLatticeV;
      uniform float insideEmissionParallaxIntensityMapRangeAvoidEdge;
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

    // 确保 vUv 在 fragment shader 中可用
    if (!shader.fragmentShader.includes('varying vec2 vUv;')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vUv;'
      );
    }

    // Three.js MeshStandardMaterial 已经定义了 vViewPosition 和 vNormal
    // 不需要额外添加这些 varying 变量

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
        // InsideEmissionParallax 材质逻辑
        const iepLogic = `
          // InsideEmissionParallax 材质逻辑
          // 声明 totalEmission 在最前面确保作用域覆盖整个 main 函数
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

          // 2. 采样基础颜色纹理（如果没有纹理则使用白色）
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
          
          // 4. 计算视角相关的效果
          // Three.js 中 vViewPosition 是从顶点到相机的向量
          vec3 viewDir = normalize(vViewPosition);
          vec3 surfaceNormal = normalize(vNormal);
          float NdotV = max(dot(surfaceNormal, viewDir), 0.0);
          
          // 5. 内部自发光视差效果 (Inside Emission Parallax)
          vec3 iepEmission = vec3(0.0);
          if (insideEmissionParallaxIntensity > 0.0) {
            // 采样视差高度贴图
            float parallaxHeight = 0.0;
            if (hasParallaxMap > 0.5) {
              parallaxHeight = texture2D(parallaxMap, vUv).r;
            }
            
            // 计算视差偏移的 UV
            float heightScale = insideEmissionParallaxHeight * parallaxHeight;
            vec2 parallaxOffset = viewDir.xy * (heightScale + insideEmissionParallaxOffset);
            vec2 parallaxUV = vUv + parallaxOffset;
            
            // 采样强度贴图（使用网格重复）
            vec2 latticeUV = parallaxUV * vec2(
              insideEmissionParallaxIntensityMapLatticeU,
              insideEmissionParallaxIntensityMapLatticeV
            );
            float iepIntensityMapValue = 1.0;
            if (hasInsideEmissionParallaxIntensityMap > 0.5) {
              iepIntensityMapValue = texture2D(insideEmissionParallaxIntensityMap, latticeUV).r;
            }
            
            // 基于视角的 Fresnel 效果
            float iepFresnel = mix(insideEmissionParallaxF0, insideEmissionParallaxF90, pow(1.0 - NdotV, 5.0));
            
            // 组合内部自发光效果（多层混合）
            // 使用加权混合而不是简单的 mix，避免颜色累积过强
            vec3 iepColor = emissionColor.rgb * emissionIntensity * (1.0 - weight1 - weight2 - weight3 - weight4);
            iepColor += emissionColorLayer1.rgb * emissionIntensityLayer1 * enableIEPTexture1 * weight1;
            iepColor += emissionColorLayer2.rgb * emissionIntensityLayer2 * enableIEPTexture2 * weight2;
            iepColor += emissionColorLayer3.rgb * emissionIntensityLayer3 * enableIEPTexture3 * weight3;
            iepColor += emissionColorLayer4.rgb * emissionIntensityLayer4 * enableIEPTexture4 * weight4;
            
            // 降低整体强度，避免过曝
            iepEmission = iepColor * iepIntensityMapValue * iepFresnel * insideEmissionParallaxIntensity * 0.5;
          }
          
          // 6. 边缘自发光效果 (Emission Rim)
          vec3 rimEmission = vec3(0.0);
          if (emissionRimRate > 0.0) {
            // 基于视角的边缘检测
            float rimValue = 1.0 - NdotV;
            
            // 应用阈值和曲线
            rimValue = max(rimValue - emissionRimThreshold, 0.0) / max(1.0 - emissionRimThreshold, 0.001);
            if (emissionRimCurve > 0.0) {
              rimValue = pow(rimValue, emissionRimCurve);
            }
            
            // Fresnel 混合
            float rimFresnel = mix(emissionRimF0, emissionRimF90, rimValue);
            
            // 降低边缘光强度，避免过强
            rimEmission = emissionRimColor.rgb * rimFresnel * emissionRimRate * 0.3;
          }
          
          // 7. 组合所有自发光
          totalEmission = iepEmission + rimEmission;
          
          // 8. 应用到 diffuseColor
          // 对于 InsideEmissionParallax 材质，保持基础颜色用于 PBR 光照
          // 自发光将在后续单独添加
          diffuseColor = finalBaseColor;
        `;

        mainFunctionBody = mainFunctionBody.replace(
          diffuseColorMatch[0],
          diffuseColorMatch[0] + iepLogic
        );

        // 在光照计算后添加自发光
        // 查找 #include <emissivemap_fragment>
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
