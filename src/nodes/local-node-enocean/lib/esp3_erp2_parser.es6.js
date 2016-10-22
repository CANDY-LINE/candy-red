'use strict';
/*jshint bitwise: false*/

import Promise from 'es6-promises';

const CRC8_TABLE = [
  0x00, 0x07, 0x0e, 0x09, 0x1c, 0x1b, 0x12, 0x15,
  0x38, 0x3f, 0x36, 0x31, 0x24, 0x23, 0x2a, 0x2d,
  0x70, 0x77, 0x7e, 0x79, 0x6c, 0x6b, 0x62, 0x65,
  0x48, 0x4f, 0x46, 0x41, 0x54, 0x53, 0x5a, 0x5d,
  0xe0, 0xe7, 0xee, 0xe9, 0xfc, 0xfb, 0xf2, 0xf5,
  0xd8, 0xdf, 0xd6, 0xd1, 0xc4, 0xc3, 0xca, 0xcd,
  0x90, 0x97, 0x9e, 0x99, 0x8c, 0x8b, 0x82, 0x85,
  0xa8, 0xaf, 0xa6, 0xa1, 0xb4, 0xb3, 0xba, 0xbd,
  0xc7, 0xc0, 0xc9, 0xce, 0xdb, 0xdc, 0xd5, 0xd2,
  0xff, 0xf8, 0xf1, 0xf6, 0xe3, 0xe4, 0xed, 0xea,
  0xb7, 0xb0, 0xb9, 0xbe, 0xab, 0xac, 0xa5, 0xa2,
  0x8f, 0x88, 0x81, 0x86, 0x93, 0x94, 0x9d, 0x9a,
  0x27, 0x20, 0x29, 0x2e, 0x3b, 0x3c, 0x35, 0x32,
  0x1f, 0x18, 0x11, 0x16, 0x03, 0x04, 0x0d, 0x0a,
  0x57, 0x50, 0x59, 0x5e, 0x4b, 0x4c, 0x45, 0x42,
  0x6f, 0x68, 0x61, 0x66, 0x73, 0x74, 0x7d, 0x7a,
  0x89, 0x8e, 0x87, 0x80, 0x95, 0x92, 0x9b, 0x9c,
  0xb1, 0xb6, 0xbf, 0xb8, 0xad, 0xaa, 0xa3, 0xa4,
  0xf9, 0xfe, 0xf7, 0xf0, 0xe5, 0xe2, 0xeb, 0xec,
  0xc1, 0xc6, 0xcf, 0xc8, 0xdd, 0xda, 0xd3, 0xd4,
  0x69, 0x6e, 0x67, 0x60, 0x75, 0x72, 0x7b, 0x7c,
  0x51, 0x56, 0x5f, 0x58, 0x4d, 0x4a, 0x43, 0x44,
  0x19, 0x1e, 0x17, 0x10, 0x05, 0x02, 0x0b, 0x0c,
  0x21, 0x26, 0x2f, 0x28, 0x3d, 0x3a, 0x33, 0x34,
  0x4e, 0x49, 0x40, 0x47, 0x52, 0x55, 0x5c, 0x5b,
  0x76, 0x71, 0x78, 0x7f, 0x6A, 0x6d, 0x64, 0x63,
  0x3e, 0x39, 0x30, 0x37, 0x22, 0x25, 0x2c, 0x2b,
  0x06, 0x01, 0x08, 0x0f, 0x1a, 0x1d, 0x14, 0x13,
  0xae, 0xa9, 0xa0, 0xa7, 0xb2, 0xb5, 0xbc, 0xbb,
  0x96, 0x91, 0x98, 0x9f, 0x8a, 0x8D, 0x84, 0x83,
  0xde, 0xd9, 0xd0, 0xd7, 0xc2, 0xc5, 0xcc, 0xcb,
  0xe6, 0xe1, 0xe8, 0xef, 0xfa, 0xfd, 0xf4, 0xf3
];

const LONG_DATA_ID_IDX = [
  [3, 0], [4, 0], [4, 4], [6, 0]
];

const TELEGRAM_TYPES = {
  0x00: ['RPS', 0xf6],
  0x01: ['1BS', 0xd5],
  0x02: ['4BS', 0xa5],
  0x03: ['Smart Acknowledge Signal', 0xd0],
  0x04: ['VDL', 0xd2],
  0x05: ['Universal Teach-In EEP', 0xd4],
  0x06: ['MSC', 0xd1],
  0x07: ['SEC', 0x30],
  0x08: ['SEC_ENCAPS', 0x31],
  0x09: ['Secure Teach-In telegram for switch', 0x35],
  0x0a: ['Generic Profiles selective data', 0xb3],
  0x0b: ['reserved'],
  0x0c: ['reserved'],
  0x0d: ['reserved'],
  0x0e: ['reserved'],
  0x0f: ['Extended Telegram type available']
};

if (!Uint8Array.prototype.slice) {
  Uint8Array.prototype.slice = Array.prototype.slice;
}

class Utils {
  static pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
  }

  static crc8(crc8, u8data) {
    return CRC8_TABLE[crc8 ^ u8data];
  }
}

// EnOcean Radio Protocol 2 SPECIFICATION V1.0 September 26, 2013
export class ERP2Parser {

  parse(payload) {
    let len, dataPl, p, c;
    if (typeof(payload) === 'object' && payload.payload && ERP2Parser.isArray(payload.payload)) {
      dataPl = payload.payload;
      c = payload;
    } else if (typeof(payload) === 'string') {
      dataPl = new Uint8Array(new Buffer(payload, 'hex'));
    } else if (ERP2Parser.isArray(payload)) {
      dataPl = payload;
    } else if (payload instanceof Buffer) {
      dataPl = new Uint8Array(payload);
    } else {
      throw new Error('Unsupported ERP2 payload data type!');
    }
    len = dataPl.length;

    if (len <= 6) {
      p = this._doParseShort(len, dataPl, c);
    } else {
      p = this._doParseLong(len, dataPl, c);
    }
    return p;
  }

  static isArray(val) {
    return (val instanceof Array) || (val instanceof Uint8Array);
  }

  _doParseShort(len, dataPl, c) {
    return new Promise((resolve, reject) => {
      try {
        let i, ctx = { len: len, payload: dataPl, originatorId: '' }, idLen = len - 1, dlLen = 1;
        if (len === 1) {
          ctx.originatorId = Utils.pad(dataPl[0].toString(16), 2);
          dlLen = 0;
        } else if (len >= 6) {
          idLen = 4;
          dlLen = 2;
        }
        for (i = 0; i < idLen; i++) {
          ctx.originatorId += Utils.pad(dataPl[i].toString(16), 2);
        }
        ctx.originatorIdInt = parseInt(ctx.originatorId, 16);
        for (i = 0; i < dlLen; i++) {
          ctx.dataDl += Utils.pad(dataPl[i + idLen].toString(16), 2);
        }
        if (c) {
          ctx.container = c;
        }
        resolve(ctx);
      } catch (e) {
        reject(e);
      }
    });
  }

  _doParseLong(len, dataPl, c) {
    return new Promise((resolve, reject) => {
      try {
        // Bit 5...7 Address Control
        let addressControl = dataPl[0] >> 5;
        if (!LONG_DATA_ID_IDX[addressControl]) {
          throw new Error('Reserved address is unsupported');
        }
        let i, ctx = { len: len, payload: dataPl, originatorId: '', destinationId: '' };
        let idLen = LONG_DATA_ID_IDX[addressControl][0];
        let destLen = LONG_DATA_ID_IDX[addressControl][1];
        for (i = 0; i < idLen; i++) {
          ctx.originatorId += Utils.pad(dataPl[i + 1].toString(16), 2);
        }
        for (i = 0; i < destLen; i++) {
          ctx.destinationId += Utils.pad(dataPl[i + idLen + 1].toString(16), 2);
        }
        ctx.originatorIdInt = parseInt(ctx.originatorId, 16);

        // Bit4 Extended header available
        let extendedHeader = (dataPl[0] & 0x10) >> 4;
        if (extendedHeader > 0) {
          throw new Error('Extended header is unsuported');
        }

        // Bit 0...3 Telegram type (R-ORG)
        let telegramType = dataPl[0] & 0x0f;
        if (telegramType === 0x0f) {
          throw new Error('Extended Telegram type is unsuported');
        }

        ctx.telegramType = TELEGRAM_TYPES[telegramType][0];
        ctx.rorg = TELEGRAM_TYPES[telegramType][1];
        ctx.dataDl = dataPl.slice(idLen + destLen + 1, dataPl.length - 1);

        // Compute CRC8 with DATA_PL except CRC
        let crc8 = 0;
        for (i = 0; i < dataPl.length - 1; i++) {
          crc8 = Utils.crc8(crc8, dataPl[i]);
        }
        if (crc8 !== dataPl[dataPl.length - 1]) {
          throw new Error('CRC8 checksum failure');
        }

        if (c) {
          ctx.container = c;
        }

        resolve(ctx);
      } catch (e) {
        reject(e);
      }
    });
  }
}

// EnOcean Serial Protocol 3 (ESP3) V1.27 / July 30, 2014
export class ESP3RadioERP2Parser {
  parse(payload) {
    let len, esp3;
    if (typeof(payload) === 'string') {
      esp3 = new Uint8Array(new Buffer(payload, 'hex'));
    } else if (payload instanceof Array) {
      esp3 = payload;
    } else if (payload instanceof Buffer) {
      esp3 = new Uint8Array(payload);
    } else {
      throw new Error('Unsupported ESP3 payload data type!');
    }
    len = esp3.length;
    return new Promise((resolve, reject) => {
      try {
        if (esp3[0] !== 0x55) {
          throw new Error('Unknown Synchronization-word');
        }
        if (esp3[4] !== 0x0a) {
          throw new Error('Invalid packet type, RADIO_ERP2(0x0a) is expected');
        }
        if (esp3[3] !== 0x02) {
          throw new Error('Invalid optinal size');
        }
        let crc8 = 0, i, header = esp3.slice(1, 5);
        for (i = 0; i < header.length; i++) {
          crc8 = Utils.crc8(crc8, header[i]);
        }
        if (crc8 !== esp3[5]) {
          throw new Error('CRC8 for header value checksum failure');
        }

        let ctx = { len: len };
        let dataLen = esp3[1] * 256 + esp3[2];
        ctx.payload = esp3.slice(6, 6 + dataLen);
        ctx.subTelNum = esp3[6 + dataLen];
        ctx.dBm = esp3[7 + dataLen];

        crc8 = 0;
        for (i = 0; i < (dataLen + 2); i++) {
          crc8 = Utils.crc8(crc8, esp3[i + 6]);
        }
        if (crc8 !== esp3[esp3.length - 1]) {
          throw new Error('CRC8 for data value checksum failure');
        }
        resolve(ctx);
      } catch (e) {
        reject(e);
      }
    });
  }
}
