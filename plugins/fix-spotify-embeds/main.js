/* Adapted from Vencord/Equicord; modified for Bedrock on 2026-10-17.
 * Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * See NOTICE for source and authorship. */
import { installPlayer } from './player.js';
const { app, webContents } = Bedrock.require('electron');
const { definePluginSettings, OptionType } = Bedrock;
let updateVolume = () => {};
let running;
export const settings = definePluginSettings({
    volume: { type: OptionType.SLIDER, label: 'Preview volume', description: 'Volume for Spotify embed previews, as a percentage.',
        default: 10, min: 0, max: 100, step: 1, onChange: () => updateVolume() }
});

export function start(ctx) {
    const state = { active: true, contents: new Map(), frames: new Map(), injected: new Set(), pending: new Set() };
    running = state;
    const inject = frame => {
        if (!state.active || ctx.signal.aborted || frame.isDestroyed()) return;
        let url;
        try { url = new URL(frame.url); } catch { return; }
        if (url.protocol !== 'https:' || url.hostname !== 'open.spotify.com' || !url.pathname.startsWith('/embed/')) return;
        state.injected.add(frame);
        const work = frame.executeJavaScript(`(${installPlayer.toString()})(${settings.store.volume / 100})`).catch(error => {
            if (state.active && !frame.isDestroyed()) ctx.log.warn('Could not adjust a Spotify embed.', error);
        }).finally(() => state.pending.delete(work));
        state.pending.add(work);
    };
    const watchFrame = frame => {
        if (!frame || frame.isDestroyed() || state.frames.has(frame)) return;
        const ready = () => inject(frame);
        state.frames.set(frame, ready);
        frame.on('dom-ready', ready);
        inject(frame);
    };
    const attach = contents => {
        if (contents.isDestroyed() || state.contents.has(contents)) return;
        const created = (_event, details) => watchFrame(details.frame);
        state.contents.set(contents, created);
        contents.on('frame-created', created);
        for (const frame of contents.mainFrame.framesInSubtree) watchFrame(frame);
    };
    const created = (_event, contents) => attach(contents);
    app.on('web-contents-created', created);
    state.detach = () => app.removeListener('web-contents-created', created);
    for (const contents of webContents.getAllWebContents()) attach(contents);
    updateVolume = () => { for (const frame of state.frames.keys()) inject(frame); };
}

export async function stop() {
    const state = running;
    if (!state) return;
    running = undefined; updateVolume = () => {}; state.active = false;
    state.detach();
    for (const [contents, listener] of state.contents) contents.removeListener('frame-created', listener);
    for (const [frame, listener] of state.frames) frame.removeListener('dom-ready', listener);
    await Promise.allSettled([...state.pending]);
    await Promise.allSettled([...state.injected].filter(frame => !frame.isDestroyed()).map(frame =>
        frame.executeJavaScript('globalThis.bedrockSpotifyVolume?.dispose(); undefined')));
}
