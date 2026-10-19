/* Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
let context: RendererContext | undefined;
export const patches: SourcePatch[] = [{ id: 'guild-owner-crown', find: '.pclUFJ}),children:', replacement: {
    match: new RegExp(String.raw`(?<=decorators:.{0,200}?isOwner:)\i`.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)')),
    replace: '$self.isGuildOwner(arguments[0])'
} }];
export function isGuildOwner(props: any): boolean {
    if (!context || context.signal.aborted || !props?.user?.id || props.channel?.type === 3) return props?.isOwner ?? false;
    const guildId = props.guildId ?? props.channel?.guild_id;
    const guilds = context.webpack.find<any>(value => value?.getName?.() === 'GuildStore');
    const guild = guilds?.getGuild(guildId);
    return guild ? guild.ownerId === props.user.id : props.isOwner;
}
export function start(ctx: RendererContext): void { context = ctx; }
export function stop(): void { context = undefined; }
