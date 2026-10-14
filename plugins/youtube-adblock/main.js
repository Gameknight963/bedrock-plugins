/*
 * Adapted from Vencord's YoutubeAdblock by Vendicated and contributors (2023).
 * Modified for Bedrock on 2026-10-12.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const { webContents } = Bedrock.require('electron');
const fs = Bedrock.require('node:fs');
const { fileURLToPath } = Bedrock.require('node:url');
const script = fs.readFileSync(fileURLToPath(new URL('./adguard.js', import.meta.url)), 'utf8');
let running;

export function start(ctx) {
    const state = { active: true, contents: new Map(), frames: new Set(), frameListeners: new Map(), injected: new Set(), pending: new Set() };
    running = state;
    const inject = frame => {
        if (!state.active || ctx.signal.aborted || frame.isDestroyed()) return;
        let url;
        try { url = new URL(frame.url); } catch { return; }
        if (url.protocol !== 'https:' || !['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(url.hostname) ||
            !url.pathname.startsWith('/embed/')) return;
        state.injected.add(frame);
        const work = frame.executeJavaScript(script).catch(error => {
            if (state.active && !frame.isDestroyed()) ctx.log.warn('Could not block ads in a YouTube embed.', error);
        }).finally(() => state.pending.delete(work));
        state.pending.add(work);
    };
    const watchFrame = frame => {
        if (!frame || frame.isDestroyed() || state.frames.has(frame)) return;
        state.frames.add(frame);
        const ready = () => {
            inject(frame);
            if (!frame.isDestroyed() && frame.parent) inject(frame.parent);
        };
        frame.on('dom-ready', ready);
        state.frameListeners.set(frame, ready);
        inject(frame);
    };
    const attach = contents => {
        if (contents.isDestroyed() || state.contents.has(contents)) return;
        const created = (_event, details) => watchFrame(details.frame);
        contents.on('frame-created', created);
        state.contents.set(contents, () => contents.removeListener('frame-created', created));
        for (const frame of contents.mainFrame.framesInSubtree) watchFrame(frame);
    };
    for (const contents of webContents.getAllWebContents()) attach(contents);
    const { app } = Bedrock.require('electron');
    const created = (_event, contents) => attach(contents);
    app.on('web-contents-created', created);
    state.unsubscribe = () => app.removeListener('web-contents-created', created);
}

export async function stop() {
    const state = running;
    if (!state) return;
    running = undefined;
    state.active = false;
    state.unsubscribe();
    for (const detach of state.contents.values()) detach();
    for (const [frame, ready] of state.frameListeners) frame.removeListener('dom-ready', ready);
    await Promise.allSettled([...state.pending]);
    await Promise.allSettled([...state.injected].filter(frame => !frame.isDestroyed()).map(frame =>
        frame.executeJavaScript('globalThis.bedrockYoutubeAdblock?.dispose(); undefined')));
}
