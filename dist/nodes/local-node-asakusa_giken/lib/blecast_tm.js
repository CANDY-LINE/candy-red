function parse(e) {
  var t = e[4] - ((128 & e[4]) << 1);
  return t += 0.5 * ((128 & e[5]) >> 7), {
    type: 'te',
    unit: 'C',
    val: t
  };
}

Object.defineProperty(exports, '__esModule', {
  value: !0
}), exports.parse = parse;

/*jshint bitwise: false*/
//# sourceMappingURL=blecast_tm.js.map
