/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-21. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
import { noticePatches, startNotices, stopNotices, enqueueNotice, clearNotices } from './notices.js';
export { noticeHasCurrent, noticeDismissed } from './notices.js';

export const settings = Bedrock.definePluginSettings({
    notices: { type: Bedrock.OptionType.BOOLEAN, label: 'Persistent notices', description: 'Also show a notice at the top of Discord when removed.', default: false },
    offlineRemovals: { type: Bedrock.OptionType.BOOLEAN, label: 'Offline removals', description: 'Check for removals that happened while Discord was closed.', default: true },
    friends: { type: Bedrock.OptionType.BOOLEAN, label: 'Friends', description: 'Notify when a friend removes you.', default: true },
    friendRequestCancels: { type: Bedrock.OptionType.BOOLEAN, label: 'Cancelled friend requests', description: 'Notify when an incoming friend request is cancelled.', default: true },
    servers: { type: Bedrock.OptionType.BOOLEAN, label: 'Servers', description: 'Notify when removed from a server.', default: true },
    groups: { type: Bedrock.OptionType.BOOLEAN, label: 'Group chats', description: 'Notify when removed from a group chat.', default: true }
});
interface Entity { id: string; name: string }
interface Snapshot { guilds: Entity[]; groups: Entity[]; friends: string[]; requests: string[] }
interface User { id: string; username: string; discriminator?: string; tag?: string }
interface Dispatcher { dispatch(event: unknown): void; subscribe(name: string, callback: (event: any) => void): void; unsubscribe(name: string, callback: (event: any) => void): void }
let context: RendererContext;
let running = false;
let generation = 0;
let account: string | undefined;
let snapshot: Snapshot | undefined;
let work = Promise.resolve();
let timer: ReturnType<typeof setTimeout> | undefined;
let dispatcher: Dispatcher | undefined;
let unsubscribe: (() => void) | undefined;
const manualFriends = new Map<string, number>(), manualGuilds = new Map<string, number>(), manualGroups = new Map<string, number>();
const notifications = new Set<() => void>();
function store(name: string): any {
    const value = context.webpack.find<any>(value => value?.getName?.() === name);
    if (!value) throw new Error(`Discord's ${name} is unavailable.`);
    return value;
}
function currentAccount(): string | undefined { return store('UserStore').getCurrentUser()?.id; }
function current(token: number): boolean { return running && !context.signal.aborted && token === generation && currentAccount() === account; }
function uniqueName(user: User): string { return user.discriminator === '0' ? user.username : user.tag ?? user.username; }
function notify(text: string, onClick?: () => void): void {
    if (!running || context.signal.aborted) return;
    if (settings.store.notices) enqueueNotice(text);
    const owner = account;
    notifications.add(context.notifications.show({ title: 'Relationship Notifier', body: text,
        onClick: onClick ? () => { if (running && !context.signal.aborted && currentAccount() === owner) onClick(); } : undefined }).close);
    if (notifications.size > 64) {
        const oldest = notifications.values().next().value!;
        oldest(); notifications.delete(oldest);
    }
}
function openProfile(id: string): void {
    if (!running || context.signal.aborted) return;
    const open = context.webpack.find<(props: object) => void>(value => typeof value === 'function' && String(value).includes('type:"USER_PROFILE_MODAL_OPEN"'));
    if (open) {
        const guilds = context.webpack.find<any>(value => value?.getName?.() === 'SelectedGuildStore');
        const channels = context.webpack.find<any>(value => value?.getName?.() === 'SelectedChannelStore');
        open({ userId: id, guildId: guilds?.getGuildId(), channelId: channels?.getChannelId(), sourceAnalyticsLocations: ['username', 'user profile popout'] });
    }
}
async function userFor(id: string): Promise<User | undefined> {
    const cached = store('UserStore').getUser(id);
    if (cached) return cached;
    const fetchUser = context.webpack.find<(id: string) => Promise<User>>(value => typeof value === 'function' && String(value).includes('.USER('));
    return fetchUser ? fetchUser(id).catch(() => undefined) : undefined;
}
function relationships(): [string, number][] {
    const values = store('RelationshipStore').getMutableRelationships();
    return values instanceof Map ? [...values] : Object.entries(values);
}
function capture(): Snapshot {
    const userId = currentAccount();
    const availability = store('GuildAvailabilityStore'), members = store('GuildMemberStore'), users = store('UserStore');
    const guilds: Entity[] = [];
    for (const guild of Object.values(store('GuildStore').getGuilds()) as (Entity & { unavailable?: boolean })[]) {
        if (members.isMember(guild.id, userId)) guilds.push({ id: guild.id, name: guild.name });
    }
    for (const previous of snapshot?.guilds ?? []) {
        if (!guilds.some(guild => guild.id === previous.id) && availability.isUnavailable(previous.id)) guilds.push(previous);
    }
    const groups: Entity[] = [];
    for (const channel of store('ChannelStore').getSortedPrivateChannels()) {
        if (channel.type !== 3) continue;
        const recipients = channel.rawRecipients ?? channel.recipients ?? [];
        const name = channel.name || recipients.map((recipient: string | User) => typeof recipient === 'string' ? users.getUser(recipient)?.username ?? recipient : recipient.username).join(', ');
        groups.push({ id: channel.id, name });
    }
    const friends: string[] = [], requests: string[] = [];
    for (const [id, type] of relationships()) {
        if (type === 1) friends.push(id);
        else if (type === 3) requests.push(id);
    }
    return { guilds, groups, friends, requests };
}
function readSnapshot(value: unknown): Snapshot | undefined {
    if (!value || typeof value !== 'object') return;
    const raw = value as Record<string, unknown>;
    if (!['guilds', 'groups', 'friends', 'requests'].every(key => Array.isArray(raw[key]))) return;
    const entities = (key: string): Entity[] => (raw[key] as unknown[]).filter((item): item is Entity => !!item && typeof item === 'object' && typeof (item as Entity).id === 'string' && typeof (item as Entity).name === 'string');
    const ids = (key: string): string[] => (raw[key] as unknown[]).filter((id): id is string => typeof id === 'string');
    return { guilds: entities('guilds'), groups: entities('groups'), friends: ids('friends'), requests: ids('requests') };
}
async function persist(token: number): Promise<void> {
    if (current(token) && snapshot) await context.settings.set(`snapshot.${account}`, structuredClone(snapshot));
}
function enqueue(task: (token: number) => void | Promise<void>): void {
    const token = generation;
    work = work.catch(() => {}).then(async () => { if (current(token)) await task(token); }).catch(error => {
        if (current(token)) context.log.error('Could not update relationship notifications.', error);
    });
}
async function initialize(token: number): Promise<void> {
    const previous = readSnapshot(context.settings.get(`snapshot.${account}`, null));
    snapshot = capture();
    for (const guild of previous?.guilds ?? []) {
        if (!snapshot.guilds.some(current => current.id === guild.id) && store('GuildAvailabilityStore').isUnavailable(guild.id)) snapshot.guilds.push(guild);
    }
    await persist(token);
    if (!current(token) || !settings.store.offlineRemovals || !previous) return;
    if (settings.store.groups) for (const group of previous.groups) {
        if (!snapshot.groups.some(value => value.id === group.id)) notify(`You are no longer in the group ${group.name}.`);
    }
    if (settings.store.servers) for (const guild of previous.guilds) {
        if (!snapshot.guilds.some(value => value.id === guild.id) && !store('GuildAvailabilityStore').isUnavailable(guild.id)) notify(`You are no longer in the server ${guild.name}.`);
    }
    if (settings.store.friends) for (const id of previous.friends) {
        if (snapshot.friends.includes(id)) continue;
        const user = await userFor(id);
        if (!current(token)) return;
        if (user) notify(`You are no longer friends with ${uniqueName(user)}.`, () => openProfile(id));
    }
    if (settings.store.friendRequestCancels) for (const id of previous.requests) {
        if (snapshot.requests.includes(id) || [1, 2, 4].includes(store('RelationshipStore').getRelationshipType(id))) continue;
        const user = await userFor(id);
        if (!current(token)) return;
        if (user) notify(`Friend request from ${uniqueName(user)} has been revoked.`, () => openProfile(id));
    }
}
function beginSession(delay = 0): void {
    const next = currentAccount();
    if (account && account !== next) clearAccountNotifications();
    generation++; snapshot = undefined; account = next;
    manualFriends.clear(); manualGuilds.clear(); manualGroups.clear();
    clearTimeout(timer);
    if (account) timer = setTimeout(() => enqueue(initialize), delay);
}
function manual(map: Map<string, number>, id: string): void {
    if (!running || context.signal.aborted) return;
    const now = Date.now();
    for (const [key, expiry] of map) if (expiry < now) map.delete(key);
    map.set(id, now + 30000);
}
function consume(map: Map<string, number>, id: string): boolean {
    const expiry = map.get(id); map.delete(id);
    return expiry !== undefined && expiry >= Date.now();
}
export function removeFriend(id: string): void { manual(manualFriends, id); }
export function removeGuild(id: string): void { manual(manualGuilds, id); }
export function removeGroup(id: string): void { manual(manualGroups, id); }
function clearAccountNotifications(): void {
    for (const close of notifications) close();
    notifications.clear(); clearNotices();
}
function sync(kind: 'guilds' | 'groups' | 'friends'): void {
    enqueue(async token => {
        if (!snapshot) return;
        const updated = capture();
        if (kind === 'friends') { snapshot.friends = updated.friends; snapshot.requests = updated.requests; }
        else snapshot[kind] = updated[kind];
        await persist(token);
    });
}
function relationshipRemoved(event: { relationship?: { id: string; type: number } }): void {
    const relation = event.relationship;
    if (!relation) return;
    const own = consume(manualFriends, relation.id);
    enqueue(async token => {
        if (!snapshot) return;
        const updated = capture();
        snapshot.friends = updated.friends; snapshot.requests = updated.requests;
        await persist(token);
        if (!current(token) || own) return;
        if (relation.type === 1 && !settings.store.friends || relation.type === 3 && !settings.store.friendRequestCancels || ![1, 3].includes(relation.type)) return;
        if (relation.type === 3 && [1, 2, 4].includes(store('RelationshipStore').getRelationshipType(relation.id))) return;
        const user = await userFor(relation.id);
        if (current(token) && user) notify(relation.type === 1 ? `${uniqueName(user)} removed you as a friend.` : `A friend request from ${uniqueName(user)} has been removed.`, () => openProfile(relation.id));
    });
}
function guildRemoved(event: { guild?: { id: string; unavailable?: boolean } }): void {
    const guild = event.guild;
    if (!guild) return;
    enqueue(async token => {
        if (!snapshot || guild.unavailable || store('GuildAvailabilityStore').isUnavailable(guild.id)) return;
        const own = consume(manualGuilds, guild.id);
        const previous = snapshot.guilds.find(value => value.id === guild.id);
        snapshot.guilds = snapshot.guilds.filter(value => value.id !== guild.id);
        await persist(token);
        if (current(token) && previous && !own && settings.store.servers) notify(`You were removed from the server ${previous.name}.`);
    });
}
function groupRemoved(event: { channel?: { id: string; type: number } }): void {
    const group = event.channel;
    if (group?.type !== 3) return;
    const own = consume(manualGroups, group.id);
    enqueue(async token => {
        if (!snapshot) return;
        const previous = snapshot.groups.find(value => value.id === group.id);
        snapshot.groups = snapshot.groups.filter(value => value.id !== group.id);
        await persist(token);
        if (current(token) && previous && !own && settings.store.groups) notify(`You were removed from the group ${previous.name}.`);
    });
}
const handlers: Record<string, (event: any) => void> = {
    GUILD_CREATE: () => sync('guilds'), GUILD_DELETE: guildRemoved, CHANNEL_CREATE: () => sync('groups'), CHANNEL_DELETE: groupRemoved,
    RELATIONSHIP_ADD: () => sync('friends'), RELATIONSHIP_UPDATE: () => sync('friends'), RELATIONSHIP_REMOVE: relationshipRemoved,
    CONNECTION_OPEN: () => beginSession(), LOGOUT: () => { generation++; snapshot = undefined; account = undefined; clearTimeout(timer); clearAccountNotifications(); }
};
const re = (source: string) => new RegExp(source.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)'));
export const patches: SourcePatch[] = [
    { id: 'manual-friend-removal', find: 'removeRelationship:(', replacement: { match: re(String.raw`(removeRelationship:\((\i),\i,\i\)=>)`), replace: '$1($self.removeFriend($2),0)||' } },
    { id: 'manual-server-leave', find: 'async leaveGuild(', replacement: { match: re(String.raw`(leaveGuild\((\i)\){)`), replace: '$1$self.removeGuild($2);' } },
    { id: 'manual-group-leave', find: '},closePrivateChannel(', replacement: { match: re(String.raw`(closePrivateChannel\((\i)\){)`), replace: '$1$self.removeGroup($2);' } },
    ...noticePatches
];
export async function start(ctx: RendererContext): Promise<void> {
    context = ctx; running = true; work = Promise.resolve();
    let events: Dispatcher;
    try { [events] = await Promise.all([
        ctx.webpack.waitFor<Dispatcher>(value => typeof value?.dispatch === 'function' && typeof value?.subscribe === 'function'),
        ...['UserStore', 'GuildStore', 'GuildMemberStore', 'GuildAvailabilityStore', 'ChannelStore', 'RelationshipStore'].map(name => ctx.webpack.waitFor(value => value?.getName?.() === name)),
        startNotices(ctx)
    ]); } catch (error) { stop(); throw error; }
    if (ctx.signal.aborted) return;
    dispatcher = events;
    for (const [event, handler] of Object.entries(handlers)) events.subscribe(event, handler);
    unsubscribe = settings.subscribe(key => { if (key === 'notices' && !settings.store.notices) clearNotices(); });
    beginSession(5000);
}
export function stop(): void {
    running = false; generation++; clearTimeout(timer);
    for (const [event, handler] of Object.entries(handlers)) dispatcher?.unsubscribe(event, handler);
    unsubscribe?.(); unsubscribe = undefined; dispatcher = undefined;
    snapshot = undefined; account = undefined;
    manualFriends.clear(); manualGuilds.clear(); manualGroups.clear();
    clearAccountNotifications(); stopNotices();
}
