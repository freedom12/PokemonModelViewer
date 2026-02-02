/**
 * Model 错误类
 *
 * 定义 Model 延迟初始化相关的错误类型。
 *
 * @see 需求 8.4
 */

/**
 * Model 未实例化错误
 *
 * 当尝试访问需要实例化的功能时抛出。
 * 例如：在未调用 materialize() 之前尝试播放动画或访问渲染相关方法。
 *
 * @example
 * ```typescript
 * if (!model.isMaterialized) {
 *   throw new ModelNotMaterializedError('play animation')
 * }
 * ```
 */
export class ModelNotMaterializedError extends Error {
  constructor(operation: string) {
    super(`Cannot ${operation}: Model is not materialized. Call materialize() first.`)
    this.name = 'ModelNotMaterializedError'
  }
}

/**
 * Model 已销毁错误
 *
 * 当尝试对已销毁的 Model 进行任何操作时抛出。
 * 一旦 Model 被 dispose()，它将不可再使用。
 *
 * @example
 * ```typescript
 * if (model.isDisposed) {
 *   throw new ModelDisposedError('access model data')
 * }
 * ```
 */
export class ModelDisposedError extends Error {
  constructor(operation?: string) {
    const message = operation
      ? `Cannot ${operation}: Model has been disposed and cannot be used.`
      : 'Model has been disposed and cannot be used.'
    super(message)
    this.name = 'ModelDisposedError'
  }
}
