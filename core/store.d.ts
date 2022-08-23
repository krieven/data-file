
export default class Store<T> {
    constructor(path: string, pageSize?: number, init?: (obj: any) => void, parser?: Parser<T>);
    get(key: string): T | undefined;
    set(key: string, val?: T): void;
    save(key: string): void;
    del(key: string): void;
    find(field: string, value: string | number | boolean): FindResult<T>;
    scan(predicate: (value?: T) => boolean): FindResult<T>;
    buildIndex(field: string): void;
    vacuum(): void;
}

export interface Parser<T> {
    tobytes(obj: T): Buffer;
    toobj(buffer: Buffer): T;
    eol(): string;
}

export interface FindResult<T> {
    size(): number;
    getKeys(unsafe?: boolean): string[];
    getValues(): string[];
    getEntryes(): { key: string, value: T }[];
    andFind(field: string, value: T): FindResult<T>;
    andScan(predicate: (value?: T) => boolean): FindResult<T>;
}