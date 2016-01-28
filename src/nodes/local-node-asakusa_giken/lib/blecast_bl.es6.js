'use strict';
/*jshint bitwise: false*/

export function parse(manufacturerData) {
  let lx = 256 * manufacturerData[5] + manufacturerData[4];
  return {
    type: 'lx',
    unit: 'lx',
    val: lx
  };
}
