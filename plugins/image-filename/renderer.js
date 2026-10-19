/* Adapted from Vencord/Equicord; modified for Bedrock on 2026-10-18.
 * Copyright (c) 2025 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * See NOTICE for source and authorship. */
const { definePluginSettings, OptionType } = Bedrock;
export const settings = definePluginSettings({
    showFullUrl: { type: OptionType.BOOLEAN, label: 'Show full URL', default: false,
        description: 'Show the full URL instead of the file name. Always enabled for GIF hosts because their file names are usually not meaningful.' }
});

export function start(ctx) {
    const changed = new Map();
    const selector = '[data-role="img"][data-safe-src]';
    const update = image => {
        const previous = changed.get(image);
        const original = image.getAttribute('title') === previous?.applied ? previous.original : image.getAttribute('title');
        const source = image.getAttribute('href') || image.closest('a[href]')?.href || image.getAttribute('data-safe-src');
        let title;
        try {
            const url = new URL(source);
            const gifHost = /^(.+?\.)?(tenor|giphy|imgur)\.com$/i.test(url.hostname);
            if (gifHost || /\.(png|jpg|jpeg|gif|webp|avif)$/i.test(url.pathname))
                title = gifHost || settings.store.showFullUrl ? source : url.pathname.split('/').pop();
        } catch {}
        if (!title) {
            if (previous && image.getAttribute('title') === previous.applied) {
                if (original === null) image.removeAttribute('title'); else image.setAttribute('title', original);
            }
            changed.delete(image);
            return;
        }
        changed.set(image, { original, applied: title });
        if (image.getAttribute('title') !== title) image.setAttribute('title', title);
    };
    const scan = node => {
        if (!(node instanceof Element)) return;
        if (node.matches(selector)) update(node);
        for (const image of node.querySelectorAll(selector)) update(image);
    };
    const observer = new MutationObserver(changes => {
        for (const change of changes) {
            if (change.type === 'attributes') scan(change.target);
            else for (const node of change.addedNodes) scan(node);
        }
        for (const [image, { original, applied }] of changed) if (!image.isConnected) {
            if (image.getAttribute('title') === applied) {
                if (original === null) image.removeAttribute('title'); else image.setAttribute('title', original);
            }
            changed.delete(image);
        }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true,
        attributeFilter: ['href', 'data-safe-src', 'title'] });
    scan(document.documentElement);
    ctx.cleanup(settings.subscribe(() => scan(document.documentElement)));
    ctx.cleanup(() => {
        observer.disconnect();
        for (const [image, { original, applied }] of changed) if (image.getAttribute('title') === applied) {
            if (original === null) image.removeAttribute('title'); else image.setAttribute('title', original);
        }
        changed.clear();
    });
}
