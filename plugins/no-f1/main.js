/* Adapted from Vencord/Equicord; modified for Bedrock on 2026-10-17.
 * Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * See NOTICE for source and authorship. */
export function start(ctx) {
    const attached = new Set();
    const attach = window => {
        const contents = window.webContents;
        if (contents.isDestroyed() || attached.has(contents)) return;
        attached.add(contents);
        const input = (event, key) => {
            if (key.type === 'keyDown' && key.key === 'F1' && !key.control && !key.shift && !key.alt && !key.meta)
                event.preventDefault();
        };
        contents.on('before-input-event', input);
        ctx.cleanup(() => contents.removeListener('before-input-event', input));
    };
    for (const window of ctx.windows.all()) attach(window);
    ctx.windows.onCreated(attach);
}
