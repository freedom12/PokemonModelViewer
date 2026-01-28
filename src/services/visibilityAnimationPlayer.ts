/**
 * 可见性动画播放服务
 * 负责加载和播放 tracm 文件中的可见性动画
 */

import * as THREE from "three";
import {
  flatbuffers,
  TRACM,
  Track,
  VisibilityShapeTimeline,
  TrackFlagsInfo,
  TrackFlag,
  unionToTrackFlag,
  FixedBoolTrack,
  DynamicBoolTrack,
  Framed16BoolTrack,
  Framed8BoolTrack,
} from "../parsers";

/**
 * 可见性动画状态接口
 */
interface VisibilityAnimationState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  loop: boolean;
  currentFrame: number;
}

/**
 * 可见性轨道信息
 */
interface VisibilityTrack {
  trackPath: string;
  timeline: VisibilityShapeTimeline;
}

/**
 * 可见性动画播放器
 */
export class VisibilityAnimationPlayer {
  private tracmData: TRACM | null = null;
  private state: VisibilityAnimationState;
  private animationId: number | null = null;
  private modelGroup: THREE.Group | null = null;
  private tracks: VisibilityTrack[] = [];
  private visibilityFrameMultiplier: number = 1;

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
   * 加载 tracm 动画文件
   * @param animationUrl - tracm 文件 URL
   */
  async loadAnimation(animationUrl: string): Promise<void> {
    try {
      const response = await fetch(animationUrl);
      if (!response.ok) {
        throw new Error(`Failed to load visibility animation: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const bb = new flatbuffers.ByteBuffer(new Uint8Array(buffer));
      this.tracmData = TRACM.getRootAsTRACM(bb);

      if (!this.tracmData) {
        throw new Error("Failed to parse TRACM data");
      }

      // 获取配置
      const config = this.tracmData.config();
      if (config) {
        this.state.duration = config.duration() / (config.framerate() || 60);
        this.visibilityFrameMultiplier = this.tracmData.visibilityFrameMultiplier() || 1;
      }

      // 解析可见性轨道
      this.tracks = [];
      const tracksLength = this.tracmData.tracksLength();
      for (let i = 0; i < tracksLength; i++) {
        const track = this.tracmData.tracks(i);
        if (track && track.visibilityAnimation()) {
          this.tracks.push({
            trackPath: track.trackPath() || "",
            timeline: track.visibilityAnimation()!,
          });
        }
      }

      console.log("Visibility animation loaded:", {
        duration: this.state.duration,
        tracksCount: this.tracks.length,
        frameMultiplier: this.visibilityFrameMultiplier,
      });
    } catch (error) {
      console.error("Error loading visibility animation:", error);
      throw error;
    }
  }

  /**
   * 设置模型组，用于应用可见性动画
   * @param modelGroup - THREE.Group 模型组
   */
  setModelGroup(modelGroup: THREE.Group): void {
    this.modelGroup = modelGroup;
  }

  /**
   * 播放动画
   */
  play(): void {
    if (!this.tracmData || this.state.isPlaying) return;

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
   * 停止动画并重置到开始
   */
  stop(): void {
    this.pause();
    this.state.currentTime = 0;
    this.state.currentFrame = 0;
    this.updateVisibility();
  }

  /**
   * 设置循环播放
   * @param loop - 是否循环
   */
  setLoop(loop: boolean): void {
    this.state.loop = loop;
  }

  /**
   * 设置当前时间
   * @param time - 时间（秒）
   */
  setCurrentTime(time: number): void {
    this.state.currentTime = Math.max(0, Math.min(time, this.state.duration));
    this.state.currentFrame = Math.floor(this.state.currentTime * 60); // 假设 60fps
    this.updateVisibility();
  }

  /**
   * 获取当前状态
   */
  getState(): VisibilityAnimationState {
    return { ...this.state };
  }

  /**
   * 销毁播放器
   */
  dispose(): void {
    this.pause();
    this.tracmData = null;
    this.modelGroup = null;
    this.tracks = [];
  }

  /**
   * 动画循环
   */
  private animate = (): void => {
    if (!this.state.isPlaying) return;

    // 更新时间
    const framerate = this.tracmData?.config()?.framerate() || 60;
    this.state.currentTime += 1 / framerate;
    this.state.currentFrame = Math.floor(this.state.currentTime * framerate);

    // 检查是否结束
    if (this.state.currentTime >= this.state.duration) {
      if (this.state.loop) {
        this.state.currentTime = 0;
        this.state.currentFrame = 0;
      } else {
        this.stop();
        return;
      }
    }

    // 更新可见性
    this.updateVisibility();

    // 继续动画
    this.animationId = requestAnimationFrame(this.animate);
  };

  /**
   * 更新所有轨道的可见性
   */
  private updateVisibility(): void {
    if (!this.modelGroup) return;

    for (const track of this.tracks) {
      const mesh = this.findMeshByPath(track.trackPath);
      if (mesh) {
        const visible = this.getVisibilityAtTime(track.timeline, this.state.currentFrame);
        mesh.visible = visible;
      }
    }
  }

  /**
   * 根据轨道路径查找网格
   * @param trackPath - 轨道路径
   * @returns THREE.Mesh 或 null
   */
  private findMeshByPath(trackPath: string): THREE.Mesh | null {
    if (!this.modelGroup) return null;

    // 递归查找匹配名称的网格
    const findMesh = (object: THREE.Object3D): THREE.Mesh | null => {
      if (object instanceof THREE.Mesh && object.name === trackPath) {
        return object;
      }
      for (const child of object.children) {
        const found = findMesh(child);
        if (found) return found;
      }
      return null;
    };

    return findMesh(this.modelGroup);
  }

  private getVisibilityAtTime(timeline: VisibilityShapeTimeline, frame: number): boolean {
    const info = timeline.info();
    if (!info) return true;

    const flagType = info.valuesType();
    const flagValue = unionToTrackFlag(flagType, (obj) => info.values(obj));

    switch (flagType) {
      case TrackFlag.FixedBoolTrack: {
        const fixedTrack = flagValue as FixedBoolTrack;
        if (!fixedTrack) {
          return false;
        }
        return fixedTrack.value();
      }

      case TrackFlag.DynamicBoolTrack: {
        const dynamicTrack = flagValue as DynamicBoolTrack;
        if (!dynamicTrack) return true;
        const valuesLength = dynamicTrack.valueLength();
        if (valuesLength === 0) return true;

        // 使用帧号对值数组长度取模
        const index = frame % valuesLength;
        const value = dynamicTrack.value(index);
        return value !== null ? value : true;
      }

      case TrackFlag.Framed16BoolTrack: {
        const framedTrack = flagValue as Framed16BoolTrack;
        if (!framedTrack) return true;
        const framesLength = framedTrack.framesLength();
        const valuesLength = framedTrack.valueLength();

        if (framesLength === 0 || valuesLength === 0) return true;

        // 找到当前帧所在的区间
        let currentIndex = 0;
        for (let i = 0; i < framesLength; i++) {
          const frameValue = framedTrack.frames(i);
          if (frameValue !== null && frame >= frameValue) {
            currentIndex = i;
          } else {
            break;
          }
        }

        // 如果超出范围，使用最后一个值
        if (currentIndex >= valuesLength) {
          currentIndex = valuesLength - 1;
        }

        const value = framedTrack.value(currentIndex);
        return value !== null ? value : true;
      }

      case TrackFlag.Framed8BoolTrack: {
        const framedTrack = flagValue as Framed8BoolTrack;
        if (!framedTrack) return true;
        const framesLength = framedTrack.framesLength();
        const valuesLength = framedTrack.valueLength();

        if (framesLength === 0 || valuesLength === 0) return true;

        // 找到当前帧所在的区间
        let currentIndex = 0;
        for (let i = 0; i < framesLength; i++) {
          const frameValue = framedTrack.frames(i);
          if (frameValue !== null && frame >= frameValue) {
            currentIndex = i;
          } else {
            break;
          }
        }

        // 如果超出范围，使用最后一个值
        if (currentIndex >= valuesLength) {
          currentIndex = valuesLength - 1;
        }

        const value = framedTrack.value(currentIndex);
        return value !== null ? value : true;
      }

      default:
        return true;
    }
  }
}