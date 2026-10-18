import { readMenu } from './menu.js';

export function start(ctx) {
    const client = crypto.randomUUID();
    const identity = Symbol.for('bedrock.native-menus.client');
    globalThis[identity] = client;
    ctx.cleanup(() => { if (globalThis[identity] === client) delete globalThis[identity]; });
    const handled = new WeakSet();
    const sessions = new Map();
    let active = true;
    let anchor;
    const rememberAnchor = event => {
        anchor = event.button === 2 ? { x: event.clientX, y: event.clientY, time: performance.now() } : null;
    };
    document.addEventListener('contextmenu', rememberAnchor, true);
    ctx.cleanup(() => document.removeEventListener('contextmenu', rememberAnchor, true));
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const colors = canvas.getContext('2d', { willReadFrequently: true });
    const color = (value, fallback) => {
        colors.clearRect(0, 0, 1, 1);
        colors.fillStyle = value;
        colors.fillRect(0, 0, 1, 1);
        const channels = colors.getImageData(0, 0, 1, 1).data;
        return channels[3] ? '#' + Array.from(channels.slice(0, 3), channel => channel.toString(16).padStart(2, '0')).join('') : fallback;
    };
    const close = (record, dismiss = true) => {
        if (!record) return;
        sessions.delete(record.session);
        record.element.style.visibility = record.visibility;
        if (dismiss && record.element.isConnected) record.menu.props.onClose?.();
    };
    const open = element => {
        if (!active || handled.has(element)) return;
        const menu = readMenu(element);
        if (!menu || !menu.items.length) return;
        handled.add(element);
        const session = crypto.randomUUID();
        const bounds = element.getBoundingClientRect();
        const point = anchor && performance.now() - anchor.time < 1500 ? anchor : { x: bounds.left, y: bounds.top };
        anchor = null;
        const style = getComputedStyle(element);
        const label = element.querySelector('[role^="menuitem"]:not([aria-disabled="true"]) [class*="label_"]') ||
            element.querySelector('[role^="menuitem"]:not([aria-disabled="true"])') || element;
        const record = { element, menu, session, visibility: element.style.visibility };
        sessions.set(session, record);
        element.style.visibility = 'hidden';
        ctx.events.emit('native-menus.request', { kind: 'show', client, session, items: menu.items,
            x: point.x, y: point.y, pixelRatio: window.devicePixelRatio,
            background: color(style.backgroundColor, '#202024'), foreground: color(getComputedStyle(label).color, '#eeeeee') })
            .catch(error => { close(record, false); ctx.log.error('Could not open the desktop menu.', error); });
    };
    const scan = () => {
        for (const element of document.querySelectorAll('[role="menu"]')) {
            try { open(element); }
            catch (error) { handled.add(element); ctx.log.error('Could not translate this Discord menu.', error); }
        }
    };
    const observer = new MutationObserver(scan);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    ctx.events.on('native-menus.reply', async event => {
        const message = event.value;
        if (!active || message?.client !== client) return;
        const record = sessions.get(message.session);
        if (!record) return;
        if (message.kind === 'closed') { close(record); return; }
        if (message.kind === 'error') { close(record, false); ctx.log.error(message.message); return; }
        const action = record.menu.actions.get(message.id);
        if (!action) return;
        try {
            const selected = message.kind === 'action' && !message.keepOpen;
            // An action may open another menu. Close this one before invoking it.
            if (selected) close(record);
            await action(message);
            if (selected) record.menu.props.onSelect?.();
        } catch (error) { close(record); ctx.log.error('The menu action failed.', error); }
    });
    ctx.cleanup(() => {
        active = false; observer.disconnect();
        for (const record of sessions.values()) close(record);
    });
    scan();
}
