// 测试 unpackQuaternion 函数

// 向量类型
class Vec3 {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

// 四元数类型
class Quat {
  constructor(x, y, z, w) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }
}

// 展开打包的浮点数
function expandFloat(i) {
  const SCALE = 0x7FFF;
  const PI_QUARTER = Math.PI / 4.0;
  const PI_HALF = Math.PI / 2.0;
  return i * (PI_HALF / SCALE) - PI_QUARTER;
}

// 解包48-bit四元数
function unpackQuaternion(x, y, z) {
  const pack = (BigInt(z) << 32n) | (BigInt(y) << 16n) | BigInt(x);
  console.log('Packed value:', pack);
  const q1 = expandFloat(Number((pack >> 3n) & 0x7FFFn));
  const q2 = expandFloat(Number((pack >> 18n) & 0x7FFFn));
  const q3 = expandFloat(Number((pack >> 33n) & 0x7FFFn));
  console.log('Expanded components:', q1, q2, q3);
  const values = [q1, q2, q3];
  const maxComponent = Math.max(1.0 - (q1 * q1 + q2 * q2 + q3 * q3), 0.0);
  const missingComponent = Math.sqrt(maxComponent);
  const missingIndex = Number(pack & 0x3n);
  values.splice(missingIndex, 0, missingComponent);
  const isNegative = (pack & 0x4n) !== 0n;
  if (isNegative) {
    return new Quat(-values[3], -values[0], -values[1], -values[2]);
  } else {
    return new Quat(values[3], values[0], values[1], values[2]);
  }
}

// 测试
const result = unpackQuaternion(42, 61442, 62196);
console.log('unpackQuaternion(42, 61442, 62196) result:', {
  x: result.x,
  y: result.y,
  z: result.z,
  w: result.w
});