"use strict";

const fs = require('fs');

const EMPTY_FUNC = () => undefined;

const DEFAULT_PARSER = {
    tobytes: (obj) => Buffer.from(JSON.stringify(obj)),
    toobj: (buffer) => JSON.parse(buffer.toString()),
    eol: () => '\n'
};

module.exports = function (path, pageSize = 1024, init = EMPTY_FUNC, parser = DEFAULT_PARSER) {
    pageSize = (pageSize > 0) ? pageSize : 1024;
    init = (init && init.apply && init) || EMPTY_FUNC;
    parser = parser || DEFAULT_PARSER;

    const index = {};
    const deIndex = {};

    let table;
    let indexKeys = {};
    let keys = [];

    let file;
    let endPos;

    let setCount = 0;
    let onAllSetted = EMPTY_FUNC;

    let eolBuf = null;

    //public section
    this.size = function () {
        buildKeys();
        return keys.length;
    }

    this.getKeys = function (unsafe) {
        buildKeys();
        return (unsafe && keys) || keys.slice();
    }

    this.getValues = function () {
        buildKeys();
        return keys.map((key) => table[key] && table[key].value);
    }
    this.getEntryes = function () {
        buildKeys();
        return keys.map((inKey) => ({ key: inKey, value: table[inKey] && table[inKey].value }))
    }

    this.get = function (key) {
        return table[key] && table[key].value;
    }

    this.set = this.put = function (key, val, initialyze) {
        initialyze && init && init(val);
        set(key, val);
    }

    this.save = function (key) {
        set(key, table[key] && table[key].value);
    }

    this.del = function (key) {
        set(key);
    }

    this.find = function (field, value) {
        return fastScan(field, value);
    }

    this.scan = function (predicate) {
        return fullScan(predicate);
    }

    const buildIndex =
        this.buildIndex = function (field) {
            if (index[field]) return;
            index[field] = {};
            buildKeys();
            keys.forEach((key) => {
                if (!table[key] || !table[key].value) {
                    return;
                }
                let vKey = table[key].value[field];
                setIndex(key, field, vKey);
            });
        }

    this.vacuum = function (callback) {
        onAllSetted = () => {
            console.time('vacuum');
            fs.copyFileSync(path, path + '.bak');
            createFile(table, pageSize);
            console.timeEnd('vacuum');
            onAllSetted = EMPTY_FUNC;
            callback && callback.apply && callback();
        };
        if (setCount === 0) {
            onAllSetted();
        }
    }

    //private section
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

        for (let i = 0; (len = fs.readSync(fd, dataBuffer, 0, dataBuffer.length, position)) > 0;) {
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
                i++;
                let row = parser.toobj(dataBuffer.subarray(0, partLen));
                if (row['v']) {
                    init(row['v']);
                }
                result[row['k']] = { value: row['v'] };
            } catch (e) {
                console.log('<record>\n', dataBuffer.subarray(0, partLen).toString(), '\n</record>', "\ncan not be parsed, record:", i);
                console.log(e);
                dataBuffer = Buffer.alloc(pageSize + eol().length)
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

        Object.keys(data).forEach((key) => {
            if (!data[key] || data[key].value === undefined) {
                return;
            }
            set(key, data[key].value);
        });

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
        buildKeys();
        return new FindResult(
            keys.filter(key => (table[key] && predicate(table[key].value))));
    }

    function fastScan(field, value) {
        if (!index[field]) {
            buildIndex(field);
        }
        return new FindResult((index[field][value] || []));
    }

    function setIndex(key, field, value) {
        if (!index[field] || typeof value === 'object') {
            return;
        }
        let oldV = (deIndex[key] || {})[field];
        if (oldV === value) {
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

    function set(key, val) {
        if (!key || (!table[key] && val === undefined)) return;
        let row = table[key] || { pos: endPos, len: 0 };
        row.value = val;
        let buffer = toBuffer({ k: key, v: val }, row.len);
        if (buffer.length > row.len) {
            table[key] = row = { pos: endPos, len: buffer.length, value: val };
            endPos += row.len;
        }
        reindex(key, val);
        keys = [];
        if (val === undefined) {
            delete indexKeys[key];
        } else {
            indexKeys[key] = true;
        }
        setCount++;
        fs.write(file, buffer, 0, row.len, row.pos, () => {
            setCount--;
            if (setCount === 0) {
                onAllSetted();
            }
        });
    }

    function buildKeys() {
        keys = (keys && keys.length && keys) || Object.keys(indexKeys);
    }

    function FindResult(keys) {
        keys = keys || [];

        this.size = function () {
            return keys.length;
        }
        this.getKeys = function (unsafe) {
            return (unsafe && keys) || keys.slice();
        }
        this.getValues = function () {
            return keys.map((key) => table[key] && table[key].value);
        }
        this.getEntryes = function () {
            return keys.map((inKey) => ({ key: inKey, value: table[inKey] && table[inKey].value }))
        }
        this.andFind = function (field, value) {
            let found = fastScan(field, value).getKeys(true);
            let short = found.length < keys.length ? [found, keys] : [keys, found];
            return new FindResult(short[0].filter((key) => !(short[1].indexOf(key) < 0)));
        }
        this.andScan = function (predicate) {
            return new FindResult(keys.filter((key) => (table[key] && predicate(table[key].value))));
        }
    }

    try {
        console.log('startup ' + path);
        console.time('startup');
        fs.copyFileSync(path, path + '.bak');
        createFile(readFile(path), pageSize);
        console.timeEnd('startup');
    } catch (e) {
        console.log('file not found, creating new file', path);
        createFile({}, pageSize);
        console.timeEnd('startup');
    }

}
