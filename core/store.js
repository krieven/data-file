"use strict";
const fs = require('fs');

const EMPTY_FUNC = () => undefined;

const DEFAULT_PARSER = {
    tobytes: (obj) => Buffer.from(JSON.stringify(obj)),
    toobj: (buffer) => JSON.parse(buffer.toString()),
    eol: () => '\n'
};

module.exports = function (path, pageSize, init, parser) {
    pageSize = (pageSize > 0) ? pageSize : 1024;
    init = init || EMPTY_FUNC;
    parser = parser || DEFAULT_PARSER;

    const me = this;
    const index = {};
    const deIndex = {};

    let table;

    let file;
    let endPos;

    //public section
    this.get = function (key) {
        return !!table[key] && table[key].value;
    }

    let setCount = 0;
    let onAllSetted = EMPTY_FUNC;
    this.set = function (key, val) {
        setCount++;
        set(key, val, () => {
            setCount--;
            if (setCount === 0) {
                onAllSetted();
            }
        });
    }

    this.save = function (key) {
        this.set(key, table[key].value);
    }

    this.del = function (key) {
        this.set(key);
    }

    this.find = function (field, value) {
        if (typeof value === "object") {
            return fullScan(o => value === o[field]);
        }
        return fastScan(field, value);
    }

    this.scan = function (predicate) {
        return fullScan(predicate);
    }

    this.buildIndex = function (field) {
        index[field] = {};
        Object.keys(table).forEach((key) => {
            if (!table[key].value) {
                return;
            }
            let vKey = table[key].value[field];
            setIndex(key, field, vKey);
        });
    }

    this.vacuum = function () {
        onAllSetted = () => {
            console.time('vacuum');
            fs.copyFileSync(path, path + '.bak');
            createFile(table, pageSize);
            console.timeEnd('vacuum');
            onAllSetted = EMPTY_FUNC;
        };
        if (setCount === 0) {
            onAllSetted();
        }
    }

    //private section
    let eolBuf = null;
    function eol() {
        if (eolBuf === null) {
            eolBuf = Buffer.from(parser.eol());
        }
        return eolBuf;
    }

    function readFile(path) {
        let fd = fs.openSync(path, 'r');

        let result = {};
        let position = 0;
        let dataBuffer = Buffer.alloc(pageSize + eol().length);
        let len;

        while ((len = fs.readSync(fd, dataBuffer, 0, dataBuffer.length, position)) > 0) {
            let partLen = dataBuffer.indexOf(eol());
            if (partLen < 1) {
                if (len < dataBuffer.length) {
                    partLen = len;
                } else {
                    dataBuffer = Buffer.alloc(dataBuffer.length + pageSize);
                    continue;
                }
            }
            try {
                let row = parser.toobj(dataBuffer.subarray(0, partLen));
                if (row['v']) {
                    init(row['v']);
                }
                result[row['k']] = { value: row['v'] };
            } catch (e) {
                console.log(dataBuffer.subarray(0, partLen).toString(), "can not be parsed");
                console.log(e);
            }
            position += partLen + eol().length;
        }
        fs.closeSync(fd);
        return result;
    }

    function createFile(data) {
        if (!file) {
            file = fs.openSync(path, 'w');
        }
        endPos = 0;
        table = {};
        fs.ftruncateSync(file, endPos);

        console.log(Object.keys(data).length)
        Object.keys(data).forEach((key) => {
            if (!data[key] || data[key].value === undefined) {
                return;
            }
            set(key, data[key].value, true);
        });
        console.log(Object.keys(table).length);

    }

    function toBuffer(o, minLen) {
        minLen = minLen && minLen > 0 ? minLen : 0;
        let rBuf = parser.tobytes(o);
        let rowLen = (Math.ceil(rBuf.length / pageSize)) * pageSize + eol().length;
        rowLen = rowLen < minLen ? minLen : rowLen;
        let buffer = Buffer.alloc(rowLen, ' ');
        rBuf.copy(buffer);
        buffer.write(parser.eol(), buffer.length - eol().length);
        return buffer;
    }

    function fullScan(predicate) {
        return new FindResult(
            Object.keys(table).filter(key => (table[key] && predicate(table[key].value))),
            me
        );
    }

    function fastScan(field, value) {
        if (!index[field]) {
            me.buildIndex(field);
        }
        return new FindResult((index[field][value] || []), me);
    }

    function setIndex(key, field, value) {
        if (!index[field] || typeof value === 'object') {
            return;
        }
        let oldV = (deIndex[key] || {})[field];
        if(oldV === value){
            return;
        }
        let oldI = (index[field][oldV] || []);
        let remI = oldI.indexOf(key);
        if (remI >= 0) {
            oldI.splice(remI, 1);
        }
        if (value === undefined && deIndex[key]) {
            delete deIndex[key][field];
            return;
        }
        (index[field][value] = index[field][value] || []).push(key);
        (deIndex[key] = deIndex[key] || {})[field] = value;
    }

    function reindex(key, obj) {
        obj = obj || {}
        Object.keys(index).forEach(field => setIndex(key, field, obj[field]));
    }

    function set(key, val, sync) {
        let row = table[key] ? table[key] : { pos: endPos, len: 0 };
        row.value = val;
        let buffer = toBuffer({ k: key, v: val }, row.len);
        if (buffer.length > row.len) {
            table[key] = row = { pos: endPos, len: buffer.length, value: val };
            endPos += row.len;
        }
        reindex(key, val);
        if (sync && !sync.apply) {
            fs.writeSync(file, buffer, 0, row.len, row.pos);
            return;
        }
        fs.write(file, buffer, 0, row.len, row.pos, sync || EMPTY_FUNC);
    }

    function FindResult(keys, store) {
        keys = keys || [];

        this.size = function(){
            return keys.length;
        }
        this.getKeys = function () {
            return keys.slice();
        }
        this.getValues = function () {
            return keys.map((key) => table[key] && table[key].value);
        }
        this.getEntryes = function () {
            return keys.map((inKey) => ({ key: inKey, value: table[inKey] && table[inKey].value }))
        }
        this.andFind = function (field, value) {
            let found = store.find(field, value).getKeys();
            let short = found.length < keys.length ? [found, keys] : [keys, found];
            return new FindResult(short[0].filter((key) => !(short[1].indexOf(key) < 0)), store);
        }
        this.andScan = function (predicate) {
            return new FindResult(keys.filter((key) => (table[key] && predicate(table[key].value))), store);
        }
    }

    try {
        console.time('startup ' + path);
        fs.copyFileSync(path, path + '.bak');
        createFile(readFile(path), pageSize);
        console.timeEnd('startup ' + path);
    } catch (e) {
        console.log('file not found, creating new file', path);
        createFile({}, pageSize);
        console.timeEnd('startup ' + path);
    }

}
