/**
 * FlatBuffers 解析器统一导出
 * 
 * 本模块导出所有 FlatBuffers 生成的 TypeScript 类型和解析器，
 * 用于解析宝可梦模型文件（TRMDL、TRMSH、TRMBF、TRMTR、TRMMT）。
 * 
 * @module parsers
 */

// 导出 flatbuffers 库以便使用 ByteBuffer
export * as flatbuffers from 'flatbuffers'

// ============================================
// 主要模型文件解析器
// ============================================

// TRMDL - 模型定义文件
export { TRMDL } from './generated/titan/model/trmdl.js'
export { trmeshes } from './generated/titan/model/trmeshes.js'
export { trskeleton } from './generated/titan/model/trskeleton.js'
export { TRSKL } from './generated/titan/model/trskl.js'
export { Lod } from './generated/titan/model/lod.js'
export { LodIndex } from './generated/titan/model/lod-index.js'
export { Bounds } from './generated/titan/model/bounds.js'

// TRMSH - 网格文件
export { TRMSH } from './generated/titan/model/trmsh.js'
export { MeshShape } from './generated/titan/model/mesh-shape.js'
export { VertexAccessor } from './generated/titan/model/vertex-accessor.js'
export { VertexAccessors } from './generated/titan/model/vertex-accessors.js'
export { VertexSize } from './generated/titan/model/vertex-size.js'
export { MaterialInfo } from './generated/titan/model/material-info.js'
export { BoundingBox } from './generated/titan/model/bounding-box.js'
export { Influence } from './generated/titan/model/influence.js'
export { VisShape } from './generated/titan/model/vis-shape.js'
export { MorphShape } from './generated/titan/model/morph-shape.js'
export { MorphData } from './generated/titan/model/morph-data.js'
export { MorphAccessor } from './generated/titan/model/morph-accessor.js'
export { MorphSize } from './generated/titan/model/morph-size.js'
export { MorphMetaData } from './generated/titan/model/morph-meta-data.js'

// TRMBF - 缓冲区文件
export { TRMBF } from './generated/titan/model/trmbf.js'
export { Buffer } from './generated/titan/model/buffer.js'
export { Indexes } from './generated/titan/model/indexes.js'
export { Vertices } from './generated/titan/model/vertices.js'
export { Morphs } from './generated/titan/model/morphs.js'
export { MorphBuffer } from './generated/titan/model/morph-buffer.js'

// TRMTR - 材质属性文件
export { TRMTR } from './generated/titan/model/trmtr.js'
export { Material } from './generated/titan/model/material.js'
export { Shader } from './generated/titan/model/shader.js'
export { Texture } from './generated/titan/model/texture.js'
export { SamplerState } from './generated/titan/model/sampler-state.js'
export { FloatParameter } from './generated/titan/model/float-parameter.js'
export { Float4Parameter } from './generated/titan/model/float4-parameter.js'
export { IntParameter } from './generated/titan/model/int-parameter.js'
export { StringParameter } from './generated/titan/model/string-parameter.js'
export { Byte_Extra } from './generated/titan/model/byte-extra.js'
export { Int_Extra } from './generated/titan/model/int-extra.js'

// TRMMT - 材质映射文件
export { TRMMT } from './generated/titan/model/trmmt.js'
export { MMT } from './generated/titan/model/mmt.js'
export { MaterialSwitches } from './generated/titan/model/material-switches.js'
export { MaterialMapper } from './generated/titan/model/material-mapper.js'
export { MaterialProperties } from './generated/titan/model/material-properties.js'
export { EmbeddedTRACM } from './generated/titan/model/embedded-tracm.js'

// TRSKL - 骨骼文件
export { Bone } from './generated/titan/model/bone.js'
export { IKControl } from './generated/titan/model/ikcontrol.js'
export { TransformNode } from './generated/titan/model/transform-node.js'
export { BoneMatrix } from './generated/titan/model/bone-matrix.js'

// ============================================
// 动画文件解析器
// ============================================

// TRACM - 材质动画文件
export { TRACM } from './generated/titan/animation/tracm.js'
export { Track } from './generated/titan/animation/track.js'
export { TrackConfig } from './generated/titan/animation/track-config.js'
export { TrackMaterialTimeline } from './generated/titan/animation/track-material-timeline.js'
export { TrackMaterial } from './generated/titan/animation/track-material.js'
export { TrackMaterialAnim } from './generated/titan/animation/track-material-anim.js'
export { TrackMaterialChannels } from './generated/titan/animation/track-material-channels.js'
export { TrackMaterialValue } from './generated/titan/animation/track-material-value.js'
export { TrackMaterialValueList } from './generated/titan/animation/track-material-value-list.js'
export { VisibilityShapeTimeline } from './generated/titan/animation/visibility-shape-timeline.js'
export { TrackFlagsInfo } from './generated/titan/animation/track-flags-info.js'
export { TrackFlag, unionToTrackFlag } from './generated/titan/animation/track-flag.js'
export { FixedBoolTrack } from './generated/titan/animation/fixed-bool-track.js'
export { DynamicBoolTrack } from './generated/titan/animation/dynamic-bool-track.js'
export { Framed16BoolTrack } from './generated/titan/animation/framed16-bool-track.js'
export { Framed8BoolTrack } from './generated/titan/animation/framed8-bool-track.js'

// TRANM - 骨骼动画文件
export { TRANM } from './generated/titan/animation/tranm.js'
export { BoneAnimation } from './generated/titan/animation/bone-animation.js'
export { BoneTrack } from './generated/titan/animation/bone-track.js'
export { BoneInit } from './generated/titan/animation/bone-init.js'
export { AnimationInfo } from './generated/titan/animation/animation-info.js'
export { Transform } from './generated/titan/animation/transform.js'
export { Vec2 } from './generated/titan/animation/vec2.js'
// Vec3 and Vec4 are exported from model section
export { VectorTrack, unionToVectorTrack, unionListToVectorTrack } from './generated/titan/animation/vector-track.js'
export { RotationTrack, unionToRotationTrack, unionListToRotationTrack } from './generated/titan/animation/rotation-track.js'
export { FixedVectorTrack } from './generated/titan/animation/fixed-vector-track.js'
export { DynamicVectorTrack } from './generated/titan/animation/dynamic-vector-track.js'
export { Framed16VectorTrack } from './generated/titan/animation/framed16-vector-track.js'
export { Framed8VectorTrack } from './generated/titan/animation/framed8-vector-track.js'
export { FixedRotationTrack } from './generated/titan/animation/fixed-rotation-track.js'
export { DynamicRotationTrack } from './generated/titan/animation/dynamic-rotation-track.js'
export { Framed16RotationTrack } from './generated/titan/animation/framed16-rotation-track.js'
export { Framed8RotationTrack } from './generated/titan/animation/framed8-rotation-track.js'

// 顶点属性类型
export { VertexAttribute } from './generated/titan/model/vertex-attribute.js'
export { Type } from './generated/titan/model/type.js'
export { PolygonType } from './generated/titan/model/polygon-type.js'
export { MorphAttribute } from './generated/titan/model/morph-attribute.js'

// UV 包裹模式
export { UVWrapMode } from './generated/titan/model/uvwrap-mode.js'

// ============================================
// 结构体类型
// ============================================

export { Vec3 } from './generated/titan/model/vec3.js'
export { Vec4 } from './generated/titan/model/vec4.js'
export { Sphere } from './generated/titan/model/sphere.js'
export { RGBA } from './generated/titan/model/rgba.js'
