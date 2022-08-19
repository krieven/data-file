const Store = require('../core/store.js')

const ROWS = 100000;
(function () {
    const store = new Store(__dirname + '/database.dsb', 1, (obj) => {
        obj.hello = () => {
            return 'hello ' + obj.name;
        }
    });

    console.time('index id');
    store.buildIndex('id');
    console.timeEnd('index id');

    console.time('set');
    for (let i = 0; i < ROWS; i++) {
        store.set('key' + i, { "id": i, "name": "Petya" + (i % 100), "secondname": "Vasya" + (i % 50) });
    }
    console.timeEnd('set');
    console.log('rows', ROWS);

    console.time('index name');
    store.buildIndex('name');
    console.timeEnd('index name');

    console.time('find name');
    let petyas = store.find('name', 'Petya99').andFind('id', '799').getValues();
    console.timeEnd('find name');

    console.log(petyas);

    console.time('get');
    for (let i = 0; i < ROWS; i++) {
        var v = store.get('key' + i);
        if(!v){
            console.log('empty', 'key' + i);
        }
    }
    console.timeEnd('get');
    console.dir(v);

    console.time('find criteria');
    let ids = store.scan(value => value.id > ROWS - 10).getEntryes()[0];
    console.timeEnd('find criteria');

    console.log(ids);

    console.time('find id');
    let idss = store.find('id', 990);
    console.timeEnd('find id');

    console.log(idss);

    console.time('set');
    for (let i = 0; i < ROWS; i++) {
        store.get('key' + i).thirdname='Rapatam-Stratacam-Zerotam ' + i;
    }
    console.timeEnd('set');
    console.log('rows', ROWS);
    store.vacuum();

    console.time('del');
    for (let i = 0; i < ROWS - 100; i++) {
        store.del('key' + i);
    }
    console.timeEnd('del');
    store.vacuum();
})();
