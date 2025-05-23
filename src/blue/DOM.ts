import { T } from "./Element";

// @ts-ignore /* @vite-ignore */
import { makeReactive, subscribe, unwrap } from "/externals/modules/object.js";

// @ts-ignore /* @vite-ignore */
import { observeAttributeBySelector } from "/externals/modules/dom.js";

//
const
	MATCH = '(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)',
	REGEX = '^(?:' + MATCH + ')|^#' + MATCH + '|^\\.' + MATCH + '|^\\[' + MATCH + '(?:([*$|~^]?=)(["\'])((?:(?=(\\\\?))\\8.)*?)\\6)?\\]';

//
export const createElement = (selector): HTMLElement|DocumentFragment => {
    if (selector == ":fragment:") return document.createDocumentFragment();
    const create = document.createElement.bind(document);
    for (var node: any = create('div'), match, className = ''; selector && (match = selector.match(REGEX));) {
        if (match[1]) node = create(match[1]);
        if (match[2]) node.id = match[2];
        if (match[3]) className += ' ' + match[3];
        if (match[4]) node.setAttribute(match[4], match[7] || '');
        selector = selector.slice(match[0].length);
    }
    if (className) node.className = className.slice(1);
    return node;
};

//
export const elMap = new WeakMap<any, HTMLElement|DocumentFragment|Text>();
export const getNode = (E, mapper?: Function, index?: number)=>{
    if (mapper) { return (E = getNode(mapper?.(E, index))); }
    if (E instanceof Node || E instanceof Text || E instanceof HTMLElement || E instanceof DocumentFragment) { return E; } else
    if (typeof E?.value == "string" || typeof E?.value == "number") { return T(E)?.element; } else
    if (typeof E == "function") { return getNode(E()); } else  // mapped arrays always empties after
    if (typeof E == "string" || typeof E == "number") { return document.createTextNode(String(E)); } else
    if (typeof E == "object" && E != null) { return E?.element ?? elMap.get(E); }
    return E;
}

//
export const appendChild = (element, cp, mapper?)=>{
    if (mapper) { cp = mapper?.(cp) ?? cp; }
    if (cp?.children && Array.isArray(unwrap(cp?.children)) && !(cp?.["@virtual"] || cp?.["@mapped"]))
        { element?.append?.(...(unwrap(cp?.children)?.map?.((cl, _: number)=>(getNode(cl)??""))?.filter?.((el)=>el!=null) ?? unwrap(cp?.children))); } else
    if (Array.isArray(unwrap(cp)))
        { element?.append?.(...unwrap(cp?.map?.((cl, _: number)=>(getNode(cl)??""))?.filter?.((el)=>el!=null) ?? unwrap(cp))); } else
        { const node = getNode(cp); if (node != null && (!node?.parentNode || node?.parentNode != element)) { element?.append?.(node); } }
}

// when possible, don't create new Text nodes
export const replaceChildren = (element, cp, index, mapper?)=>{
    if (mapper) { cp = mapper?.(cp) ?? cp; }
    const cn = element?.childNodes?.[index];
    if (cn instanceof Text && typeof cp == "string") { cn.textContent = cp; } else {
        const node = getNode(cp);
        if (cn instanceof Text && node instanceof Text) { if (cn.textContent != node.textContent) { cn.textContent = node.textContent; } } else
        if (cn != node && (!node?.parentNode || node?.parentNode != element)) { cn?.replaceWith?.(node); }
    }
}

//
export const removeChild = (element, cp, mapper?, index = -1)=>{
    if (element?.childNodes?.length < 1) return;
    const node = getNode(cp = mapper?.(cp) ?? cp);
    const ch = node ?? (index >= 0 ? element?.childNodes?.[index] : null);
    if (ch?.parentNode == element) { ch?.remove?.(); } else
    if (ch?.children && ch?.children?.length >= 1) { // TODO: remove by same string value
        ch?.children?.forEach?.(c => { const R = (elMap.get(c) ?? c); if (R == element?.parentNode) R?.remove?.(); });
    } else { (ch)?.remove?.(); }
    return element;
}

//
export const removeNotExists = (element, children, mapper)=>{
    const uw = Array.from(unwrap(children))?.map?.((cp)=>getNode(mapper?.(cp) ?? cp));
    Array.from(element.childNodes).forEach((nd: any)=>{ if (uw!?.find?.((cp)=>(cp == nd))) nd?.remove?.(); });
    return element;
}

// reacts by change storage, loads from storage, and reacts from storage event changes
export const localStorageRef = (key, initial?: any)=>{
    const ref = makeReactive({value: localStorage.getItem(key) ?? (initial?.value ?? initial)});
    addEventListener("storage", (ev)=>{
        if (ev.storageArea == localStorage && ev.key == key) {
            if (ref.value !== ev.newValue) { ref.value = ev.newValue; };
        }
    });
    subscribe([ref, "value"], (val)=>{
        localStorage.setItem(key, val);
    });
    return ref;
}

// reacts only from media, you can't change media condition
export const matchMediaRef = (condition: string)=>{
    const med = matchMedia(condition);
    const ref = makeReactive({value: med.matches});
    med.addEventListener("change", (ev)=>{
        ref.value = ev.matches;
    });
    return ref;
}

// one-shot update
export const visibleRef = (element, initial?: any)=>{
    // bi-directional attribute
    const val = makeReactive({ value: (initial?.value ?? initial) ?? (element?.getAttribute?.("data-hidden") == null) });
    if ((initial?.value ?? initial) != null && element?.getAttribute?.("data-hidden") == null) { if (initial?.value ?? initial) { element?.removeAttribute?.("data-hidden"); } else { element?.setAttribute?.("data-hidden", val.value); } };

    //
    element?.addEventListener?.("u2-hidden", ()=>{ val.value = false; }, {passive: true});
    element?.addEventListener?.("u2-visible", ()=>{ val.value = true; }, {passive: true});
    subscribe([val, "value"], (v,p)=>{if (v) { element?.removeAttribute?.("data-hidden"); } else { element?.setAttribute?.("data-hidden", val.value); }})
    return val;
}

// one-shot update
export const attrRef = (element, attribute: string, initial?: any)=>{
    // bi-directional attribute
    const val = makeReactive({ value: element?.getAttribute?.(attribute) ?? ((initial?.value ?? initial) === true && typeof initial == "boolean" ? "" : (initial?.value ?? initial)) });
    if (initial != null && element?.getAttribute?.(attribute) == null && (typeof val.value != "object" && typeof val.value != "function") && (val.value != null && val.value !== false)) { element?.setAttribute?.(attribute, val.value); };
    const config = {
        attributeFilter: [attribute],
        attributeOldValue: true,
        attributes: true,
        childList: false,
        subtree: false,
    };

    //
    const onMutation = (mutation: any)=>{
        if (mutation.type == "attributes") {
            const value = mutation?.target?.getAttribute?.(mutation.attributeName);
            if (mutation.oldValue != value && (val != null && (val?.value != null || (typeof val == "object" || typeof val == "function")))) {
                if (val?.value !== value) { val.value = value; }
            }
        }
    }

    //
    if (element?.self) {
        observeAttributeBySelector(element.self, element.selector, attribute, onMutation);
    } else {
        const callback = (mutationList, _) => { for (const mutation of mutationList) { onMutation(mutation); } };
        const observer = new MutationObserver(callback);
        if (element instanceof HTMLElement) { observer.observe(element, config); }
    }

    //
    subscribe([val, "value"], (v)=>{
        if (v !== element?.getAttribute?.(attribute)) {
            if (v == null || v === false || typeof v == "object" || typeof v == "function") {
                element?.removeAttribute?.(attribute);
            } else {
                element?.setAttribute?.(attribute, v);
            }
        }
    });

    //
    return val;
}

// ! you can't change size, due it's may break styles
export const sizeRef = (element, axis: "inline"|"block", box: ResizeObserverBoxOptions = "border-box")=>{
    const val = makeReactive({ value: 0 });
    const obs = new ResizeObserver((entries)=>{
        if (box == "border-box") { val.value = axis == "inline" ? entries[0].borderBoxSize[0].inlineSize : entries[0].borderBoxSize[0].blockSize };
        if (box == "content-box") { val.value = axis == "inline" ? entries[0].contentBoxSize[0].inlineSize : entries[0].contentBoxSize[0].blockSize };
        if (box == "device-pixel-content-box") { val.value = axis == "inline" ? entries[0].devicePixelContentBoxSize[0].inlineSize : entries[0].devicePixelContentBoxSize[0].blockSize };
    });
    if ((element?.self ?? element) instanceof HTMLElement) { obs.observe(element?.self ?? element, {box}); };
    return val;
}

//
export const scrollRef = (element, axis: "inline"|"block", initial?: any)=>{
    if (initial != null && typeof (initial?.value ?? initial) == "number") { element?.scrollTo?.({ [axis=="inline"?"left":"top"]: (initial?.value ?? initial) }); };
    const val = makeReactive({ value: (axis == "inline" ? element?.scrollLeft : element?.scrollTop) || 0 });
    subscribe([val, "value"], ()=>element?.scrollTo?.({ [axis=="inline"?"left":"top"]: (val?.value ?? val) }));
    element?.addEventListener?.("scroll", (ev)=>{ val.value = (axis == "inline" ? ev?.target?.scrollLeft : ev?.target?.scrollTop) || 0; }, { passive: true });
    return val;
}

// for checkbox
export const checkedRef = (element)=>{
    const val = makeReactive({ value: (!!element?.checked) || false });
    if (element?.self ?? element) {
        (element?.self ?? element)?.addEventListener?.("change", (ev)=>{ if (val.value != ev?.target?.checked) { val.value = (!!ev?.target?.checked) || false; } });
        (element?.self ?? element)?.addEventListener?.("input", (ev)=>{ if (val.value != ev?.target?.checked) { val.value = (!!ev?.target?.checked) || false; } });
        (element?.self ?? element)?.addEventListener?.("click", (ev)=>{ if (val.value != ev?.target?.checked) { val.value = (!!ev?.target?.checked) || false; } });
    }
    subscribe([val, "value"], (v)=>{
        if (element && element?.checked != v) {
            element.checked = !!v;
            element?.dispatchEvent?.(new Event("change", { bubbles: true }));
        }
    })
    return val;
}

// for string inputs
export const valueRef = (element)=>{
    const val = makeReactive({ value: element?.value || "" });
    (element?.self ?? element)?.addEventListener?.("change", (ev) => { if (val.value != ev?.target?.value) { val.value = ev?.target?.value; } });
    subscribe([val, "value"], (v)=>{
        if (element && element?.value != v) {
            element.value = v;
            element?.dispatchEvent?.(new Event("change", {
                bubbles: true
            }));
        }
    })
    return val;
}

// for numeric inputs
export const valueAsNumberRef = (element)=>{
    const val = makeReactive({ value: Number(element?.valueAsNumber) || 0 });
    (element?.self ?? element)?.addEventListener?.("change", (ev)=>{
        if (val.value != ev?.target?.valueAsNumber) { val.value = Number(ev?.target?.valueAsNumber); }
    });
    subscribe([val, "value"], (v)=>{
        if (element && element?.valueAsNumber != v && typeof element?.valueAsNumber == "number") {
            element.valueAsNumber = Number(v);
            element?.dispatchEvent?.(new Event("change", { bubbles: true }));
        }
    })
    return val;
}
