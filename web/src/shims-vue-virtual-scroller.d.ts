declare module 'vue-virtual-scroller' {
  import { Component } from 'vue'

  export const RecycleScroller: Component<{
    items: any[]
    itemSize: number
    keyField?: string
  }, any, any, any, any>

  export const DynamicScroller: Component<{
    items: any[]
    minItemSize: number
    keyField?: string
  }, any, any, any, any>

  export const DynamicScrollerItem: Component<{
    item: any
    active: boolean
    sizeDependencies?: any[]
    watchData?: boolean
  }, any, any, any, any>
}