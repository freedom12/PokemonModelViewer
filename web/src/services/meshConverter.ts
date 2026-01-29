/**
 * 网格转换器模块
 *
 * 将 FlatBuffers 解析后的 TRMSH 和 TRMBF 数据转换为 Three.js BufferGeometry
 *
 * @module services/meshConverter
 */

import * as THREE from "three";
import {
  type TRMSH,
  type TRMBF,
  type TRSKL,
  type MeshShape,
  type Buffer as TRMBFBuffer,
  VertexAttribute,
} from "../parsers";
import {
  parseVertexAttribute,
  parseIndices,
  extractUV2Components,
  normalizeNormals,
  getVertexTypeInfo,
  getIndexByteSize,
} from "./vertexParser";

/**
 * 几何体组信息
 * 用于描述子网格在几何体中的位置
 */
export interface GeometryGroup {
  /** 起始索引 */
  start: number;
  /** 索引数量 */
  count: number;
  /** 材质索引 */
  materialIndex: number;
  /** 材质名称 */
  materialName: string | null;
}

/**
 * 创建几何体的结果
 */
export interface CreateGeometryResult {
  /** Three.js BufferGeometry */
  geometry: THREE.BufferGeometry;
  /** 几何体组列表（用于多材质） */
  groups: GeometryGroup[];
}

/**
 * 从 TRMSH 和 TRMBF 数据创建 Three.js BufferGeometry
 *
 * 此函数解析网格形状数据和缓冲区数据，创建包含顶点位置、法线、UV 坐标的几何体
 *
 * @param trmsh - TRMSH 网格文件数据
 * @param trmbf - TRMBF 缓冲区文件数据
 * @param meshIndex - 要转换的网格索引（默认为 0）
 * @returns 创建的几何体和几何体组信息
 *
 * @validates 需求 3.4: 顶点数据解析完成后创建 Three.js BufferGeometry 对象
 *
 * @example
 * const { geometry, groups } = createGeometry(trmsh, trmbf, 0)
 * const mesh = new THREE.Mesh(geometry, materials)
 */
export function createGeometry(
  trmsh: TRMSH,
  trmbf: TRMBF,
  meshIndex: number = 0,
): CreateGeometryResult {
  // 获取网格形状
  const meshShape = trmsh.meshes(meshIndex);
  if (!meshShape) {
    throw new Error(`Mesh shape at index ${meshIndex} not found`);
  }

  // 获取对应的缓冲区
  const buffer = trmbf.buffers(meshIndex);
  if (!buffer) {
    throw new Error(`Buffer at index ${meshIndex} not found`);
  }

  return createGeometryFromMeshShape(meshShape, buffer);
}

/**
 * 从 MeshShape 和 Buffer 创建几何体
 *
 * @param meshShape - 网格形状数据
 * @param buffer - 缓冲区数据
 * @returns 创建的几何体和几何体组信息
 */
export function createGeometryFromMeshShape(
  meshShape: MeshShape,
  buffer: TRMBFBuffer,
): CreateGeometryResult {
  const geometry = new THREE.BufferGeometry();

  // 解析顶点属性
  const vertexData = parseVertexAttributes(meshShape, buffer);

  // 设置顶点位置
  if (vertexData.positions) {
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(vertexData.positions, 3),
    );
  }

  // 设置法线
  if (vertexData.normals) {
    // 法线数据可能是 4 分量（RGBA_16_FLOAT），需要提取前 3 个分量
    let normals3: Float32Array;

    // 通过位置数据计算顶点数量
    const vertexCount = vertexData.positions
      ? vertexData.positions.length / 3
      : 0;
    const expectedLength4 = vertexCount * 4;
    const expectedLength3 = vertexCount * 3;

    if (vertexData.normals.length === expectedLength4) {
      // 4 分量数据，提取前 3 个分量
      normals3 = new Float32Array(vertexCount * 3);
      for (let i = 0; i < vertexCount; i++) {
        normals3[i * 3] = vertexData.normals[i * 4];
        normals3[i * 3 + 1] = vertexData.normals[i * 4 + 1];
        normals3[i * 3 + 2] = vertexData.normals[i * 4 + 2];
      }
    } else {
      // 已经是 3 分量数据
      normals3 = vertexData.normals;
    }

    // 归一化法线向量
    const normalizedNormals = normalizeNormals(normals3);
    geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(normalizedNormals, 3),
    );
  }

  // 设置 UV 坐标
  if (vertexData.uvs) {
    geometry.setAttribute("uv", new THREE.BufferAttribute(vertexData.uvs, 2));
  }

  // 设置第二套 UV 坐标（如果存在）
  if (vertexData.uvs2) {
    geometry.setAttribute("uv2", new THREE.BufferAttribute(vertexData.uvs2, 2));
  }

  // 设置顶点颜色（如果存在）
  if (vertexData.colors) {
    geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(vertexData.colors, 4),
    );
  }

  // 设置切线（用于法线贴图）
  if (vertexData.tangents) {
    // 切线数据可能是 4 分量（RGBA_16_FLOAT），包含 x,y,z,w（w 为 handedness）
    let tangents3: Float32Array;

    // 通过位置数据计算顶点数量
    const vertexCount = vertexData.positions
      ? vertexData.positions.length / 3
      : 0;
    const expectedLength4 = vertexCount * 4;

    if (vertexData.tangents.length === expectedLength4) {
      tangents3 = new Float32Array(vertexCount * 3);
      for (let i = 0; i < vertexCount; i++) {
        tangents3[i * 3] = vertexData.tangents[i * 4];
        tangents3[i * 3 + 1] = vertexData.tangents[i * 4 + 1];
        tangents3[i * 3 + 2] = vertexData.tangents[i * 4 + 2];
        // if (vertexData.tangents[i * 4 + 3] === -1) {
        //   // 如果 w 分量为 -1，则反转切线方向
        //   tangents3[i * 3] = -tangents3[i * 3];
        //   tangents3[i * 3 + 1] = -tangents3[i * 3 + 1];
        //   tangents3[i * 3 + 2] = -tangents3[i * 3 + 2];
        // }
      }
    } else {
      tangents3 = vertexData.tangents;
    }
    const normalizedTangents = normalizeNormals(tangents3);
    geometry.setAttribute("tangent", new THREE.BufferAttribute(normalizedTangents, 3));
  }

  // 设置蒙皮索引
  if (vertexData.skinIndices) {
    geometry.setAttribute(
      "skinIndex",
      new THREE.BufferAttribute(vertexData.skinIndices, 4),
    );
  }

  // 设置蒙皮权重
  if (vertexData.skinWeights) {
    geometry.setAttribute(
      "skinWeight",
      new THREE.BufferAttribute(vertexData.skinWeights, 4),
    );
  }

  // 解析索引数据
  const indices = parseIndexData(meshShape, buffer);
  if (indices) {
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  }

  // 创建几何体组
  const groups = createGeometryGroups(meshShape);

  // 将组添加到几何体
  for (const group of groups) {
    geometry.addGroup(group.start, group.count, group.materialIndex);
  }

  // 计算包围盒和包围球
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  // 如果没有法线数据，自动计算法线
  if (!vertexData.normals) {
    geometry.computeVertexNormals();
  }

  return { geometry, groups };
}

/**
 * 顶点数据解析结果
 */
interface VertexData {
  positions: Float32Array | null;
  normals: Float32Array | null;
  uvs: Float32Array | null;
  uvs2: Float32Array | null;
  colors: Float32Array | null;
  tangents: Float32Array | null;
  skinIndices: Float32Array | null;
  skinWeights: Float32Array | null;
}

/**
 * 解析所有顶点属性
 *
 * @param meshShape - 网格形状数据
 * @param buffer - 缓冲区数据
 * @returns 解析后的顶点数据
 */
function parseVertexAttributes(
  meshShape: MeshShape,
  buffer: TRMBFBuffer,
): VertexData {
  const result: VertexData = {
    positions: null,
    normals: null,
    uvs: null,
    uvs2: null,
    colors: null,
    tangents: null,
    skinIndices: null,
    skinWeights: null,
  };

  // 获取顶点属性访问器
  const attributesCount = meshShape.attributesLength();
  if (attributesCount === 0) {
    return result;
  }

  // 遍历所有属性组
  for (let attrGroupIdx = 0; attrGroupIdx < attributesCount; attrGroupIdx++) {
    const vertexAccessors = meshShape.attributes(attrGroupIdx);
    if (!vertexAccessors) continue;

    // 获取顶点缓冲区
    const vertices = buffer.vertexBuffer(attrGroupIdx);
    if (!vertices) continue;

    const vertexBuffer = vertices.bufferArray();
    if (!vertexBuffer) continue;

    // 获取顶点步长
    const sizeInfo = vertexAccessors.size(0);
    const stride = sizeInfo ? sizeInfo.size() : 0;

    // 计算顶点数量
    const vertexCount =
      stride > 0 ? Math.floor(vertexBuffer.length / stride) : 0;
    if (vertexCount === 0) continue;

    // 遍历所有属性访问器
    const attrsCount = vertexAccessors.attrsLength();
    for (let i = 0; i < attrsCount; i++) {
      const accessor = vertexAccessors.attrs(i);
      if (!accessor) continue;

      const attribute = accessor.attribute();
      const type = accessor.type();
      const offset = accessor.position();
      const layer = accessor.attributeLayer();

      // 根据属性类型解析数据
      switch (attribute) {
        case VertexAttribute.POSITION:
          result.positions = parseVertexAttribute(
            vertexBuffer,
            type,
            offset,
            stride,
            vertexCount,
          );
          break;

        case VertexAttribute.NORMAL:
          result.normals = parseVertexAttribute(
            vertexBuffer,
            type,
            offset,
            stride,
            vertexCount,
          );
          break;

        case VertexAttribute.TEXCOORD:
          {
            const uvData = parseVertexAttribute(
              vertexBuffer,
              type,
              offset,
              stride,
              vertexCount,
            );

            // 根据数据类型提取 UV 分量
            const typeInfo = getVertexTypeInfo(type);
            let uvs: Float32Array;

            if (typeInfo.componentCount === 4) {
              // RGBA_16_UNORM 等 4 分量类型，只取前 2 个分量
              uvs = extractUV2Components(uvData, vertexCount);
            } else if (typeInfo.componentCount === 2) {
              // RG_32_FLOAT 等 2 分量类型，直接使用
              uvs = uvData;
            } else {
              uvs = uvData;
            }

            // 根据层级存储 UV
            if (layer === 0 && !result.uvs) {
              result.uvs = uvs;
            } else if (layer === 1 || (layer === 0 && result.uvs)) {
              result.uvs2 = uvs;
            }
          }
          break;

        case VertexAttribute.COLOR:
          result.colors = parseVertexAttribute(
            vertexBuffer,
            type,
            offset,
            stride,
            vertexCount,
          );
          break;

        case VertexAttribute.TANGENT:
          result.tangents = parseVertexAttribute(
            vertexBuffer,
            type,
            offset,
            stride,
            vertexCount,
          );
          break;

        case VertexAttribute.BLEND_INDICES:
          result.skinIndices = parseVertexAttribute(
            vertexBuffer,
            type,
            offset,
            stride,
            vertexCount,
          );
          break;

        case VertexAttribute.BLEND_WEIGHTS:
          result.skinWeights = parseVertexAttribute(
            vertexBuffer,
            type,
            offset,
            stride,
            vertexCount,
          );
          break;

        // 其他属性类型暂不处理
        default:
          break;
      }
    }
  }

  return result;
}

/**
 * 解析索引数据
 *
 * @param meshShape - 网格形状数据
 * @param buffer - 缓冲区数据
 * @returns 索引数组
 */
function parseIndexData(
  meshShape: MeshShape,
  buffer: TRMBFBuffer,
): Uint16Array | Uint32Array | null {
  // 获取索引缓冲区
  const indexBufferCount = buffer.indexBufferLength();
  if (indexBufferCount === 0) {
    return null;
  }

  const indexes = buffer.indexBuffer(0);
  if (!indexes) {
    return null;
  }

  const indexBuffer = indexes.bufferArray();
  if (!indexBuffer) {
    return null;
  }

  // 获取多边形类型
  const polygonType = meshShape.polygonType();

  // 计算索引数量
  const indexByteSize = getIndexByteSize(polygonType);
  const indexCount = Math.floor(indexBuffer.length / indexByteSize);

  return parseIndices(indexBuffer, polygonType, 0, indexCount);
}

/**
 * 为多子网格创建几何体组
 *
 * 根据 MeshShape 中的材质信息创建几何体组，每个组对应一个子网格/材质
 *
 * @param meshShape - 网格形状数据
 * @returns 几何体组数组
 *
 * @validates 需求 3.6: 模型包含多个子网格时为每个子网格创建独立的几何体组
 *
 * @example
 * const groups = createGeometryGroups(meshShape)
 * // groups = [
 * //   { start: 0, count: 1000, materialIndex: 0, materialName: 'body' },
 * //   { start: 1000, count: 500, materialIndex: 1, materialName: 'eyes' }
 * // ]
 */
export function createGeometryGroups(meshShape: MeshShape): GeometryGroup[] {
  const groups: GeometryGroup[] = [];

  const materialsCount = meshShape.materialsLength();

  if (materialsCount === 0) {
    // 没有材质信息，创建一个默认组
    return [
      {
        start: 0,
        count: Infinity, // 将在实际使用时被替换为实际索引数量
        materialIndex: 0,
        materialName: null,
      },
    ];
  }

  // 遍历所有材质信息，创建对应的几何体组
  for (let i = 0; i < materialsCount; i++) {
    const materialInfo = meshShape.materials(i);
    if (!materialInfo) continue;

    const polyOffset = materialInfo.polyOffset();
    const polyCount = materialInfo.polyCount();
    const materialName = materialInfo.materialName();

    groups.push({
      start: polyOffset,
      count: polyCount,
      materialIndex: i,
      materialName: materialName,
    });
  }

  return groups;
}

/**
 * 从 TRMSH 和 TRMBF 创建所有网格的几何体
 *
 * @param trmsh - TRMSH 网格文件数据
 * @param trmbf - TRMBF 缓冲区文件数据
 * @returns 所有网格的几何体和组信息数组
 */
export function createAllGeometries(
  trmsh: TRMSH,
  trmbf: TRMBF,
): CreateGeometryResult[] {
  const results: CreateGeometryResult[] = [];

  const meshCount = trmsh.meshesLength();

  for (let i = 0; i < meshCount; i++) {
    try {
      const result = createGeometry(trmsh, trmbf, i);
      results.push(result);
    } catch (error) {
      console.warn(`Failed to create geometry for mesh ${i}:`, error);
    }
  }

  return results;
}

/**
 * 获取网格的子网格数量
 *
 * @param meshShape - 网格形状数据
 * @returns 子网格数量
 */
export function getSubmeshCount(meshShape: MeshShape): number {
  return meshShape.materialsLength() || 1;
}

/**
 * 验证几何体组数量与材质数量一致
 *
 * @param meshShape - 网格形状数据
 * @param groups - 几何体组数组
 * @returns 是否一致
 *
 * @validates Property 5: 子网格数量一致性
 */
export function validateGroupCount(
  meshShape: MeshShape,
  groups: GeometryGroup[],
): boolean {
  const expectedCount = getSubmeshCount(meshShape);
  return groups.length === expectedCount;
}

export function createSkeleton(trskl: TRSKL): THREE.Skeleton {
  const bones: THREE.Bone[] = [];
  const boneInverses: THREE.Matrix4[] = [];

  // 获取数据
  const boneCount = trskl.bonesLength();
  const transformNodeCount = trskl.transformNodesLength();

  console.log(`TRSKL has ${boneCount} bones and ${transformNodeCount} transform nodes`);

  // 创建骨骼数组，大小等于 bones.length
  for (let i = 0; i < boneCount; i++) {
    const bone = new THREE.Bone();
    bone.name = `Bone_${i}`;
    bones.push(bone);
    boneInverses.push(new THREE.Matrix4());
  }

  // 创建 transformNodes 的映射：rigIdx -> transformNode
  const rigIdxToTransformNode = new Map<number, any>();
  for (let i = 0; i < transformNodeCount; i++) {
    const node = trskl.transformNodes(i);
    if (node) {
      const rigIdx = node.rigIdx();
      if (rigIdx >= 0) {
        rigIdxToTransformNode.set(rigIdx, node);
      }
    }
  }

  // 为每个骨骼设置变换和名称
  for (let boneIndex = 0; boneIndex < boneCount; boneIndex++) {
    const bone = bones[boneIndex];
    const transformNode = rigIdxToTransformNode.get(boneIndex);

    if (transformNode) {
      // 设置骨骼名称
      const name = transformNode.name();
      if (name) {
        bone.name = name.decode ? name.decode('utf-8') : name;
      }

      // 设置骨骼的局部变换
      const transform = transformNode.transform();
      if (transform) {
        const scale = transform.vecScale();
        const rotation = transform.vecRot();
        const translation = transform.vecTranslate();

        if (scale && rotation && translation) {
          // 设置缩放
          bone.scale.set(scale.x(), scale.y(), scale.z());

          // 设置旋转（欧拉角 -> 四元数）
          const euler = new THREE.Euler(rotation.x(), rotation.y(), rotation.z(), 'ZYX');
          const quat = new THREE.Quaternion().setFromEuler(euler);
          bone.quaternion.copy(quat);

          // 设置位置
          bone.position.set(translation.x(), translation.y(), translation.z());
        }
      }
    }
  }

  // 建立层次结构
  for (let boneIndex = 0; boneIndex < boneCount; boneIndex++) {
    const transformNode = rigIdxToTransformNode.get(boneIndex);
    if (!transformNode) continue;

    const parentIdx = transformNode.parentIdx();
    if (parentIdx >= 0) {
      // 查找父骨骼：parentIdx 是 transformNodes 的索引，需要转换为 rigIdx
      const parentNode = trskl.transformNodes(parentIdx);
      if (parentNode) {
        const parentRigIdx = parentNode.rigIdx();
        if (parentRigIdx >= 0 && parentRigIdx < bones.length) {
          const parentBone = bones[parentRigIdx];
          const childBone = bones[boneIndex];
          if (parentBone && childBone && parentBone !== childBone) {
            parentBone.add(childBone);
          }
        }
      }
    }
  }

  // 计算 boneInverses：绑定姿势的世界变换的逆矩阵
  // 首先更新所有骨骼的世界矩阵
  bones.forEach(bone => {
    bone.updateMatrixWorld(true);
  });

  bones.forEach((bone, index) => {
    // 获取骨骼的世界变换矩阵
    const worldMatrix = bone.matrixWorld.clone();
    boneInverses[index] = worldMatrix.invert();
  });

  console.log(`Created skeleton with ${bones.length} bones`);

  return new THREE.Skeleton(bones, boneInverses);
}
