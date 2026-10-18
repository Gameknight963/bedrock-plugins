export function menuProps(element) {
    const key = Object.keys(element).find(key => key.startsWith('__reactFiber$'));
    for (let fiber = element[key], depth = 0; fiber && depth < 40; fiber = fiber.return, depth++) {
        if (typeof fiber.memoizedProps?.navId === 'string') return fiber.memoizedProps;
    }
    return null;
}

function text(value, depth = 0) {
    if (depth > 20 || value == null || typeof value === 'boolean') return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (Array.isArray(value)) return value.map(item => text(item, depth + 1)).join('');
    return text(value.props?.children ?? value.props?.text, depth + 1);
}

export function readMenu(element) {
    const props = menuProps(element);
    if (!props) return null;
    const actions = new Map();
    let sequence = 0;
    const rootId = element.id;
    const rowFor = id => document.getElementById(`${rootId}-${id}`);
    const labelFor = (value, row) => text(value) || row?.querySelector('[class*="label_"]')?.textContent ||
        row?.getAttribute('aria-label') || row?.querySelector('[aria-label]')?.getAttribute('aria-label') ||
        row?.querySelector('img[alt]')?.getAttribute('alt') || '';
    const register = callback => { const id = String(++sequence); actions.set(id, callback); return id; };
    const eventFor = (message, row) => {
        const event = new MouseEvent('click', { bubbles: true, ctrlKey: !!message.ctrlKey, shiftKey: !!message.shiftKey, altKey: !!message.altKey });
        Object.defineProperties(event, { target: { value: row || element }, currentTarget: { value: row || element } });
        return event;
    };
    const controls = (node, parent, row, depth) => {
        if (!node || depth > 20) return [];
        if (Array.isArray(node)) return node.flatMap(item => controls(item, parent, row, depth + 1));
        if (typeof node !== 'object') return [];
        const p = node.props || {};
        const change = p.onChange || p.onValueChange;
        if (typeof change === 'function' && typeof (p.value ?? p.initialValue) === 'number') {
            const slider = row?.querySelector('[role="slider"]');
            const defaults = node.type?.defaultProps || {};
            const value = p.value ?? p.initialValue;
            const min = p.minValue ?? defaults.minValue ?? Number(slider?.getAttribute('aria-valuemin') || 0);
            const max = p.maxValue ?? defaults.maxValue ?? Number(slider?.getAttribute('aria-valuemax') || Math.max(100, value));
            const step = p.step ?? p.markers?.[1] - p.markers?.[0];
            return [{ type: 'slider', id: register(message => change(message.value)), label: parent.label || text(p['aria-label']),
                value, min, max, step: Number.isFinite(step) && step > 0 ? step : 1, disabled: !!parent.disabled || !!p.disabled }];
        }
        if (typeof change === 'function' && typeof p.value === 'string') {
            return [{ type: 'text', id: register(message => change(message.value)), label: parent.label, text: p.value, disabled: !!p.disabled }];
        }
        if (typeof p.onClick === 'function') {
            return [{ type: 'item', id: register(message => p.onClick(eventFor(message, row))),
                label: labelFor(p.children || p['aria-label'], row) || parent.label, hasAction: true, disabled: !!p.disabled }];
        }
        const children = controls(p.children, parent, row, depth + 1);
        if (children.length) return children;
        return [{ type: 'placeholder', label: `${parent.id || parent.label || 'Custom control'} not implemented`, disabled: true }];
    };
    const read = (children, depth = 0) => {
        if (depth > 20) throw new Error('Menu nesting exceeds twenty levels.');
        if (children == null || typeof children === 'boolean') return [];
        if (Array.isArray(children)) return children.flatMap(child => read(child, depth + 1));
        if (typeof children !== 'object' || !children.props) return [];
        const p = children.props;
        if (p.id == null) {
            if (p.children == null) return [{ type: 'separator' }];
            const group = read(p.children, depth + 1);
            if (!group.length) return [];
            return [{ type: 'separator' }, ...(p.label ? [{ type: 'label', label: text(p.label) }] : []), ...group];
        }
        const row = rowFor(p.id);
        let label = labelFor(p.label, row);
        if (!label && typeof p.render === 'function') {
            const visual = p.render({ isFocused: false, disabled: !!p.disabled });
            label = text(visual) || visual?.props?.['aria-label'] || visual?.props?.emoji?.name || '';
        }
        if (typeof p.control === 'function') {
            try {
                const content = p.control({ disabled: !!p.disabled, isFocused: false, onClose: props.onClose,
                    onInteraction: props.onInteraction, tabIndex: -1 }, null);
                const result = controls(content, { ...p, label }, row, depth + 1);
                return result.length || content == null || typeof content === 'boolean' ? result :
                    [{ type: 'placeholder', label: `${p.id || label || 'Custom control'} not implemented`, disabled: true }];
            } catch {
                return [{ type: 'placeholder', label: `${p.id || label || 'Custom control'} not implemented`, disabled: true }];
            }
        }
        const nested = read(p.children, depth + 1);
        const action = typeof p.action === 'function' ? p.action : null;
        const id = action ? register(message => action(eventFor(message, row))) : String(++sequence);
        if (!label && !nested.length) throw new Error(`Menu item ${p.id} has no readable label.`);
        return [{ type: p.checked != null ? p.group != null ? 'radio' : 'checkbox' : 'item', id, label,
            description: text(p.subtext), hasAction: !!action, disabled: !!p.disabled, checked: !!p.checked,
            dangerous: p.color === 'danger', keepOpenOnShift: !!p.dontCloseOnActionIfHoldingShiftKey, children: nested }];
    };
    const clean = nodes => {
        const result = [];
        for (const node of nodes) {
            if (node.children) node.children = clean(node.children);
            if (node.type === 'separator' && (!result.length || result.at(-1).type === 'separator')) continue;
            result.push(node);
        }
        if (result.at(-1)?.type === 'separator') result.pop();
        return result;
    };
    return { props, items: clean(read(props.children)), actions };
}
