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

import * as THREE from 'three';
import { MaterialData } from '../core/data';
import type { MaterialCreator } from './MaterialFactory';

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
  _basePath: string,
  textureMap: Map<string, THREE.Texture>
): THREE.Material => {
  // 检查任意 shader 是否启用了 EnableHighlight（通常在第二个 shader Eye 中）
  const enableHighlight = data.isAnyShaderFeatureEnabled('EnableHighlight');

  // 获取纹理
  const baseColorMapTexture = getTextureByName(data, textureMap, 'BaseColorMap');
  const layerMaskTexture = getTextureByName(data, textureMap, 'LayerMaskMap');
  let highlightMaskTexture = getTextureByName(data, textureMap, 'HighlightMaskMap');

  // 如果启用了 EnableHighlight 但没有 HighlightMaskMap，则从 LayerMaskMap 生成
  if (enableHighlight && !highlightMaskTexture && layerMaskTexture) {
    const layerMaskRef = data.getTextureByName('LayerMaskMap');
    if (layerMaskRef) {
      highlightMaskTexture = textureMap.get('eye_hight_mask') || null;

      // 如果找到了纹理，复制 LayerMaskMap 的采样器设置
      if (highlightMaskTexture && layerMaskTexture) {
        highlightMaskTexture.wrapS = layerMaskTexture.wrapS;
        highlightMaskTexture.wrapT = layerMaskTexture.wrapT;
      }
    }
  }

  const normalTexture = getTextureByName(data, textureMap, 'NormalMap');
  const normalTexture1 = getTextureByName(data, textureMap, 'NormalMap1');

  // 获取各层的参数
  const baseColor = data.getColorParam(
    'BaseColor',
    new THREE.Vector4(0.0, 0.0, 0.0, 1.0)
  );
  const baseColorLayer1 = data.getColorParam(
    'BaseColorLayer1',
    new THREE.Vector4(0.0, 0.0, 0.0, 1.0)
  );
  const baseColorLayer2 = data.getColorParam(
    'BaseColorLayer2',
    new THREE.Vector4(0.0, 0.0, 0.0, 1.0)
  );
  const baseColorLayer3 = data.getColorParam(
    'BaseColorLayer3',
    new THREE.Vector4(0.0, 0.0, 0.0, 1.0)
  );
  const baseColorLayer4 = data.getColorParam(
    'BaseColorLayer4',
    new THREE.Vector4(0.0, 0.0, 0.0, 1.0)
  );

  const emissionColor = data.getColorParam(
    'EmissionColor',
    new THREE.Vector4(0.0, 0.0, 0.0, 1.0)
  );
  const emissionColorLayer1 = data.getColorParam(
    'EmissionColorLayer1',
    new THREE.Vector4(0.0, 0.0, 0.0, 1.0)
  );
  const emissionColorLayer2 = data.getColorParam(
    'EmissionColorLayer2',
    new THREE.Vector4(0.0, 0.0, 0.0, 1.0)
  );
  const emissionColorLayer3 = data.getColorParam(
    'EmissionColorLayer3',
    new THREE.Vector4(0.0, 0.0, 0.0, 1.0)
  );
  const emissionColorLayer4 = data.getColorParam(
    'EmissionColorLayer4',
    new THREE.Vector4(0.0, 0.0, 0.0, 1.0)
  );
  const emissionColorLayer5 = data.getColorParam(
    'EmissionColorLayer5',
    new THREE.Vector4(0.0, 0.0, 0.0, 1.0)
  );

  const emissionIntensity = data.getFloatParam('EmissionIntensity', 0);
  const metallicLayer1 = data.getFloatParam('MetallicLayer1', 0.0);
  const metallicLayer2 = data.getFloatParam('MetallicLayer2', 0.0);
  const metallicLayer3 = data.getFloatParam('MetallicLayer3', 0.0);
  const metallicLayer4 = data.getFloatParam('MetallicLayer4', 0.0);

  const roughnessLayer1 = data.getFloatParam('RoughnessLayer1', 0.8);
  const roughnessLayer2 = data.getFloatParam('RoughnessLayer2', 0.8);
  const roughnessLayer3 = data.getFloatParam('RoughnessLayer3', 0.8);
  const roughnessLayer4 = data.getFloatParam('RoughnessLayer4', 0.8);

  const emissionIntensityLayer1 = data.getFloatParam('EmissionIntensityLayer1', 0);
  const emissionIntensityLayer2 = data.getFloatParam('EmissionIntensityLayer2', 0);
  const emissionIntensityLayer3 = data.getFloatParam('EmissionIntensityLayer3', 0);
  const emissionIntensityLayer4 = data.getFloatParam('EmissionIntensityLayer4', 0);

  const layerMaskScale1 = data.getFloatParam('LayerMaskScale1', 0.0);
  const layerMaskScale2 = data.getFloatParam('LayerMaskScale2', 0.0);
  const layerMaskScale3 = data.getFloatParam('LayerMaskScale3', 0.0);
  const layerMaskScale4 = data.getFloatParam('LayerMaskScale4', 0.0);

  // 获取 UV 缩放和偏移参数
  const uvScaleOffset = data.getColorParam(
    'UVScaleOffset',
    new THREE.Vector4(1.0, 1.0, 0.0, 0.0)
  );
  const uvScaleOffsetNormal = data.getColorParam(
    'UVScaleOffsetNormal',
    new THREE.Vector4(1.0, 1.0, 0.0, 0.0)
  );

  // 获取 UV 变换模式：T (仅平移) 或 SRT (缩放+旋转+平移)，默认为 SRT
  const uvTransformMode = data.findShaderValue('UVTransformMode') || 'SRT';
  const isTranslateOnly = uvTransformMode.toUpperCase() === 'T';

  // 根据 UVTransformMode 决定是否应用缩放
  // T 模式：只应用偏移，缩放设为 1.0
  // SRT 模式：应用完整的缩放和偏移
  const uvRepeat = isTranslateOnly 
    ? new THREE.Vector2(1.0, 1.0) 
    : new THREE.Vector2(uvScaleOffset.x, uvScaleOffset.y);
  const uvOffset = new THREE.Vector2(uvScaleOffset.z, uvScaleOffset.w);
  
  const uvRepeatNormal = isTranslateOnly
    ? new THREE.Vector2(1.0, 1.0)
    : new THREE.Vector2(uvScaleOffsetNormal.x, uvScaleOffsetNormal.y);
  const uvOffsetNormal = new THREE.Vector2(uvScaleOffsetNormal.z, uvScaleOffsetNormal.w);

  // 创建 MeshStandardMaterial
  const material = new THREE.MeshStandardMaterial({
    side: THREE.DoubleSide,
    transparent: data.isTransparent,
  });

  // 设置纹理和 UV 变换
  if (baseColorMapTexture) {
    material.map = baseColorMapTexture;
    material.userData.baseColorMap = baseColorMapTexture;
    baseColorMapTexture.repeat.copy(uvRepeat);
    baseColorMapTexture.offset.copy(uvOffset);
  }
  if (layerMaskTexture) {
    material.userData.layerMaskMap = layerMaskTexture;
    layerMaskTexture.repeat.copy(uvRepeat);
    layerMaskTexture.offset.copy(uvOffset);
  }
  if (highlightMaskTexture) {
    material.userData.highlightMaskMap = highlightMaskTexture;
    highlightMaskTexture.repeat.copy(uvRepeat);
    highlightMaskTexture.offset.copy(uvOffset);
  }
  if (normalTexture) {
    material.normalMap = normalTexture;
    normalTexture.repeat.copy(uvRepeatNormal);
    normalTexture.offset.copy(uvOffsetNormal);
  }
  if (normalTexture1) {
    material.userData.normalMap1 = normalTexture1;
    normalTexture1.repeat.copy(uvRepeatNormal);
    normalTexture1.offset.copy(uvOffsetNormal);
  }

  // 使用 onBeforeCompile 修改 fragment shader
  material.onBeforeCompile = (shader) => {
    // 添加 uniforms
    shader.uniforms.baseColorMap = { value: baseColorMapTexture || null };
    shader.uniforms.useBaseColorMap = { value: !!baseColorMapTexture };
    shader.uniforms.layerMaskMap = { value: layerMaskTexture || null };
    shader.uniforms.highlightMaskMap = { value: highlightMaskTexture || null };
    shader.uniforms.useHighlightMask = { value: !!highlightMaskTexture };
    shader.uniforms.normalMap1 = { value: normalTexture1 || null };
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
    shader.uniforms.emissionColorLayer5 = { value: emissionColorLayer5 };
    shader.uniforms.emissionIntensity = { value: emissionIntensity };
    shader.uniforms.metallicLayer1 = { value: metallicLayer1 };
    shader.uniforms.metallicLayer2 = { value: metallicLayer2 };
    shader.uniforms.metallicLayer3 = { value: metallicLayer3 };
    shader.uniforms.metallicLayer4 = { value: metallicLayer4 };
    shader.uniforms.roughnessLayer1 = { value: roughnessLayer1 };
    shader.uniforms.roughnessLayer2 = { value: roughnessLayer2 };
    shader.uniforms.roughnessLayer3 = { value: roughnessLayer3 };
    shader.uniforms.roughnessLayer4 = { value: roughnessLayer4 };
    shader.uniforms.emissionIntensityLayer1 = {
      value: emissionIntensityLayer1,
    };
    shader.uniforms.emissionIntensityLayer2 = {
      value: emissionIntensityLayer2,
    };
    shader.uniforms.emissionIntensityLayer3 = {
      value: emissionIntensityLayer3,
    };
    shader.uniforms.emissionIntensityLayer4 = {
      value: emissionIntensityLayer4,
    };
    shader.uniforms.layerMaskScale1 = { value: layerMaskScale1 };
    shader.uniforms.layerMaskScale2 = { value: layerMaskScale2 };
    shader.uniforms.layerMaskScale3 = { value: layerMaskScale3 };
    shader.uniforms.layerMaskScale4 = { value: layerMaskScale4 };
    // 添加 UV 变换 uniform（使用已根据 UVTransformMode 处理的值）
    shader.uniforms.uvTransform = {
      value: new THREE.Vector4(
        uvRepeat.x,
        uvRepeat.y,
        uvOffset.x,
        uvOffset.y
      ),
    };
    shader.uniforms.uvTransformNormal = {
      value: new THREE.Vector4(
        uvRepeatNormal.x,
        uvRepeatNormal.y,
        uvOffsetNormal.x,
        uvOffsetNormal.y
      ),
    };

    // 确保 vUv 在 vertex shader 中可用
    if (!shader.vertexShader.includes('varying vec2 vUv;')) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vUv;'
      );
    }

    // 确保 vUv 被赋值 - 在 uv_vertex chunk 之后插入
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      '#include <uv_vertex>\nvUv = uv;'
    );

    // uniform 声明
    const uniformDeclarations = `
      uniform sampler2D baseColorMap;
      uniform bool useBaseColorMap;
      uniform sampler2D layerMaskMap;
      uniform sampler2D highlightMaskMap;
      uniform bool useHighlightMask;
      uniform sampler2D normalMap1;
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
      uniform vec4 emissionColorLayer5;
      uniform float emissionIntensity;
      uniform float emissionIntensityLayer1;
      uniform float emissionIntensityLayer2;
      uniform float emissionIntensityLayer3;
      uniform float emissionIntensityLayer4;
      uniform float layerMaskScale1;
      uniform float layerMaskScale2;
      uniform float layerMaskScale3;
      uniform float layerMaskScale4;
      uniform float metallicLayer1;
      uniform float metallicLayer2;
      uniform float metallicLayer3;
      uniform float metallicLayer4;
      uniform float roughnessLayer1;
      uniform float roughnessLayer2;
      uniform float roughnessLayer3;
      uniform float roughnessLayer4;
      uniform vec4 uvTransform;
      uniform vec4 uvTransformNormal;
    `;

    // 在 fragment shader 中添加 uniform 声明
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      '#include <common>\n' + uniformDeclarations
    );

    // 确保 vUv 在 fragment shader 中可用
    if (!shader.fragmentShader.includes('varying vec2 vUv;')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vUv;'
      );
    }

    // EyeClearCoat 多层混合逻辑 - 在 map_fragment 之后插入
    const eyeClearCoatLogic = `
      // ============ EyeClearCoat 层叠逻辑 ============
      // 应用 UV 变换
      vec2 transformedUv = vUv * uvTransform.xy + uvTransform.zw;
      // 1. 采样 LayerMask (RGBA 四个通道)
      vec4 layerMask = texture(layerMaskMap, transformedUv);
      
      // 2. 应用 LayerMaskScale 并 clamp
      float s1 = (layerMaskScale1 == 0.0) ? 1.0 : layerMaskScale1;
      float s2 = (layerMaskScale2 == 0.0) ? 1.0 : layerMaskScale2;
      float s3 = (layerMaskScale3 == 0.0) ? 1.0 : layerMaskScale3;
      float s4 = (layerMaskScale4 == 0.0) ? 1.0 : layerMaskScale4;
      
      layerMask.r *= s1;
      layerMask.g *= s2;
      layerMask.b *= s3;
      layerMask.a *= s4;
      layerMask = clamp(layerMask, 0.0, 1.0);
      
      // 3. 采样 BaseColorMap 作为基础纹理
      vec3 baseSample = vec3(1.0);
      if (useBaseColorMap) {
        baseSample = texture(baseColorMap, transformedUv).rgb;
      }
      
      // 4. 基础颜色混合逻辑 (参考 shader 的层叠算法)
      vec3 finalBaseColor = baseSample * baseColor.rgb;
      
      // 计算基础层权重 (1.0 - 所有层mask的总和)
      float weightBase = clamp(1.0 - dot(vec4(1.0), layerMask), 0.0, 1.0);
      vec3 blendedColor = finalBaseColor * weightBase;
      
      // Layer1 (R 通道)
      vec3 layer1Color = baseSample * baseColorLayer1.rgb;
      blendedColor = mix(blendedColor, layer1Color, layerMask.r);
      weightBase = mix(weightBase, 1.0, layerMask.r);
      
      // Layer2 (G 通道)
      vec3 layer2Color = baseSample * baseColorLayer2.rgb;
      blendedColor = mix(blendedColor, layer2Color, layerMask.g);
      weightBase = mix(weightBase, 1.0, layerMask.g);
      
      // Layer3 (B 通道)
      vec3 layer3Color = baseSample * baseColorLayer3.rgb;
      blendedColor = mix(blendedColor, layer3Color, layerMask.b);
      weightBase = mix(weightBase, 1.0, layerMask.b);
      
      // Layer4 (A 通道)
      vec3 layer4Color = baseSample * baseColorLayer4.rgb;
      blendedColor = mix(blendedColor, layer4Color, layerMask.a);
      weightBase = mix(weightBase, 1.0, layerMask.a);
      
      // 归一化 (防止除零)
      float invWeight = 1.0 / max(weightBase, 0.00001);
      finalBaseColor = blendedColor * invWeight;
      
      // 5. Emission 层叠逻辑
      vec3 finalEmission = emissionColor.rgb * emissionIntensity;
      
      // 同样按照层混合 emission
      vec3 blendedEmission = finalEmission * (1.0 - dot(vec4(1.0), layerMask));
      blendedEmission = mix(blendedEmission, emissionColorLayer1.rgb * emissionIntensityLayer1, layerMask.r);
      blendedEmission = mix(blendedEmission, emissionColorLayer2.rgb * emissionIntensityLayer2, layerMask.g);
      blendedEmission = mix(blendedEmission, emissionColorLayer3.rgb * emissionIntensityLayer3, layerMask.b);
      blendedEmission = mix(blendedEmission, emissionColorLayer4.rgb * emissionIntensityLayer4, layerMask.a);
      
      // 6. 高光遮罩混合
      vec3 highlightColor = vec3(0.0);
      if (useHighlightMask) {
        vec4 highlightMask = texture2D(highlightMaskMap, transformedUv);
        // 高光遮罩叠加到最终颜色
        highlightColor = highlightMask.rgb * highlightMask.a;
      }
      
      // 7. 最终输出: baseColor + emission + highlight
      diffuseColor.rgb = finalBaseColor + blendedEmission + highlightColor;
      diffuseColor.a = 1.0;
    `;

    // 在 #include <map_fragment> 之后插入自定义逻辑
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      '#include <map_fragment>\n' + eyeClearCoatLogic
    );
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
