/* Adapted from Vencord/Equicord; modified for Bedrock on 2026-10-18.
 * Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * See NOTICE for source and authorship. */
export function start(ctx) {
    const changed = new Map();
    const update = image => {
        const previous = changed.get(image);
        if (image.alt !== 'GIF' && image.alt !== previous?.applied) { changed.delete(image); return; }
        let name;
        try {
            const source = image.closest('[data-safe-src]')?.getAttribute('data-safe-src') || image.currentSrc || image.src;
            name = decodeURI(new URL(source, location.href).pathname.split('/').pop());
        } catch { return; }
        name = name.replace(/\d/g, '').replace(/\.gif$/i, '').split(/[,\-_ ]+/).filter(Boolean).slice(0, 20).join(' ');
        if (name.length > 300) name = name.slice(0, 300) + '...';
        const applied = name ? `GIF - ${name}` : 'GIF';
        if (applied === 'GIF') {
            if (previous && image.alt === previous.applied) image.alt = 'GIF';
            changed.delete(image);
            return;
        }
        changed.set(image, { applied });
        if (image.alt !== applied) image.alt = applied;
    };
    const scan = node => {
        if (!(node instanceof Element)) return;
        if (node.matches('img')) update(node);
        for (const image of node.querySelectorAll('img')) update(image);
    };
    const observer = new MutationObserver(changes => {
        for (const change of changes) {
            if (change.type === 'attributes') scan(change.target);
            else for (const node of change.addedNodes) scan(node);
        }
        for (const [image, { applied }] of changed) if (!image.isConnected) {
            if (image.alt === applied) image.alt = 'GIF';
            changed.delete(image);
        }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true,
        attributeFilter: ['src', 'srcset', 'alt', 'data-safe-src'] });
    scan(document.documentElement);
    ctx.cleanup(() => {
        observer.disconnect();
        for (const [image, { applied }] of changed) if (image.alt === applied) image.alt = 'GIF';
        changed.clear();
    });
}
