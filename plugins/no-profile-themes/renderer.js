/* Adapted from Vencord/Equicord; modified for Bedrock on 2026-10-18.
 * Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * See NOTICE for source and authorship. */
export async function start(ctx) {
    ctx.reportStatus('Waiting for Discord profile models');
    const [Profile, users] = await Promise.all([
        ctx.webpack.waitFor(value => typeof value === 'function' &&
            typeof Object.getOwnPropertyDescriptor(value.prototype || {}, 'canUsePremiumProfileCustomization')?.get === 'function'),
        ctx.webpack.waitFor(value => typeof value?.getCurrentUser === 'function' && typeof value?.getUser === 'function')
    ]);
    if (ctx.signal.aborted) return;
    const original = Object.getOwnPropertyDescriptor(Profile.prototype, 'canUsePremiumProfileCustomization');
    if (!original.configurable) throw new Error('Discord profile customization getter cannot be patched.');
    const get = function () {
        return this.userId === users.getCurrentUser()?.id && original.get.call(this);
    };
    Object.defineProperty(Profile.prototype, 'canUsePremiumProfileCustomization', { ...original, get });
    ctx.cleanup(() => {
        if (Object.getOwnPropertyDescriptor(Profile.prototype, 'canUsePremiumProfileCustomization')?.get === get)
            Object.defineProperty(Profile.prototype, 'canUsePremiumProfileCustomization', original);
    });
}
