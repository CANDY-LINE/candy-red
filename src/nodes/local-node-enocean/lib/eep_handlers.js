/**
 * @license
 * Copyright (c) 2019 CANDY LINE INC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

/*
 * EEP payload handler collection
 */

export const ERP2_HANDLERS = {
  // key = 'OBRG-FUNC-TYPE' (lower cases), value = function(ctx)
  'f6-02-04': ctx => {
    let data = {
      ebo: false, // State of the energy bow, false for released, true for pressed
      rb: null, // State of the rocker B, I for state I being pressed, 0 for state 0 being pressed
      ra: null // State of the rocker A, I for state I being pressed, 0 for state 0 being pressed
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
  },
  'd5-00-01': ctx => {
    let data = {
      lrn: false, // false for pressed, true for not pressed
      co: false // false for open, true for closed
    };
    let state = ctx.dataDl[0];
    if (state & 0x08) {
      data.lrn = true;
    }
    if (state & 0x01) {
      data.co = true;
    }
    return data;
  },
  'a5-07-01': ctx => {
    let data = {
      svc: null, // null if supply voltage is unsupported
      rips: false // false = RIP off, true = RIP on
    };
    let voltageSupported = ctx.dataDl[3] & 0x01;
    if (voltageSupported) {
      data.svc = ctx.dataDl[0]; // 0 - 250
    }
    data.rips = ctx.dataDl[2] > 127; // PIR on when RIPS > 127
    return data;
  }
};

export const ERP2_TEACH_IN_HANDLERS = {
  f6: ctx => {
    return ctx.dataDl.length === 1;
  },
  d5: (ctx, ignoreLRNBit = false) => {
    return (
      ctx.dataDl.length === 1 &&
      (ignoreLRNBit ? true : (ctx.dataDl[0] & 0x08) === 0)
    );
  },
  a5: (ctx, ignoreLRNBit = false) => {
    return (
      ctx.dataDl.length === 4 &&
      (ignoreLRNBit ? true : (ctx.dataDl[3] & 0x08) === 0)
    );
  }
};
