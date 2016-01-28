'use strict';
/*jshint bitwise: false*/

export function parse(manufacturerData) {
  let tempC = manufacturerData[4] - ((manufacturerData[4] & 0x80) << 1);
  tempC += ((manufacturerData[5] & 0x80) >> 7) * 0.5;
  return {
    type: 'te',
    unit: 'C',
    val: tempC
  };
}
