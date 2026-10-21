import type { RendererContext, SourcePatch } from '@bedrock/renderer';
import { React, useState, useEffect, Tooltip, Flex, ErrorBoundary, CopyIcon, LinkIcon,
    UserProfileStore, useStateFromStores, findByCodeLazy, findByPropsLazy,
    copyWithToast, fetchGithubOrgs, openXboxProfile, setContext, getContext, isActive, stopContext } from './discord.js';
import { VerifiedIcon } from './VerifiedIcon.js';
type User = any;
type ConnectedAccount = any;
const OptionType = Bedrock.OptionType;
declare global { namespace JSX { interface IntrinsicElements { [tag: string]: any } interface IntrinsicAttributes { key?: string | number } } }
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




interface ConnectionPlatform {
    getPlatformUserUrl(connection: ConnectedAccount): string;
    icon: { lightSVG: string, darkSVG: string; };
}

interface GithubOrg {
    login: string;
}

const useLegacyPlatformType: (platform: string) => string = findByCodeLazy(".TWITTER_LEGACY:");
const platforms: { get(type: string): ConnectionPlatform; } = findByPropsLazy("isSupported", "getByUrl");
const getProfileThemeProps = findByCodeLazy(".getPreviewThemeColors", "primaryColor:");

const enum Spacing {
    COMPACT,
    COZY,
    ROOMY
}
const getSpacingPx = (spacing: Spacing | undefined) => (spacing ?? Spacing.COMPACT) * 2 + 4;

export const settings = Bedrock.definePluginSettings({
    iconSize: {
        label: "Icon size",
        type: OptionType.NUMBER,
        description: "Icon size (px)",
        default: 32
    },
    iconSpacing: {
        label: "Icon spacing",
        type: OptionType.SELECT,
        description: "Icon margin",
        default: Spacing.COZY,
        options: [
            { label: "Compact", value: Spacing.COMPACT },
            { label: "Cozy", value: Spacing.COZY }, // US Spelling :/
            { label: "Roomy", value: Spacing.ROOMY }
        ]
    },
    showGithubOrgs: {
        label: "Show GitHub organizations",
        type: OptionType.BOOLEAN,
        description: "Show GitHub organizations the user is a member of",
        default: true
    },
    showOnModal: {
        label: "Show on full profiles",
        type: OptionType.BOOLEAN,
        description: "Show connected accounts in the full-size profile modal",
        default: true
    }
});


function GithubOrgIcons({ username, size, iconSrc }: { username: string, size: number, iconSrc: string; }) {
    const [orgs, setOrgs] = useState<GithubOrg[]>([]);

    useEffect(() => {
        let cancelled = false;
        fetchGithubOrgs(username).then(data => {
            if (!cancelled) setOrgs(data);
        });
        return () => { cancelled = true; };
    }, [username]);

    if (!orgs.length) return null;

    return (
        <>
            {orgs.map(org => (
                <Tooltip text={org.login} key={org.login}>
                    {tooltipProps => (
                        <a
                            {...tooltipProps}
                            className="vc-user-connection"
                            href={`https://github.com/${org.login}`}
                            target="_blank"
                            rel="noreferrer"
                        >
                            <img
                                src={iconSrc}
                                alt={org.login}
                                style={{ width: size, height: size }}
                            />
                        </a>
                    )}
                </Tooltip>
            ))}
        </>
    );
}

const ProfileConnections = ErrorBoundary.wrap(
    (props: { user: User; displayProfile?: any; }) => (
        <ConnectionsComponent
            {...props}
            id={props.user.id}
            theme={getProfileThemeProps(props).theme}
        />
    ),
    { noop: true }
);

function ConnectionsComponent({ id, theme }: { id: string, theme: string; }) {
    settings.use(["iconSize", "iconSpacing", "showGithubOrgs"]);
    const profile = useStateFromStores([UserProfileStore], () => UserProfileStore.getUserProfile(id));
    if (!profile)
        return null;

    const connections = profile.connectedAccounts;
    if (!connections?.length)
        return null;

    return (
        <Flex gap={getSpacingPx(settings.store.iconSpacing)} flexWrap="wrap">
            {connections.map(connection => <CompactConnectionComponent connection={connection} theme={theme} key={connection.id} />)}
        </Flex>
    );
}

function CompactConnectionComponent({ connection, theme }: { connection: ConnectedAccount, theme: string; }) {
    const platform = platforms.get(useLegacyPlatformType(connection.type));
    if (!platform) return null;
    const url = platform.getPlatformUserUrl?.(connection);

    const img = (
        <img
            aria-label={connection.name}
            src={theme === "light" ? platform.icon.lightSVG : platform.icon.darkSVG}
            style={{
                width: settings.store.iconSize,
                height: settings.store.iconSize
            }}
        />
    );

    const TooltipIcon = url ? LinkIcon : CopyIcon;

    return (
        <>
            <Tooltip
                text={
                    <span className="vc-sc-tooltip">
                        <span className="vc-sc-connection-name">{connection.name}</span>
                        {connection.verified && <VerifiedIcon />}
                        <TooltipIcon height={16} width={16} className="vc-sc-tooltip-icon" />
                    </span>
                }
                key={connection.id}
            >
                {tooltipProps =>
                    url
                        ? <a
                            {...tooltipProps}
                            className="vc-user-connection"
                            href={url}
                            onClick={event => {
                                if (!isActive()) return;
                                const runtime = Bedrock as unknown as {
                                    plugins: { list(): Array<{ manifest: { id: string }; enabled: boolean }> };
                                    _sourcePlugin?(id: string): { handleAccountView?(event: unknown, platform: string, accountId: string): boolean };
                                };
                                const id = "gameknight963.open-in-app";
                                if (runtime.plugins.list().some(plugin => plugin.manifest.id === id && plugin.enabled))
                                    runtime._sourcePlugin?.(id)?.handleAccountView?.(event, connection.type, connection.id);
                            }}
                            target="_blank"
                            rel="noreferrer"
                        >
                            {img}
                        </a>
                        : <button
                            {...tooltipProps}
                            className="vc-user-connection"
                            onClick={() => {
                                if (connection.type === "xbox") {
                                    openXboxProfile(connection.name);
                                } else {
                                    copyWithToast(connection.name);
                                }
                            }}
                        >
                            {img}
                        </button>
                }
            </Tooltip>
            {connection.type === "github" && settings.store.showGithubOrgs && (
                <GithubOrgIcons
                    username={connection.name}
                    size={settings.store.iconSize}
                    iconSrc={theme === "light" ? platform.icon.lightSVG : platform.icon.darkSVG}
                />
            )}
        </>
    );
}

const plugin = {
    name: "ShowConnections",
    description: "Show connected accounts in user popouts",
    tags: ["Friends", "Appearance"],

    settings,

    patches: [
        {
            // Same find as ReviewDB
            find: '"UserProfilePopout");',
            replacement: {
                match: /userId:\i\.id,guild:\i\}\)(?=])/,
                replace: "$&,$self.profilePopoutComponent(arguments[0])"
            }
        },
        {
            find: ",applicationRoleConnection:",
            predicate: () => settings.store.showOnModal,
            replacement: {
                match: /\i\.length>0.{0,250}locale:\i\}\)\}\)/,
                replace: "$self.profilePopoutComponent(arguments[0]),",
            }
        },
        {
            find: ".MODAL_V2,onClose:",
            predicate: () => settings.store.showOnModal,
            replacement: {
                match: /!\i&&\(\i\|\|\i\).{0,250}profileAppConnections\}\)\}\)/,
                replace: "$self.profilePopoutComponent(arguments[0]),",
            }
        }
    ],


};

const identifier = '[A-Za-z_$][\\w$]*';
export const patches: SourcePatch[] = plugin.patches.map((patch, index) => ({
    id: ['profile-popout', 'profile-modal-connections', 'profile-modal-v2-connections'][index],
    find: patch.find,
    replacement: { match: new RegExp(patch.replacement.match.source.replaceAll('\\i', identifier), patch.replacement.match.flags),
        replace: index === 0 ? patch.replacement.replace : (match: string) => `$self.renderModalConnections(arguments[0],()=>(${match})),` }
}));
export function profilePopoutComponent(props: any): any { return isActive() ? React.createElement(ProfileConnections, props) : null; }
export function renderModalConnections(props: any, original: () => unknown): any {
    settings.use(['showOnModal']);
    return isActive() && settings.store.showOnModal ? profilePopoutComponent(props) : original();
}
export async function start(ctx: RendererContext): Promise<void> {
    setContext(ctx);
    const response = await fetch(new URL('./styles.css', import.meta.url), { signal: ctx.signal });
    if (!response.ok) throw new Error(`Could not load connection styles (HTTP ${response.status}).`);
    const css = await response.text();
    if (ctx.signal.aborted) return;
    ctx.styles.add(css);
}
export function stop(): void { stopContext(); }
