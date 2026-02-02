/**
 * 核心数据模型类型定义
 * 
 * 本文件定义了模型系统的基础接口和类型，用于将原始FlatBuffers数据
 * 转换为通用格式，方便后续扩展支持其他格式。
 */

import * as THREE from 'three'

// ==================== 模型数据接口 ====================

/**
 * 模型数据接口
 * 存储解析后的模型数据（网格、材质引用、骨骼引用）
 */
export interface IModelData {
  readonly name: string;
  readonly meshes: IMeshData[];
  readonly materials: IMaterialData[];
  readonly skeleton: ISkeletonData | null;
}

/**
 * 网格数据接口
 * 存储单个网格的顶点数据（位置、法线、UV、切线、蒙皮权重等）
 */
export interface IMeshData {
  readonly name: string;
  readonly positions: Float32Array;
  readonly normals: Float32Array | null;
  readonly uvs: Float32Array | null;
  readonly uvs2: Float32Array | null;
  readonly tangents: Float32Array | null;
  readonly colors: Float32Array | null;
  readonly skinIndices: Float32Array | null;
  readonly skinWeights: Float32Array | null;
  readonly indices: Uint16Array | Uint32Array;
  readonly groups: MeshGroup[];
}

/**
 * 材质数据接口
 * 存储材质属性（纹理引用、shader参数、渲染状态）
 */
export interface IMaterialData {
  readonly name: string;
  readonly shaderName: string | null;
  readonly textures: TextureReference[];
  readonly floatParams: Map<string, number>;
  readonly colorParams: Map<string, THREE.Vector4>;
  readonly alphaType: string | null;
  readonly samplers: SamplerData[];
}

/**
 * 骨骼数据接口
 * 存储骨骼层次结构和绑定姿势
 */
export interface ISkeletonData {
  readonly bones: BoneData[];
  readonly boneCount: number;
}

/**
 * 动画数据接口
 * 存储动画轨道数据
 */
export interface IAnimationData {
  readonly name: string;
  readonly duration: number;
  readonly frameRate: number;
  readonly frameCount: number;
  readonly loop: boolean;
  readonly tracks: AnimationTrackData[];
}

// ==================== 网格相关类型 ====================

/**
 * 网格分组
 * 用于将网格按材质分组
 */
export interface MeshGroup {
  start: number;
  count: number;
  materialIndex: number;
  materialName: string | null;
}

// ==================== 材质相关类型 ====================

/**
 * 纹理引用
 * 存储纹理的引用信息
 */
export interface TextureReference {
  name: string;
  filename: string;
  slot: number;
  type: TextureType;
}

/**
 * 纹理类型枚举
 */
export type TextureType = 
  | 'albedo' 
  | 'normal' 
  | 'emission' 
  | 'roughness' 
  | 'metalness' 
  | 'ao' 
  | 'mask' 
  | 'region' 
  | 'unknown';

/**
 * 采样器数据
 * 存储纹理采样器的配置
 */
export interface SamplerData {
  wrapU: UVWrapMode;
  wrapV: UVWrapMode;
}

/**
 * UV包裹模式
 */
export type UVWrapMode = 'repeat' | 'clamp' | 'mirror';

// ==================== 骨骼相关类型 ====================

/**
 * 单个骨骼的数据
 */
export interface BoneData {
  readonly index: number;
  readonly name: string;
  readonly parentIndex: number;
  readonly localPosition: THREE.Vector3;
  readonly localRotation: THREE.Euler;
  readonly localScale: THREE.Vector3;
}

// ==================== 动画相关类型 ====================

/**
 * 动画轨道数据基础接口
 */
export interface AnimationTrackData {
  readonly type: 'bone' | 'visibility' | 'material';
  readonly targetName: string;
}

/**
 * 骨骼动画轨道数据
 */
export interface BoneTrackData extends AnimationTrackData {
  readonly type: 'bone';
  readonly positionTrack: VectorTrackData | null;
  readonly rotationTrack: RotationTrackData | null;
  readonly scaleTrack: VectorTrackData | null;
}

/**
 * 可见性动画轨道数据
 */
export interface VisibilityTrackData extends AnimationTrackData {
  readonly type: 'visibility';
  readonly visibilityTrack: BoolTrackData;
}

/**
 * 材质动画轨道数据（预留扩展）
 */
export interface MaterialTrackData extends AnimationTrackData {
  readonly type: 'material';
  readonly propertyName: string;
  readonly valueTrack: FloatTrackData | VectorTrackData | ColorTrackData;
}

// ==================== 轨道数据类型 ====================

/**
 * 轨道类型枚举
 */
export type TrackType = 'fixed' | 'dynamic' | 'framed16' | 'framed8';

/**
 * 向量轨道数据（位置、缩放使用）
 */
export interface VectorTrackData {
  readonly type: TrackType;
  readonly values: Float32Array;
  readonly frames?: Uint16Array | Uint8Array;
}

/**
 * 旋转轨道数据（四元数）
 */
export interface RotationTrackData {
  readonly type: TrackType;
  readonly values: Float32Array; // 四元数数组 [x, y, z, w, ...]
  readonly frames?: Uint16Array | Uint8Array;
}

/**
 * 布尔轨道数据
 */
export interface BoolTrackData {
  readonly type: TrackType;
  readonly values: Uint8Array; // 0 或 1
  readonly frames?: Uint16Array | Uint8Array;
}

/**
 * 浮点轨道数据
 */
export interface FloatTrackData {
  readonly type: TrackType;
  readonly values: Float32Array;
  readonly frames?: Uint16Array | Uint8Array;
}

/**
 * 颜色轨道数据
 */
export interface ColorTrackData {
  readonly type: TrackType;
  readonly values: Float32Array; // RGBA [r, g, b, a, ...]
  readonly frames?: Uint16Array | Uint8Array;
}

// ==================== 骨骼变换类型 ====================

/**
 * 骨骼变换数据
 */
export interface BoneTransform {
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  scale: THREE.Vector3;
}

// ==================== 动画状态类型 ====================

/**
 * 动画播放状态
 */
export interface AnimationState {
  currentTime: number;
  duration: number;
  currentFrame: number;
  frameCount: number;
  isPlaying: boolean;
  loop: boolean;
}

// ==================== 材质选项类型 ====================

/**
 * 材质创建选项
 */
export interface MaterialOptions {
  transparent?: boolean;
  doubleSide?: boolean;
  emissiveColor?: THREE.Color;
  emissiveIntensity?: number;
}

// ==================== 游戏类型 ====================

/**
 * 支持的游戏类型
 */
export type Game = 'SCVI' | 'LZA' | 'LA';
