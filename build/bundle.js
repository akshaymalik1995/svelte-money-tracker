
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function set_store_value(store, ret, value) {
        store.set(value);
        return ret;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.57.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    function construct_svelte_component_dev(component, props) {
        const error_message = 'this={...} of <svelte:component> should specify a Svelte component.';
        try {
            const instance = new component(props);
            if (!instance.$$ || !instance.$set || !instance.$on || !instance.$destroy) {
                throw new Error(error_message);
            }
            return instance;
        }
        catch (err) {
            const { message } = err;
            if (typeof message === 'string' && message.indexOf('is not a constructor') !== -1) {
                throw new Error(error_message);
            }
            else {
                throw err;
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0 && stop) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const records = writable([]);
    const searchText = writable("");
    const filters = writable({type : "all", date: ""} );
    const modal = writable({display : "hidden", content: null, props : {record : "record"}});

    /* src\form.svelte generated by Svelte v3.57.0 */
    const file$a = "src\\form.svelte";

    function create_fragment$a(ctx) {
    	let form;
    	let h2;
    	let t1;
    	let div1;
    	let label0;
    	let t3;
    	let div0;
    	let label1;
    	let input0;
    	let t4;
    	let span0;
    	let t6;
    	let label2;
    	let input1;
    	let t7;
    	let span1;
    	let t9;
    	let div2;
    	let label3;
    	let t11;
    	let input2;
    	let t12;
    	let div3;
    	let label4;
    	let t14;
    	let input3;
    	let t15;
    	let div4;
    	let label5;
    	let t17;
    	let input4;
    	let t18;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			form = element("form");
    			h2 = element("h2");
    			h2.textContent = "Add transaction";
    			t1 = space();
    			div1 = element("div");
    			label0 = element("label");
    			label0.textContent = "Type";
    			t3 = space();
    			div0 = element("div");
    			label1 = element("label");
    			input0 = element("input");
    			t4 = space();
    			span0 = element("span");
    			span0.textContent = "Expense";
    			t6 = space();
    			label2 = element("label");
    			input1 = element("input");
    			t7 = space();
    			span1 = element("span");
    			span1.textContent = "Income";
    			t9 = space();
    			div2 = element("div");
    			label3 = element("label");
    			label3.textContent = "Name";
    			t11 = space();
    			input2 = element("input");
    			t12 = space();
    			div3 = element("div");
    			label4 = element("label");
    			label4.textContent = "Amount";
    			t14 = space();
    			input3 = element("input");
    			t15 = space();
    			div4 = element("div");
    			label5 = element("label");
    			label5.textContent = "Date";
    			t17 = space();
    			input4 = element("input");
    			t18 = space();
    			button = element("button");
    			button.textContent = "Create";
    			attr_dev(h2, "class", "text-xl font-medium text-gray-900 mb-4");
    			add_location(h2, file$a, 24, 4, 781);
    			attr_dev(label0, "class", "block text-gray-700 font-medium mb-2");
    			add_location(label0, file$a, 26, 6, 884);
    			input0.checked = true;
    			input0.required = true;
    			attr_dev(input0, "type", "radio");
    			attr_dev(input0, "class", "form-radio text-blue-500");
    			attr_dev(input0, "name", "transaction_type");
    			input0.value = "expense";
    			add_location(input0, file$a, 29, 10, 1041);
    			attr_dev(span0, "class", "ml-2 text-gray-700 font-medium");
    			add_location(span0, file$a, 37, 10, 1253);
    			attr_dev(label1, "class", "inline-flex items-center mr-6");
    			add_location(label1, file$a, 28, 8, 984);
    			input1.required = true;
    			attr_dev(input1, "type", "radio");
    			attr_dev(input1, "class", "form-radio text-green-500");
    			attr_dev(input1, "name", "transaction_type");
    			input1.value = "income";
    			add_location(input1, file$a, 40, 10, 1392);
    			attr_dev(span1, "class", "ml-2 text-gray-700 font-medium");
    			add_location(span1, file$a, 47, 10, 1585);
    			attr_dev(label2, "class", "inline-flex items-center");
    			add_location(label2, file$a, 39, 8, 1340);
    			attr_dev(div0, "class", "flex");
    			add_location(div0, file$a, 27, 6, 956);
    			attr_dev(div1, "class", "mb-4");
    			add_location(div1, file$a, 25, 4, 858);
    			attr_dev(label3, "class", "block text-gray-700 font-medium mb-2");
    			add_location(label3, file$a, 52, 6, 1719);
    			input2.required = true;
    			attr_dev(input2, "type", "text");
    			attr_dev(input2, "class", "form-input w-full border p-2 ");
    			attr_dev(input2, "name", "name");
    			attr_dev(input2, "placeholder", "Enter name");
    			add_location(input2, file$a, 53, 6, 1791);
    			attr_dev(div2, "class", "mb-4");
    			add_location(div2, file$a, 51, 4, 1693);
    			attr_dev(label4, "class", "block text-gray-700 font-medium mb-2");
    			add_location(label4, file$a, 62, 6, 1992);
    			input3.required = true;
    			attr_dev(input3, "type", "number");
    			attr_dev(input3, "class", "border p-2 form-input w-full");
    			attr_dev(input3, "name", "amount");
    			attr_dev(input3, "placeholder", "Enter amount");
    			add_location(input3, file$a, 63, 6, 2066);
    			attr_dev(div3, "class", "mb-4");
    			add_location(div3, file$a, 61, 4, 1966);
    			attr_dev(label5, "class", "block text-gray-700 font-medium mb-2");
    			add_location(label5, file$a, 72, 6, 2272);
    			input4.required = true;
    			attr_dev(input4, "type", "date");
    			attr_dev(input4, "class", "border p-2 form-input w-full");
    			attr_dev(input4, "name", "date");
    			add_location(input4, file$a, 73, 6, 2344);
    			attr_dev(div4, "class", "mb-4");
    			add_location(div4, file$a, 71, 4, 2246);
    			attr_dev(button, "type", "submit");
    			attr_dev(button, "class", "bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded");
    			add_location(button, file$a, 80, 4, 2484);
    			add_location(form, file$a, 23, 2, 729);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, form, anchor);
    			append_dev(form, h2);
    			append_dev(form, t1);
    			append_dev(form, div1);
    			append_dev(div1, label0);
    			append_dev(div1, t3);
    			append_dev(div1, div0);
    			append_dev(div0, label1);
    			append_dev(label1, input0);
    			append_dev(label1, t4);
    			append_dev(label1, span0);
    			append_dev(div0, t6);
    			append_dev(div0, label2);
    			append_dev(label2, input1);
    			append_dev(label2, t7);
    			append_dev(label2, span1);
    			append_dev(form, t9);
    			append_dev(form, div2);
    			append_dev(div2, label3);
    			append_dev(div2, t11);
    			append_dev(div2, input2);
    			append_dev(form, t12);
    			append_dev(form, div3);
    			append_dev(div3, label4);
    			append_dev(div3, t14);
    			append_dev(div3, input3);
    			append_dev(form, t15);
    			append_dev(form, div4);
    			append_dev(div4, label5);
    			append_dev(div4, t17);
    			append_dev(div4, input4);
    			append_dev(form, t18);
    			append_dev(form, button);

    			if (!mounted) {
    				dispose = listen_dev(form, "submit", prevent_default(/*handleSubmit*/ ctx[0]), false, true, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(form);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function generateUniqueId() {
    	let randomId = Math.random().toString(36).substr(2);
    	return randomId;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let $modal;
    	let $records;
    	validate_store(modal, 'modal');
    	component_subscribe($$self, modal, $$value => $$invalidate(1, $modal = $$value));
    	validate_store(records, 'records');
    	component_subscribe($$self, records, $$value => $$invalidate(2, $records = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Form', slots, []);

    	const handleSubmit = event => {
    		const id = generateUniqueId();
    		const type = event.target["transaction_type"].value;
    		const name = event.target["name"].value;
    		let amount = Number(event.target["amount"].value);
    		const date = event.target["date"].value;
    		const newRecord = { name, type, amount, date, id };
    		set_store_value(records, $records = [newRecord, ...$records], $records);
    		localStorage.setItem("records", JSON.stringify($records));
    		event.target.reset();
    		set_store_value(modal, $modal.display = "hidden", $modal);
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Form> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		records,
    		modal,
    		generateUniqueId,
    		handleSubmit,
    		$modal,
    		$records
    	});

    	return [handleSubmit];
    }

    class Form extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Form",
    			options,
    			id: create_fragment$a.name
    		});
    	}
    }

    /* src\Search.svelte generated by Svelte v3.57.0 */
    const file$9 = "src\\Search.svelte";

    // (26:0) {#if $filters.date !== "" || $filters.type !== "all" }
    function create_if_block(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Clear ❌";
    			attr_dev(button, "class", "block border bg-transparent focus:shadow-outline text-sm focus:outline-none py-2 px-3 rounded");
    			add_location(button, file$9, 26, 0, 912);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*clearFilters*/ ctx[2], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(26:0) {#if $filters.date !== \\\"\\\" || $filters.type !== \\\"all\\\" }",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let div1;
    	let div0;
    	let input;
    	let t0;
    	let button0;
    	let t1;
    	let button1;
    	let t3;
    	let if_block_anchor;
    	let mounted;
    	let dispose;
    	let if_block = (/*$filters*/ ctx[0].date !== "" || /*$filters*/ ctx[0].type !== "all") && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			input = element("input");
    			t0 = space();
    			button0 = element("button");
    			t1 = space();
    			button1 = element("button");
    			button1.textContent = "Filter";
    			t3 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr_dev(input, "type", "search");
    			attr_dev(input, "name", "search");
    			attr_dev(input, "placeholder", "Search");
    			attr_dev(input, "class", "bg-white focus:border-black border h-10 px-5 pr-10 w-full rounded-lg text-sm focus:outline-none py-2");
    			add_location(input, file$9, 13, 8, 381);
    			attr_dev(button0, "type", "submit");
    			attr_dev(button0, "class", "absolute right-0 top-0 mt-3 mr-4");
    			add_location(button0, file$9, 20, 8, 660);
    			attr_dev(div0, "class", "w-full text-gray-600");
    			add_location(div0, file$9, 12, 4, 337);
    			attr_dev(button1, "class", "rounded-lg px-5 py-2 border hover:bg-gray-100 ");
    			add_location(button1, file$9, 22, 4, 743);
    			attr_dev(div1, "class", "my-5 flex space-x-2 items-center justify-between");
    			add_location(div1, file$9, 11, 0, 269);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, input);
    			set_input_value(input, /*$searchText*/ ctx[1]);
    			append_dev(div0, t0);
    			append_dev(div0, button0);
    			append_dev(div1, t1);
    			append_dev(div1, button1);
    			insert_dev(target, t3, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", /*input_input_handler*/ ctx[4]),
    					listen_dev(button1, "click", /*handleClick*/ ctx[3], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*$searchText*/ 2 && input.value !== /*$searchText*/ ctx[1]) {
    				set_input_value(input, /*$searchText*/ ctx[1]);
    			}

    			if (/*$filters*/ ctx[0].date !== "" || /*$filters*/ ctx[0].type !== "all") {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t3);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let $modal;
    	let $filters;
    	let $searchText;
    	validate_store(modal, 'modal');
    	component_subscribe($$self, modal, $$value => $$invalidate(5, $modal = $$value));
    	validate_store(filters, 'filters');
    	component_subscribe($$self, filters, $$value => $$invalidate(0, $filters = $$value));
    	validate_store(searchText, 'searchText');
    	component_subscribe($$self, searchText, $$value => $$invalidate(1, $searchText = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Search', slots, []);

    	const clearFilters = () => {
    		set_store_value(filters, $filters = { type: "all", date: "" }, $filters);
    	};

    	const handleClick = () => {
    		set_store_value(modal, $modal = { display: "block", content: "filter" }, $modal);
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Search> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		$searchText = this.value;
    		searchText.set($searchText);
    	}

    	$$self.$capture_state = () => ({
    		searchText,
    		modal,
    		filters,
    		clearFilters,
    		handleClick,
    		$modal,
    		$filters,
    		$searchText
    	});

    	return [$filters, $searchText, clearFilters, handleClick, input_input_handler];
    }

    class Search extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Search",
    			options,
    			id: create_fragment$9.name
    		});
    	}
    }

    /* src\Record.svelte generated by Svelte v3.57.0 */
    const file$8 = "src\\Record.svelte";

    function create_fragment$8(ctx) {
    	let div2;
    	let div0;
    	let h2;
    	let t0_value = /*record*/ ctx[0].name + "";
    	let t0;
    	let t1;
    	let p0;
    	let t2_value = /*record*/ ctx[0].date + "";
    	let t2;
    	let t3;
    	let div1;
    	let p1;

    	let t4_value = (/*record*/ ctx[0].type === "income"
    	? `₹${/*record*/ ctx[0].amount}`
    	: `-  ₹${/*record*/ ctx[0].amount}`) + "";

    	let t4;
    	let p1_class_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			h2 = element("h2");
    			t0 = text(t0_value);
    			t1 = space();
    			p0 = element("p");
    			t2 = text(t2_value);
    			t3 = space();
    			div1 = element("div");
    			p1 = element("p");
    			t4 = text(t4_value);
    			attr_dev(h2, "class", "text-xl font-semibold mb-2");
    			add_location(h2, file$8, 12, 8, 386);
    			attr_dev(p0, "class", "text-gray-400");
    			add_location(p0, file$8, 13, 8, 453);
    			add_location(div0, file$8, 11, 4, 371);

    			attr_dev(p1, "class", p1_class_value = "" + ((/*record*/ ctx[0].type === "income"
    			? 'text-green-500'
    			: 'text-red-500') + " font-bold text-lg mb-4"));

    			add_location(p1, file$8, 16, 8, 528);
    			add_location(div1, file$8, 15, 4, 513);
    			attr_dev(div2, "class", "bg-gray-200 hover:bg-gray-300 cursor-pointer flex justify-between rounded-lg shadow-md my-4 p-6");
    			add_location(div2, file$8, 8, 0, 199);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, h2);
    			append_dev(h2, t0);
    			append_dev(div0, t1);
    			append_dev(div0, p0);
    			append_dev(p0, t2);
    			append_dev(div2, t3);
    			append_dev(div2, div1);
    			append_dev(div1, p1);
    			append_dev(p1, t4);

    			if (!mounted) {
    				dispose = [
    					listen_dev(div2, "keydown", /*handleClick*/ ctx[1], false, false, false, false),
    					listen_dev(div2, "click", /*handleClick*/ ctx[1], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*record*/ 1 && t0_value !== (t0_value = /*record*/ ctx[0].name + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*record*/ 1 && t2_value !== (t2_value = /*record*/ ctx[0].date + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*record*/ 1 && t4_value !== (t4_value = (/*record*/ ctx[0].type === "income"
    			? `₹${/*record*/ ctx[0].amount}`
    			: `-  ₹${/*record*/ ctx[0].amount}`) + "")) set_data_dev(t4, t4_value);

    			if (dirty & /*record*/ 1 && p1_class_value !== (p1_class_value = "" + ((/*record*/ ctx[0].type === "income"
    			? 'text-green-500'
    			: 'text-red-500') + " font-bold text-lg mb-4"))) {
    				attr_dev(p1, "class", p1_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let $modal;
    	validate_store(modal, 'modal');
    	component_subscribe($$self, modal, $$value => $$invalidate(2, $modal = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Record', slots, []);
    	let { record } = $$props;

    	const handleClick = () => {
    		set_store_value(
    			modal,
    			$modal = {
    				display: "block",
    				content: "detail",
    				props: record
    			},
    			$modal
    		);
    	};

    	$$self.$$.on_mount.push(function () {
    		if (record === undefined && !('record' in $$props || $$self.$$.bound[$$self.$$.props['record']])) {
    			console.warn("<Record> was created without expected prop 'record'");
    		}
    	});

    	const writable_props = ['record'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Record> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('record' in $$props) $$invalidate(0, record = $$props.record);
    	};

    	$$self.$capture_state = () => ({ record, modal, handleClick, $modal });

    	$$self.$inject_state = $$props => {
    		if ('record' in $$props) $$invalidate(0, record = $$props.record);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [record, handleClick];
    }

    class Record extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, { record: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Record",
    			options,
    			id: create_fragment$8.name
    		});
    	}

    	get record() {
    		throw new Error("<Record>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set record(value) {
    		throw new Error("<Record>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\List.svelte generated by Svelte v3.57.0 */
    const file$7 = "src\\List.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	return child_ctx;
    }

    // (24:4) {:else}
    function create_else_block(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "No records found.";
    			attr_dev(div, "class", "font-bold my-5");
    			add_location(div, file$7, 24, 4, 794);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(24:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (22:4) {#each filteredRecords as record}
    function create_each_block(ctx) {
    	let record;
    	let current;

    	record = new Record({
    			props: { record: /*record*/ ctx[5] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(record.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(record, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const record_changes = {};
    			if (dirty & /*filteredRecords*/ 1) record_changes.record = /*record*/ ctx[5];
    			record.$set(record_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(record.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(record.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(record, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(22:4) {#each filteredRecords as record}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
    	let div;
    	let current;
    	let each_value = /*filteredRecords*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	let each_1_else = null;

    	if (!each_value.length) {
    		each_1_else = create_else_block(ctx);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			if (each_1_else) {
    				each_1_else.c();
    			}

    			add_location(div, file$7, 20, 0, 702);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div, null);
    				}
    			}

    			if (each_1_else) {
    				each_1_else.m(div, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*filteredRecords*/ 1) {
    				each_value = /*filteredRecords*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();

    				if (!each_value.length && each_1_else) {
    					each_1_else.p(ctx, dirty);
    				} else if (!each_value.length) {
    					each_1_else = create_else_block(ctx);
    					each_1_else.c();
    					each_1_else.m(div, null);
    				} else if (each_1_else) {
    					each_1_else.d(1);
    					each_1_else = null;
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    			if (each_1_else) each_1_else.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let searchRecords;
    	let $records;
    	let $filters;
    	let $searchText;
    	validate_store(records, 'records');
    	component_subscribe($$self, records, $$value => $$invalidate(2, $records = $$value));
    	validate_store(filters, 'filters');
    	component_subscribe($$self, filters, $$value => $$invalidate(3, $filters = $$value));
    	validate_store(searchText, 'searchText');
    	component_subscribe($$self, searchText, $$value => $$invalidate(4, $searchText = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('List', slots, []);
    	let filteredRecords;

    	onMount(() => {
    		const savedRecords = localStorage.getItem("records");

    		if (savedRecords) {
    			set_store_value(records, $records = JSON.parse(savedRecords), $records);
    		}
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<List> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		records,
    		searchText,
    		filters,
    		Record,
    		onMount,
    		filteredRecords,
    		searchRecords,
    		$records,
    		$filters,
    		$searchText
    	});

    	$$self.$inject_state = $$props => {
    		if ('filteredRecords' in $$props) $$invalidate(0, filteredRecords = $$props.filteredRecords);
    		if ('searchRecords' in $$props) $$invalidate(1, searchRecords = $$props.searchRecords);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$searchText, $records*/ 20) {
    			$$invalidate(1, searchRecords = $searchText === ""
    			? $records
    			: $records.filter(record => record.name.toLowerCase().includes($searchText.toLowerCase())));
    		}

    		if ($$self.$$.dirty & /*searchRecords, $filters*/ 10) {
    			$$invalidate(0, filteredRecords = searchRecords.filter(record => {
    				return ($filters.type === "all"
    				? true
    				: record.type === $filters.type) && ($filters.date ? record.date === $filters.date : true);
    			}));
    		}
    	};

    	return [filteredRecords, searchRecords, $records, $filters, $searchText];
    }

    class List extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "List",
    			options,
    			id: create_fragment$7.name
    		});
    	}
    }

    /* src\Total.svelte generated by Svelte v3.57.0 */
    const file$6 = "src\\Total.svelte";

    function create_fragment$6(ctx) {
    	let div2;
    	let div0;
    	let t1;
    	let div1;

    	let t2_value = (/*totalAmount*/ ctx[0] < 0
    	? `-  ₹${Math.abs(/*totalAmount*/ ctx[0])}`
    	: ` ₹${/*totalAmount*/ ctx[0]}`) + "";

    	let t2;
    	let div2_class_value;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			div0.textContent = "Total:";
    			t1 = space();
    			div1 = element("div");
    			t2 = text(t2_value);
    			attr_dev(div0, "class", "font-bold");
    			add_location(div0, file$6, 9, 4, 485);
    			attr_dev(div1, "class", "font-bold");
    			add_location(div1, file$6, 10, 4, 526);

    			attr_dev(div2, "class", div2_class_value = "" + ((/*totalAmount*/ ctx[0] > 0
    			? "bg-green-300"
    			: "bg-red-300") + " flex text-lg my-5 justify-between px-6 py-3 rounded-lg"));

    			add_location(div2, file$6, 8, 0, 361);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div2, t1);
    			append_dev(div2, div1);
    			append_dev(div1, t2);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*totalAmount*/ 1 && t2_value !== (t2_value = (/*totalAmount*/ ctx[0] < 0
    			? `-  ₹${Math.abs(/*totalAmount*/ ctx[0])}`
    			: ` ₹${/*totalAmount*/ ctx[0]}`) + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*totalAmount*/ 1 && div2_class_value !== (div2_class_value = "" + ((/*totalAmount*/ ctx[0] > 0
    			? "bg-green-300"
    			: "bg-red-300") + " flex text-lg my-5 justify-between px-6 py-3 rounded-lg"))) {
    				attr_dev(div2, "class", div2_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let totalIncome;
    	let totalExpense;
    	let totalAmount;
    	let $records;
    	validate_store(records, 'records');
    	component_subscribe($$self, records, $$value => $$invalidate(3, $records = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Total', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Total> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		records,
    		totalExpense,
    		totalIncome,
    		totalAmount,
    		$records
    	});

    	$$self.$inject_state = $$props => {
    		if ('totalExpense' in $$props) $$invalidate(1, totalExpense = $$props.totalExpense);
    		if ('totalIncome' in $$props) $$invalidate(2, totalIncome = $$props.totalIncome);
    		if ('totalAmount' in $$props) $$invalidate(0, totalAmount = $$props.totalAmount);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$records*/ 8) {
    			$$invalidate(2, totalIncome = $records.reduce(
    				(total, record) => record.type === "income"
    				? total + record.amount
    				: total + 0,
    				0
    			));
    		}

    		if ($$self.$$.dirty & /*$records*/ 8) {
    			$$invalidate(1, totalExpense = $records.reduce(
    				(total, record) => record.type === "expense"
    				? total + record.amount
    				: total + 0,
    				0
    			));
    		}

    		if ($$self.$$.dirty & /*totalIncome, totalExpense*/ 6) {
    			$$invalidate(0, totalAmount = totalIncome - totalExpense);
    		}
    	};

    	return [totalAmount, totalExpense, totalIncome, $records];
    }

    class Total extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Total",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src\Modal.svelte generated by Svelte v3.57.0 */
    const file$5 = "src\\Modal.svelte";

    function create_fragment$5(ctx) {
    	let div6;
    	let div5;
    	let div1;
    	let div0;
    	let t0;
    	let span;
    	let t1;
    	let div4;
    	let div2;
    	let button;
    	let svg;
    	let path;
    	let t2;
    	let div3;
    	let div6_class_value;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[2].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], null);

    	const block = {
    		c: function create() {
    			div6 = element("div");
    			div5 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			t0 = space();
    			span = element("span");
    			t1 = text("​\r\n      ");
    			div4 = element("div");
    			div2 = element("div");
    			button = element("button");
    			svg = svg_element("svg");
    			path = svg_element("path");
    			t2 = space();
    			div3 = element("div");
    			if (default_slot) default_slot.c();
    			attr_dev(div0, "class", "absolute inset-0 bg-gray-500 opacity-75");
    			add_location(div0, file$5, 9, 8, 304);
    			attr_dev(div1, "class", "fixed inset-0 transition-opacity");
    			add_location(div1, file$5, 8, 6, 248);
    			attr_dev(span, "class", "hidden sm:inline-block sm:align-middle sm:h-screen");
    			add_location(span, file$5, 11, 6, 385);
    			attr_dev(path, "stroke-linecap", "round");
    			attr_dev(path, "stroke-linejoin", "round");
    			attr_dev(path, "stroke-width", "2");
    			attr_dev(path, "d", "M6 18L18 6M6 6l12 12");
    			add_location(path, file$5, 16, 14, 1005);
    			attr_dev(svg, "class", "h-6 w-6");
    			attr_dev(svg, "stroke", "currentColor");
    			attr_dev(svg, "fill", "none");
    			attr_dev(svg, "viewBox", "0 0 24 24");
    			add_location(svg, file$5, 15, 12, 914);
    			attr_dev(button, "type", "button");
    			attr_dev(button, "class", "text-gray-500 hover:text-gray-700 focus:outline-none focus:text-gray-700 sm:text-sm sm:leading-5");
    			add_location(button, file$5, 14, 10, 730);
    			attr_dev(div2, "class", "bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse");
    			add_location(div2, file$5, 13, 8, 648);
    			attr_dev(div3, "class", "bg-white px-4 py-2 pb-4 sm:px-6");
    			add_location(div3, file$5, 20, 8, 1174);
    			attr_dev(div4, "class", "inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full");
    			add_location(div4, file$5, 12, 6, 472);
    			attr_dev(div5, "class", "flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0");
    			add_location(div5, file$5, 7, 4, 137);
    			attr_dev(div6, "class", div6_class_value = "fixed z-10 inset-0 overflow-y-auto " + /*$modal*/ ctx[0].display);
    			add_location(div6, file$5, 6, 0, 65);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div6, anchor);
    			append_dev(div6, div5);
    			append_dev(div5, div1);
    			append_dev(div1, div0);
    			append_dev(div5, t0);
    			append_dev(div5, span);
    			append_dev(div5, t1);
    			append_dev(div5, div4);
    			append_dev(div4, div2);
    			append_dev(div2, button);
    			append_dev(button, svg);
    			append_dev(svg, path);
    			append_dev(div4, t2);
    			append_dev(div4, div3);

    			if (default_slot) {
    				default_slot.m(div3, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[3], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 2)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[1],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[1])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[1], dirty, null),
    						null
    					);
    				}
    			}

    			if (!current || dirty & /*$modal*/ 1 && div6_class_value !== (div6_class_value = "fixed z-10 inset-0 overflow-y-auto " + /*$modal*/ ctx[0].display)) {
    				attr_dev(div6, "class", div6_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let $modal;
    	validate_store(modal, 'modal');
    	component_subscribe($$self, modal, $$value => $$invalidate(0, $modal = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Modal', slots, ['default']);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Modal> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => set_store_value(modal, $modal.display = "hidden", $modal);

    	$$self.$$set = $$props => {
    		if ('$$scope' in $$props) $$invalidate(1, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ modal, $modal });
    	return [$modal, $$scope, slots, click_handler];
    }

    class Modal extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Modal",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src\AddBtn.svelte generated by Svelte v3.57.0 */
    const file$4 = "src\\AddBtn.svelte";

    function create_fragment$4(ctx) {
    	let div;
    	let button;
    	let span;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			button = element("button");
    			span = element("span");
    			span.textContent = "+";
    			attr_dev(span, "class", "text-lg");
    			add_location(span, file$4, 10, 6, 307);
    			attr_dev(button, "class", "bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full");
    			add_location(button, file$4, 9, 4, 186);
    			attr_dev(div, "class", "fixed bottom-4 right-4");
    			add_location(div, file$4, 8, 0, 144);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, button);
    			append_dev(button, span);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*handleClick*/ ctx[0], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let $modal;
    	validate_store(modal, 'modal');
    	component_subscribe($$self, modal, $$value => $$invalidate(1, $modal = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('AddBtn', slots, []);

    	const handleClick = () => {
    		set_store_value(modal, $modal = { display: "block", content: "form" }, $modal);
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<AddBtn> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ modal, handleClick, $modal });
    	return [handleClick];
    }

    class AddBtn extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "AddBtn",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src\Filter.svelte generated by Svelte v3.57.0 */
    const file$3 = "src\\Filter.svelte";

    function create_fragment$3(ctx) {
    	let div5;
    	let h2;
    	let t1;
    	let form;
    	let div3;
    	let div0;
    	let input0;
    	let t2;
    	let label0;
    	let t4;
    	let div1;
    	let input1;
    	let t5;
    	let label1;
    	let t7;
    	let div2;
    	let input2;
    	let t8;
    	let label2;
    	let t10;
    	let div4;
    	let label3;
    	let t12;
    	let input3;
    	let t13;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div5 = element("div");
    			h2 = element("h2");
    			h2.textContent = "Filters";
    			t1 = space();
    			form = element("form");
    			div3 = element("div");
    			div0 = element("div");
    			input0 = element("input");
    			t2 = space();
    			label0 = element("label");
    			label0.textContent = "All";
    			t4 = space();
    			div1 = element("div");
    			input1 = element("input");
    			t5 = space();
    			label1 = element("label");
    			label1.textContent = "Expense";
    			t7 = space();
    			div2 = element("div");
    			input2 = element("input");
    			t8 = space();
    			label2 = element("label");
    			label2.textContent = "Income";
    			t10 = space();
    			div4 = element("div");
    			label3 = element("label");
    			label3.textContent = "Select a date:";
    			t12 = space();
    			input3 = element("input");
    			t13 = space();
    			button = element("button");
    			button.textContent = "Apply";
    			attr_dev(h2, "class", "text-2xl font-medium mb-4");
    			add_location(h2, file$3, 13, 4, 312);
    			input0.value = "all";
    			attr_dev(input0, "type", "radio");
    			attr_dev(input0, "name", "record-type");
    			attr_dev(input0, "id", "all");
    			attr_dev(input0, "class", "form-radio h-5 w-5 text-blue-600");
    			input0.checked = true;
    			add_location(input0, file$3, 17, 10, 504);
    			attr_dev(label0, "for", "all");
    			attr_dev(label0, "class", "ml-2 text-gray-700");
    			add_location(label0, file$3, 18, 10, 625);
    			attr_dev(div0, "class", "flex items-center mr-4");
    			add_location(div0, file$3, 16, 8, 456);
    			input1.value = "expense";
    			attr_dev(input1, "type", "radio");
    			attr_dev(input1, "name", "record-type");
    			attr_dev(input1, "id", "expense");
    			attr_dev(input1, "class", "form-radio h-5 w-5 text-blue-600");
    			add_location(input1, file$3, 21, 10, 754);
    			attr_dev(label1, "for", "expense");
    			attr_dev(label1, "class", "ml-2 text-gray-700");
    			add_location(label1, file$3, 22, 10, 875);
    			attr_dev(div1, "class", "flex items-center mr-4");
    			add_location(div1, file$3, 20, 8, 706);
    			input2.value = "income";
    			attr_dev(input2, "type", "radio");
    			attr_dev(input2, "name", "record-type");
    			attr_dev(input2, "id", "income");
    			attr_dev(input2, "class", "form-radio h-5 w-5 text-blue-600");
    			add_location(input2, file$3, 25, 10, 1009);
    			attr_dev(label2, "for", "income");
    			attr_dev(label2, "class", "ml-2 text-gray-700");
    			add_location(label2, file$3, 26, 10, 1128);
    			attr_dev(div2, "class", "flex items-center");
    			add_location(div2, file$3, 24, 8, 966);
    			attr_dev(div3, "class", "flex mb-8");
    			add_location(div3, file$3, 15, 6, 423);
    			attr_dev(label3, "for", "date");
    			attr_dev(label3, "class", "text-gray-700");
    			add_location(label3, file$3, 30, 8, 1255);
    			attr_dev(input3, "type", "date");
    			attr_dev(input3, "id", "date");
    			attr_dev(input3, "name", "date");
    			attr_dev(input3, "class", "block w-full mt-2 border p-2");
    			add_location(input3, file$3, 31, 8, 1327);
    			attr_dev(div4, "class", "mb-8");
    			add_location(div4, file$3, 29, 6, 1227);
    			attr_dev(button, "class", "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 w-full px-4 rounded focus:outline-none focus:shadow-outline");
    			attr_dev(button, "type", "submit");
    			add_location(button, file$3, 33, 6, 1427);
    			add_location(form, file$3, 14, 4, 368);
    			attr_dev(div5, "class", "");
    			add_location(div5, file$3, 12, 0, 292);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div5, anchor);
    			append_dev(div5, h2);
    			append_dev(div5, t1);
    			append_dev(div5, form);
    			append_dev(form, div3);
    			append_dev(div3, div0);
    			append_dev(div0, input0);
    			append_dev(div0, t2);
    			append_dev(div0, label0);
    			append_dev(div3, t4);
    			append_dev(div3, div1);
    			append_dev(div1, input1);
    			append_dev(div1, t5);
    			append_dev(div1, label1);
    			append_dev(div3, t7);
    			append_dev(div3, div2);
    			append_dev(div2, input2);
    			append_dev(div2, t8);
    			append_dev(div2, label2);
    			append_dev(form, t10);
    			append_dev(form, div4);
    			append_dev(div4, label3);
    			append_dev(div4, t12);
    			append_dev(div4, input3);
    			append_dev(form, t13);
    			append_dev(form, button);

    			if (!mounted) {
    				dispose = listen_dev(form, "submit", prevent_default(/*handleSubmit*/ ctx[0]), false, true, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div5);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let $modal;
    	let $filters;
    	validate_store(modal, 'modal');
    	component_subscribe($$self, modal, $$value => $$invalidate(1, $modal = $$value));
    	validate_store(filters, 'filters');
    	component_subscribe($$self, filters, $$value => $$invalidate(2, $filters = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Filter', slots, []);

    	const handleSubmit = event => {
    		const type = event.target["record-type"].value;
    		const date = event.target["date"].value;
    		set_store_value(filters, $filters.type = type, $filters);
    		set_store_value(filters, $filters.date = date, $filters);
    		set_store_value(modal, $modal.display = "hidden", $modal);
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Filter> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		modal,
    		filters,
    		handleSubmit,
    		$modal,
    		$filters
    	});

    	return [handleSubmit];
    }

    class Filter extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Filter",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src\Detail.svelte generated by Svelte v3.57.0 */
    const file$2 = "src\\Detail.svelte";

    function create_fragment$2(ctx) {
    	let div0;
    	let t0_value = /*record*/ ctx[0].name + "";
    	let t0;
    	let t1;
    	let div1;

    	let t2_value = (/*record*/ ctx[0].type === "expense"
    	? `- ₹${/*record*/ ctx[0].amount}`
    	: `₹${/*record*/ ctx[0].amount}`) + "";

    	let t2;
    	let div1_class_value;
    	let t3;
    	let div2;
    	let t5;
    	let div3;
    	let t6_value = /*record*/ ctx[0].date + "";
    	let t6;
    	let t7;
    	let div4;
    	let button0;
    	let t9;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			div1 = element("div");
    			t2 = text(t2_value);
    			t3 = space();
    			div2 = element("div");
    			div2.textContent = "Date";
    			t5 = space();
    			div3 = element("div");
    			t6 = text(t6_value);
    			t7 = space();
    			div4 = element("div");
    			button0 = element("button");
    			button0.textContent = "Edit";
    			t9 = space();
    			button1 = element("button");
    			button1.textContent = "Delete";
    			attr_dev(div0, "class", "text-3xl font-bold ");
    			add_location(div0, file$2, 14, 0, 411);

    			attr_dev(div1, "class", div1_class_value = "" + ((/*record*/ ctx[0].type === "expense"
    			? "text-red-700"
    			: "text-green-700") + " my-3 font-bold text-lg"));

    			add_location(div1, file$2, 15, 0, 465);
    			attr_dev(div2, "class", "font-bold text-lg");
    			add_location(div2, file$2, 16, 0, 647);
    			attr_dev(div3, "class", "my-1 mb-5");
    			add_location(div3, file$2, 17, 0, 690);
    			attr_dev(button0, "class", "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded");
    			add_location(button0, file$2, 19, 4, 773);
    			attr_dev(button1, "class", "bg-transparent hover:bg-blue-500 text-blue-700 font-semibold hover:text-white py-2 px-4 border border-blue-500 hover:border-transparent rounded");
    			add_location(button1, file$2, 22, 6, 919);
    			attr_dev(div4, "class", "flex my-3 space-x-4");
    			add_location(div4, file$2, 18, 0, 734);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, t2);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, div2, anchor);
    			insert_dev(target, t5, anchor);
    			insert_dev(target, div3, anchor);
    			append_dev(div3, t6);
    			insert_dev(target, t7, anchor);
    			insert_dev(target, div4, anchor);
    			append_dev(div4, button0);
    			append_dev(div4, t9);
    			append_dev(div4, button1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*handleEdit*/ ctx[1], false, false, false, false),
    					listen_dev(button1, "click", /*handleDelete*/ ctx[2], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*record*/ 1 && t0_value !== (t0_value = /*record*/ ctx[0].name + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*record*/ 1 && t2_value !== (t2_value = (/*record*/ ctx[0].type === "expense"
    			? `- ₹${/*record*/ ctx[0].amount}`
    			: `₹${/*record*/ ctx[0].amount}`) + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*record*/ 1 && div1_class_value !== (div1_class_value = "" + ((/*record*/ ctx[0].type === "expense"
    			? "text-red-700"
    			: "text-green-700") + " my-3 font-bold text-lg"))) {
    				attr_dev(div1, "class", div1_class_value);
    			}

    			if (dirty & /*record*/ 1 && t6_value !== (t6_value = /*record*/ ctx[0].date + "")) set_data_dev(t6, t6_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div2);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(div3);
    			if (detaching) detach_dev(t7);
    			if (detaching) detach_dev(div4);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let record;
    	let $modal;
    	let $records;
    	validate_store(modal, 'modal');
    	component_subscribe($$self, modal, $$value => $$invalidate(3, $modal = $$value));
    	validate_store(records, 'records');
    	component_subscribe($$self, records, $$value => $$invalidate(4, $records = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Detail', slots, []);

    	const handleEdit = () => {
    		set_store_value(modal, $modal.content = "editForm", $modal);
    	};

    	const handleDelete = () => {
    		set_store_value(records, $records = $records.filter(item => item.id !== record.id), $records);
    		localStorage.setItem("records", JSON.stringify($records));
    		set_store_value(modal, $modal = { ...$modal, display: "hidden" }, $modal);
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Detail> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		modal,
    		records,
    		handleEdit,
    		handleDelete,
    		record,
    		$modal,
    		$records
    	});

    	$$self.$inject_state = $$props => {
    		if ('record' in $$props) $$invalidate(0, record = $$props.record);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$modal*/ 8) {
    			$$invalidate(0, record = $modal.props);
    		}
    	};

    	return [record, handleEdit, handleDelete, $modal];
    }

    class Detail extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Detail",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src\EditForm.svelte generated by Svelte v3.57.0 */
    const file$1 = "src\\EditForm.svelte";

    function create_fragment$1(ctx) {
    	let form;
    	let h2;
    	let t1;
    	let div1;
    	let label0;
    	let t3;
    	let div0;
    	let label1;
    	let input0;
    	let input0_checked_value;
    	let t4;
    	let span0;
    	let t6;
    	let label2;
    	let input1;
    	let input1_checked_value;
    	let t7;
    	let span1;
    	let t9;
    	let div2;
    	let label3;
    	let t11;
    	let input2;
    	let input2_value_value;
    	let t12;
    	let div3;
    	let label4;
    	let t14;
    	let input3;
    	let input3_value_value;
    	let t15;
    	let div4;
    	let label5;
    	let t17;
    	let input4;
    	let input4_value_value;
    	let t18;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			form = element("form");
    			h2 = element("h2");
    			h2.textContent = "Edit transaction";
    			t1 = space();
    			div1 = element("div");
    			label0 = element("label");
    			label0.textContent = "Type";
    			t3 = space();
    			div0 = element("div");
    			label1 = element("label");
    			input0 = element("input");
    			t4 = space();
    			span0 = element("span");
    			span0.textContent = "Expense";
    			t6 = space();
    			label2 = element("label");
    			input1 = element("input");
    			t7 = space();
    			span1 = element("span");
    			span1.textContent = "Income";
    			t9 = space();
    			div2 = element("div");
    			label3 = element("label");
    			label3.textContent = "Name";
    			t11 = space();
    			input2 = element("input");
    			t12 = space();
    			div3 = element("div");
    			label4 = element("label");
    			label4.textContent = "Amount";
    			t14 = space();
    			input3 = element("input");
    			t15 = space();
    			div4 = element("div");
    			label5 = element("label");
    			label5.textContent = "Date";
    			t17 = space();
    			input4 = element("input");
    			t18 = space();
    			button = element("button");
    			button.textContent = "Edit";
    			attr_dev(h2, "class", "text-xl font-medium text-gray-900 mb-4");
    			add_location(h2, file$1, 19, 6, 759);
    			attr_dev(label0, "class", "block text-gray-700 font-medium mb-2");
    			add_location(label0, file$1, 21, 8, 867);
    			input0.required = true;
    			input0.checked = input0_checked_value = /*record*/ ctx[0]?.type === "expense";
    			attr_dev(input0, "type", "radio");
    			attr_dev(input0, "class", "form-radio text-blue-500");
    			attr_dev(input0, "name", "transaction_type");
    			input0.value = "expense";
    			add_location(input0, file$1, 24, 12, 1030);
    			attr_dev(span0, "class", "ml-2 text-gray-700 font-medium");
    			add_location(span0, file$1, 32, 12, 1291);
    			attr_dev(label1, "class", "inline-flex items-center mr-6");
    			add_location(label1, file$1, 23, 10, 971);
    			input1.checked = input1_checked_value = /*record*/ ctx[0]?.type === "income";
    			input1.required = true;
    			attr_dev(input1, "type", "radio");
    			attr_dev(input1, "class", "form-radio text-green-500");
    			attr_dev(input1, "name", "transaction_type");
    			input1.value = "income";
    			add_location(input1, file$1, 35, 12, 1436);
    			attr_dev(span1, "class", "ml-2 text-gray-700 font-medium");
    			add_location(span1, file$1, 43, 12, 1692);
    			attr_dev(label2, "class", "inline-flex items-center");
    			add_location(label2, file$1, 34, 10, 1382);
    			attr_dev(div0, "class", "flex");
    			add_location(div0, file$1, 22, 8, 941);
    			attr_dev(div1, "class", "mb-4");
    			add_location(div1, file$1, 20, 6, 839);
    			attr_dev(label3, "class", "block text-gray-700 font-medium mb-2");
    			add_location(label3, file$1, 48, 8, 1836);
    			input2.required = true;
    			input2.value = input2_value_value = /*record*/ ctx[0]?.name ?? "";
    			attr_dev(input2, "type", "text");
    			attr_dev(input2, "class", "form-input w-full border p-2 ");
    			attr_dev(input2, "name", "name");
    			attr_dev(input2, "placeholder", "Enter name");
    			add_location(input2, file$1, 49, 8, 1910);
    			attr_dev(div2, "class", "mb-4");
    			add_location(div2, file$1, 47, 6, 1808);
    			attr_dev(label4, "class", "block text-gray-700 font-medium mb-2");
    			add_location(label4, file$1, 59, 8, 2167);
    			input3.required = true;
    			input3.value = input3_value_value = /*record*/ ctx[0]?.amount ?? "";
    			attr_dev(input3, "type", "number");
    			attr_dev(input3, "class", "border p-2 form-input w-full");
    			attr_dev(input3, "name", "amount");
    			attr_dev(input3, "placeholder", "Enter amount");
    			add_location(input3, file$1, 60, 8, 2243);
    			attr_dev(div3, "class", "mb-4");
    			add_location(div3, file$1, 58, 6, 2139);
    			attr_dev(label5, "class", "block text-gray-700 font-medium mb-2");
    			add_location(label5, file$1, 70, 8, 2507);
    			input4.required = true;
    			input4.value = input4_value_value = /*record*/ ctx[0]?.date ?? "";
    			attr_dev(input4, "type", "date");
    			attr_dev(input4, "class", "border p-2 form-input w-full");
    			attr_dev(input4, "name", "date");
    			add_location(input4, file$1, 71, 8, 2581);
    			attr_dev(div4, "class", "mb-4");
    			add_location(div4, file$1, 69, 6, 2479);
    			attr_dev(button, "type", "submit");
    			attr_dev(button, "class", "bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded");
    			add_location(button, file$1, 79, 6, 2773);
    			add_location(form, file$1, 18, 4, 675);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, form, anchor);
    			append_dev(form, h2);
    			append_dev(form, t1);
    			append_dev(form, div1);
    			append_dev(div1, label0);
    			append_dev(div1, t3);
    			append_dev(div1, div0);
    			append_dev(div0, label1);
    			append_dev(label1, input0);
    			append_dev(label1, t4);
    			append_dev(label1, span0);
    			append_dev(div0, t6);
    			append_dev(div0, label2);
    			append_dev(label2, input1);
    			append_dev(label2, t7);
    			append_dev(label2, span1);
    			append_dev(form, t9);
    			append_dev(form, div2);
    			append_dev(div2, label3);
    			append_dev(div2, t11);
    			append_dev(div2, input2);
    			append_dev(form, t12);
    			append_dev(form, div3);
    			append_dev(div3, label4);
    			append_dev(div3, t14);
    			append_dev(div3, input3);
    			append_dev(form, t15);
    			append_dev(form, div4);
    			append_dev(div4, label5);
    			append_dev(div4, t17);
    			append_dev(div4, input4);
    			append_dev(form, t18);
    			append_dev(form, button);

    			if (!mounted) {
    				dispose = listen_dev(form, "submit", prevent_default(/*submit_handler*/ ctx[3]), false, true, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*record*/ 1 && input0_checked_value !== (input0_checked_value = /*record*/ ctx[0]?.type === "expense")) {
    				prop_dev(input0, "checked", input0_checked_value);
    			}

    			if (dirty & /*record*/ 1 && input1_checked_value !== (input1_checked_value = /*record*/ ctx[0]?.type === "income")) {
    				prop_dev(input1, "checked", input1_checked_value);
    			}

    			if (dirty & /*record*/ 1 && input2_value_value !== (input2_value_value = /*record*/ ctx[0]?.name ?? "") && input2.value !== input2_value_value) {
    				prop_dev(input2, "value", input2_value_value);
    			}

    			if (dirty & /*record*/ 1 && input3_value_value !== (input3_value_value = /*record*/ ctx[0]?.amount ?? "") && input3.value !== input3_value_value) {
    				prop_dev(input3, "value", input3_value_value);
    			}

    			if (dirty & /*record*/ 1 && input4_value_value !== (input4_value_value = /*record*/ ctx[0]?.date ?? "")) {
    				prop_dev(input4, "value", input4_value_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(form);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let record;
    	let $modal;
    	let $records;
    	validate_store(modal, 'modal');
    	component_subscribe($$self, modal, $$value => $$invalidate(2, $modal = $$value));
    	validate_store(records, 'records');
    	component_subscribe($$self, records, $$value => $$invalidate(4, $records = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('EditForm', slots, []);

    	const handleSubmit = (event, id) => {
    		const type = event.target["transaction_type"].value;
    		const name = event.target["name"].value;
    		let amount = Number(event.target["amount"].value);
    		const date = event.target["date"].value;
    		const newRecord = { name, type, amount, date };
    		set_store_value(records, $records = $records.map(record => record.id === id ? newRecord : record), $records);
    		localStorage.setItem("records", JSON.stringify($records));
    		event.target.reset();
    		set_store_value(modal, $modal.display = "hidden", $modal);
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<EditForm> was created with unknown prop '${key}'`);
    	});

    	const submit_handler = event => handleSubmit(event, record?.id);

    	$$self.$capture_state = () => ({
    		records,
    		modal,
    		handleSubmit,
    		record,
    		$modal,
    		$records
    	});

    	$$self.$inject_state = $$props => {
    		if ('record' in $$props) $$invalidate(0, record = $$props.record);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$modal*/ 4) {
    			$$invalidate(0, record = $modal.props);
    		}
    	};

    	return [record, handleSubmit, $modal, submit_handler];
    }

    class EditForm extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "EditForm",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.57.0 */
    const file = "src\\App.svelte";

    // (29:4) <Modal>
    function create_default_slot(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	var switch_value = /*components*/ ctx[1][/*$modal*/ ctx[0].content];

    	function switch_props(ctx) {
    		return { $$inline: true };
    	}

    	if (switch_value) {
    		switch_instance = construct_svelte_component_dev(switch_value, switch_props());
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) mount_component(switch_instance, target, anchor);
    			insert_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$modal*/ 1 && switch_value !== (switch_value = /*components*/ ctx[1][/*$modal*/ ctx[0].content])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = construct_svelte_component_dev(switch_value, switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(29:4) <Modal>",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div;
    	let h1;
    	let t1;
    	let total;
    	let t2;
    	let search;
    	let t3;
    	let modal_1;
    	let t4;
    	let list;
    	let t5;
    	let addbtn;
    	let current;
    	total = new Total({ $$inline: true });
    	search = new Search({ $$inline: true });

    	modal_1 = new Modal({
    			props: {
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	list = new List({ $$inline: true });
    	addbtn = new AddBtn({ $$inline: true });

    	const block = {
    		c: function create() {
    			div = element("div");
    			h1 = element("h1");
    			h1.textContent = "Transactions";
    			t1 = space();
    			create_component(total.$$.fragment);
    			t2 = space();
    			create_component(search.$$.fragment);
    			t3 = space();
    			create_component(modal_1.$$.fragment);
    			t4 = space();
    			create_component(list.$$.fragment);
    			t5 = space();
    			create_component(addbtn.$$.fragment);
    			attr_dev(h1, "class", "my-5 text-4xl");
    			add_location(h1, file, 24, 4, 603);
    			attr_dev(div, "class", "my-14 px-5 max-w-xl mx-auto");
    			add_location(div, file, 23, 0, 557);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h1);
    			append_dev(div, t1);
    			mount_component(total, div, null);
    			append_dev(div, t2);
    			mount_component(search, div, null);
    			append_dev(div, t3);
    			mount_component(modal_1, div, null);
    			append_dev(div, t4);
    			mount_component(list, div, null);
    			append_dev(div, t5);
    			mount_component(addbtn, div, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const modal_1_changes = {};

    			if (dirty & /*$$scope, $modal*/ 5) {
    				modal_1_changes.$$scope = { dirty, ctx };
    			}

    			modal_1.$set(modal_1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(total.$$.fragment, local);
    			transition_in(search.$$.fragment, local);
    			transition_in(modal_1.$$.fragment, local);
    			transition_in(list.$$.fragment, local);
    			transition_in(addbtn.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(total.$$.fragment, local);
    			transition_out(search.$$.fragment, local);
    			transition_out(modal_1.$$.fragment, local);
    			transition_out(list.$$.fragment, local);
    			transition_out(addbtn.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(total);
    			destroy_component(search);
    			destroy_component(modal_1);
    			destroy_component(list);
    			destroy_component(addbtn);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let $modal;
    	validate_store(modal, 'modal');
    	component_subscribe($$self, modal, $$value => $$invalidate(0, $modal = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);

    	const components = {
    		form: Form,
    		filter: Filter,
    		detail: Detail,
    		editForm: EditForm
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		Form,
    		Search,
    		List,
    		Total,
    		Modal,
    		AddBtn,
    		Filter,
    		Detail,
    		EditForm,
    		modal,
    		records,
    		components,
    		$modal
    	});

    	return [$modal, components];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
