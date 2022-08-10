const Store = require('../core/store.js')

const ROWS = 100000;

console.log('rows', ROWS);

const store = new Store('./database.dsb', 128, (obj) => {
    obj.hello = () => {
        return 'hello ' + obj.name;
    }
});

console.time('index id');
store.buildIndex('id');
console.timeEnd('index id');

console.time('set');
for (let i = 0; i < ROWS; i++) {
    store.set('key' + i, {"id": i, "name": "Petya" + (i % 100), "secondname": "Vasya" + (i % 50)});
}
console.timeEnd('set');

console.time('index name');
store.buildIndex('name');
console.timeEnd('index name');

console.time('find name');
let petyas = store.findByVal('name', 'Petya99')
console.timeEnd('find name');

console.log(petyas);

console.time('get');
for (let i = 0; i < ROWS; i++) {
    store.get('key' + i);
}
console.timeEnd('get');

console.time('find criteria');
let ids = store.find(value => value.id > 99990);
console.timeEnd('find criteria');

console.log(ids);

console.time('find id');
let idss = store.findByVal('id', 99990);
console.timeEnd('find id');

console.log(idss);

console.time('del');
for (let i = 0; i < ROWS; i++) {
    store.del('key' + i);
}
console.timeEnd('del');

store.vacuum();

console.log(process)