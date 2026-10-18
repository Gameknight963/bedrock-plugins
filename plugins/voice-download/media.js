/* Adapted from Vencord/Equicord; modified for Bedrock on 2026-10-17.
 * Copyright (c) 2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * See NOTICE for source and authorship. */
export function watchMedia(ctx, selector, create) {
    const records = new Map();
    const attach = media => {
        if (records.has(media) || !media.closest('[id^="chat-messages-"], [data-list-item-id^="chat-messages___"]')) return;
        records.set(media, create(media));
    };
    const scan = node => {
        if (!(node instanceof Element)) return;
        if (node.matches(selector)) attach(node);
        for (const media of node.querySelectorAll(selector)) attach(media);
    };
    const observer = new MutationObserver(changes => {
        for (const change of changes) for (const node of change.addedNodes) scan(node);
        for (const [media, dispose] of records) if (!media.isConnected) { dispose(); records.delete(media); }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    ctx.cleanup(() => { observer.disconnect(); for (const dispose of records.values()) dispose(); records.clear(); });
    scan(document.documentElement);
    ctx.styles.add(`
        .bedrock-media-tools { display:flex; align-items:center; justify-content:flex-end; gap:6px; padding:3px 0; }
        .bedrock-media-tools :is(button,select,a) { box-sizing:border-box; min-height:22px; padding:2px 6px;
            border:1px solid var(--border-subtle, #ffffff20); border-radius:4px; font:inherit; font-size:12px;
            background:var(--background-modifier-accent, #ffffff10); color:var(--text-normal, #ddd); cursor:pointer; text-decoration:none; }
        .bedrock-media-tools :is(button,select,a):focus-visible { outline:2px solid var(--brand-500, #5865f2); }
    `);
}

export function addControl(media, control) {
    const container = media.closest('[class*="wrapperAudio_"], [class*="videoWrapper_"], [class*="audioWrapper_"]') || media.parentElement;
    let tools = container.querySelector(':scope > .bedrock-media-tools');
    if (!tools) { tools = document.createElement('div'); tools.className = 'bedrock-media-tools'; container.append(tools); }
    tools.append(control);
    return () => { control.remove(); if (!tools.children.length) tools.remove(); };
}
