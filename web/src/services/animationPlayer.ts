/**
 * 动画播放服务
 * 负责加载和播放骨骼动画
 */

import * as THREE from "three";
import {
  flatbuffers,
  TRANM,
  AnimationInfo,
  BoneAnimation,
  BoneTrack,
  VectorTrack,
  RotationTrack,
  FixedVectorTrack,
  DynamicVectorTrack,
  Framed16VectorTrack,
  Framed8VectorTrack,
  FixedRotationTrack,
  DynamicRotationTrack,
  Framed16RotationTrack,
  Framed8RotationTrack,
  unionToVectorTrack,
  unionToRotationTrack,
} from "../parsers";
import { loadBinaryResource } from "./resourceLoader";

/**
 * 动画状态接口
 */
interface AnimationState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  loop: boolean;
  currentFrame: number;
}

/**
 * 向量类型
 */
interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * 四元数类型
 */
interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * 骨骼变换
 */
interface BoneTransform {
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
}

/**
 * 动画播放器类
 */
export class AnimationPlayer {
  private animationData: TRANM | null = null;
  private state: AnimationState;
  private skeleton: THREE.Group | null = null;
  private threeSkeleton: THREE.Skeleton | null = null;
  private boneMap: Map<string, THREE.Object3D> = new Map();
  private initialTransforms: Map<string, BoneTransform> = new Map();
  private animationId: number | null = null;

  constructor() {
    this.state = {
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      loop: true,
      currentFrame: 0,
    };
  }

  /**
   * 加载动画数据
   */
  async loadAnimation(animationUrl: string): Promise<void> {
    try {
      const buffer = await loadBinaryResource(animationUrl);
      const bytes = new Uint8Array(buffer);
      const bb = new flatbuffers.ByteBuffer(bytes);

      this.animationData = TRANM.getRootAsTRANM(bb);

      console.log("Animation data parsed:", this.animationData);
      console.log("Animation info:", this.animationData.info());
      console.log("Animation track:", this.animationData.track());

      this.calculateDuration();
      console.log("Animation loaded:", {
        doesLoop: this.animationData.info()?.doesLoop(),
        animationCount: this.animationData.info()?.animationCount(),
        animationRate: this.animationData.info()?.animationRate(),
        trackCount: this.animationData.track()?.tracksLength(),
      });
    } catch (error) {
      console.error("Failed to load animation:", error);
      throw error;
    }
  }

  /**
   * 设置骨骼对象
   */
  setSkeleton(skeleton: THREE.Group): void {
    this.skeleton = skeleton;
    this.buildBoneMap();
  }

  /**
   * 设置 Three.js Skeleton 对象（用于蒙皮动画）
   */
  setThreeSkeleton(threeSkeleton: THREE.Skeleton): void {
    this.threeSkeleton = threeSkeleton;
    this.buildSkeletonBoneMap();
  }

  /**
   * 构建骨骼名称到 THREE.Bone 对象的映射
   */
  private buildSkeletonBoneMap(): void {
    if (!this.threeSkeleton) return;

    // 为THREE.Skeleton的bones添加映射（骨骼名称已在createSkeleton中设置）
    this.threeSkeleton.bones.forEach((bone, index) => {
      const boneName = bone.name || `Bone_${index}`;
      this.boneMap.set(boneName, bone);

      // 存储初始变换
      const initialTransform: BoneTransform = {
        position: {
          x: bone.position.x,
          y: bone.position.y,
          z: bone.position.z,
        },
        rotation: {
          x: bone.quaternion.x,
          y: bone.quaternion.y,
          z: bone.quaternion.z,
          w: bone.quaternion.w,
        },
        scale: { x: bone.scale.x, y: bone.scale.y, z: bone.scale.z },
      };
      this.initialTransforms.set(boneName, initialTransform);
    });
  }

  /**
   * 构建骨骼名称到对象的映射
   */
  private buildBoneMap(): void {
    if (!this.skeleton) return;

    // 不清除现有的映射（THREE.Skeleton的bones）
    this.skeleton.traverse((object) => {
      if (object.name && object.name.startsWith("Joint_")) {
        const boneName = object.name.replace("Joint_", "");
        this.boneMap.set(`Joint_${boneName}`, object); // 使用Joint_前缀作为key

        // 存储初始变换
        const initialTransform: BoneTransform = {
          position: {
            x: object.position.x,
            y: object.position.y,
            z: object.position.z,
          },
          rotation: {
            x: object.quaternion.x,
            y: object.quaternion.y,
            z: object.quaternion.z,
            w: object.quaternion.w,
          },
          scale: { x: object.scale.x, y: object.scale.y, z: object.scale.z },
        };
        this.initialTransforms.set(boneName, initialTransform);
      }
    });
  }

  /**
   * 计算动画持续时间
   */
  private calculateDuration(): void {
    if (!this.animationData) return;

    const info = this.animationData.info();
    if (!info) return;

    const animationCount = info.animationCount();
    const animationRate = info.animationRate();
    this.state.duration = animationCount / animationRate;
  }

  /**
   * 开始播放动画
   */
  play(): void {
    if (!this.animationData || !this.skeleton) {
      console.warn("Animation or skeleton not loaded");
      return;
    }

    this.state.isPlaying = true;
    this.animate();
  }

  /**
   * 暂停动画
   */
  pause(): void {
    this.state.isPlaying = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * 停止动画
   */
  stop(): void {
    this.pause();
    this.state.currentTime = 0;
    this.state.currentFrame = 0;
    this.resetBonesToInitialPose();
  }

  /**
   * 设置循环播放
   */
  setLoop(loop: boolean): void {
    this.state.loop = loop;
  }

  /**
   * 获取当前播放状态
   */
  getState(): AnimationState {
    return { ...this.state };
  }

  /**
   * 动画循环
   */
  private animate = (): void => {
    if (!this.state.isPlaying) return;

    this.updateAnimation();
    this.animationId = requestAnimationFrame(this.animate);
  };

  /**
   * 更新动画状态
   */
  private updateAnimation(): void {
    if (!this.animationData) return;

    const info = this.animationData.info();
    if (!info) return;

    const animationCount = info.animationCount();
    const animationRate = info.animationRate();
    const doesLoop = info.doesLoop() !== 0;

    // 计算当前帧
    const frameTime = 1 / animationRate;
    this.state.currentTime += frameTime;
    this.state.currentFrame++;

    // 检查是否到达动画末尾
    if (this.state.currentFrame >= animationCount) {
      if (doesLoop && this.state.loop) {
        this.state.currentTime = frameTime;
        this.state.currentFrame = 1;
      } else {
        // 动画播放完成且不循环时，直接暂停，保持最后一帧状态
        this.pause();
        return;
      }
    }

    // 更新骨骼变换
    this.updateBoneTransforms();
  }

  /**
   * 更新所有骨骼的变换
   */
  private updateBoneTransforms(): void {
    if (!this.animationData) return;

    const boneAnimation = this.animationData.track();
    if (!boneAnimation) return;

    // 如果有THREE.Skeleton，按照层次结构更新
    if (this.threeSkeleton) {
      this.updateSkeletonBones(boneAnimation);
    }

    // 更新可视化骨骼
    for (let i = 0; i < boneAnimation.tracksLength(); i++) {
      const track = boneAnimation.tracks(i);
      if (!track) continue;

      const boneName = track.boneName();
      if (!boneName) continue;

      // 只处理可视化骨骼
      const boneObject = this.boneMap.get(`Joint_${boneName}`);
      if (boneObject && !(boneObject instanceof THREE.Bone)) {
        const transform = this.getBoneTransformAtFrame(
          track,
          this.state.currentFrame,
        );
        this.applyTransformToBone(boneObject, transform);
      }
    }
  }

  /**
   * 更新THREE.Skeleton的骨骼，按照层次结构
   */
  private updateSkeletonBones(boneAnimation: any): void {
    if (!this.threeSkeleton) {
      console.warn("No threeSkeleton to update");
      return;
    }

    // 创建骨骼名称到track的映射
    const trackMap = new Map<string, any>();
    for (let i = 0; i < boneAnimation.tracksLength(); i++) {
      const track = boneAnimation.tracks(i);
      if (!track) continue;
      const boneName = track.boneName();
      if (boneName) {
        trackMap.set(boneName, track);
      }
    }

    // 直接设置每个骨骼的局部变换
    this.threeSkeleton.bones.forEach((bone, index) => {
      const boneName = bone.name;
      const track = trackMap.get(boneName);

      if (track) {
        const transform = this.getBoneTransformAtFrame(
          track,
          this.state.currentFrame,
        );

        // 直接设置骨骼的局部变换
        bone.position.set(
          transform.position.x,
          transform.position.y,
          transform.position.z,
        );
        bone.quaternion.set(
          transform.rotation.x,
          transform.rotation.y,
          transform.rotation.z,
          transform.rotation.w,
        );
        bone.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
      }
    });
  }

  /**
   * 获取指定帧的骨骼变换
   */
  private getBoneTransformAtFrame(
    track: BoneTrack,
    frame: number,
  ): BoneTransform {
    const position = this.interpolateVectorTrack(
      track.translateType(),
      track.translate.bind(track),
      frame,
    );
    const rotation = this.interpolateRotationTrack(
      track.rotateType(),
      track.rotate.bind(track),
      frame,
    );
    const scale = this.interpolateVectorTrack(
      track.scaleType(),
      track.scale.bind(track),
      frame,
    );

    return { position, rotation, scale };
  }

  /**
   * 插值向量轨道
   */
  private interpolateVectorTrack(
    type: VectorTrack,
    accessor: (obj: any) => any,
    frame: number,
  ): Vec3 {
    const track = unionToVectorTrack(type, accessor);
    if (!track) return { x: 0, y: 0, z: 0 };

    switch (type) {
      case VectorTrack.FixedVectorTrack:
        if (track instanceof FixedVectorTrack) {
          const vec = track.co();
          return vec
            ? { x: vec.x(), y: vec.y(), z: vec.z() }
            : { x: 0, y: 0, z: 0 };
        }
        return { x: 0, y: 0, z: 0 };
      case VectorTrack.DynamicVectorTrack:
        if (track instanceof DynamicVectorTrack) {
          const frameIndex = Math.floor(frame);
          if (frameIndex >= 0 && frameIndex < track.coLength()) {
            const vec = track.co(frameIndex);
            return vec
              ? { x: vec.x(), y: vec.y(), z: vec.z() }
              : { x: 0, y: 0, z: 0 };
          } else if (track.coLength() > 0) {
            // 帧超出范围，返回最后一个值
            const vec = track.co(track.coLength() - 1);
            return vec
              ? { x: vec.x(), y: vec.y(), z: vec.z() }
              : { x: 0, y: 0, z: 0 };
          }
          return { x: 0, y: 0, z: 0 };
        }
        return { x: 0, y: 0, z: 0 };
      case VectorTrack.Framed16VectorTrack:
        if (track instanceof Framed16VectorTrack) {
          return this.interpolateFramedVector(track, frame);
        }
        return { x: 0, y: 0, z: 0 };
      case VectorTrack.Framed8VectorTrack:
        if (track instanceof Framed8VectorTrack) {
          return this.interpolateFramedVector(track, frame);
        }
        return { x: 0, y: 0, z: 0 };
      default:
        return { x: 0, y: 0, z: 0 };
    }
  }

  /**
   * 插值旋转轨道
   */
  private interpolateRotationTrack(
    type: RotationTrack,
    accessor: (obj: any) => any,
    frame: number,
  ): Quat {
    const track = unionToRotationTrack(type, accessor);
    if (!track) return { x: 0, y: 0, z: 0, w: 1 };

    switch (type) {
      case RotationTrack.FixedRotationTrack:
        if (track instanceof FixedRotationTrack) {
          const vec = track.co();
          return vec
            ? this.unpackQuaternion(vec.x(), vec.y(), vec.z())
            : { x: 0, y: 0, z: 0, w: 1 };
        }
        return { x: 0, y: 0, z: 0, w: 1 };
      case RotationTrack.DynamicRotationTrack:
        if (track instanceof DynamicRotationTrack) {
          const frameIndex = Math.floor(frame);
          if (frameIndex >= 0 && frameIndex < track.coLength()) {
            const vec = track.co(frameIndex);
            return vec
              ? this.unpackQuaternion(vec.x(), vec.y(), vec.z())
              : { x: 0, y: 0, z: 0, w: 1 };
          } else if (track.coLength() > 0) {
            // 帧超出范围，返回最后一个值
            const vec = track.co(track.coLength() - 1);
            return vec
              ? this.unpackQuaternion(vec.x(), vec.y(), vec.z())
              : { x: 0, y: 0, z: 0, w: 1 };
          }
          return { x: 0, y: 0, z: 0, w: 1 };
        }
        return { x: 0, y: 0, z: 0, w: 1 };
      case RotationTrack.Framed16RotationTrack:
        if (track instanceof Framed16RotationTrack) {
          return this.interpolateFramedRotation(track, frame);
        }
        return { x: 0, y: 0, z: 0, w: 1 };
      case RotationTrack.Framed8RotationTrack:
        if (track instanceof Framed8RotationTrack) {
          return this.interpolateFramedRotation(track, frame);
        }
        return { x: 0, y: 0, z: 0, w: 1 };
      default:
        return { x: 0, y: 0, z: 0, w: 1 };
    }
  }

  /**
   * 插值FramedVectorTrack (Framed8VectorTrack 或 Framed16VectorTrack)
   */
  private interpolateFramedVector(
    track: Framed8VectorTrack | Framed16VectorTrack,
    frame: number,
  ): Vec3 {
    const framesLength = track.framesLength();
    const valuesLength = track.coLength();

    if (framesLength === 0 || valuesLength === 0) return { x: 0, y: 0, z: 0 };

    // 如果只有一个帧，直接返回
    if (framesLength === 1) {
      const vec = track.co(0);
      return vec
        ? { x: vec.x(), y: vec.y(), z: vec.z() }
        : { x: 0, y: 0, z: 0 };
    }

    // 找到当前帧所在的两个关键帧
    let prevIndex = 0;
    let nextIndex = 1;

    for (let i = 0; i < framesLength - 1; i++) {
      const currentFrame = track.frames(i);
      const nextFrame = track.frames(i + 1);
      if (
        currentFrame !== null &&
        nextFrame !== null &&
        frame >= currentFrame &&
        frame <= nextFrame
      ) {
        prevIndex = i;
        nextIndex = i + 1;
        break;
      }
    }

    // 如果帧超出范围，返回最后一个值
    if (frame >= track.frames(framesLength - 1)!) {
      const vec = track.co(framesLength - 1);
      return vec
        ? { x: vec.x(), y: vec.y(), z: vec.z() }
        : { x: 0, y: 0, z: 0 };
    }

    const prevFrame = track.frames(prevIndex)!;
    const nextFrame = track.frames(nextIndex)!;
    const prevVec = track.co(prevIndex);
    const nextVec = track.co(nextIndex);

    if (!prevVec || !nextVec) return { x: 0, y: 0, z: 0 };

    // 计算插值因子
    const t = (frame - prevFrame) / (nextFrame - prevFrame);

    // 线性插值
    return {
      x: prevVec.x() + (nextVec.x() - prevVec.x()) * t,
      y: prevVec.y() + (nextVec.y() - prevVec.y()) * t,
      z: prevVec.z() + (nextVec.z() - prevVec.z()) * t,
    };
  }

  /**
   * 插值FramedRotationTrack (Framed8RotationTrack 或 Framed16RotationTrack)
   */
  private interpolateFramedRotation(
    track: Framed8RotationTrack | Framed16RotationTrack,
    frame: number,
  ): Quat {
    const framesLength = track.framesLength();
    const valuesLength = track.coLength();

    if (framesLength === 0 || valuesLength === 0)
      return { x: 0, y: 0, z: 0, w: 1 };

    // 如果只有一个帧，直接返回
    if (framesLength === 1) {
      const vec = track.co(0);
      return vec
        ? this.unpackQuaternion(vec.x(), vec.y(), vec.z())
        : { x: 0, y: 0, z: 0, w: 1 };
    }

    // 找到当前帧所在的两个关键帧
    let prevIndex = 0;
    let nextIndex = 1;

    for (let i = 0; i < framesLength - 1; i++) {
      const currentFrame = track.frames(i);
      const nextFrame = track.frames(i + 1);
      if (
        currentFrame !== null &&
        nextFrame !== null &&
        frame >= currentFrame &&
        frame <= nextFrame
      ) {
        prevIndex = i;
        nextIndex = i + 1;
        break;
      }
    }

    // 如果帧超出范围，返回最后一个值
    if (frame >= track.frames(framesLength - 1)!) {
      const vec = track.co(framesLength - 1);
      return vec
        ? this.unpackQuaternion(vec.x(), vec.y(), vec.z())
        : { x: 0, y: 0, z: 0, w: 1 };
    }

    const prevFrame = track.frames(prevIndex)!;
    const nextFrame = track.frames(nextIndex)!;
    const prevVec = track.co(prevIndex);
    const nextVec = track.co(nextIndex);

    if (!prevVec || !nextVec) return { x: 0, y: 0, z: 0, w: 1 };

    // 计算插值因子
    const t = (frame - prevFrame) / (nextFrame - prevFrame);

    // 解包四元数
    const q1 = this.unpackQuaternion(prevVec.x(), prevVec.y(), prevVec.z());
    const q2 = this.unpackQuaternion(nextVec.x(), nextVec.y(), nextVec.z());

    // 球面线性插值
    return this.slerp(q1, q2, t);
  }

  /**
   * 解包48-bit四元数
   */
  private unpackQuaternion(x: number, y: number, z: number): Quat {
    const pack = (BigInt(z) << 32n) | (BigInt(y) << 16n) | BigInt(x);
    const q1 = this.expandFloat(Number((pack >> 3n) & 0x7fffn));
    const q2 = this.expandFloat(Number((pack >> 18n) & 0x7fffn));
    const q3 = this.expandFloat(Number((pack >> 33n) & 0x7fffn));
    const values = [q1, q2, q3];
    const maxComponent = Math.max(1.0 - (q1 * q1 + q2 * q2 + q3 * q3), 0.0);
    const missingComponent = Math.sqrt(maxComponent);
    const missingIndex = Number(pack & 0x3n);
    values.splice(missingIndex, 0, missingComponent);
    const isNegative = (pack & 0x4n) !== 0n;
    if (isNegative) {
      return { x: -values[0], y: -values[1], z: -values[2], w: -values[3] };
    } else {
      return { x: values[0], y: values[1], z: values[2], w: values[3] };
    }
  }

  /**
   * 展开打包的浮点数
   */
  private expandFloat(i: number): number {
    const SCALE = 0x7fff;
    const PI_QUARTER = Math.PI / 4.0;
    const PI_HALF = Math.PI / 2.0;
    return i * (PI_HALF / SCALE) - PI_QUARTER;
  }

  /**
   * 球面线性插值
   */
  private slerp(q1: Quat, q2: Quat, t: number): Quat {
    const q = new THREE.Quaternion(q1.x, q1.y, q1.z, q1.w || 1);
    const qTarget = new THREE.Quaternion(q2.x, q2.y, q2.z, q2.w || 1);
    q.slerp(qTarget, t);
    return { x: q.x, y: q.y, z: q.z, w: q.w };
  }

  /**
   * 将变换应用到骨骼对象
   */
  private applyTransformToBone(
    boneObject: THREE.Object3D,
    transform: BoneTransform,
  ): void {
    // 直接设置世界变换（用于可视化骨骼）
    boneObject.position.set(
      transform.position.x,
      transform.position.y,
      transform.position.z,
    );
    boneObject.quaternion.set(
      transform.rotation.x,
      transform.rotation.y,
      transform.rotation.z,
      transform.rotation.w,
    );
    boneObject.scale.set(
      transform.scale.x,
      transform.scale.y,
      transform.scale.z,
    );

    // 更新骨骼可视化（如果存在）
    this.updateSkeletonVisualization(boneObject, transform);
  }

  /**
   * 更新骨骼可视化
   */
  private updateSkeletonVisualization(
    boneObject: THREE.Object3D,
    transform: BoneTransform,
  ): void {
    // 找到对应的可视化关节
    const boneName = boneObject.name.replace("Joint_", "");
    const jointName = `Joint_${boneName}`;

    // 遍历场景查找骨骼可视化
    if (this.skeleton) {
      this.skeleton.traverse((child) => {
        if (child.name === jointName && child instanceof THREE.Mesh) {
          // 更新关节位置
          child.position.copy(boneObject.position);
        } else if (
          child instanceof THREE.Line &&
          child.userData.parentJoint &&
          child.userData.childJoint
        ) {
          // 更新连接线位置
          const parentJoint = child.userData.parentJoint as THREE.Mesh;
          const childJoint = child.userData.childJoint as THREE.Mesh;

          // 如果这条线连接到当前更新的骨骼，则更新线的位置
          if (parentJoint === boneObject || childJoint === boneObject) {
            const geometry = child.geometry as THREE.BufferGeometry;

            // 获取世界位置
            const parentWorldPos = new THREE.Vector3();
            const childWorldPos = new THREE.Vector3();
            parentJoint.getWorldPosition(parentWorldPos);
            childJoint.getWorldPosition(childWorldPos);

            const positions = new Float32Array([
              parentWorldPos.x,
              parentWorldPos.y,
              parentWorldPos.z,
              childWorldPos.x,
              childWorldPos.y,
              childWorldPos.z,
            ]);
            geometry.setAttribute(
              "position",
              new THREE.BufferAttribute(positions, 3),
            );
            geometry.attributes.position.needsUpdate = true;
          }
        }
      });
    }
  }

  /**
   * 应用变换到THREE.Skeleton骨骼
   */
  private applyTransformToSkeletonBone(
    bone: THREE.Bone,
    transform: BoneTransform,
  ): void {
    // 设置骨骼的局部变换
    bone.position.set(
      transform.position.x,
      transform.position.y,
      transform.position.z,
    );
    bone.quaternion.set(
      transform.rotation.x,
      transform.rotation.y,
      transform.rotation.z,
      transform.rotation.w,
    );
    bone.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);

    // 更新骨骼的矩阵
    bone.updateMatrix();
  }

  /**
   * 获取插值变换
   */
  private getInterpolatedTransform(
    track: any,
    time: number,
  ): BoneTransform | null {
    // 使用现有的插值方法
    const position = this.interpolateVectorTrack(
      track.translateType(),
      track.translate.bind(track),
      Math.floor(time * 30), // 假设30fps
    );
    const rotation = this.interpolateRotationTrack(
      track.rotateType(),
      track.rotate.bind(track),
      Math.floor(time * 30),
    );
    const scale = this.interpolateVectorTrack(
      track.scaleType(),
      track.scale.bind(track),
      Math.floor(time * 30),
    );

    return { position, rotation, scale };
  }

  /**
   * 重置骨骼到初始姿态
   */
  private resetBonesToInitialPose(): void {
    // 重置到存储的初始变换（T-pose）
    if (this.threeSkeleton) {
      this.threeSkeleton.bones.forEach((bone) => {
        const boneName = bone.name;
        const initialTransform = this.initialTransforms.get(boneName);

        if (initialTransform) {
          // 使用存储的初始变换
          bone.position.set(
            initialTransform.position.x,
            initialTransform.position.y,
            initialTransform.position.z,
          );
          bone.quaternion.set(
            initialTransform.rotation.x,
            initialTransform.rotation.y,
            initialTransform.rotation.z,
            initialTransform.rotation.w,
          );
          bone.scale.set(
            initialTransform.scale.x,
            initialTransform.scale.y,
            initialTransform.scale.z,
          );
        } else {
          // 如果没有存储的初始变换，使用默认值
          bone.position.set(0, 0, 0);
          bone.quaternion.set(0, 0, 0, 1);
          bone.scale.set(1, 1, 1);
        }
      });
    }

    // 同时重置可视化骨骼
    if (this.skeleton) {
      this.skeleton.traverse((object) => {
        if (object.name && object.name.startsWith("Joint_")) {
          const boneName = object.name.replace("Joint_", "");
          const initialTransform = this.initialTransforms.get(boneName);

          if (initialTransform) {
            object.position.set(
              initialTransform.position.x,
              initialTransform.position.y,
              initialTransform.position.z,
            );
            object.quaternion.set(
              initialTransform.rotation.x,
              initialTransform.rotation.y,
              initialTransform.rotation.z,
              initialTransform.rotation.w,
            );
            object.scale.set(
              initialTransform.scale.x,
              initialTransform.scale.y,
              initialTransform.scale.z,
            );
          }
        }
      });
    }
  }

  /**
   * 销毁播放器
   */
  dispose(): void {
    this.pause();
    this.animationData = null;
    this.skeleton = null;
    this.boneMap.clear();
    this.initialTransforms.clear();
  }
}
