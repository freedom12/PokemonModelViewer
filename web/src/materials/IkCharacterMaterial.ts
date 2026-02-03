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

import * as THREE from "three";
import { MaterialData } from "../core/data";
import type { MaterialCreator } from "./MaterialFactory";

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
  /** 第一层蒙版缩放 */
  layerMaskScale1: number;
  /** 第二层蒙版缩放 */
  layerMaskScale2: number;
  /** 第三层蒙版缩放 */
  layerMaskScale3: number;
  /** 第四层蒙版缩放 */
  layerMaskScale4: number;
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
  textureMap: Map<string, THREE.Texture>,
): THREE.Material => {
  // 获取纹理
  const baseColorTexture = getTextureByName(data, textureMap, "BaseColorMap");
  const normalTexture = getTextureByName(data, textureMap, "NormalMap");
  const occlusionTexture = getTextureByName(data, textureMap, "OcclusionMap");
  const layerMaskTexture = getTextureByName(data, textureMap, "LayerMaskMap");

  // 获取各层的参数
  const baseColorLayer1 = data.getColorParam(
    "BaseColorLayer1",
    new THREE.Vector4(1.0, 1.0, 1.0, 1.0),
  );
  const baseColorLayer2 = data.getColorParam(
    "BaseColorLayer2",
    new THREE.Vector4(1.0, 1.0, 1.0, 1.0),
  );
  const baseColorLayer3 = data.getColorParam(
    "BaseColorLayer3",
    new THREE.Vector4(1.0, 1.0, 1.0, 1.0),
  );
  const baseColorLayer4 = data.getColorParam(
    "BaseColorLayer4",
    new THREE.Vector4(1.0, 1.0, 1.0, 1.0),
  );

  const baseColor = data.getColorParam(
    "BaseColor",
    new THREE.Vector4(1.0, 1.0, 1.0, 1.0),
  );
  const emissionColor = data.getColorParam(
    "EmissionColor",
    new THREE.Vector4(0.0, 0.0, 0.0, 1.0),
  );
  const emissionColorLayer1 = data.getColorParam(
    "EmissionColorLayer1",
    new THREE.Vector4(0.0, 0.0, 0.0, 1.0),
  );
  const emissionColorLayer2 = data.getColorParam(
    "EmissionColorLayer2",
    new THREE.Vector4(0.0, 0.0, 0.0, 1.0),
  );
  const emissionColorLayer3 = data.getColorParam(
    "EmissionColorLayer3",
    new THREE.Vector4(0.0, 0.0, 0.0, 1.0),
  );
  const emissionColorLayer4 = data.getColorParam(
    "EmissionColorLayer4",
    new THREE.Vector4(0.0, 0.0, 0.0, 1.0),
  );
  const roughness = data.getFloatParam("Roughness", 0.7);
  const metalness = data.getFloatParam("Metallic", 0.0);
  const emissionIntensity = data.getFloatParam("EmissionIntensity", 0);
  const emissionIntensityLayer1 = data.getFloatParam("EmissionIntensityLayer1", 0);
  const emissionIntensityLayer2 = data.getFloatParam("EmissionIntensityLayer2", 0);
  const emissionIntensityLayer3 = data.getFloatParam("EmissionIntensityLayer3", 0);
  const emissionIntensityLayer4 = data.getFloatParam("EmissionIntensityLayer4", 0);
  const layerMaskScale1 = data.getFloatParam("LayerMaskScale1", 1.0);
  const layerMaskScale2 = data.getFloatParam("LayerMaskScale2", 1.0);
  const layerMaskScale3 = data.getFloatParam("LayerMaskScale3", 1.0);
  const layerMaskScale4 = data.getFloatParam("LayerMaskScale4", 1.0);

  // 获取 UV 缩放和偏移参数
  const uvScaleOffset = data.getColorParam(
    "UVScaleOffset",
    new THREE.Vector4(1.0, 1.0, 0.0, 0.0),
  );
  const uvScaleOffsetNormal = data.getColorParam(
    "UVScaleOffsetNormal",
    new THREE.Vector4(1.0, 1.0, 0.0, 0.0),
  );

  // 创建 MeshStandardMaterial
  const material = new THREE.MeshStandardMaterial({
    roughness,
    metalness,
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
    normalTexture.repeat.set(uvScaleOffsetNormal.x, uvScaleOffsetNormal.y);
    normalTexture.offset.set(uvScaleOffsetNormal.z, uvScaleOffsetNormal.w);
  }
  if (occlusionTexture) {
    material.aoMap = occlusionTexture;
    material.aoMapIntensity = 1.0;
    occlusionTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    occlusionTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }
  if (layerMaskTexture) {
    material.userData.layerMaskMap = layerMaskTexture;
    layerMaskTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    layerMaskTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }

  // 存储 IkCharacter 参数
  const ikCharacterParams: IkCharacterParams = {
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
    layerMaskScale1,
    layerMaskScale2,
    layerMaskScale3,
    layerMaskScale4,
    uvScaleOffset,
  };
  material.userData.ikCharacterParams = ikCharacterParams;

  // 如果有 LayerMaskMap，使用 onBeforeCompile 修改 fragment shader
  if (layerMaskTexture) {
    material.onBeforeCompile = (shader) => {
      // 添加 uniforms
      shader.uniforms.layerMaskMap = { value: layerMaskTexture || null };
      shader.uniforms.baseColorMap = { value: baseColorTexture || null };
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
      shader.uniforms.layerMaskScale1 = { value: layerMaskScale1 };
      shader.uniforms.layerMaskScale2 = { value: layerMaskScale2 };
      shader.uniforms.layerMaskScale3 = { value: layerMaskScale3 };
      shader.uniforms.layerMaskScale4 = { value: layerMaskScale4 };
      // 添加 UV 变换 uniform
      shader.uniforms.layerMaskUvTransform = { 
        value: new THREE.Vector4(uvScaleOffset.x, uvScaleOffset.y, uvScaleOffset.z, uvScaleOffset.w) 
      };

      // uniform 声明和 varying
      const additions = `
        uniform sampler2D layerMaskMap;
        uniform sampler2D baseColorMap;
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
        uniform float layerMaskScale1;
        uniform float layerMaskScale2;
        uniform float layerMaskScale3;
        uniform float layerMaskScale4;
        uniform vec4 layerMaskUvTransform;
        varying vec2 vUv;
      `;

      // 在 fragment shader 中添加声明
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        "#include <common>\n" + additions,
      );

      // 确保 vUv 在 vertex shader 中可用
      if (!shader.vertexShader.includes("varying vec2 vUv;")) {
        shader.vertexShader = shader.vertexShader.replace(
          "#include <common>",
          "#include <common>\nvarying vec2 vUv;",
        );
      }

      // 确保 vUv 被赋值
      if (!shader.vertexShader.includes("vUv = uv;")) {
        const vertexMainRegex = /void main\(\) \{([\s\S]*?)\}/;
        const vertexMainMatch = shader.vertexShader.match(vertexMainRegex);
        if (vertexMainMatch) {
          let vertexMainBody = vertexMainMatch[1];
          vertexMainBody = "vUv = uv;\n" + vertexMainBody;
          shader.vertexShader = shader.vertexShader.replace(
            vertexMainMatch[0],
            `void main() {${vertexMainBody}}`,
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
        const diffuseColorMatch = mainFunctionBody.match(
          diffuseColorAssignmentRegex,
        );

        if (diffuseColorMatch) {
          // IkCharacter 多层混合逻辑
          // 手动应用 UV 变换：transformedUv = uv * scale + offset
          const ikCharacterLogic = `
            // IkCharacter 多层混合逻辑
            // 应用 UV 变换：layerMaskUvTransform.xy = scale, layerMaskUvTransform.zw = offset
            vec2 transformedUv = vUv * layerMaskUvTransform.xy + layerMaskUvTransform.zw;
            
            // 调试：输出 UV 坐标查看
            // diffuseColor = vec4(fract(transformedUv), 0.0, 1.0); // 取消注释可调试 UV
            
            vec4 layerMask = texture(layerMaskMap, transformedUv);
            float weight1 = layerMask.r * layerMaskScale1;
            float weight2 = layerMask.g * layerMaskScale2;
            float weight3 = layerMask.b * layerMaskScale3;
            float weight4 = layerMask.a * layerMaskScale4;

            // 手动采样 baseColorTexture，使用相同的 UV 变换
            vec4 albedo = texture(baseColorMap, transformedUv);
            vec4 finalBaseColor = albedo * baseColor + emissionColor * emissionIntensity;
            finalBaseColor = (albedo * baseColorLayer1 + emissionColorLayer1 * emissionIntensityLayer1) * weight1 + finalBaseColor * (1.0 - weight1);
            finalBaseColor = (albedo * baseColorLayer2 + emissionColorLayer2 * emissionIntensityLayer2) * weight2 + finalBaseColor * (1.0 - weight2);
            finalBaseColor = (albedo * baseColorLayer3 + emissionColorLayer3 * emissionIntensityLayer3) * weight3 + finalBaseColor * (1.0 - weight3);
            finalBaseColor = (albedo * baseColorLayer4 + emissionColorLayer4 * emissionIntensityLayer4) * weight4 + finalBaseColor * (1.0 - weight4);

            // 应用层颜色到 diffuseColor
            diffuseColor = finalBaseColor;
          `;

          mainFunctionBody = mainFunctionBody.replace(
            diffuseColorMatch[0],
            diffuseColorMatch[0] + ikCharacterLogic,
          );
        }

        shader.fragmentShader = shader.fragmentShader.replace(
          mainFunctionMatch[0],
          `void main() {${mainFunctionBody}}`,
        );
      }
    };
  }

  // 设置材质名称
  material.name = data.name;

  return material;
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
  textureName: string,
): THREE.Texture | null {
  const textureRef = data.getTextureByName(textureName);
  if (textureRef) {
    return textureMap.get(textureRef.filename) || null;
  }
  return null;
}

