const fs = require('fs');

const ENCODING = 'utf8';
const emptyFunc = () => undefined;

module.exports = function Store(path, pageSize, foreach) {
    pageSize = pageSize > 0 ? pageSize : 1024;
    foreach = foreach || emptyFunc;

    const me = this;
    const index = {};
    const deIndex = {};

    let table;

    let file;
    let endPos;

    //public section
    this.get = function (key) {
        return table[key].value;
    }

    this.set = function (key, val) {
        let row = table[key] ? table[key] : {pos: endPos, len: 0};
        row.value = val;
        let buffer = toBuffer({k: key, v: val}, row.len);
        if (buffer.length > row.len) {
            table[key] = row = {pos: endPos, len: buffer.length, value: val};
            endPos += row.len;
        }
        reindex(key, val);
        fs.write(file, buffer, 0, row.len, row.pos, emptyFunc);
    }

    this.save = function (key) {
        this.set(key, table[key].value);
    }

    this.del = function (key) {
        this.set(key);
    }

    //first find - full scan
    //if value is scalar then build index
    //second find uses index
    this.findByVal = function (field, value) {
        if (typeof value === "object") {
            return fullScan(o => value === o[field]);
        }
        return fastScan(field, value);
    }

    this.find = function (predicate) {
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
        console.time('vacuum');
        fs.copyFileSync(path, path + '.bak');
        table = createFile(readFile(path + '.bak'), pageSize);
        console.timeEnd('vacuum');
    }

    //private section
    function readFile(path) {
        let fd = fs.openSync(path, 'r');

        let result = {};
        let position = 0;
        let dataBuffer = Buffer.alloc(pageSize);
        let len;

        while ((len = fs.readSync(fd, dataBuffer, 0, dataBuffer.length, position)) > 0) {
            let partLen = dataBuffer.indexOf('\n') + 1;
            if (partLen < 1) {
                if (len < dataBuffer.length) {
                    partLen = len;
                } else {
                    dataBuffer = Buffer.alloc(dataBuffer.length + pageSize);
                    continue;
                }
            }
            try {
                let row = JSON.parse(dataBuffer.toString(ENCODING, 0, partLen));
                if (row['v']) {
                    foreach(row['v']);
                }
                result[row['k']] = row['v'];
            } catch (e) {
                console.log(dataBuffer.toString(ENCODING, 0, partLen), "can not be parsed");
            }
            position += partLen;
        }
        fs.closeSync(fd);
        return result;
    }

    function createFile(data) {
        if (file) {
            fs.closeSync(file);
        }
        file = fs.openSync(path, 'w');

        let result = {};
        let position = 0;
        Object.keys(data).forEach((key) => {
            if (data[key] === undefined) {
                return;
            }
            let buffer = toBuffer({k: key, v: data[key]});
            let row = result[key] = {pos: position, len: buffer.length, value: data[key]};
            fs.writeSync(file, buffer, 0, row.len, position);
            position += row.len;
        });
        endPos = position;
        return result;
    }

    function toBuffer(o, minLen) {
        minLen = minLen && minLen > 0 ? minLen : 0;
        let rBuf = Buffer.from(JSON.stringify(o) + ' ');
        let rowLen = (Math.ceil(rBuf.length / pageSize)) * pageSize;
        rowLen = rowLen < minLen ? minLen : rowLen;
        let buffer = Buffer.alloc(rowLen, ' ', ENCODING);
        rBuf.copy(buffer);
        buffer.write('\n', buffer.length - 1);
        return buffer;
    }

    function fullScan(predicate) {
        return Object.keys(table).filter(key => predicate(table[key].value));
    }

    function fastScan(field, value) {
        if (!index[field]) {
            me.buildIndex(field);
        }
        return (index[field][value] || []).slice();
    }

    function setIndex(key, field, value) {
        if (!index[field] || typeof value === 'object') {
            return;
        }
        let oldI = (index[field][(deIndex[key] || {})[field]] || []);
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

    try {
        this.vacuum();
    } catch (e) {
        console.log('file not found, creating new file', path);
        table = createFile({}, pageSize);
        console.timeEnd('vacuum');
    }

}