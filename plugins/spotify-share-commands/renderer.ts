/* Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-18. See NOTICE. */
import type { RendererContext } from '@bedrock/renderer';

interface Track { id: string | null; album: { id: string }; artists: { external_urls: { spotify: string } }[] }
interface MessageActions {
    sendMessage(channel: string, message: object, wait: boolean, options: object): Promise<unknown>;
    getSendMessageOptionsForReply(reply: unknown): object;
}

export function start(ctx: RendererContext): void {
    const formats = {
        track: (track: Track) => `https://open.spotify.com/track/${track.id}`,
        album: (track: Track) => `https://open.spotify.com/album/${track.album.id}`,
        artist: (track: Track) => track.artists[0]?.external_urls.spotify
    };
    for (const [name, format] of Object.entries(formats)) ctx.commands.register({
        name, description: `Share your current Spotify ${name} in chat`,
        options: [{ name: 'message', description: 'Message to send with the link', type: 'string' }],
        async execute(values, command) {
            const spotify = ctx.webpack.find<{ getTrack(): Track | null }>(value => typeof value?.getTrack === 'function' &&
                (typeof value?.getActiveSocketAndDevice === 'function' || value?.constructor?.displayName === 'SpotifyStore'));
            const track = spotify?.getTrack();
            if (!track) { ctx.notifications.show({ title: "You're not listening to any music." }); return; }
            if (track.id == null) { ctx.notifications.show({ title: 'Failed to find the track on Spotify.' }); return; }
            const url = format(track);
            if (!url) throw new Error(`Spotify did not supply this track's ${name} link.`);
            if (!command.channelId) throw new Error('No channel was selected.');
            const actions = await ctx.webpack.waitFor<MessageActions>(value => typeof value?.sendMessage === 'function' && typeof value?.getSendMessageOptionsForReply === 'function');
            if (ctx.signal.aborted) return;
            const pending = ctx.webpack.find<{ getPendingReply(channel: string): unknown }>(value => typeof value?.getPendingReply === 'function');
            const reply = pending?.getPendingReply(command.channelId);
            const content = values.message ? `${values.message} ${url}` : url;
            await actions.sendMessage(command.channelId, { content, invalidEmojis: [], validNonShortcutEmojis: [], tts: false }, false,
                actions.getSendMessageOptionsForReply(reply));
            if (!ctx.signal.aborted && reply) {
                const dispatcher = ctx.webpack.find<{ dispatch(event: object): void }>(value => typeof value?.dispatch === 'function' && typeof value?.subscribe === 'function');
                if (pending?.getPendingReply(command.channelId) === reply) dispatcher?.dispatch({ type: 'DELETE_PENDING_REPLY', channelId: command.channelId });
            }
        }
    });
}
