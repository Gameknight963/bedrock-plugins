/* Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-18. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';

export const settings = Bedrock.definePluginSettings({
    userList: { type: Bedrock.OptionType.STRING, label: 'User List', description: 'User IDs separated by commas or spaces.', default: '', multiline: true },
    roleList: { type: Bedrock.OptionType.STRING, label: 'Role List', description: 'Role IDs separated by commas or spaces.', default: '', multiline: true },
    shouldPingListed: { type: Bedrock.OptionType.SELECT, label: 'Behavior', description: 'How to use the user and role lists.', default: true,
        options: [{ label: 'Do not ping the listed users / roles', value: false }, { label: 'Only ping the listed users / roles', value: true }] },
    inverseShiftReply: { type: Bedrock.OptionType.BOOLEAN, label: 'Invert Shift Reply', description: "Invert Discord's Shift-reply behavior so Shift-reply mentions the user.", default: false }
});
const identifier = '[A-Za-z_$][\\w$]*';
export const patches: SourcePatch[] = [{ id: 'default-reply-mention', find: ',"Message")}function', replacement: {
    match: new RegExp(String.raw`:(\i),shouldMention:!(\i)\.shiftKey`.replaceAll('\\i', identifier)),
    replace: ':$1,shouldMention:$self.shouldMention($1,$2.shiftKey)'
} }];
let context: RendererContext;
export function start(ctx: RendererContext): void { context = ctx; }

export function shouldMention(message: { author: { id: string }; channel_id: string }, shift: boolean): boolean {
    const users = new Set(settings.store.userList.split(/[,\s]+/));
    const roles = new Set(settings.store.roleList.split(/[,\s]+/));
    let listed = users.has(message.author.id);
    const channels = context.webpack.find<{ getChannel(id: string): { guild_id?: string } | undefined }>(value => typeof value?.getChannel === 'function' && typeof value?.getDMFromUserId === 'function');
    const guild = channels?.getChannel(message.channel_id)?.guild_id;
    if (guild && !listed) {
        const members = context.webpack.find<{ getMember(guild: string, user: string): { roles?: string[] } | undefined }>(value => typeof value?.getMember === 'function' && typeof value?.getMembers === 'function');
        listed = members?.getMember(guild, message.author.id)?.roles?.some(role => roles.has(role)) ?? false;
    }
    const exempt = settings.store.shouldPingListed ? listed : !listed;
    return settings.store.inverseShiftReply ? shift !== exempt : !shift && exempt;
}
