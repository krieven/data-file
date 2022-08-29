const assert = require('assert');
const Store = require('../core/store.js');
const fs = require('fs');
const sinon = require('sinon')

const fsWrite = fs.write.bind(fs);

function fsMock(done) {
    let counter = 0;
    sinon.replace(fs, 'write', (v1, v2, v3, v4, v5, v6) => {
        counter++;
        fsWrite(v1, v2, v3, v4, v5, () => {
            v6();
            console.log('written');
            counter--;
            if(!counter) {
                sinon.restore();
                console.log('reset');
                done();
            }
        });
    });
}

describe('Store testing', () => {
    it('database file created', () => {
        const tpath = __dirname + '/tmp/testdb.dsb';

        const store = new Store(tpath);
        assert.equal(fs.existsSync(tpath), true);

        fs.unlinkSync(tpath);
    });

    fs.copyFileSync(__dirname + '/tmp/testdb2.broken', __dirname + '/tmp/testdb2.database')

    const fpath = __dirname + '/tmp/testdb2.database';
    let store;
    it('Successfully open existing database', () => {
        store = new Store(fpath, 4);
        assert.equal(fs.existsSync(fpath), true);

        assert.equal(store.size(), 2);

        fs.unlinkSync(fpath + '.bak');
    })

    it('Add two records, all accessors working properly', (done) => {

        fsMock(done);

        store.set('ivan2', { name: 'Ivan' });
        store.set('peter2', { name: 'Peter' });

        assert.equal(store.get('ivan2').name, 'Ivan');
        assert.equal(store.get('peter2').name, 'Peter');

        assert.equal(store.size(), 4);
        assert.equal(store.getKeys().length, 4);
        assert.equal(store.getValues()[0].name, 'Ivan');
        assert.equal(store.getEntryes()[0].value.name, 'Ivan');
    });

    it('Save and del ok, skip empty field trougth buildIndex', (done) => {

        fsMock(done);

        store.set('empty', {});
        store.get('empty').title = 'mister';
        store.save('empty');
        store.buildIndex('title');
        assert.equal(store.find('title', undefined).size(), 0);
        assert.equal(store.size(), 5);
        store.del('empty');
        assert.equal(store.size(), 4);
    });

    it('Deleting unexistent record has no effect', () => {

        store.del('vasya');
        assert.equal(store.size(), 4);
    });

    it('Find by field value ok', () => {

        let found = store.find('name', 'Peter');
        assert.equal(found.size(), 2);
        assert.equal(found.getKeys(true)[0], 'peter');
        assert.equal(found.getKeys()[1], 'peter2');
        store.buildIndex('name');
        assert.equal(found.andFind('name', 'Peter').size(), 2);
    });

    it('Scan by predicate ok', () => {

        let found = store.scan((value) => value.name == 'Ivan');
        assert.equal(found.size(), 2);
        assert.equal(found.getKeys(true).length, 2);
        assert.equal(found.getKeys().length, 2);

        assert.equal(found.getValues().length, 2);
        assert.equal(found.getValues()[0].name, 'Ivan');

        assert.equal(found.getEntryes().length, 2);
        assert.equal(found.getEntryes()[0].value.name, 'Ivan');

        assert.equal(found.andScan((value) => value.name == 'Peter').size(), 0);
    });

    it('Delete two records ok', (done) => {

        fsMock(done);

        assert.equal(store.size(), 4);

        store.del('ivan2');
        assert.equal(store.size(), 3);
        store.del('ivan2');
        assert.equal(store.size(), 3);

        store.del('peter2');
        assert.equal(store.size(), 2);
    });

    it('vacuum', (done) => {

        fsMock(done);
        store.vacuum(() => console.log('first vacuum finished'));
        store.set('ivan2', { name: 'Ivan' });
        store.set('peter2', { name: 'Peter' });

        store.vacuum(() => console.log('second vacuum finished'));
        store.del('ivan2');
        store.del('peter2');


    });

});