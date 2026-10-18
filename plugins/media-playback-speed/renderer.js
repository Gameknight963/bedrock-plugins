/* Adapted from Vencord/Equicord; modified for Bedrock on 2026-10-17.
 * Copyright (c) 2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * See NOTICE for source and authorship. */
import { watchMedia, addControl } from './media.js';
const { definePluginSettings, OptionType } = Bedrock;
export const settings = definePluginSettings({
    voice: { type: OptionType.SLIDER, label: 'Voice message speed', default: 1, min: 0.25, max: 3.5, step: 0.25 },
    audio: { type: OptionType.SLIDER, label: 'Audio speed', default: 1, min: 0.25, max: 3.5, step: 0.25 },
    video: { type: OptionType.SLIDER, label: 'Video speed', default: 1, min: 0.25, max: 3.5, step: 0.25 }
});

export function start(ctx) {
    const refresh = new Set();
    watchMedia(ctx, 'audio,video', media => {
        const kind = media.tagName === 'VIDEO' ? 'video' : media.className.includes('audioElement') ? 'voice' : 'audio';
        const original = media.playbackRate;
        let selected = settings.store[kind];
        let applied;
        const select = document.createElement('select');
        select.setAttribute('aria-label', 'Playback speed');
        select.title = 'Playback speed';
        for (let speed = 0.25; speed <= 3.5; speed += 0.25) {
            const option = document.createElement('option'); option.value = String(speed); option.textContent = `${speed}x`; select.append(option);
        }
        const apply = () => { media.playbackRate = selected; applied = selected; select.value = String(selected); };
        const change = () => { selected = Number(select.value); apply(); };
        const update = () => { selected = settings.store[kind]; apply(); };
        const rateChanged = () => { select.value = String(media.playbackRate); };
        select.addEventListener('change', change);
        media.addEventListener('play', apply);
        media.addEventListener('loadedmetadata', apply);
        media.addEventListener('ratechange', rateChanged);
        const remove = addControl(media, select);
        refresh.add(update);
        apply();
        return () => {
            refresh.delete(update);
            select.removeEventListener('change', change);
            media.removeEventListener('play', apply); media.removeEventListener('loadedmetadata', apply); media.removeEventListener('ratechange', rateChanged);
            remove();
            if (media.playbackRate === applied) media.playbackRate = original;
        };
    });
    ctx.cleanup(settings.subscribe(() => { for (const update of refresh) update(); }));
}
