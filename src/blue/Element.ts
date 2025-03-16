import { makeReactive } from '/externals/lib/object.js';
import observableArray from './Array';
import { createElement, elMap } from './DOM';
import { reflectAttributes, reflectChildren, reflectClassList, reflectStyles, reflectProperties, reformChildren } from './Reflect';

//
interface Params {
    classList?: Set<string>;
    attributes?: any;
    dataset?: any;
    properties?: any;
    style?: any|string;
    slot?: string;
    is?: string;
    on?: any;
};

//
export class El {
    children: any[];
    params: Params;
    selector: string;

    //
    constructor(selector, params = {}, children?) {
        this.children = children || observableArray([]);
        this.params   = params;
        this.selector = selector;
    }

    //
    get element(): HTMLElement|DocumentFragment|Text {
        if (elMap.has(this)) {
            const el = elMap.get(this);
            if (el) { return el; };
        }

        // create new element if there is not for reflection
        const element = createElement(this.selector);
        if (element instanceof HTMLElement) {
            reflectAttributes(element, this.params.attributes);
            reflectStyles(element, this.params.style);
            reflectClassList(element, this.params.classList);
            reflectProperties(element, this.params.properties);

            //
            if (this.params.slot != null) element.slot = this.params.slot;
            if (this.params.is != null) element.setAttribute("is", this.params.is);

            // TODO: reflect with dataset
            if (this.params.dataset != null) Object.assign(element.dataset, this.params.dataset);

            // if has event listeners, use it
            if (this.params.on) {
                Object.entries(this.params.on).forEach(([name, list])=>{
                    (list as any)?.forEach?.(fn => {
                        if (typeof fn == "function") {
                            this.element.addEventListener(name, fn, {});
                        } else {
                            this.element.addEventListener(name, fn?.[0], fn?.[1] || {});
                        }
                    });
                });
            }
        }
        if (this.children) reflectChildren(element, this.children);
        elMap.set(this, element);
        return element;
    }

    reform() {
        if ((this.element instanceof HTMLElement || this.element instanceof DocumentFragment) && this.children) {
            reformChildren(this.element, this.children);
        }
        return this;
    }
}

//
export const observeSize = (element, box, styles?) => {
    if (!styles) styles = makeReactive({});
    new ResizeObserver((mut)=>{
        if (box == "border-box") {
            styles.inlineSize = `${mut[0].borderBoxSize[0].inlineSize}px`;
            styles.blockSize = `${mut[0].borderBoxSize[0].blockSize}px`;
        }
        if (box == "content-box") {
            styles.inlineSize = `${mut[0].contentBoxSize[0].inlineSize}px`;
            styles.blockSize = `${mut[0].contentBoxSize[0].blockSize}px`;
        }
        if (box == "device-pixel-content-box") {
            styles.inlineSize = `${mut[0].devicePixelContentBoxSize[0].inlineSize}px`;
            styles.blockSize = `${mut[0].devicePixelContentBoxSize[0].blockSize}px`;
        }
    }).observe(element?.element ?? element, {box});
    return styles;
}

//
export const E = (selector, params = {}, children?)=>{
    return new El(selector, params, children);
}

//
export default E;
