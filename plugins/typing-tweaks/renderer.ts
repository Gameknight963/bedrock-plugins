/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { MenuChild, MenuElement, RendererContext, SourcePatch } from '@bedrock/renderer';

interface User { id: string; username: string; globalName?: string; getAvatarURL(guildId?: string, size?: number): string }
interface Channel { id: string; guild_id?: string }
interface Store { addChangeListener?(callback: () => void): void; removeChangeListener?(callback: () => void): void; [key: string]: any }
let context: RendererContext;
export const settings = Bedrock.definePluginSettings({
    showAvatars: { type: Bedrock.OptionType.BOOLEAN, label: 'Show avatars', description: 'Show avatars beside typing users.', default: true },
    showRoleColors: { type: Bedrock.OptionType.BOOLEAN, label: 'Show role colors', description: 'Use server role colors for typing users.', default: true },
    alternativeFormatting: { type: Bedrock.OptionType.BOOLEAN, label: 'Name more typing users', description: 'Show names and a count instead of “Several people are typing”.', default: true },
    amITyping: { type: Bedrock.OptionType.BOOLEAN, label: 'Show my typing status', description: 'Include yourself when other people can see you typing.', default: false, restartNeeded: true }
});
const identifier = '(?:[A-Za-z_$][\\w$]*)';
const re = (source: string) => new RegExp(source.replaceAll('\\i', identifier));
export const patches: SourcePatch[] = [
    { id: 'typing-users-and-formatting', find: 'Q8lUnE', replacement: [
        { match: re(String.raw`(?<="aria-hidden":!0,children:)\i`), replace: '$self.renderTypingUsers({users:arguments[0]?.typingUserObjects,guildId:arguments[0]?.channel?.guild_id,children:$&})' },
        { match: re(String.raw`(?<=function \i\(\i\)\{)(?=[^}]+?\{channel:\i,isThreadCreation:\i=!1,\.\.\.\i\})`), replace: 'let typingUserObjects=$self.useTypingUsers(arguments[0]?.channel);' },
        { match: re(String.raw`typingUsers:(\i)\?\[\]:\i,`), replace: '$&typingUserObjects:$1||typeof typingUserObjects==="undefined"?[]:typingUserObjects,' },
        { match: re(String.raw`(&&\(\i=)(\i\.\i\.format\(\i\.\i\.Q8lUnE,\{\}\))`),
            replace: '$1$self.buildSeveralUsers({users:arguments[0]?.typingUserObjects,guildId:arguments[0]?.channel?.guild_id,fallback:$2})' }
    ] },
    { id: 'include-own-typing-status', find: 'this.handleDismissInviteEducation', replacement: {
        match: /^[\s\S]*$/, replace(source: string) {
            if (!settings.store.amITyping) return source;
            const match = re(String.raw`\i\.default\.getCurrentUser\(\)`);
            if (!match.test(source)) throw new Error("Discord's typing user filter did not match.");
            return source.replace(match, '""');
        }
    } }
];

function store(name: string): Store | undefined { return context.webpack.find<Store>(value => value?.getName?.() === name); }
export function useTypingUsers(channel: Channel | undefined): User[] {
    const { amITyping } = settings.use(['amITyping', 'showAvatars', 'showRoleColors', 'alternativeFormatting']);
    const typing = store('TypingStore'), users = store('UserStore'), auth = store('AuthenticationStore'), relationships = store('RelationshipStore'), members = store('GuildMemberStore');
    const [, refresh] = context.react.useState(0);
    context.react.useEffect(() => {
        const update = () => refresh(value => value + 1);
        const stores = [typing, users, auth, relationships, members].filter((value): value is Store => !!value);
        for (const value of stores) value.addChangeListener?.(update);
        return () => { for (const value of stores) value.removeChangeListener?.(update); };
    }, [typing, users, auth, relationships, members]);
    if (!channel || !typing || !users) return [];
    const self = auth?.getId?.() ?? users.getCurrentUser?.()?.id;
    return Object.keys(typing.getTypingUsers(channel.id)).filter(id => id &&
        !(relationships?.isBlockedOrIgnored?.(id) ?? (relationships?.isBlocked?.(id) || relationships?.isIgnored?.(id))) && (id !== self || amITyping))
        .map(id => users.getUser(id)).filter((user): user is User => !!user);
}

function TypingUser({ user, guildId }: { user: User; guildId?: string }): MenuElement {
    const ctx = context;
    const { showAvatars, showRoleColors } = settings.use(['showAvatars', 'showRoleColors']);
    const members = store('GuildMemberStore'), relationships = store('RelationshipStore');
    const name = (guildId && members?.getNick?.(guildId, user.id)) || (!guildId && relationships?.getNickname?.(user.id)) || user.globalName || user.username;
    function openProfile(): void {
        try {
            const open = ctx.webpack.find<(props: object) => void>(value => typeof value === 'function' && String(value).includes('type:"USER_PROFILE_MODAL_OPEN"'));
            if (!open) throw new Error("Discord's user profile action is unavailable.");
            open({ userId: user.id, guildId, sourceAnalyticsLocations: ['username', 'typing indicator'] });
        } catch (error) { ctx.log.error(error); }
    }
    const avatar = ctx.webpack.find(value => {
        const component = value?.type || value?.render || value;
        return typeof component === 'function' && String(component).includes('.size-1.375*');
    });
    return ctx.react.createElement('strong', { className: 'vc-typing-tweaks-user', role: 'button', tabIndex: 0, onClick: openProfile,
        onKeyDown(event: KeyboardEvent) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openProfile(); } },
        style: { color: showRoleColors && guildId ? members?.getMember?.(guildId, user.id)?.colorString : undefined } },
        showAvatars ? ctx.react.createElement(avatar || 'img', { className: 'vc-typing-tweaks-avatar', size: 'SIZE_16', src: user.getAvatarURL(guildId, 128), alt: '' }) : null, name);
}

function TypingUsers({ users, guildId, children }: { users?: User[]; guildId?: string; children: MenuChild }): MenuChild {
    if (!Array.isArray(users) || !Array.isArray(children)) return children;
    let index = 0;
    return children.map(child => {
        if (child === null || child === false || typeof child === 'string' || typeof child === 'number') return child;
        if (context.react.isValidElement(child) && child.type !== 'strong') return child;
        const user = users[index++];
        return user ? context.react.createElement(TypingUser, { key: user.id, user, guildId }) : child;
    });
}
export function renderTypingUsers(props: { users?: User[]; guildId?: string; children: MenuChild }): MenuElement {
    return context.react.createElement(TypingUsers, props);
}
export function buildSeveralUsers({ users, guildId, fallback, count }: { users?: User[]; guildId?: string; fallback?: MenuChild; count?: number }): MenuChild {
    const remaining = count ?? Math.max(0, (users?.length ?? 0) - 2);
    if (!settings.store.alternativeFormatting || !users || remaining < 1) return fallback ?? null;
    return context.react.createElement(context.react.Fragment, null,
        ...users.slice(0, 2).flatMap(user => [context.react.createElement(TypingUser, { key: user.id, user, guildId }), ', ']),
        `and ${remaining} ${remaining === 1 ? 'other is' : 'others are'} typing...`);
}
export function start(ctx: RendererContext): void {
    context = ctx;
    ctx.styles.add('.vc-typing-tweaks-user{cursor:pointer}.vc-typing-tweaks-user [class*="wrapper"],.vc-typing-tweaks-avatar{display:inline-block;margin-right:.25em;vertical-align:-4px}.vc-typing-tweaks-avatar{width:16px;height:16px;border-radius:50%}');
}
