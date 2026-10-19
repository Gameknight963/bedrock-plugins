/* Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { MenuElement, RendererContext, SourcePatch } from '@bedrock/renderer';

interface Emoji { name: string; id?: string }
interface Message { id: string; channel_id: string; reactions: unknown[] }
interface User { id: string; [key: string]: unknown }
interface CacheEntry { fetched: boolean; users: Map<string, unknown> }
interface ReactionProps { message: Message; emoji: Emoji; type: number }
interface Dispatcher { subscribe(event: string, callback: (event: any) => void): void; unsubscribe(event: string, callback: (event: any) => void): void; dispatch(event: Record<string, unknown>): void }
let context: RendererContext;
let reactions: Record<string, CacheEntry> = {};
let scroll: { scrollCounter: number; setAutomaticAnchor(value: null): void } | undefined;
let pending = Promise.resolve();
let Boundary: unknown;
export const settings = Bedrock.definePluginSettings({
    clickableAvatars: { type: Bedrock.OptionType.BOOLEAN, label: 'Clickable Avatars', description: "Clicking a reacting user's avatar opens their profile instead of adding the reaction.", default: true }
});
const identifier = '(?:[A-Za-z_$][\\w$]*)';
export const patches: SourcePatch[] = [
    { id: 'reaction-avatars', find: ',reactionRef:', replacement: {
        match: new RegExp(String.raw`(\i)\?null:\(0,\i\.jsx\)\(\i\.\i,{className:\i\.reactionCount,.*?}\),(?<=(emoji:\i,message:\i,type:\i).+?)`.replaceAll('\\i', identifier)),
        replace: '$&$1?null:$self.renderUsers({$2}),'
    } },
    { id: 'reaction-cache', find: '"MessageReactionsStore"', replacement: {
        match: new RegExp(String.raw`CONNECTION_OPEN:function\(\)\{(\i)=\{\}`.replaceAll('\\i', identifier)), replace: '$&;$self.setReactions($1);'
    } },
    { id: 'scroll-anchor', find: 'cleanAutomaticAnchor(){', replacement: {
        match: new RegExp(String.raw`constructor\(\i\)\{(?=.{0,100}(?:automaticAnchor|\.messages\.loadingMore))`.replaceAll('\\i', identifier)), replace: '$&$self.setScrollObj(this);'
    } }
];
function find<T>(predicate: (value: any) => boolean, name: string): T {
    const value = context.webpack.find<T>(predicate);
    if (!value) throw new Error(`Discord's ${name} is not available.`);
    return value;
}
function dispatcher(): Dispatcher { return find(value => typeof value?.dispatch === 'function' && typeof value?.subscribe === 'function', 'dispatcher'); }
function keyFor(message: Message, emoji: Emoji, type: number): string { return `${message.id}:${emoji.name}:${emoji.id ?? ''}:${type}`; }
function queueFetch(message: Message, emoji: Emoji, type: number): CacheEntry {
    const key = keyFor(message, emoji, type);
    const cache = reactions[key] ??= { fetched: false, users: new Map() };
    if (cache.fetched) return cache;
    cache.fetched = true;
    const activation = context;
    pending = pending.then(async () => {
        if (activation.signal.aborted || activation !== context) return;
        try {
            const api = find<{ get(options: Record<string, unknown>): Promise<{ body: User[] }> }>(value => typeof value?.get === 'function' && typeof value?.del === 'function' && typeof value?.put === 'function', 'HTTP client');
            const reaction = encodeURIComponent(emoji.name + (emoji.id ? `:${emoji.id}` : ''));
            const response = await api.get({ url: `/channels/${message.channel_id}/messages/${message.id}/reactions/${reaction}`, query: { limit: 100, type }, oldFormErrors: true });
            if (activation.signal.aborted || activation !== context) return;
            const flux = dispatcher();
            for (const user of response.body) { cache.users.set(user.id, user); flux.dispatch({ type: 'USER_UPDATE', user }); }
            flux.dispatch({ type: 'MESSAGE_REACTION_ADD_USERS', channelId: message.channel_id, messageId: message.id, users: response.body, emoji, reactionType: type });
        } catch (error) {
            cache.fetched = false;
            if (!activation.signal.aborted) activation.log.error('Could not load reacting users.', error);
        }
        await new Promise<void>(resolve => {
            const done = () => { clearTimeout(timer); activation.signal.removeEventListener('abort', done); resolve(); };
            const timer = setTimeout(done, 250);
            activation.signal.addEventListener('abort', done, { once: true });
            if (activation.signal.aborted) done();
        });
    });
    return cache;
}
function ReactionUsers({ message, emoji, type }: ReactionProps): MenuElement | null {
    const React = context.react;
    const [, refresh] = React.useState(0);
    const { clickableAvatars } = settings.use(['clickableAvatars']);
    const cache = reactions[keyFor(message, emoji, type)] ??= { fetched: false, users: new Map() };
    React.useEffect(() => {
        const flux = dispatcher();
        const changed = (event: { messageId?: string }) => { if (event.messageId === message.id) refresh(value => value + 1); };
        flux.subscribe('MESSAGE_REACTION_ADD_USERS', changed);
        return () => flux.unsubscribe('MESSAGE_REACTION_ADD_USERS', changed);
    }, [message.id]);
    React.useEffect(() => {
        if (message.reactions.length <= 10) queueFetch(message, emoji, type);
    }, [message.id, emoji.id, emoji.name, type, cache]);
    React.useLayoutEffect(() => { if (scroll && scroll.scrollCounter > 0) scroll.setAutomaticAnchor(null); });
    if (message.reactions.length > 10) return null;
    const usersStore = find<{ getUser(id: string): User | undefined }>(value => typeof value?.getUser === 'function' && typeof value?.getCurrentUser === 'function', 'user store');
    const users = [...cache.users.keys()].map(id => usersStore.getUser(id)).filter(Boolean);
    if (!users.length) return null;
    const UserSummaryItem = find(value => typeof value === 'function' && String(value).includes('defaultRenderUser') && String(value).includes('showDefaultAvatarsForNullUsers'), 'user avatars');
    const channels = find<{ getChannel(id: string): { guild_id?: string } | undefined }>(value => typeof value?.getChannel === 'function' && typeof value?.getDMFromUserId === 'function', 'channel store');
    const stop = (event: { stopPropagation(): void }) => event.stopPropagation();
    return React.createElement('div', { style: { marginLeft: '.5em', transform: 'scale(.9)' } },
        React.createElement('div', { onClick: stop, onKeyDown: stop, style: clickableAvatars ? {} : { pointerEvents: 'none' } },
            React.createElement(UserSummaryItem, { users, guildId: channels.getChannel(message.channel_id)?.guild_id, renderIcon: false, max: 5, showDefaultAvatarsForNullUsers: true, showUserPopout: true })));
}
export function renderUsers(props: ReactionProps): MenuElement {
    if (!Boundary) {
        const ctx = context;
        const React = ctx.react as typeof ctx.react & { Component: any };
        Boundary = class extends React.Component {
            state = { failed: false };
            static getDerivedStateFromError() { return { failed: true }; }
            componentDidCatch(error: unknown) { ctx.log.error('Could not render reacting users.', error); }
            render() { return this.state.failed ? null : this.props.children; }
        };
    }
    return context.react.createElement(Boundary, null, context.react.createElement(ReactionUsers, props as unknown as Record<string, unknown>));
}
export function setReactions(value: Record<string, CacheEntry>): void { reactions = value; }
export function setScrollObj(value: typeof scroll): void { scroll = value; }
export function start(ctx: RendererContext): void {
    context = ctx;
    Boundary = undefined;
}
export function stop(): void { reactions = {}; scroll = undefined; pending = Promise.resolve(); }
