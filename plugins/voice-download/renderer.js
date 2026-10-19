/* Adapted from Vencord/Equicord; modified for Bedrock on 2026-10-18.
 * Copyright (c) 2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * See NOTICE for source and authorship. */
export function start(ctx) {
    const links = new Map();
    ctx.styles.add(`
        .vc-voice-download { width:24px; height:24px; color:var(--interactive-icon-default);
            cursor:pointer; position:relative; flex-shrink:0; }
        .vc-voice-download:hover { color:var(--interactive-icon-active); }
    `);
    const attach = element => {
        const key = Object.keys(element).find(key => key.startsWith('__reactFiber$'));
        for (let fiber = element[key], depth = 0; fiber && depth < 40; fiber = fiber.return, depth++) {
            const props = fiber.memoizedProps;
            if (typeof props?.src !== 'string' || typeof props.waveform !== 'string') continue;
            // Voice players have waveform props even before they create an audio element.
            let host = fiber.child;
            while (host && !(host.stateNode instanceof HTMLElement)) host = host.child;
            const container = host?.stateNode;
            if (!container || !container.contains(element)) return;
            let source;
            try { source = new URL(props.src, location.href); } catch { return; }
            if (!['https:', 'http:', 'blob:'].includes(source.protocol)) return;
            let link = links.get(container);
            if (!link) {
                link = document.createElement('a');
                link.className = 'vc-voice-download';
                link.setAttribute('aria-label', 'Download voice message');
                link.target = '_blank'; link.rel = 'noopener noreferrer';
                link.addEventListener('click', event => event.stopPropagation());
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                for (const [name, value] of Object.entries({ height: '24', width: '24', viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': 'true' })) svg.setAttribute(name, value);
                const path = document.createElementNS(svg.namespaceURI, 'path');
                path.setAttribute('d', 'M12 2a1 1 0 0 1 1 1v10.59l3.3-3.3a1 1 0 1 1 1.4 1.42l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 1 1 1.4-1.42l3.3 3.3V3a1 1 0 0 1 1-1ZM3 20a1 1 0 1 0 0 2h18a1 1 0 1 0 0-2H3Z');
                svg.append(path); link.append(svg);
                links.set(container, link);
            }
            if (link.href !== source.href) link.href = source.href;
            if (link.parentElement !== container) container.append(link);
            return;
        }
    };
    const scan = node => {
        if (!(node instanceof Element)) return;
        const messages = node.matches('[id^="chat-messages-"], [data-list-item-id^="chat-messages___"]') ? [node] :
            node.closest('[id^="chat-messages-"], [data-list-item-id^="chat-messages___"]') ? [node] :
                [...node.querySelectorAll('[id^="chat-messages-"], [data-list-item-id^="chat-messages___"]')];
        for (const message of messages) {
            attach(message);
            for (const element of message.querySelectorAll('*:not(.vc-voice-download):not(.vc-voice-download *)')) attach(element);
        }
    };
    const observer = new MutationObserver(changes => {
        for (const change of changes) {
            if (change.target instanceof Element && !change.target.closest('.vc-voice-download')) scan(change.target);
        }
        for (const [container, link] of links) if (!container.isConnected) { link.remove(); links.delete(container); }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    scan(document.documentElement);
    ctx.cleanup(() => { observer.disconnect(); for (const link of links.values()) link.remove(); links.clear(); });
}
