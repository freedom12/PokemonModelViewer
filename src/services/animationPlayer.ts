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
  Framed8VectorTrack,
  FixedRotationTrack,
  Framed8RotationTrack,
  unionToVectorTrack,
  unionToRotationTrack,
} from "../parsers";

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
      const response = await fetch(animationUrl);
      if (!response.ok) {
        throw new Error(`Failed to load animation: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
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
   * 构建骨骼名称到对象的映射
   */
  private buildBoneMap(): void {
    if (!this.skeleton) return;

    this.boneMap.clear();
    this.initialTransforms.clear();
    this.skeleton.traverse((object) => {
      if (object.name && object.name.startsWith("Joint_")) {
        const boneName = object.name.replace("Joint_", "");
        this.boneMap.set(boneName, object);

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

    const deltaTime = 1 / 60; // 假设60fps
    this.state.currentTime += deltaTime;

    // 计算当前帧
    const frameTime = 1 / animationRate;
    this.state.currentFrame = Math.floor(this.state.currentTime / frameTime);

    // 检查是否到达动画末尾
    if (this.state.currentFrame >= animationCount) {
      if (doesLoop && this.state.loop) {
        this.state.currentTime = 0;
        this.state.currentFrame = 0;
      } else {
        this.stop();
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

    for (let i = 0; i < boneAnimation.tracksLength(); i++) {
      const track = boneAnimation.tracks(i);
      if (!track) continue;

      const boneName = track.boneName();
      if (!boneName) continue;

      const boneObject = this.boneMap.get(boneName);
      if (!boneObject) {
        console.warn(
          `Bone not found in map: ${boneName}, available bones:`,
          Array.from(this.boneMap.keys()),
        );
        continue;
      }

      const transform = this.getBoneTransformAtFrame(
        track,
        this.state.currentFrame,
      );
      this.applyTransformToBone(boneObject, transform);
    }
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
   * 插值Framed8VectorTrack
   */
  private interpolateFramedVector(
    track: Framed8VectorTrack,
    frame: number,
  ): Vec3 {
    const framesLength = track.framesLength();
    const valuesLength = track.coLength();

    if (framesLength === 0 || valuesLength === 0) return { x: 0, y: 0, z: 0 };

    // 如果只有一个帧，直接返回
    if (framesLength === 1) {
      const vec = track.co(0);
      return vec ? { x: vec.x(), y: vec.y(), z: vec.z() } : { x: 0, y: 0, z: 0 };
    }

    // 找到当前帧所在的两个关键帧
    let prevIndex = 0;
    let nextIndex = 1;

    for (let i = 0; i < framesLength - 1; i++) {
      const currentFrame = track.frames(i);
      const nextFrame = track.frames(i + 1);
      if (currentFrame !== null && nextFrame !== null && frame >= currentFrame && frame <= nextFrame) {
        prevIndex = i;
        nextIndex = i + 1;
        break;
      }
    }

    // 如果帧超出范围，返回最后一个值
    if (frame >= track.frames(framesLength - 1)!) {
      const vec = track.co(framesLength - 1);
      return vec ? { x: vec.x(), y: vec.y(), z: vec.z() } : { x: 0, y: 0, z: 0 };
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
   * 插值Framed8RotationTrack
   */
  private interpolateFramedRotation(
    track: Framed8RotationTrack,
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
      if (currentFrame !== null && nextFrame !== null && frame >= currentFrame && frame <= nextFrame) {
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
    const boneName = boneObject.name.replace("Joint_", "");
    const initialTransform = this.initialTransforms.get(boneName);

    // 直接设置动画变换（参考Blender导入器的逻辑）
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
   * 重置骨骼到初始姿态
   */
  private resetBonesToInitialPose(): void {
    // 这里应该重置到动画的第一帧或初始姿态
    // 暂时重置到单位变换
    this.boneMap.forEach((bone) => {
      bone.position.set(0, 0, 0);
      bone.quaternion.set(0, 0, 0, 1);
      bone.scale.set(1, 1, 1);
    });
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
