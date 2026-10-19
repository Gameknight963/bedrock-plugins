/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-18. See NOTICE. */
import type { RendererContext } from '@bedrock/renderer';

export async function start(ctx: RendererContext): Promise<void> {
    const moment = await ctx.webpack.waitFor<{ relativeTimeRounding(): (value: number) => number; relativeTimeRounding(round: (value: number) => number): boolean }>(
        value => typeof value?.relativeTimeRounding === 'function');
    if (ctx.signal.aborted) return;
    const previous = moment.relativeTimeRounding();
    moment.relativeTimeRounding(Math.floor);
    ctx.cleanup(() => { if (moment.relativeTimeRounding() === Math.floor) moment.relativeTimeRounding(previous); });
}
