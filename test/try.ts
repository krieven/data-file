import Store, {Parser, FindResult} from "../core/store";

class MyParser implements Parser<any>{
    tobytes(obj: any): Buffer {
        throw new Error("Method not implemented.");
    }
    toobj(buffer: Buffer) {
        throw new Error("Method not implemented.");
    }
    eol(): string {
        throw new Error("Method not implemented.");
    }
}

const store = new Store<any>(__dirname + '/database.dsb', 64, null,
   new MyParser() );

console.log(store.find("key", "value").getEntryes()[0].key);

