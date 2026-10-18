/* Adapted from Vencord/Equicord; modified for Bedrock on 2026-10-17.
 * Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * See NOTICE for source and authorship. */
export function start(ctx) {
    const keydown = event => {
        if (event.code === 'F8' && !event.repeat) debugger;
    };
    window.addEventListener('keydown', keydown);
    ctx.cleanup(() => window.removeEventListener('keydown', keydown));
}
