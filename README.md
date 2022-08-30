# krieven-data-file
    persistent, embedded, key-value storage,  nosql database

Some Node projects, such as game servers, need to manage large amounts of frequently changing data synchronously. And it is required that data is not lost if the server crashes or shuts down for any reason.

**krieven-data-file** is designed especially for such cases. It provides an interface similar to **Map<string, T>** and saves the data to a file.

Access to data by key occurs at the speed of access to the fields of a regular object.

Data is written to the file in the background with virtually no delay. Records in the file are overwritten, which saves disk space.

**krieven-data-file** provides the ability to quickly search records by data field values ​​(indexed search), as well as scan by predicate (full scan). You can also search in the search results.

This is a small but powerful and fast tool, without of dependencyes.

It is recommended to use a separate instance for each entity, for example one **krieven-data-file** for user data, another for their units, a third for inventory, etc.

## Example of usage


    const Store = require('krieven-data-file');
    const {initUser} = require('./userUtils.js');

    const activeUnits = {};

    const users = new Store('/database/users.dsb', 1024, initUser);

    const units = new Store('/database/units.dsb', 512);
    ........
    function onLogin(login, socket){
        const user = users.find('login', login).getEntryes()[0];
        if(!user){
            return;
        }

        user.value.lastLogon = new Date();
        users.save(user.key);

        const unitList = units.scan((u) => u.ovner === user.key && u.isAlive).getValues();

        activeUnits[user.key] = user.value;

        socket.send({user: user.value, units: unitList});
    }



