/* Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { MenuChild, MenuElement, RendererContext, SourcePatch } from '@bedrock/renderer';

interface User { id: string; avatarDecorationData?: unknown; avatarDecoration?: unknown }
interface Guild { id: string; icon?: string | null; banner?: string | null }
interface Channel { id: string }
interface IconUtils {
    getUserAvatarURL(user: User, animate: boolean): string;
    getGuildMemberAvatarURLSimple(options: { userId: string; avatar: string; guildId: string; canAnimate: boolean }): string;
    getAvatarDecorationURL(options: { avatarDecoration: unknown; size: number; canAnimate: boolean }): string | undefined;
    getGuildIconURL(options: { id: string; icon: string; canAnimate: boolean }): string | undefined;
    getGuildBannerURL(guild: Guild, animate: boolean): string | undefined;
    getChannelIconURL(channel: Channel): string | undefined;
}
let context: RendererContext;
export const settings = Bedrock.definePluginSettings({
    format: { type: Bedrock.OptionType.SELECT, label: 'Image format', description: 'Format for still images. Animated images use WebP.', default: 'webp',
        options: ['webp', 'png', 'jpg'].map(value => ({ label: value, value })) },
    imgSize: { type: Bedrock.OptionType.SELECT, label: 'Image size', description: 'Resolution used by the image preview.', default: '1024',
        options: ['128', '256', '512', '1024', '2048', '4096'].map(value => ({ label: value, value })) }
});

const identifier = '[A-Za-z_$][\\w$]*';
const re = (source: string) => new RegExp(source.replaceAll('\\i', identifier));
export const patches: SourcePatch[] = [
    { id: 'profile-avatar-click', find: 'return{avatarProps:{', replacement: {
        match: re(String.raw`(?<=onClick:.{0,30}?)null!=(\i)(?=.{0,200}children:.{0,50}...(\i),imageClassName:)`),
        replace: 'null!=($1&&=$self.openAvatar.bind(undefined,$2.src))'
    } },
    { id: 'profile-banner-click', find: '"--custom-cutout-radius":', replacement: {
        match: re(String.raw`style:{(?=\.\.\.\i,backgroundImage:null!=(\i).{0,20}?\?\x60url\(\$\{\1\}\)\x60)`),
        replace: (_match: string, source: string) => `onClick:vcEvent=>${source}!=null&&$self.openBanner(${source},vcEvent),style:{cursor:${source}!=null?"pointer":void 0,`
    } },
    { id: 'group-dm-icon-click', find: '["aria-hidden"],"aria-label":', replacement: {
        match: re(String.raw`null==\i\.icon\?.+?src:(\(0,\i\.\i\).+?\))(?=[,}])`),
        replace: (match: string, source: string) => `${match},onClick:vcEvent=>arguments[0]?.size!=="SIZE_40"&&$self.openAvatar(${source},vcEvent)`
    } },
    { id: 'dm-header-avatar-click', find: '.channel.getRecipientId(),', replacement: {
        match: re(String.raw`(?=,src:(\i.getAvatarURL\(.+?[)]))`),
        replace: (_match: string, source: string) => `,onClick:vcEvent=>$self.openAvatar(${source},vcEvent)`
    } },
    { id: 'dm-empty-avatar-click', find: '.EMPTY_GROUP_DM)', replacement: {
        match: /(?<=SIZE_80,)(?=src:(.+?\))[,}])/,
        replace: (_match: string, source: string) => `onClick:vcEvent=>$self.openAvatar(${source},vcEvent),`
    } }
];

function icons(): IconUtils {
    const value = context.webpack.find<IconUtils>(value => typeof value?.getUserAvatarURL === 'function' && typeof value?.getGuildIconURL === 'function');
    if (!value) throw new Error("Discord's avatar and icon helpers are unavailable.");
    return value;
}

export function imageSources(source: string): { url: string; original: string } {
    let url: URL;
    try { url = new URL(source, location.href); }
    catch (cause) { throw new Error(`Invalid image URL: ${JSON.stringify(source)}. ${cause instanceof Error ? cause.message : String(cause)}`, { cause }); }
    const format = source.startsWith('/') ? 'png' : url.searchParams.get('animated') === 'true' ? 'webp' : settings.store.format;
    url.searchParams.set('size', settings.store.imgSize);
    url.pathname = url.pathname.replace(/\.(png|jpe?g|webp)$/, `.${format}`);
    const preview = url.href;
    url.searchParams.set('size', '4096');
    return { url: preview, original: url.href };
}

async function openImage(source: string | undefined, width: number, height?: number): Promise<void> {
    const ctx = context;
    if (!ctx || ctx.signal.aborted || !source) return;
    try {
        const item = { type: 'IMAGE', ...imageSources(source), width, height };
        const predicate = (value: any) => typeof value === 'function' && String(value).includes('hasMediaOptions') && String(value).includes('shouldHideMediaOptions');
        if (!ctx.webpack.find(predicate)) await ctx.webpack.loadChunks({ find: ['hasMediaOptions', 'shouldHideMediaOptions'] });
        if (ctx.signal.aborted) return;
        const open = ctx.webpack.find<(props: { items: object[] }) => void>(predicate);
        if (!open) throw new Error("Discord's image viewer is unavailable.");
        open({ items: [item] });
    } catch (error) {
        if (ctx.signal.aborted) return;
        ctx.log.error(error);
        ctx.notifications.show({ title: 'Could not open this image', body: error instanceof Error ? error.message : String(error), type: 'error' });
    }
}

export function openAvatar(source: string | undefined, event?: { stopPropagation(): void }): void {
    event?.stopPropagation();
    void openImage(source, 512, 512);
}
export function openBanner(source: string | undefined, event?: { stopPropagation(): void }): void {
    event?.stopPropagation();
    void openImage(source, 1024);
}

function ImageIcon(): MenuElement {
    return context.react.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true },
        context.react.createElement('path', { d: 'M21,19V5c0,-1.1 -0.9,-2 -2,-2H5c-1.1,0 -2,0.9 -2,2v14c0,1.1 0.9,2 2,2h14c1.1,0 2,-0.9 2,-2zM8.5,13.5l2.5,3.01L14.5,12l4.5,6H5l3.5,-4.5z' }));
}
function item(id: string, label: string, action: () => void): MenuElement {
    return context.contextMenus.item({ id, label, leadingAccessory: { type: 'icon', icon: ImageIcon }, action });
}
function addGroup(children: MenuChild[], items: MenuElement[]): void {
    if (!items.length) return;
    const menu = context.webpack.find<{ MenuGroup: unknown }>(value => value?.MenuGroup && value?.MenuItem);
    const group = context.react.createElement(menu?.MenuGroup ?? context.react.Fragment, { key: 'bedrock-view-icons' }, ...items);
    children.splice(Math.max(0, children.length - 1), 0, group);
}

export function start(ctx: RendererContext): void {
    context = ctx;
    ctx.contextMenus.patch<{ user?: User; guildId?: string }>('user-context', (children, { user, guildId }) => {
        if (!user) return;
        const utils = icons();
        const memberAvatar = guildId ? ctx.webpack.find<{ getMember(guild: string, user: string): { avatar?: string } | undefined }>(value => value?.getName?.() === 'GuildMemberStore')?.getMember(guildId, user.id)?.avatar : undefined;
        const decoration = user.avatarDecorationData ?? user.avatarDecoration;
        const entries = [item('view-avatar', 'View Avatar', () => openAvatar(utils.getUserAvatarURL(user, true)))];
        if (memberAvatar && guildId) entries.push(item('view-server-avatar', 'View Server Avatar', () => openAvatar(utils.getGuildMemberAvatarURLSimple({ userId: user.id, avatar: memberAvatar, guildId, canAnimate: true }))));
        if (decoration) entries.push(item('view-avatar-decoration', 'View Avatar Decoration', () => openAvatar(utils.getAvatarDecorationURL({ avatarDecoration: decoration, size: 1024, canAnimate: true }))));
        addGroup(children, entries);
    });
    ctx.contextMenus.patch<{ guild?: Guild }>('guild-context', (children, { guild }) => {
        if (!guild || (!guild.icon && !guild.banner)) return;
        const entries: MenuElement[] = [];
        if (guild.icon) entries.push(item('view-icon', 'View Icon', () => openAvatar(icons().getGuildIconURL({ id: guild.id, icon: guild.icon!, canAnimate: true }))));
        if (guild.banner) entries.push(item('view-banner', 'View Banner', () => openBanner(icons().getGuildBannerURL(guild, true))));
        addGroup(children, entries);
    });
    ctx.contextMenus.patch<{ channel?: Channel }>('gdm-context', (children, { channel }) => {
        if (channel) addGroup(children, [item('view-group-channel-icon', 'View Icon', () => openAvatar(icons().getChannelIconURL(channel)))]);
    });
}
