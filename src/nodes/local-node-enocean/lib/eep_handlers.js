'use strict';
/*jshint bitwise: false*/

/*
 * EEP payload handler collection
 */

export const ERP2_HANDLERS = {
  // key = 'OBRG-FUNC-TYPE' (lower cases), value = function(ctx)
  'f6-02-04' : function(ctx) {
    let data = {
      type: ctx.telegramType
    };
    let state = ctx.dataDl[0];
    data.val = 'released';
    if (state & 0x08) {
      data.val = 'RBI'; // State I of the rocker B
    }
    if (state & 0x04) {
      data.val = 'RB0'; // State 0 of the rocker B
    }
    return data;
  }
};
