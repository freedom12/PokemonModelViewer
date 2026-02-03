/**
 * 动画系统模块入口
 *
 * 导出所有动画相关的类型、类和函数
 *
 * @module core/animation
 */

// 动画轨道
export {
  // 抽象基类
  AnimationTrack,

  // 向量轨道
  type IVectorTrack,
  FixedVectorTrack,
  DynamicVectorTrack,
  Framed16VectorTrack,
  Framed8VectorTrack,
  type VectorTrack,
  createVectorTrack,

  // 旋转轨道
  QuaternionUnpacker,
  type IRotationTrack,
  FixedRotationTrack,
  DynamicRotationTrack,
  Framed16RotationTrack,
  Framed8RotationTrack,
  type RotationTrack,
  createRotationTrack,

  // 布尔轨道
  type IBoolTrack,
  FixedBoolTrack,
  DynamicBoolTrack,
  Framed16BoolTrack,
  Framed8BoolTrack,
  type BoolTrack,
  createBoolTrack,
} from './AnimationTrack';

// 骨骼动画轨道
export { BoneAnimationTrack } from './BoneAnimationTrack';

// 可见性动画轨道
export { VisibilityAnimationTrack } from './VisibilityAnimationTrack';

// 动画片段
export { AnimationClip } from './AnimationClip';

// 动画混合器
export { AnimationMixer } from './AnimationMixer';
