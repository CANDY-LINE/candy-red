Object.defineProperty(exports, '__esModule', {
  value: !0
});
var ERP2_HANDLERS = {
  'f6-02-04': function (e) {
    var t = {
      ebo: !1,
      rb: null,
      ra: null
    },
        n = e.dataDl[0];
    return 128 & n && (t.ebo = !0), 8 & n ? t.rb = 'I' : 4 & n && (t.rb = '0'), 2 & n ? t.ra = 'I' : 1 & n && (t.ra = '0'), t;
  },
  'd5-00-01': function (e) {
    var t = {
      lrn: !1,
      co: !1
    },
        n = e.dataDl[0];
    return 8 & n && (t.lrn = !0), 1 & n && (t.co = !0), t;
  }
};
exports.ERP2_HANDLERS = ERP2_HANDLERS;

/*jshint bitwise: false*/

/*
 * EEP payload handler collection
 */

// key = 'OBRG-FUNC-TYPE' (lower cases), value = function(ctx)
// State of the energy bow, false for released, true for pressed
// State of the rocker B, I for state I being pressed, 0 for state 0 being pressed
// State of the rocker A, I for state I being pressed, 0 for state 0 being pressed
// false for pressed, true for not pressed
// false for open, true for closed
//# sourceMappingURL=eep_handlers.js.map
