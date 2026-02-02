/**
 * Model 状态枚举
 *
 * 用于管理 Model 类的生命周期状态，支持延迟初始化模式。
 *
 * 状态转换规则：
 * - Unmaterialized -> Materializing: 调用 materialize()
 * - Materializing -> Materialized: 成功创建 GPU 资源
 * - Materializing -> Unmaterialized: 创建失败（清理资源）
 * - Materialized -> Unmaterialized: 调用 dematerialize()
 * - Materialized -> Disposed: 调用 dispose()
 * - Unmaterialized -> Disposed: 调用 dispose()
 *
 * @see 需求 8.1, 8.2, 8.3
 */
export enum ModelState {
  /** 未实例化：仅持有数据，未创建 GPU 资源 */
  Unmaterialized = 'unmaterialized',
  /** 实例化中：正在创建 GPU 资源 */
  Materializing = 'materializing',
  /** 已实例化：GPU 资源已创建，可以渲染 */
  Materialized = 'materialized',
  /** 已销毁：所有资源已释放，不可再使用 */
  Disposed = 'disposed'
}
