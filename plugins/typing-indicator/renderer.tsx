/* Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
import { React, setContext, getContext, GuildMemberStore, RelationshipStore, SelectedChannelStore, Tooltip, TypingStore, UserGuildSettingsStore, UserStore, UserSummaryItem, useStateFromStores, ThreeDots, getIntlMessage, ErrorBoundary } from './discord.js';
const enum IndicatorMode { Dots = 1, Avatars = 2 }
export const settings = Bedrock.definePluginSettings({
    includeCurrentChannel: { type: Bedrock.OptionType.BOOLEAN, label: 'Current channel', description: 'Show indicators for the selected channel', default: true },
    includeMutedChannels: { type: Bedrock.OptionType.BOOLEAN, label: 'Muted channels', description: 'Show indicators for muted channels', default: false },
    includeIgnoredUsers: { type: Bedrock.OptionType.BOOLEAN, label: 'Ignored users', description: 'Include ignored users in indicators', default: false },
    includeBlockedUsers: { type: Bedrock.OptionType.BOOLEAN, label: 'Blocked users', description: 'Include blocked users in indicators', default: false },
    indicatorMode: { type: Bedrock.OptionType.SELECT, label: 'Indicator style', description: 'Choose avatars, animated dots or both', default: 3, options: [
        { label: 'Avatars and animated dots', value: 3 }, { label: 'Animated dots', value: 1 }, { label: 'Avatars', value: 2 }
    ] }
});
function getDisplayName(guildId: string, userId: string) {
    const user = UserStore.getUser(userId);
    return GuildMemberStore.getNick(guildId, userId) ?? user?.globalName ?? user?.username ?? userId;
}

function TypingIndicatorView({ channelId, guildId }: { channelId: string; guildId: string; }) {
    const options = settings.use(['includeCurrentChannel', 'includeMutedChannels', 'includeIgnoredUsers', 'includeBlockedUsers', 'indicatorMode']);
    const typingUsers: Record<string, number> = useStateFromStores(
        [TypingStore, RelationshipStore, UserGuildSettingsStore, UserStore, GuildMemberStore],
        () => ({ ...TypingStore.getTypingUsers(channelId) }),
        null,
        (old: Record<string, number>, current: Record<string, number>) => {
            const oldKeys = Object.keys(old);
            const currentKeys = Object.keys(current);

            return oldKeys.length === currentKeys.length && currentKeys.every(key => old[key] != null);
        }
    );
    const currentChannelId = useStateFromStores([SelectedChannelStore], () => SelectedChannelStore.getChannelId());

    if (!options.includeMutedChannels) {
        const isChannelMuted = UserGuildSettingsStore.isChannelMuted(guildId, channelId);
        if (isChannelMuted) return null;
    }

    if (!options.includeCurrentChannel) {
        if (currentChannelId === channelId) return null;
    }

    const myId = UserStore.getCurrentUser()?.id;

    const typingUsersArray = Object.keys(typingUsers).filter(id =>
        id !== myId && !(RelationshipStore.isBlocked(id) && !options.includeBlockedUsers) && !(RelationshipStore.isIgnored(id) && !options.includeIgnoredUsers)
    );
    const [a, b, c] = typingUsersArray;
    let tooltipText: string;

    switch (typingUsersArray.length) {
        case 0: break;
        case 1: {
            tooltipText = getIntlMessage("ONE_USER_TYPING", { a: getDisplayName(guildId, a) });
            break;
        }
        case 2: {
            tooltipText = getIntlMessage("TWO_USERS_TYPING", { a: getDisplayName(guildId, a), b: getDisplayName(guildId, b) });
            break;
        }
        case 3: {
            tooltipText = getIntlMessage("THREE_USERS_TYPING", { a: getDisplayName(guildId, a), b: getDisplayName(guildId, b), c: getDisplayName(guildId, c) });
            break;
        }
        default: {
            tooltipText = getIntlMessage("SEVERAL_USERS_TYPING");
            break;
        }
    }

    if (typingUsersArray.length > 0) {
        return (
            <Tooltip text={tooltipText!}>
                {(props: any) => (
                    <div className="vc-typing-indicator" {...props}>
                        {((options.indicatorMode & IndicatorMode.Avatars) === IndicatorMode.Avatars) && (
                            <div
                                onClick={(e: any) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                }}
                                onKeyPress={(e: any) => e.stopPropagation()}
                            >
                                <UserSummaryItem
                                    users={typingUsersArray.map(id => UserStore.getUser(id))}
                                    guildId={guildId}
                                    renderIcon={false}
                                    max={3}
                                    showDefaultAvatarsForNullUsers
                                    showUserPopout
                                    size={16}
                                    className="vc-typing-indicator-avatars"
                                />
                            </div>
                        )}
                        {((options.indicatorMode & IndicatorMode.Dots) === IndicatorMode.Dots) && (
                            <div className="vc-typing-indicator-dots">
                                <ThreeDots dotRadius={3} themed={true} />
                            </div>
                        )}
                    </div>
                )}
            </Tooltip>
        );
    }

    return null;
}

const definitions = [
    { id: 'channel-typing', find: 'UNREAD_IMPORTANT:', match: /\.Children\.count.+?:null(?<=,channel:(\i).+?)/, replace: '$&,$self.TypingIndicator($1.id,$1.getGuildId())' },
    { id: 'thread-typing', find: 'M0 15H2c0 1.6569', match: /\(\i,\{thread:(\i),countInVoice:.{0,200}?\]\}\)(?=\])/, replace: '$&,$self.TypingIndicator($1.id,$1.getGuildId())' }
];
export const patches: SourcePatch[] = definitions.map(patch => ({ id: patch.id, find: patch.find, replacement: {
    match: new RegExp(patch.match.source.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)'), patch.match.flags), replace: patch.replace
} }));
export function TypingIndicator(channelId: string, guildId: string): any {
    if (!getContext() || getContext().signal.aborted) return null;
    return React.createElement(ErrorBoundary, null, React.createElement(TypingIndicatorView, { channelId, guildId }));
}
export async function start(ctx: RendererContext): Promise<void> {
    setContext(ctx);
    const response = await fetch(new URL('./styles.css', import.meta.url), { signal: ctx.signal });
    if (!response.ok) throw new Error(`Could not load typing indicator styles (HTTP ${response.status}).`);
    const css = await response.text();
    if (!ctx.signal.aborted) ctx.styles.add(css);
}
