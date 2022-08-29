/**
 * Class Store 
 */
export default class Store<T> {
    /**
     * Constructor
     * @param path path to the file for store data
     * @param pageSize minimal increasing size of record (bytes)
     * @param init function, will be applyed for each record in the store
     * @param parser the Parser object, by default wrapped JSON used
     */
    constructor(path: string, pageSize?: number, init?: (obj: any) => void, parser?: Parser<T>);
    /**
     * Returns the value, stored for the corresponding key
     * @param key key of the record
     * @returns the value, stored for the corresponding key
     */
    get(key: string): T | undefined;
    /**
     * Store value under the key and writes to the file
     * @param key the key
     * @param val the value
     * @param initialyze determines - will be initialyzer applyed for data before it will be stored
     */
    set(key: string, val?: T, initialyze?: boolean): void;
    /**
     * The alias for 'set'
     * @param key the key
     * @param val the value
     * @param initialyze determines - will be initialyzer applyed for data before it will be stored
     */
    put(key: string, val?: T): void;
    /**
     * Writes the data that is already setted to the file
     * for example:
     *  store.get('k1').name = 'K1 name';
     *  store.save('k1');
     * is equivalent of 
     *  store.set('k1', store.get('k1'))
     * @param key key
     */
    save(key: string): void;
    /**
     * Removes data from store and from file,
     * sets it to empty, is equivalent of
     *  store.set('key')
     * @param key key
     */
    del(key: string): void;
    /**
     * Returns the number of actual, not empty keys
     */
    size(): number;
    /**
     * Returns actual, not empty keys
     * @param unsafe use true, if you are shure that you wont modify this list
     */
    getKeys(unsafe?: boolean): string[];
    /**
     * Returns all stored, not empty values
     */
    getValues(): T[];
    /**
     * Returns all actual, not empty entryes
     */
    getEntryes(): { key: string, value: T }[];
    /**
     * Returns the FindResult, contains records with fiald value === value,
     * uses index, if index fot specifyed field is not builded - builds it
     * @param field field
     * @param value value
     */
    find(field: string, value: string | number | boolean): FindResult<T>;
    /**
     * Returns the FindResult with values that satisfy the predicate 
     * @param predicate the predicate
     */
    scan(predicate: (value?: T) => boolean): FindResult<T>;
    /** 
     * Builds index for the specified field 
     * @param field the field
     * */
    buildIndex(field: string): void;
    /**
     * Removes all empty records from the file
     * @param callback 
     */
    vacuum(callback?: () => any): void;
}

/**
 * Parser and serialyzer - specify you own methods
 */
export interface Parser<T> {
    /**
     * Specify how to convert object to bytes
     * @param obj the object
     */
    tobytes(obj: T): Buffer;
    /**
     * Specify how to convert bytes to object
     * @param buffer 
     */
    toobj(buffer: Buffer): T;
    /**
     * Specify record separator
     */
    eol(): string;
}

/**
 * The result of find or scan
 */
export interface FindResult<T> {
    /**
     * Returns the number of found records
     */
    size(): number;
    /**
     * Returns the list of found keys
     * @param unsafe use true, if you are shure that you wont modify this list
     */
    getKeys(unsafe?: boolean): string[];
    /**
     * Returns the list of found values
     */
    getValues(): T[];
    /**
     * Returns the list of found entryes
     */
    getEntryes(): { key: string, value: T }[];
    /**
     * Finds by index in the result, same as Store.find, returns FindResult that intercepts with this
     * @param field field
     * @param value value
     */
    andFind(field: string, value: string | number | boolean): FindResult<T>;
    /**
     * Same as Store.scan, scans this for satisfy predicate
     * @param predicate 
     */
    andScan(predicate: (value?: T) => boolean): FindResult<T>;
}
