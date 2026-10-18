/* Adapted from Vencord/Equicord; modified for Bedrock on 2026-10-17.
 * Copyright (c) 2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * See NOTICE for source and authorship. */
import { watchMedia, addControl } from './media.js';

export function start(ctx) {
    watchMedia(ctx, 'audio', media => {
        const link = document.createElement('a');
        link.textContent = 'Download audio';
        link.setAttribute('aria-label', 'Download audio');
        link.target = '_blank'; link.rel = 'noopener noreferrer'; link.download = 'voice-message.ogg';
        const update = () => {
            const source = media.currentSrc || media.src;
            try {
                const url = new URL(source, location.href);
                if (!source || !['https:', 'http:', 'blob:'].includes(url.protocol)) { link.removeAttribute('href'); return; }
                link.href = url.href;
                link.download = decodeURIComponent(url.pathname.split('/').pop()) || 'voice-message.ogg';
            } catch { link.removeAttribute('href'); }
        };
        const click = event => { update(); if (!link.hasAttribute('href')) event.preventDefault(); event.stopPropagation(); };
        link.addEventListener('click', click);
        media.addEventListener('loadedmetadata', update); media.addEventListener('loadstart', update);
        const remove = addControl(media, link);
        update();
        return () => { link.removeEventListener('click', click); media.removeEventListener('loadedmetadata', update); media.removeEventListener('loadstart', update); remove(); };
    });
}
