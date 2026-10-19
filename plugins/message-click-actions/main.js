/* SPDX-License-Identifier: GPL-3.0-or-later */
export function validateMessageURL(value) {
    if (typeof value !== 'string') throw new TypeError(`Message URL must be a string; received ${typeof value}.`);
    let url;
    try { url = new URL(value); }
    catch { throw new Error(`Message URL is invalid: ${JSON.stringify(value)}.`); }
    if (url.protocol !== 'https:') throw new Error(`Message URL protocol must be "https:"; received ${JSON.stringify(url.protocol)}.`);
    if (!['discord.com', 'canary.discord.com', 'ptb.discord.com'].includes(url.hostname))
        throw new Error(`Message URL host must be discord.com, canary.discord.com or ptb.discord.com; received ${JSON.stringify(url.hostname)}.`);
    if (url.port) throw new Error(`Message URL must not contain a port; received ${JSON.stringify(url.port)}.`);
    if (url.username || url.password) throw new Error('Message URL must not contain username or password fields.');
    if (!/^\/channels\/(?:@me|\d+)\/\d+\/\d+$/.test(url.pathname))
        throw new Error(`Message URL path must be /channels/<server or @me>/<channel ID>/<message ID>; received ${JSON.stringify(url.pathname)}.`);
    if (url.search || url.hash) throw new Error(`Message URL must not contain query parameters or a fragment; received ${JSON.stringify(url.search + url.hash)}.`);
    return url.href;
}
export function start(ctx) {
    const { shell } = Bedrock.require('electron');
    ctx.events.on('message-click-actions.open-external', async event => {
        if (event.id !== ctx.id || ctx.signal.aborted) return;
        try { await shell.openExternal(validateMessageURL(event.value)); }
        catch (error) { ctx.log.error('Could not open the message in your browser.', error); }
    });
}
