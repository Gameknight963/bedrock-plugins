/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later */
import type { RendererContext } from '@bedrock/renderer';
interface Invite { code: string; expires_at: string; max_uses: number; uses: number }
interface FriendInvites {
    createFriendInvite(): Promise<Invite>;
    getAllFriendInvites(): Promise<Invite[]>;
    revokeFriendInvites(): Promise<void>;
}
export function formatInvite(invite: Invite, usage: boolean): string {
    if (!invite || typeof invite !== 'object') throw new Error(`Invalid friend invite: ${JSON.stringify(invite)}. Expected an object.`);
    if (typeof invite.code !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(invite.code))
        throw new Error(`Invalid friend invite code: ${JSON.stringify(invite.code)}.`);
    const expires = typeof invite.expires_at === 'string' ? new Date(invite.expires_at).getTime() : NaN;
    if (!Number.isFinite(expires)) throw new Error(`Friend invite ${JSON.stringify(invite.code)} has an invalid expires_at: ${JSON.stringify(invite.expires_at)}.`);
    if (!Number.isSafeInteger(invite.max_uses) || invite.max_uses < 0)
        throw new Error(`Friend invite ${JSON.stringify(invite.code)} has an invalid max_uses: ${JSON.stringify(invite.max_uses)}.`);
    if (usage && (!Number.isSafeInteger(invite.uses) || invite.uses < 0))
        throw new Error(`Friend invite ${JSON.stringify(invite.code)} has an invalid uses: ${JSON.stringify(invite.uses)}.`);
    return `discord.gg/${invite.code} \u00b7 Expires: <t:${Math.round(expires / 1000)}:R> \u00b7 ${usage ? `Times used: \`${invite.uses}/${invite.max_uses}\`` : `Max uses: \`${invite.max_uses}\``}`;
}
export function start(ctx: RendererContext): void {
    for (const [operation, description] of [
        ['create', 'Generate a friend invite link'],
        ['view', 'View all your active friend invite links'],
        ['revoke', 'Revoke all your friend invite links']
    ] as const) ctx.commands.register({
        name: `${operation}-friend-invite${operation === 'create' ? '' : 's'}`, description,
        async execute(_values, command) {
            if (ctx.signal.aborted || command.signal.aborted) return;
            if (!command.channelId) throw new Error('Select a channel to display the command result.');
            const invites = ctx.webpack.find<FriendInvites>(value => typeof value?.createFriendInvite === 'function' && typeof value?.getAllFriendInvites === 'function' && typeof value?.revokeFriendInvites === 'function');
            const create = ctx.webpack.find<(options: object) => Record<string, unknown>>(value => typeof value === 'function' && /username:\s*["']Clyde["']/.test(Function.prototype.toString.call(value)));
            const actions = ctx.webpack.find<{ receiveMessage(channelId: string, message: object): void }>(value => typeof value?.receiveMessage === 'function' && typeof value?.sendMessage === 'function');
            if (!invites) throw new Error("Discord's friend invite API is unavailable.");
            if (!create || !actions) throw new Error("Discord's local message API is unavailable.");
            let content: string;
            try {
                if (operation === 'create') content = formatInvite(await invites.createFriendInvite(), false);
                else if (operation === 'view') {
                    const active = await invites.getAllFriendInvites();
                    if (!Array.isArray(active)) throw new Error(`Invalid friend invite list: ${JSON.stringify(active)}. Expected an array.`);
                    content = active.map(invite => formatInvite(invite, true)).join('\n') || 'You have no active friend invites!';
                } else { await invites.revokeFriendInvites(); content = 'All friend invites have been revoked.'; }
            } catch (error) {
                throw new Error(`Could not ${operation} friend invites: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
            }
            if (ctx.signal.aborted || command.signal.aborted) return;
            actions.receiveMessage(command.channelId, { ...create({ channelId: command.channelId, content: '', embeds: [] }), content });
        }
    });
}
