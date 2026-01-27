import math


SCALE = 0x7FFF
PI_QUARTER = math.pi / 4.0
PI_HALF = math.pi / 2.0


def expand_float(i):
    """
    Expands packed integer into float.
    :param i: Packed integer.
    :return: Expanded float.
    """
    return i * (PI_HALF / SCALE) - PI_QUARTER


def unpack_48bit_quaternion(x, y, z):
    """
    Unpacks 48-bit integer Vector into Blender Quaternion.
    :param x: X value.
    :param y: Y value.
    :param z: Z value.
    :return: Blender Quaternion.
    """
    pack = (z << 32) | (y << 16) | x
    print("Packed Value: {}".format(pack))
    q1 = expand_float((pack >> 3) & 0x7FFF)
    q2 = expand_float((pack >> 18) & 0x7FFF)
    q3 = expand_float((pack >> 33) & 0x7FFF)
    print("q1: {}, q2: {}, q3: {}".format(q1, q2, q3))
    values = [q1, q2, q3]
    max_component = max(1.0 - (q1 * q1 + q2 * q2 + q3 * q3), 0.0)
    max_component = math.sqrt(max_component)
    missing_component = pack & 0B0011
    values.insert(missing_component, max_component)
    is_negative = (pack & 0B0100) != 0
    return (
        [values[3], values[0], values[1], values[2]]
        if not is_negative
        else [-values[3], -values[0], -values[1], -values[2]]
    )

    # x: 42,
    # y: 61442,
    # z: 62196


[x, y, z, w] = unpack_48bit_quaternion(42, 61442, 62196)
print("Unpacked Quaternion: x={}, y={}, z={}, w={}".format(x, y, z, w))