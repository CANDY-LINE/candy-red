'use strict';
/*jshint bitwise: false*/

/*
 * EEP payload handler collection
 */

export const ERP2_HANDLERS = {
  // key = 'OBRG-FUNC-TYPE' (lower cases), value = function(ctx)
  'f6-02-04' : function(ctx) {
    let data = {
      ebo: false, // State of the energy bow, false for released, true for pressed
      rb: null,   // State of the rocker B, I for state I being pressed, 0 for state 0 being pressed
      ra: null    // State of the rocker A, I for state I being pressed, 0 for state 0 being pressed
    };
    let state = ctx.dataDl[0];
    if (state & 0x80) {
      data.ebo = true;
    }
    if (state & 0x08) {
      data.rb = 'I';
    } else if (state & 0x04) {
      data.rb = '0';
    }
    if (state & 0x02) {
      data.ra = 'I';
    } else if (state & 0x01) {
      data.ra = '0';
    }
    return data;
  }
};
