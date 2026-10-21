/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import type { RendererContext, SourcePatch } from '@bedrock/renderer';
import { React, Paragraph, ErrorBoundary, findComponentByCodeLazy, findCssClassesLazy, Tooltip, setContext, getContext, closeModals, UserStore, AuthSessionsStore, RestAPI, SettingsRouter } from './discord.js';
import { NewButton, RenameButton } from './RenameButton.js';
import type { Session, SessionInfo } from './types.js';
import { cl, fetchNamesFromDataStore, getDefaultName, GetOsColor, GetPlatformIcon, savedSessionsCache, saveSessionsToDataStore, clearCache } from './utils.js';
const OptionType = Bedrock.OptionType;
const TimestampClasses = findCssClassesLazy("timestamp", "blockquoteContainer");
const BlobMask = findComponentByCodeLazy("!1,lowerBadgeSize:");

export const settings = Bedrock.definePluginSettings({
    backgroundCheck: {
        label: "Background checks",
        type: OptionType.BOOLEAN,
        description: "Check for new sessions in the background, and display notifications when they are detected",
        default: false,

    },
    checkInterval: {
        label: "Check interval",
        min: 1,
        description: "How often to check for new sessions in the background (if enabled), in minutes",
        type: OptionType.NUMBER,
        default: 20,

    }
});

const plugin = {
    name: "BetterSessions",
    description: "Enhances the sessions (devices) menu. Allows you to view exact timestamps, give each session a custom name, and receive notifications about new sessions.",
    tags: ["Notifications", "Customisation", "Utility"],
    settings: settings,

    patches: [
        {
            find: "cDHCNY",
            replacement: [
                {
                    match: /(TXCmfL.{0,230}role:"listitem",children:\[.{0,15},\{icon:)\i/,
                    replace: "$1()=>$self.renderIcon(arguments[0])"
                },
                {
                    match: /("horizontal",gap:"xs",children:)\[.{0,250}"text-subtle",children:\i\}\)\]\}\),/,
                    replace: "$1$self.renderName(arguments[0])}),"
                },
                {
                    match: /("text-muted",children:)\i(?=\}\)\]\}\),.{0,120}\.client_info\?\.location)/,
                    replace: "$1$self.renderDescription(arguments[0])"
                },
                {
                    match: /:\i\(\i\.approx_last_used_time\).{0,40}\(0,\i\.jsxs?\)\(\i,\{/,
                    replace: "$&session:arguments[0]?.session,"
                },
            ]
        },
    ],

    renderName: ErrorBoundary.wrap(({ session }: SessionInfo) => {
        const savedSession = savedSessionsCache.get(session.id_hash);

        const state = React.useState(savedSession?.name ? `${savedSession.name}*` : getDefaultName(session.client_info));
        const [title, setTitle] = state;
        // Show a "NEW" badge if the session is seen for the first time
        return (
            <>
                <Paragraph size="md" weight="semibold" color="text-strong">{title}</Paragraph>
                <div className={cl("footer-buttons")}>
                    {(savedSession == null || savedSession.isNew) && (
                        <NewButton />
                    )}
                    <RenameButton session={session} state={state} />
                </div>
            </>
        );
    }, { noop: true }),

    renderDescription: ErrorBoundary.wrap(({ session, description }: { session: Session, description: string; }) => {
        const [label, timeLabel] = description.split(" \xb7 ");

        return (
            <div className={cl("description")}>
                <Paragraph size="sm" weight="normal" color="text-muted">{label}</Paragraph>
                {timeLabel && (
                    <>
                        {" \xb7 "}
                        <Tooltip text={session.approx_last_used_time.toLocaleString()}>
                            {(props: any) => (
                                <span {...props} className={TimestampClasses.timestamp}>
                                    {timeLabel}
                                </span>
                            )}
                        </Tooltip>
                    </>
                )}
            </div>
        );
    }, { noop: true }),

    renderIcon: ErrorBoundary.wrap(({ session, icon: DeviceIcon }: { session: Session; icon: any; }) => {
        const PlatformIcon = GetPlatformIcon(session.client_info.platform);

        return (
            <BlobMask
                isFolder
                style={{ cursor: "unset" }}
                selected={false}
                lowerBadge={
                    <div className={cl("lowerBadge")}>
                        <PlatformIcon width={14} height={14} className={cl("lowerBadge-icon")} />
                    </div>
                }
                lowerBadgeSize={{
                    width: 20,
                    height: 20
                }}
            >
                <div
                    className={cl("icon")}
                    style={{ backgroundColor: GetOsColor(session.client_info.os) }}
                >
                    <DeviceIcon size="md" color="currentColor" />
                </div>
            </BlobMask>
        );
    }, { noop: true }),

};

export const patches: SourcePatch[] = plugin.patches.map((patch, index) => ({ id: `device-details-${index}`, find: patch.find, replacement: {
    match: /^[\s\S]*$/, replace(source: string): string {
        for (const replacement of patch.replacement) {
            const match = new RegExp(replacement.match.source.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)'), replacement.match.flags);
            if (!match.test(source)) throw new Error(`Better Sessions replacement did not match (${replacement.match}).`);
            source = source.replace(match, replacement.replace);
        }
        return source;
    }
} }));
export const renderName = (props: SessionInfo): any => plugin.renderName(props);
export const renderDescription = (props: any): any => plugin.renderDescription(props);
export const renderIcon = (props: any): any => plugin.renderIcon(props);
let ownerId: string | undefined;
let pendingCheck: { ctx: RendererContext; id: string } | undefined;
let interval: ReturnType<typeof setInterval> | undefined;
const disposers: (() => void)[] = [];
const notifications = new Set<{ close(): void }>();
function isCurrent(ctx: RendererContext, id: string): boolean { return !ctx.signal.aborted && ownerId === id && UserStore.getCurrentUser()?.id === id; }
export async function checkNewSessions(): Promise<void> {
    const ctx = getContext(), id = ownerId;
    if (!ctx || ctx.signal.aborted || !id || pendingCheck?.ctx === ctx && pendingCheck.id === id) return;
    const ticket = { ctx, id }; pendingCheck = ticket;
    try {
        const data = await RestAPI.get({ url: '/auth/sessions' });
        if (!isCurrent(ctx, id)) return;
        if (!Array.isArray(data?.body?.user_sessions)) throw new Error('Discord returned no session list.');
        for (const session of data.body.user_sessions as Session[]) {
            if (savedSessionsCache.has(session.id_hash)) continue;
            savedSessionsCache.set(session.id_hash, { name: '', isNew: true });
            notifications.add(ctx.notifications.show({ title: 'Better Sessions', body: `New session:\n${session.client_info.os} · ${session.client_info.platform} · ${session.client_info.location}`, timeout: 0, onClick: () => { if (isCurrent(ctx, id)) SettingsRouter.openUserSettings('sessions_panel'); } }));
        }
        await saveSessionsToDataStore();
    } catch (error) { if (isCurrent(ctx, id)) ctx.log.error('Could not check device sessions.', error); }
    finally { if (pendingCheck === ticket) pendingCheck = undefined; }
}
function configureInterval(): void {
    clearInterval(interval); interval = undefined;
    if (settings.store.backgroundCheck && Number.isFinite(settings.store.checkInterval) && settings.store.checkInterval >= 1) interval = setInterval(() => { void checkNewSessions(); }, settings.store.checkInterval * 60000);
}
export function accountChanged(): void {
    const ctx = getContext();
    if (ctx.signal.aborted) return;
    const id = UserStore.getCurrentUser()?.id;
    if (id === ownerId) return;
    ownerId = id; closeModals();
    for (const notification of notifications) notification.close(); notifications.clear();
    clearCache();
    if (id) { fetchNamesFromDataStore(id); void checkNewSessions(); }
}
export function sessionsViewed(): void {
    const ctx = getContext();
    if (ctx.signal.aborted || !ownerId) return;
    const store = ctx.webpack.find<any>(value => value?.getName?.() === 'AuthSessionsStore');    if (!store) return;    const ids = store.getSessions().map((session: Session) => session.id_hash);
    for (const id of ids) if (!savedSessionsCache.has(id)) savedSessionsCache.set(id, { name: '', isNew: false });
    if (ids.length) for (const id of savedSessionsCache.keys()) if (!ids.includes(id)) savedSessionsCache.delete(id);
    for (const session of savedSessionsCache.values()) session.isNew = false;
    void saveSessionsToDataStore();
}
export async function start(ctx: RendererContext): Promise<void> {
    setContext(ctx); ownerId = undefined; pendingCheck = undefined; clearCache();
    const response = await fetch(new URL('./styles.css', import.meta.url), { signal: ctx.signal });
    if (!response.ok) throw new Error(`Could not load device session styles (HTTP ${response.status}).`);
    const css = await response.text(); if (ctx.signal.aborted) return; ctx.styles.add(css);
    const dispatcher = await ctx.webpack.waitFor<any>(value => typeof value?.dispatch === 'function' && typeof value?.subscribe === 'function');
    const users = await ctx.webpack.waitFor<any>(value => value?.getName?.() === 'UserStore');
    if (ctx.signal.aborted) return;
    users.addChangeListener(accountChanged); disposers.push(() => users.removeChangeListener(accountChanged));
    dispatcher.subscribe('USER_SETTINGS_ACCOUNT_RESET_AND_CLOSE_FORM', sessionsViewed); disposers.push(() => dispatcher.unsubscribe('USER_SETTINGS_ACCOUNT_RESET_AND_CLOSE_FORM', sessionsViewed));
    accountChanged(); configureInterval();
    disposers.push(settings.subscribe(() => configureInterval()));
}
export function stop(): void {
    clearInterval(interval); interval = undefined;
    for (const dispose of disposers.splice(0)) dispose();
    for (const notification of notifications) notification.close(); notifications.clear();
    closeModals(); clearCache(); ownerId = undefined; pendingCheck = undefined;
}
