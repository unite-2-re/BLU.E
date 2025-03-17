import { subscribe } from "/externals/lib/object.js";

//
class ObserveMethod {
    #handle: any;
    #name: string;
    #self: any;

    constructor(name, handle, self) {
        this.#name   = name;
        this.#handle = handle;
        this.#self   = self;
    }

    apply(target, ctx, args) {
        const wp = this.#handle.wrap(Reflect.apply(target, ctx || this.#self, args));
        this.#handle.trigger(this.#name, args, wp);
        return wp;
    }

    get(target, name, rec) {
        return Reflect.get(target, name, rec);
    }
}

//
const observeMaps = new WeakMap<any[], ObserveArray>();

//
class ObserveArray {
    #handle: any;
    #events: Set<Function>;

    //
    get events() {
        return this.#events;
    }

    //
    constructor() {
        this.#events = new Set<Function>([]);
        const events = this.#events;
        this.#handle = {
            trigger(name, ...args) {
                events.values().forEach(ev => ev?.(name, ...args));
            },
            wrap(nw) {
                if (Array.isArray(nw)) {
                    const obs = new ObserveArray();
                    observeMaps.set(nw, obs);
                    return new Proxy(nw, obs);
                }
                return nw;
            }
        }
    }

    //
    has(target, name) { return Reflect.has(target, name); }
    get(target, name, rec) {
        if (name == "@target") return target;
        const got = Reflect.get(target, name, rec);
        if (typeof got == "function") { return new Proxy(got, new ObserveMethod(name, this.#handle, target)); };
        return got;
    }
    set(target, name, value) {
        if (!Number.isInteger(parseInt(name))) { return Reflect.set(target, name, value); };
        name = parseInt(name);
        const old = target?.[name];
        const got = Reflect.set(target, name, value);
        this.#handle.trigger("@set", name, value, old);
        return got;
    }

    //
    deleteProperty(target, name) {
        const old = target?.[name];
        const got = Reflect.deleteProperty(target, name);
        this.#handle.trigger("@delete", name, old);
        return got;
    }
}

//
export const observableArray = (arr: any[])=>{
    if (Array.isArray(arr)) {
        const obs = new ObserveArray();
        observeMaps.set(arr, obs);
        return new Proxy(arr, obs);
    }
    return arr;
};

//
export const observe = (arr, cb)=>{
    const obs = observeMaps.get(arr?.["@target"] ?? arr);
    const evt = obs?.events;
    arr?.forEach?.((val, _)=>{
        return cb("push", [val])
    });
    evt?.add(cb);
};

//
export default observableArray;

//
export const observableBySet = (set)=>{
    const obs = observableArray([]);
    subscribe(set, (value, _, old)=>{
        if (value !== old) {
            if (old == null && value != null) {
                obs.push(value);
            } else
            if (old != null && value == null) {
                const idx = obs.indexOf(old);
                if (idx >= 0) obs.splice(idx, 1);
            } else {
                const idx = obs.indexOf(old);
                if (idx >= 0 && obs[idx] !== value) obs[idx] = value;
            }
        }
    });
    return obs;
}

//
export const observableByMap = (map)=>{
    const obs = observableArray([]);
    subscribe(map, (value, prop, old)=>{
        if (value !== old) {
            if (old != null && value == null) {
                const idx = obs.findIndex(([name, _])=>(name == prop));
                if (idx >= 0) obs.splice(idx, 1);
            } else {
                const idx = obs.findIndex(([name, _])=>{
                    return (name == prop)
                });
                if (idx >= 0) { if (obs[idx]?.[1] !== value) obs[idx] = [prop, value]; } else { obs.push([prop, value]); };
            }
        }
    });
    return obs;
}

//
export const unwrap = (arr)=>{
    return arr?.["@target"] ?? arr;
}
