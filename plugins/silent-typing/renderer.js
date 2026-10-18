/* Adapted from Vencord/Equicord; modified for Bedrock on 2026-10-17.
 * Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * See NOTICE for source and authorship. */
export async function start(ctx) {
    ctx.reportStatus('Waiting for Discord typing actions');
    const actions = await ctx.webpack.waitFor(value => typeof value?.startTyping === 'function' && typeof value?.stopTyping === 'function');
    if (ctx.signal.aborted) return;
    ctx.patches.instead(actions, 'startTyping', () => Promise.resolve());
}
