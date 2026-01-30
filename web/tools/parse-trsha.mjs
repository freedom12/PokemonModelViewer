import * as flatbuffers from "flatbuffers";

class SlotMapping {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }

  stringValue() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.__string(this.bb_pos + offset) : null;
  }

  uintValue() {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset ? this.bb.readUint32(this.bb_pos + offset) : 0;
  }
}

class SlotMap {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }

  slotName() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.__string(this.bb_pos + offset) : null;
  }

  slotValues(index, obj) {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset
      ? (obj || new SlotMapping()).__init(
          this.bb.__indirect(
            this.bb.__vector(this.bb_pos + offset) + index * 4,
          ),
          this.bb,
        )
      : null;
  }

  slotValuesLength() {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
  }

  bool1() {
    const offset = this.bb.__offset(this.bb_pos, 8);
    return offset ? this.bb.readUint8(this.bb_pos + offset) : 0;
  }

  bool2() {
    const offset = this.bb.__offset(this.bb_pos, 10);
    return offset ? this.bb.readUint8(this.bb_pos + offset) : 0;
  }

  bool3() {
    const offset = this.bb.__offset(this.bb_pos, 12);
    return offset ? this.bb.readUint8(this.bb_pos + offset) : 0;
  }

  slotIndex() {
    const offset = this.bb.__offset(this.bb_pos, 14);
    return offset ? this.bb.readUint8(this.bb_pos + offset) : 0;
  }

  offset() {
    const offset = this.bb.__offset(this.bb_pos, 16);
    return offset ? this.bb.readUint32(this.bb_pos + offset) : 0;
  }
}

class TRSHA {
  bb = null;
  bb_pos = 0;
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }

  static getRootAsTRSHA(bb, obj) {
    return (obj || new TRSHA()).__init(
      bb.readInt32(bb.position()) + bb.position(),
      bb,
    );
  }

  name() {
    const offset = this.bb.__offset(this.bb_pos, 4);
    return offset ? this.bb.__string(this.bb_pos + offset) : null;
  }

  fileName() {
    const offset = this.bb.__offset(this.bb_pos, 6);
    return offset ? this.bb.__string(this.bb_pos + offset) : null;
  }

  shaderParam(index, obj) {
    const offset = this.bb.__offset(this.bb_pos, 8);
    return offset
      ? (obj || new SlotMap()).__init(
          this.bb.__indirect(
            this.bb.__vector(this.bb_pos + offset) + index * 4,
          ),
          this.bb,
        )
      : null;
  }

  shaderParamLength() {
    const offset = this.bb.__offset(this.bb_pos, 8);
    return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
  }

  globalParam(index, obj) {
    const offset = this.bb.__offset(this.bb_pos, 10);
    return offset
      ? (obj || new SlotMap()).__init(
          this.bb.__indirect(
            this.bb.__vector(this.bb_pos + offset) + index * 4,
          ),
          this.bb,
        )
      : null;
  }

  globalParamLength() {
    const offset = this.bb.__offset(this.bb_pos, 10);
    return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
  }

  paramBuffer(index) {
    const offset = this.bb.__offset(this.bb_pos, 12);
    return offset
      ? this.bb.readUint32(this.bb.__vector(this.bb_pos + offset) + index * 4)
      : 0;
  }

  paramBufferLength() {
    const offset = this.bb.__offset(this.bb_pos, 12);
    return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
  }

  hasShaderParam() {
    const offset = this.bb.__offset(this.bb_pos, 14);
    return offset ? !!this.bb.readInt8(this.bb_pos + offset) : false;
  }

  hasGlobalParam() {
    const offset = this.bb.__offset(this.bb_pos, 16);
    return offset ? !!this.bb.readInt8(this.bb_pos + offset) : false;
  }
}

function slotMappingToJson(slotMapping) {
  return {
    stringValue: slotMapping.stringValue(),
    uintValue: slotMapping.uintValue(),
  };
}

function slotMapToJson(slotMap) {
  const result = {
    slotName: slotMap.slotName(),
    slotValues: [],
    bool1: slotMap.bool1(),
    bool2: slotMap.bool2(),
    bool3: slotMap.bool3(),
    slotIndex: slotMap.slotIndex(),
    offset: slotMap.offset(),
  };

  for (let i = 0; i < slotMap.slotValuesLength(); i++) {
    result.slotValues.push(slotMappingToJson(slotMap.slotValues(i)));
  }

  return result;
}

function trshaToJson(trsha) {
  const result = {
    name: trsha.name(),
    fileName: trsha.fileName(),
    hasShaderParam: trsha.hasShaderParam(),
    hasGlobalParam: trsha.hasGlobalParam(),
  };

  if (trsha.hasShaderParam()) {
    result.shaderParam = [];
    for (let i = 0; i < trsha.shaderParamLength(); i++) {
      result.shaderParam.push(slotMapToJson(trsha.shaderParam(i)));
    }
  }

  if (trsha.hasGlobalParam()) {
    result.globalParam = [];
    for (let i = 0; i < trsha.globalParamLength(); i++) {
      result.globalParam.push(slotMapToJson(trsha.globalParam(i)));
    }
  }

  result.paramBuffer = [];
  for (let i = 0; i < trsha.paramBufferLength(); i++) {
    result.paramBuffer.push(trsha.paramBuffer(i));
  }

  return result;
}

import fs from "fs";
import path from "path";

const filePath = process.argv[2];
const outputPath = process.argv[3];

if (!filePath || !outputPath) {
  console.error("Usage: node parse-trsha.mjs <input.trsha> <output.json>");
  process.exit(1);
}

const buffer = fs.readFileSync(filePath);
const bb = new flatbuffers.ByteBuffer(buffer);
const trsha = TRSHA.getRootAsTRSHA(bb);
const json = trshaToJson(trsha);
fs.writeFileSync(outputPath, JSON.stringify(json, null, 2));
console.log("Converted to JSON");
