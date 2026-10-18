/* Adapted from Vencord/Equicord; modified for Bedrock on 2026-10-17.
 * Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * See NOTICE for source and authorship. */
import { watchMedia, addControl } from './media.js';
const { definePluginSettings, OptionType } = Bedrock;
export const settings = definePluginSettings({
    loop: { type: OptionType.BOOLEAN, label: 'Loop video', default: true }
});
let finish;

export function start(ctx) {
    if (!document.pictureInPictureEnabled) throw new Error('Picture in picture is not available in this window.');
    const owned = new Set();
    const pending = new Set();
    const refresh = new Set();
    watchMedia(ctx, 'video', video => {
        const button = document.createElement('button');
        button.type = 'button'; button.textContent = 'Picture in picture';
        button.setAttribute('aria-label', 'Picture in picture');
        let originalLoop;
        let appliedLoop;
        const updateLoop = () => {
            if (document.pictureInPictureElement !== video) return;
            if (originalLoop === undefined) originalLoop = video.loop;
            video.loop = appliedLoop = settings.store.loop;
        };
        const restoreLoop = () => {
            if (originalLoop !== undefined && video.loop === appliedLoop) video.loop = originalLoop;
            originalLoop = undefined; owned.delete(video); button.setAttribute('aria-pressed', 'false');
        };
        const entered = () => { owned.add(video); updateLoop(); button.setAttribute('aria-pressed', 'true'); };
        const clicked = event => {
            event.stopPropagation();
            const work = (async () => {
                if (document.pictureInPictureElement === video) await document.exitPictureInPicture();
                else {
                    await video.requestPictureInPicture();
                    if (ctx.signal.aborted && document.pictureInPictureElement === video) await document.exitPictureInPicture();
                }
            })().catch(error => { if (!ctx.signal.aborted) ctx.log.warn('Could not open picture in picture. Start the video first.', error); })
                .finally(() => pending.delete(work));
            pending.add(work);
        };
        button.addEventListener('click', clicked);
        video.addEventListener('enterpictureinpicture', entered); video.addEventListener('leavepictureinpicture', restoreLoop);
        const remove = addControl(video, button);
        refresh.add(updateLoop);
        return () => {
            refresh.delete(updateLoop); button.removeEventListener('click', clicked);
            video.removeEventListener('enterpictureinpicture', entered); video.removeEventListener('leavepictureinpicture', restoreLoop);
            if (originalLoop !== undefined && video.loop === appliedLoop) video.loop = originalLoop;
            remove();
        };
    });
    ctx.cleanup(settings.subscribe(() => { for (const update of refresh) update(); }));
    finish = async () => {
        await Promise.allSettled([...pending]);
        if (owned.has(document.pictureInPictureElement)) await document.exitPictureInPicture();
        owned.clear();
    };
}

export async function stop() {
    const cleanup = finish;
    finish = undefined;
    await cleanup?.();
}
