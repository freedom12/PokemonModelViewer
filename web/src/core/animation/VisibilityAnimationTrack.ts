/**
 * VisibilityAnimationTrack 模块
 *
 * 可见性动画轨道，控制网格的显示/隐藏。
 * 从 visibilityAnimationPlayer.ts 迁移逻辑。
 *
 * @module core/animation/VisibilityAnimationTrack
 */

import { AnimationTrack, BoolTrack, createBoolTrack } from './AnimationTrack';
import { VisibilityTrackData } from '../data/types';

/**
 * VisibilityAnimationTrack 类
 *
 * 可见性动画轨道，包含一个布尔值轨道用于控制网格的显示/隐藏。
 *
 * @extends AnimationTrack<boolean>
 *
 * @example
 * ```typescript
 * // 从数据创建可见性动画轨道
 * const track = VisibilityAnimationTrack.fromData(visibilityTrackData);
 *
 * // 获取第10帧的可见性
 * const visible = track.getVisibilityAtFrame(10);
 *
 * // 获取0.5秒时的可见性（30fps）
 * const visibleAtTime = track.getVisibilityAtTime(0.5, 30);
 * ```
 */
export class VisibilityAnimationTrack extends AnimationTrack<boolean> {
  /** 布尔值轨道 */
  readonly visibilityTrack: BoolTrack;

  /**
   * 创建可见性动画轨道
   *
   * @param targetName - 目标网格名称
   * @param visibilityTrack - 布尔值轨道
   */
  constructor(targetName: string, visibilityTrack: BoolTrack) {
    super(targetName);
    this.visibilityTrack = visibilityTrack;
  }

  /**
   * 获取指定帧的值
   *
   * @param frame - 帧索引
   * @returns 该帧的可见性（true 为可见，false 为隐藏）
   */
  getValueAtFrame(frame: number): boolean {
    return this.getVisibilityAtFrame(frame);
  }

  /**
   * 获取指定时间的值
   *
   * @param time - 时间（秒）
   * @param frameRate - 帧率（如 30）
   * @returns 该时间点的可见性
   */
  getValueAtTime(time: number, frameRate: number): boolean {
    return this.getVisibilityAtTime(time, frameRate);
  }

  /**
   * 获取指定帧的可见性
   *
   * 布尔值不进行插值，直接返回当前帧的值。
   *
   * @param frame - 帧索引（会被取整）
   * @returns 该帧的可见性
   */
  getVisibilityAtFrame(frame: number): boolean {
    // 布尔值不需要插值，直接取整数帧
    const intFrame = Math.floor(frame);
    return this.visibilityTrack.getValue(intFrame);
  }

  /**
   * 获取指定时间的可见性
   *
   * 将时间转换为帧后获取可见性。
   *
   * @param time - 时间（秒）
   * @param frameRate - 帧率
   * @returns 该时间点的可见性
   */
  getVisibilityAtTime(time: number, frameRate: number): boolean {
    // 将时间转换为帧
    const frame = time * frameRate;
    return this.getVisibilityAtFrame(frame);
  }

  /**
   * 从 VisibilityTrackData 创建 VisibilityAnimationTrack
   *
   * @param data - 可见性轨道数据
   * @returns VisibilityAnimationTrack 实例
   * @throws Error 如果无法创建布尔轨道
   */
  static fromData(data: VisibilityTrackData): VisibilityAnimationTrack {
    const boolTrack = createBoolTrack(data.visibilityTrack);

    if (!boolTrack) {
      throw new Error(
        `Failed to create bool track for visibility animation: ${data.targetName}`
      );
    }

    return new VisibilityAnimationTrack(data.targetName, boolTrack);
  }
}
