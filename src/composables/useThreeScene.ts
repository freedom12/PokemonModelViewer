/**
 * useThreeScene.ts - Three.js 场景逻辑 composable
 * 
 * 封装 Three.js 场景的初始化和管理逻辑
 * 
 * 功能：
 * - 初始化 Scene、Camera、Renderer
 * - 创建 World 对象（参考平面网格 + 坐标轴）
 * - 集成 OrbitControls 实现摄像机控制
 * - 响应窗口调整，更新 canvas 尺寸和摄像机宽高比
 */
import { type Ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TRSKL, TransformNode } from '../parsers'

/**
 * 点击结果类型
 */
type ClickResult = 
  | { type: 'mesh', mesh: THREE.Mesh, faceIndex: number, vertices: Array<{ position: THREE.Vector3, normal: THREE.Vector3, uv?: THREE.Vector2 }> }
  | { type: 'bone', boneIndex: number, boneName: string, worldPosition: THREE.Vector3, localPosition: THREE.Vector3 }
  | null

/**
 * useThreeScene 选项接口
 */
export interface UseThreeSceneOptions {
  container: Ref<HTMLElement | null>
}

/**
 * useThreeScene 返回值接口
 */
export interface UseThreeSceneReturn {
  /** 初始化场景 */
  init: () => void
  /** 清理资源 */
  dispose: () => void
  /** 获取场景对象 */
  getScene: () => THREE.Scene | null
  /** 获取摄像机对象 */
  getCamera: () => THREE.PerspectiveCamera | null
  /** 获取控制器对象 */
  getControls: () => OrbitControls | null
  /** 获取 World 对象 */
  getWorld: () => THREE.Group | null
  /** 添加对象到场景 */
  addToScene: (object: THREE.Object3D) => void
  /** 从场景移除对象 */
  removeFromScene: (object: THREE.Object3D) => void
  /** 设置 World 可见性 */
  setWorldVisible: (visible: boolean) => void
  /** 显示/隐藏顶点法线 */
  setVertexNormalsVisible: (visible: boolean, model?: THREE.Object3D) => void
  /** 设置线框模式 */
  setWireframeMode: (enabled: boolean, model?: THREE.Object3D) => void
  /** 处理鼠标点击事件 */
  handleMouseClick: (event: MouseEvent, model?: THREE.Object3D) => ClickResult
  /** 高亮显示选中的三角形 */
  highlightSelectedTriangle: (mesh: THREE.Mesh | null, faceIndex: number | null) => void
  /** 高亮显示选中的骨骼 */
  highlightSelectedBone: (boneIndex: number | null) => void
  /** 创建骨骼可视化 */
  createSkeletonVisualization: (trskl: any) => THREE.Group | null
  /** 设置骨骼可见性 */
  setSkeletonVisible: (visible: boolean) => void
  /** 获取骨骼组 */
  getSkeletonGroup: () => THREE.Group | null
  /** 设置选择模式 */
  setSelectionMode: (mode: 'mesh' | 'bone') => void
}

/**
 * 场景状态接口
 */
interface SceneState {
  scene: THREE.Scene | null
  camera: THREE.PerspectiveCamera | null
  renderer: THREE.WebGLRenderer | null
  controls: OrbitControls | null
  world: THREE.Group | null
  ambientLight: THREE.AmbientLight | null
  directionalLight: THREE.DirectionalLight | null
  animationId: number | null
  vertexNormalsGroup: THREE.Group | null
  selectedTriangleHighlight: THREE.Mesh | null
  selectedBoneHighlight: THREE.Mesh | null
  skeletonGroup: THREE.Group | null
  selectionMode: 'mesh' | 'bone'
  trskl: TRSKL | null
}

/**
 * 配置常量
 */
const CONFIG = {
  // 场景配置
  scene: {
    backgroundColor: 0x1a1a2e
  },
  // 摄像机配置
  camera: {
    fov: 45,
    near: 0.01,
    far: 100,
    position: { x: 2, y: 1.5, z: 3 }
  },
  // 渲染器配置
  renderer: {
    antialias: true
  },
  // 控制器配置
  controls: {
    enableDamping: true,
    dampingFactor: 0.05,
    minDistance: 0.5,
    maxDistance: 50,
    enablePan: true,
    target: { x: 0, y: 0.5, z: 0 }  // 默认看向模型中心偏上
  },
  // World 配置
  world: {
    // 网格平面配置
    grid: {
      size: 4,
      divisions: 20,
      colorCenterLine: 0x444444,
      colorGrid: 0x333333
    },
    // 坐标轴配置
    axes: {
      size: 1
    }
  },
  // 光照配置
  lighting: {
    ambient: {
      color: 0xffffff,
      intensity: 0.6
    },
    directional: {
      color: 0xffffff,
      intensity: 0.8,
      position: { x: 5, y: 10, z: 7 }
    }
  }
} as const

/**
 * Three.js 场景管理 composable
 * 
 * @param options - 配置选项，包含容器元素引用
 * @returns 场景管理方法
 */
export function useThreeScene(options: UseThreeSceneOptions): UseThreeSceneReturn {
  const { container } = options

  // 场景状态
  const state: SceneState = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    world: null,
    ambientLight: null,
    directionalLight: null,
    animationId: null,
    vertexNormalsGroup: null,
    selectedTriangleHighlight: null,
    selectedBoneHighlight: null,
    skeletonGroup: null,
    selectionMode: 'mesh',
    trskl: null
  }

  /**
   * 创建 World 对象
   * 包含参考平面网格和坐标轴
   */
  function createWorld(): THREE.Group {
    const world = new THREE.Group()
    world.name = 'World'

    // 创建网格平面
    const gridHelper = new THREE.GridHelper(
      CONFIG.world.grid.size,
      CONFIG.world.grid.divisions,
      CONFIG.world.grid.colorCenterLine,
      CONFIG.world.grid.colorGrid
    )
    gridHelper.name = 'GridHelper'
    world.add(gridHelper)

    // 创建坐标轴（禁用深度测试避免 Z-fighting 闪烁）
    const axesHelper = new THREE.AxesHelper(CONFIG.world.axes.size)
    axesHelper.name = 'AxesHelper'
    // 设置渲染顺序，确保坐标轴在网格之上
    axesHelper.renderOrder = 1
    // 禁用深度测试，彻底解决 Z-fighting 问题
    axesHelper.traverse((child) => {
      if (child instanceof THREE.Line) {
        const material = child.material as THREE.LineBasicMaterial
        material.depthTest = false
      }
    })
    world.add(axesHelper)

    return world
  }

  /**
   * 初始化 Three.js 场景
   */
  function init(): void {
    if (!container.value) {
      console.warn('useThreeScene: 容器元素不存在，无法初始化场景')
      return
    }

    const containerElement = container.value
    const width = containerElement.clientWidth
    const height = containerElement.clientHeight

    // 1. 创建场景
    state.scene = new THREE.Scene()
    state.scene.background = new THREE.Color(CONFIG.scene.backgroundColor)

    // 2. 创建摄像机
    const aspect = width / height
    state.camera = new THREE.PerspectiveCamera(
      CONFIG.camera.fov,
      aspect,
      CONFIG.camera.near,
      CONFIG.camera.far
    )
    state.camera.position.set(
      CONFIG.camera.position.x,
      CONFIG.camera.position.y,
      CONFIG.camera.position.z
    )

    // 3. 创建渲染器
    state.renderer = new THREE.WebGLRenderer({
      antialias: CONFIG.renderer.antialias
    })
    state.renderer.setSize(width, height)
    state.renderer.setPixelRatio(window.devicePixelRatio)
    containerElement.appendChild(state.renderer.domElement)

    // 4. 创建 World 对象（网格 + 坐标轴）
    state.world = createWorld()
    state.scene.add(state.world)

    // 5. 添加光照系统
    state.ambientLight = new THREE.AmbientLight(
      CONFIG.lighting.ambient.color,
      CONFIG.lighting.ambient.intensity
    )
    state.scene.add(state.ambientLight)

    state.directionalLight = new THREE.DirectionalLight(
      CONFIG.lighting.directional.color,
      CONFIG.lighting.directional.intensity
    )
    state.directionalLight.position.set(
      CONFIG.lighting.directional.position.x,
      CONFIG.lighting.directional.position.y,
      CONFIG.lighting.directional.position.z
    )
    state.scene.add(state.directionalLight)

    // 6. 初始化 OrbitControls
    state.controls = new OrbitControls(state.camera, state.renderer.domElement)
    state.controls.enableDamping = CONFIG.controls.enableDamping
    state.controls.dampingFactor = CONFIG.controls.dampingFactor
    state.controls.minDistance = CONFIG.controls.minDistance
    state.controls.maxDistance = CONFIG.controls.maxDistance
    state.controls.enablePan = CONFIG.controls.enablePan
    state.controls.target.set(
      CONFIG.controls.target.x,
      CONFIG.controls.target.y,
      CONFIG.controls.target.z
    )
    state.controls.update()

    // 7. 添加窗口调整事件监听器
    window.addEventListener('resize', handleResize)

    // 8. 启动渲染循环
    animate()

    console.log('useThreeScene: 场景初始化完成')
  }

  /**
   * 处理窗口调整事件
   */
  function handleResize(): void {
    if (!container.value || !state.camera || !state.renderer) {
      return
    }

    const width = container.value.clientWidth
    const height = container.value.clientHeight

    state.camera.aspect = width / height
    state.camera.updateProjectionMatrix()
    state.renderer.setSize(width, height)
  }

  /**
   * 渲染循环
   */
  function animate(): void {
    state.animationId = requestAnimationFrame(animate)
    
    if (state.controls) {
      state.controls.update()
    }
    
    if (state.renderer && state.scene && state.camera) {
      state.renderer.render(state.scene, state.camera)
    }
  }

  /**
   * 清理 Three.js 资源
   */
  function dispose(): void {
    if (state.animationId !== null) {
      cancelAnimationFrame(state.animationId)
      state.animationId = null
    }

    window.removeEventListener('resize', handleResize)

    if (state.controls) {
      state.controls.dispose()
      state.controls = null
    }

    if (state.renderer) {
      state.renderer.dispose()
      if (state.renderer.domElement.parentElement) {
        state.renderer.domElement.parentElement.removeChild(state.renderer.domElement)
      }
      state.renderer = null
    }

    if (state.scene) {
      state.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose())
          } else {
            object.material.dispose()
          }
        }
      })
      state.scene = null
    }

    state.camera = null
    state.world = null
    state.ambientLight = null
    state.directionalLight = null
    state.vertexNormalsGroup = null
    state.selectedTriangleHighlight = null
    state.skeletonGroup = null
    state.trskl = null

    console.log('useThreeScene: 资源已清理')
  }

  function getScene(): THREE.Scene | null {
    return state.scene
  }

  function getCamera(): THREE.PerspectiveCamera | null {
    return state.camera
  }

  function getControls(): OrbitControls | null {
    return state.controls
  }

  function getWorld(): THREE.Group | null {
    return state.world
  }

  function addToScene(object: THREE.Object3D): void {
    if (state.scene) {
      state.scene.add(object)
    } else {
      console.warn('useThreeScene: 场景未初始化，无法添加对象')
    }
  }

  function removeFromScene(object: THREE.Object3D): void {
    if (state.scene) {
      state.scene.remove(object)
    }
  }

  /**
   * 设置 World 可见性
   */
  function setWorldVisible(visible: boolean): void {
    if (state.world) {
      state.world.visible = visible
    }
  }

  /**
   * 显示/隐藏顶点法线
   */
  function setVertexNormalsVisible(visible: boolean, model?: THREE.Object3D): void {
    // 如果有现有的法线组，先移除
    if (state.vertexNormalsGroup) {
      removeFromScene(state.vertexNormalsGroup)
      state.vertexNormalsGroup = null
    }

    if (!visible || !model) {
      return
    }

    // 创建新的法线组
    const normalsGroup = new THREE.Group()
    normalsGroup.name = 'VertexNormals'

    // 遍历模型中的所有Mesh
    model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const geometry = child.geometry
        const positions = geometry.attributes.position
        const normals = geometry.attributes.normal

        if (!positions || !normals) {
          return
        }

        // 创建材质用于绘制法线
        const material = new THREE.LineBasicMaterial({ color: 0x00ff00 }) // 绿色法线

        // 为每个顶点创建法线线条
        for (let i = 0; i < positions.count; i++) {
          const position = new THREE.Vector3().fromBufferAttribute(positions, i)
          const normal = new THREE.Vector3().fromBufferAttribute(normals, i)

          // 将顶点位置转换到世界坐标
          const worldPosition = child.localToWorld(position.clone())

          // 计算法线终点
          const normalLength = 0.05 // 法线长度，调整为更合适的大小
          const endPosition = worldPosition.clone().add(normal.clone().multiplyScalar(normalLength))

          // 创建线条几何体
          const lineGeometry = new THREE.BufferGeometry().setFromPoints([worldPosition, endPosition])
          const line = new THREE.Line(lineGeometry, material)

          normalsGroup.add(line)
        }
      }
    })

    // 添加到场景
    addToScene(normalsGroup)
    state.vertexNormalsGroup = normalsGroup
  }

  /**
   * 设置线框模式
   */
  function setWireframeMode(enabled: boolean, model?: THREE.Object3D): void {
    if (!model) {
      return
    }

    // 遍历模型中的所有Mesh，设置wireframe模式
    model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => {
            if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial) {
              material.wireframe = enabled
            }
          })
        } else {
          if (child.material instanceof THREE.MeshStandardMaterial || child.material instanceof THREE.MeshBasicMaterial) {
            child.material.wireframe = enabled
          }
        }
      }
    })
  }

  /**
   * 处理鼠标点击事件，返回点击的三角形信息
   */
  function handleMouseClick(event: MouseEvent, model?: THREE.Object3D): ClickResult {
    if (!state.renderer || !state.camera) {
      return null
    }

    // 获取canvas元素
    const canvas = state.renderer.domElement
    const rect = canvas.getBoundingClientRect()

    // 计算鼠标在canvas中的标准化坐标
    const mouse = new THREE.Vector2()
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    // 创建Raycaster
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, state.camera)

    if (state.selectionMode === 'mesh' && model) {
      // 面片选择模式
      // 获取所有可点击的mesh
      const meshes: THREE.Mesh[] = []
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          meshes.push(child)
        }
      })

      // 检测射线与mesh的交点
      const intersects = raycaster.intersectObjects(meshes)

      if (intersects.length > 0) {
        const intersect = intersects[0]
        const mesh = intersect.object as THREE.Mesh
        const faceIndex = intersect.faceIndex

        if (faceIndex !== undefined && mesh.geometry) {
          const geometry = mesh.geometry
          const positionAttribute = geometry.attributes.position
          const normalAttribute = geometry.attributes.normal
          const uvAttribute = geometry.attributes.uv

          // 获取三角形的三个顶点索引
          const a = intersect.face!.a
          const b = intersect.face!.b
          const c = intersect.face!.c

          // 辅助函数：安全地从buffer attribute获取向量数据
          const getVector3FromAttribute = (attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, index: number): THREE.Vector3 => {
            const vector = new THREE.Vector3()
            if (attribute instanceof THREE.BufferAttribute) {
              vector.fromBufferAttribute(attribute, index)
            } else {
              // InterleavedBufferAttribute
              vector.set(
                attribute.getX(index),
                attribute.getY(index),
                attribute.getZ(index)
              )
            }
            return vector
          }

          const getVector2FromAttribute = (attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, index: number): THREE.Vector2 => {
            const vector = new THREE.Vector2()
            if (attribute instanceof THREE.BufferAttribute) {
              vector.fromBufferAttribute(attribute, index)
            } else {
              // InterleavedBufferAttribute
              vector.set(
                attribute.getX(index),
                attribute.getY(index)
              )
            }
            return vector
          }

          const vertices = [
            {
              position: getVector3FromAttribute(positionAttribute, a),
              normal: getVector3FromAttribute(normalAttribute, a),
              uv: uvAttribute ? getVector2FromAttribute(uvAttribute, a) : undefined
            },
            {
              position: getVector3FromAttribute(positionAttribute, b),
              normal: getVector3FromAttribute(normalAttribute, b),
              uv: uvAttribute ? getVector2FromAttribute(uvAttribute, b) : undefined
            },
            {
              position: getVector3FromAttribute(positionAttribute, c),
              normal: getVector3FromAttribute(normalAttribute, c),
              uv: uvAttribute ? getVector2FromAttribute(uvAttribute, c) : undefined
            }
          ]

          return {
            type: 'mesh',
            mesh,
            faceIndex,
            vertices
          }
        }
      }
    } else if (state.selectionMode === 'bone' && state.skeletonGroup && state.trskl) {
      // 骨骼选择模式
      // 获取骨骼关节（球体）
      const joints: THREE.Mesh[] = []
      state.skeletonGroup.traverse((child) => {
        if (child instanceof THREE.Mesh && child.name.startsWith('Joint_')) {
          joints.push(child)
        }
      })

      // 检测射线与关节的交点
      const intersects = raycaster.intersectObjects(joints)

      if (intersects.length > 0) {
        const intersect = intersects[0]
        const joint = intersect.object as THREE.Mesh
        const boneName = joint.name.replace('Joint_', '')
        
        // 找到对应的骨骼索引
        let boneIndex = -1
        for (let i = 0; i < state.trskl.transformNodesLength(); i++) {
          const node = state.trskl.transformNodes(i)
          if (node && node.name() === boneName) {
            boneIndex = i
            break
          }
        }

        if (boneIndex >= 0) {
          // 获取世界坐标（关节位置）
          const worldPosition = joint.position.clone()

          // 获取本地坐标
          const node = state.trskl.transformNodes(boneIndex)
          let localPosition = new THREE.Vector3()
          if (node) {
            const transform = node.transform()
            if (transform) {
              const translate = transform.vecTranslate()
              if (translate) {
                localPosition.set(translate.x(), translate.y(), translate.z())
              }
            }
          }

          return {
            type: 'bone',
            boneIndex,
            boneName,
            worldPosition,
            localPosition
          }
        }
      }
    }

    return null
  }

  /**
   * 高亮显示选中的三角形
   */
  function highlightSelectedTriangle(mesh: THREE.Mesh | null, faceIndex: number | null): void {
    // 移除现有的高亮
    if (state.selectedTriangleHighlight) {
      removeFromScene(state.selectedTriangleHighlight)
      state.selectedTriangleHighlight.geometry.dispose()
      if (Array.isArray(state.selectedTriangleHighlight.material)) {
        state.selectedTriangleHighlight.material.forEach(material => material.dispose())
      } else {
        state.selectedTriangleHighlight.material.dispose()
      }
      state.selectedTriangleHighlight = null
    }

    // 如果没有选中任何东西，返回
    if (!mesh || faceIndex === null || !mesh.geometry) {
      return
    }

    const geometry = mesh.geometry
    const positionAttribute = geometry.attributes.position
    const indexAttribute = geometry.index

    if (!positionAttribute) {
      return
    }

    // 获取三角形的三个顶点索引
    let a: number, b: number, c: number
    if (indexAttribute) {
      // 使用索引缓冲区
      a = indexAttribute.getX(faceIndex * 3)
      b = indexAttribute.getX(faceIndex * 3 + 1)
      c = indexAttribute.getX(faceIndex * 3 + 2)
    } else {
      // 不使用索引缓冲区
      a = faceIndex * 3
      b = faceIndex * 3 + 1
      c = faceIndex * 3 + 2
    }

    // 创建三角形的几何体
    const triangleGeometry = new THREE.BufferGeometry()
    const positions = new Float32Array(9) // 3 vertices * 3 coordinates

    // 获取顶点位置
    const posA = new THREE.Vector3().fromBufferAttribute(positionAttribute, a)
    const posB = new THREE.Vector3().fromBufferAttribute(positionAttribute, b)
    const posC = new THREE.Vector3().fromBufferAttribute(positionAttribute, c)

    // 设置位置数组
    positions[0] = posA.x; positions[1] = posA.y; positions[2] = posA.z
    positions[3] = posB.x; positions[4] = posB.y; positions[5] = posB.z
    positions[6] = posC.x; positions[7] = posC.y; positions[8] = posC.z

    triangleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    // 计算三角形法线和朝向
    const edge1 = new THREE.Vector3().subVectors(posB, posA)
    const edge2 = new THREE.Vector3().subVectors(posC, posA)
    const faceNormal = new THREE.Vector3().crossVectors(edge1, edge2).normalize()

    // 计算三角形中心点
    const triangleCenter = new THREE.Vector3()
      .add(posA)
      .add(posB)
      .add(posC)
      .divideScalar(3)

    // 将中心点转换到世界坐标
    const worldCenter = triangleCenter.clone()
    mesh.localToWorld(worldCenter)

    // 获取相机位置
    const cameraPosition = state.camera ? state.camera.position.clone() : new THREE.Vector3(0, 0, 1)
    
    // 计算从三角形中心到相机的向量
    const toCamera = new THREE.Vector3().subVectors(cameraPosition, worldCenter).normalize()
    
    // 将法线转换到世界坐标
    const worldNormal = faceNormal.clone()
    mesh.getWorldDirection(worldNormal)
    
    // 计算点积来判断朝向
    const dotProduct = worldNormal.dot(toCamera)
    const isFrontFace = dotProduct > 0

    // 根据朝向选择颜色：正面绿色，反面红色
    const highlightColor = isFrontFace ? 0x00ff00 : 0xff0000

    // 创建材质
    const material = new THREE.MeshBasicMaterial({
      color: highlightColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    })

    // 创建高亮mesh
    const highlightMesh = new THREE.Mesh(triangleGeometry, material)
    highlightMesh.name = 'SelectedTriangleHighlight'

    // 设置变换矩阵与原mesh相同
    highlightMesh.matrix.copy(mesh.matrix)
    highlightMesh.matrixAutoUpdate = false

    // 添加到场景
    addToScene(highlightMesh)
    state.selectedTriangleHighlight = highlightMesh
  }

  function highlightSelectedBone(boneIndex: number | null): void {
    // 移除现有的骨骼高亮
    if (state.selectedBoneHighlight) {
      removeFromScene(state.selectedBoneHighlight)
      state.selectedBoneHighlight.geometry.dispose()
      if (Array.isArray(state.selectedBoneHighlight.material)) {
        state.selectedBoneHighlight.material.forEach(material => material.dispose())
      } else {
        state.selectedBoneHighlight.material.dispose()
      }
      state.selectedBoneHighlight = null
    }

    // 如果没有选中任何骨骼，返回
    if (boneIndex === null || !state.skeletonGroup || !state.trskl) {
      return
    }

    // 找到对应的骨骼关节
    let selectedJoint: THREE.Mesh | null = null
    state.skeletonGroup.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh && child.name.startsWith('Joint_')) {
        const jointBoneName = child.name.replace('Joint_', '')
        // 找到对应的骨骼索引
        for (let i = 0; i < state.trskl!.transformNodesLength(); i++) {
          const node = state.trskl!.transformNodes(i)
          if (node && node.name() === jointBoneName && i === boneIndex) {
            selectedJoint = child
            break
          }
        }
      }
    })

    if (!selectedJoint) {
      return
    }

    // 现在 selectedJoint 肯定不为 null，类型为 THREE.Mesh
    const joint: THREE.Mesh = selectedJoint

    // 创建高亮球体（比原球体稍大）
    const highlightGeometry = new THREE.SphereGeometry(0.03, 16, 16) // 更大的球体
    const highlightMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00, // 黄色高亮
      transparent: true,
      opacity: 0.8,
      depthTest: false // 不受深度测试影响，始终显示在最前面
    })

    // 创建高亮mesh
    const highlightMesh = new THREE.Mesh(highlightGeometry, highlightMaterial)
    highlightMesh.position.copy(joint.position)
    highlightMesh.name = 'SelectedBoneHighlight'
    highlightMesh.renderOrder = 2 // 设置更高的渲染顺序，确保在骨骼之上

    // 添加到场景
    addToScene(highlightMesh)
    state.selectedBoneHighlight = highlightMesh
  }

  /**
   * 创建骨骼可视化
   */
  function createSkeletonVisualization(trskl: TRSKL): THREE.Group | null {
    if (!trskl) {
      return null
    }

    state.trskl = trskl

    const skeletonGroup = new THREE.Group()
    skeletonGroup.name = 'Skeleton'

    // 创建骨骼节点映射
    const transformNodes: Map<number, TransformNode> = new Map()

    // 收集所有transform nodes，使用rig_idx作为key
    for (let i = 0; i < trskl.transformNodesLength(); i++) {
      const node = trskl.transformNodes(i)
      if (node) {
        transformNodes.set(i, node)
      }
    }

    // 计算每个骨骼的世界变换矩阵
    const worldMatrices: Map<number, THREE.Matrix4> = new Map()

    // 递归函数：计算世界变换矩阵
    function computeWorldMatrix(index: number): THREE.Matrix4 {
      if (worldMatrices.has(index)) {
        return worldMatrices.get(index)!
      }

      const node = transformNodes.get(index)
      if (!node) {
        return new THREE.Matrix4() // 单位矩阵
      }

      // 获取局部变换矩阵
      const localMatrix = new THREE.Matrix4()

      // 从transform_nodes的transform字段构建局部变换
      const transform = node.transform()
      if (transform) {
        const scale = transform.vecScale()
        const rotation = transform.vecRot()
        const translation = transform.vecTranslate()

        if (scale && rotation && translation) {
          // 创建缩放矩阵
          const scaleMatrix = new THREE.Matrix4().makeScale(scale.x(), scale.y(), scale.z())

          // 创建旋转矩阵 (欧拉角 -> 四元数)
          const euler = new THREE.Euler(rotation.x(), rotation.y(), rotation.z(), 'ZYX')
          const quat = new THREE.Quaternion().setFromEuler(euler)
          const rotationMatrix = new THREE.Matrix4().makeRotationFromQuaternion(quat)

          // 创建平移矩阵
          const translationMatrix = new THREE.Matrix4().makeTranslation(translation.x(), translation.y(), translation.z())

          // 组合变换：平移 * 旋转 * 缩放
          localMatrix.multiplyMatrices(rotationMatrix, scaleMatrix)
          localMatrix.multiplyMatrices(translationMatrix, localMatrix)
        }
      }

      // 获取父骨骼的世界变换
      const parentIdx = node.parentIdx()
      let worldMatrix = localMatrix.clone()

      if (parentIdx >= 0) {
        // 查找父节点的rig_idx
        const parentNode = trskl.transformNodes(parentIdx)
        if (parentNode) {
          const parentWorldMatrix = computeWorldMatrix(parentIdx)
          worldMatrix.multiplyMatrices(parentWorldMatrix, localMatrix)
        }
      }

      worldMatrices.set(index, worldMatrix)
      return worldMatrix
    }

    // 为每个骨骼创建可视化
    const jointMap = new Map<number, THREE.Mesh>()

    for (let index = 0; index < trskl.transformNodesLength(); index++) {
      const transformNode = trskl.transformNodes(index)!
      const boneName = transformNode.name() || `Bone_${index}`

      // 创建骨骼关节（球体）
      const jointGeometry = new THREE.SphereGeometry(0.02, 8, 8)
      const jointMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff0000,
        depthTest: false // 不受深度测试影响，始终显示在最前面
      })
      const joint = new THREE.Mesh(jointGeometry, jointMaterial)
      joint.name = `Joint_${boneName}`
      joint.renderOrder = 1 // 设置渲染顺序，确保在模型之后渲染
      
      jointMap.set(index, joint)
    }

    // 建立层次结构并设置局部变换
    for (let index = 0; index < trskl.transformNodesLength(); index++) {
      const transformNode = trskl.transformNodes(index)!
      const joint = jointMap.get(index)!
      
      const parentIdx = transformNode.parentIdx()
      if (parentIdx >= 0 && jointMap.has(parentIdx)) {
        // 添加到父关节
        jointMap.get(parentIdx)!.add(joint)
      } else {
        // 根关节添加到skeletonGroup
        skeletonGroup.add(joint)
      }
      
      // 设置局部变换
      const transform = transformNode.transform()
      if (transform) {
        const translate = transform.vecTranslate()
        const rotate = transform.vecRot()
        const scale = transform.vecScale()
        
        if (translate) {
          joint.position.set(translate.x(), translate.y(), translate.z())
        }
        if (rotate) {
          const euler = new THREE.Euler(rotate.x(), rotate.y(), rotate.z(), 'ZYX')
          joint.setRotationFromEuler(euler)
        }
        if (scale) {
          joint.scale.set(scale.x(), scale.y(), scale.z())
        }
      }
    }

    // 创建骨骼连接线 - 使用transform_nodes的层次结构
    transformNodes.forEach((node, rigIdx) => {
      const parentIdx = node.parentIdx()
      if (parentIdx >= 0) {
        const parentJoint = jointMap.get(parentIdx)
        const childJoint = jointMap.get(rigIdx)
        
        if (parentJoint && childJoint) {
          // 获取世界位置
          const parentWorldPos = new THREE.Vector3()
          const childWorldPos = new THREE.Vector3()
          parentJoint.getWorldPosition(parentWorldPos)
          childJoint.getWorldPosition(childWorldPos)

          // 创建骨骼线段
          const boneGeometry = new THREE.BufferGeometry().setFromPoints([parentWorldPos, childWorldPos])
          const boneMaterial = new THREE.LineBasicMaterial({ 
            color: 0x00ff00,
            depthTest: false // 不受深度测试影响，始终显示在最前面
          })
          const boneLine = new THREE.Line(boneGeometry, boneMaterial)
          boneLine.name = `Bone_${node.name()}`
          boneLine.renderOrder = 1 // 设置渲染顺序，确保在模型之后渲染
          
          // 存储关节引用用于动画更新
          boneLine.userData = { parentJoint, childJoint }
          
          skeletonGroup.add(boneLine)
        }
      }
    })

    // 清理旧的骨骼
    if (state.skeletonGroup) {
      removeFromScene(state.skeletonGroup)
    }

    state.skeletonGroup = skeletonGroup
    addToScene(skeletonGroup)
    return skeletonGroup
  }

  /**
   * 设置骨骼可见性
   */
  function setSkeletonVisible(visible: boolean): void {
    if (state.skeletonGroup) {
      state.skeletonGroup.visible = visible
    }
  }

  function getSkeletonGroup(): THREE.Group | null {
    return state.skeletonGroup
  }

  function setSelectionMode(mode: 'mesh' | 'bone'): void {
    state.selectionMode = mode
    // 切换模式时清除当前的选择和高亮
    highlightSelectedTriangle(null, null)
    highlightSelectedBone(null)
  }

  return {
    init,
    dispose,
    getScene,
    getCamera,
    getControls,
    getWorld,
    addToScene,
    removeFromScene,
    setWorldVisible,
    setVertexNormalsVisible,
    setWireframeMode,
    handleMouseClick,
    highlightSelectedTriangle,
    highlightSelectedBone,
    createSkeletonVisualization,
    setSkeletonVisible,
    getSkeletonGroup,
    setSelectionMode
  }
}
