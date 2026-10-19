/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
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
import { React, CogWheel, findGroupChildrenByChildId, Menu, ChannelStore, CollapsedVoiceChannelStore, SortedGuildStore, UserStore, findByPropsLazy, findByCodeLazy, mapMangledModuleLazy, sleep, setContext, getContext } from './discord.js';
type Guild = any;
type NavContextMenuPatchCallback = (children: any[], props: any) => void;
const OptionType = Bedrock.OptionType;
const notificationActions = findByPropsLazy("updateGuildNotificationSettings");
const guildOnboardingActions = mapMangledModuleLazy(".onboardExistingMember(", {
    toggleShowAllChannels: m => {
        const s = String(m);
        return s.length < 100 && !s.includes("onboardExistingMember") && !s.includes("getOptedInChannels");
    }
});
const isOptInEnabledForGuild = findByCodeLazy(".COMMUNITY)||", ".isOptInEnabled(");
const collapsedChannels = findByPropsLazy("toggleCollapseGuild");

export const settings = Bedrock.definePluginSettings({
    guild: {
        label: "Mute server",
        type: OptionType.BOOLEAN,
        default: true
    },
    messages: {
        label: "Message notifications",
        type: OptionType.SELECT,
        default: 3,
        options: [
            { label: "All messages", value: 0 },
            { label: "Only @mentions", value: 1 },
            { label: "Nothing", value: 2 },
            { label: "Server default", value: 3 }
        ],
    },
    everyone: {
        label: "Suppress @everyone and @here",
        type: OptionType.BOOLEAN,
        default: true
    },
    role: {
        label: "Suppress role mentions",
        type: OptionType.BOOLEAN,
        default: true
    },
    highlights: {
        label: "Suppress highlights",
        type: OptionType.BOOLEAN,
        default: true
    },
    events: {
        label: "Mute new events",
        type: OptionType.BOOLEAN,
        default: true
    },
    showAllChannels: {
        label: "Show all channels",
        type: OptionType.BOOLEAN,
        default: true
    },
    mobilePush: {
        label: "Mute mobile push notifications",
        type: OptionType.BOOLEAN,
        default: true
    },
    voiceChannels: {
        label: "Hide voice channel members",
        description: "Collapse the member lists under voice channels",
        type: OptionType.BOOLEAN,
        default: false
    }
});

const makeContextMenuPatch: (shouldAddIcon: boolean) => NavContextMenuPatchCallback = (shouldAddIcon: boolean) => (children, props: { guild?: Guild; folderId?: number; onClose(): void; }) => {
    const { guild, folderId } = props;
    const owner = getContext();

    if (guild) {
        const group = findGroupChildrenByChildId("privacy", children);
        if (!group) return;

        group.push(
            <Menu.MenuItem
                label="Apply NewGuildSettings"
                id="vc-newguildsettings-apply"
                icon={shouldAddIcon ? CogWheel : void 0}
                leadingAccessory={shouldAddIcon ? { type: "icon", icon: CogWheel } : void 0}
                action={() => applyDefaultSettings(guild.id)}
            />
        );
    }

    if (folderId) {
        const folder = SortedGuildStore.getGuildFolderById(folderId);

        children.push(
            <Menu.MenuItem
                label="Apply NewGuildSettings to Folder"
                id="vc-newguildsettings-apply-folder"
                icon={shouldAddIcon ? CogWheel : void 0}
                leadingAccessory={shouldAddIcon ? { type: "icon", icon: CogWheel } : void 0}
                action={async () => {
                    for (const guildId of folder.guildIds) {
                        if (owner.signal.aborted) return;
                        applyDefaultSettings(guildId);
                        // you will be rate limited really fast so hopefully this avoids that
                        await sleep(250, owner.signal);
                    }
                }}
            />
        );
    }
};

function applyVoiceNameHidingToGuild(guildId: string) {
    if (!settings.store.voiceChannels) return;

    try {
        ChannelStore.getChannelIds(guildId).filter((channelId: string) => {
            const channel = ChannelStore.getChannel(channelId);
            return channel.isGuildVocal() && !CollapsedVoiceChannelStore.isCollapsed(channelId);
        }).forEach((id: string) => collapsedChannels.update(id));
    } catch (error) {
        console.warn("[NewGuildSettings] Error applying voice name hiding:", error);
    }
}

function applySettings(guildId: string | null) {
    if (guildId === "@me" || guildId === "null" || guildId == null) return;

    notificationActions.updateGuildNotificationSettings(guildId,
        {
            muted: settings.store.guild,
            mobile_push: !settings.store.mobilePush,
            suppress_everyone: settings.store.everyone,
            suppress_roles: settings.store.role,
            mute_scheduled_events: settings.store.events,
            notify_highlights: settings.store.highlights ? 1 : 0
        });

    if (settings.store.messages !== 3) {
        notificationActions.updateGuildNotificationSettings(guildId,
            {
                message_notifications: settings.store.messages,
            });
    }

    if (settings.store.showAllChannels && isOptInEnabledForGuild(guildId)) {
        guildOnboardingActions.toggleShowAllChannels(guildId);
    }

    if (settings.store.voiceChannels) {
        applyVoiceNameHidingToGuild(guildId);
    }
}


export function applyDefaultSettings(guildId: string | null): void {
    const ctx = getContext();
    if (!ctx || ctx.signal.aborted) return;
    try { applySettings(guildId); }
    catch (error) { ctx.log.error('Could not apply new server settings.', error); }
}
export const patches: SourcePatch[] = [
    { id: 'accepted-invite-settings', find: ',acceptInvite(', replacement: {
        match: /INVITE_ACCEPT_SUCCESS.+?,([A-Za-z_$][\w$]*)=null!=.+?;/,
        replace: (match: string, guildId: string) => `${match}$self.applyDefaultSettings(${guildId});`
    } },
    { id: 'joined-server-settings', find: '{joinGuild:', replacement: {
        match: /(?<=type:"GUILD_JOIN",guildId:([A-Za-z_$][\w$]*),lurker:([A-Za-z_$][\w$]*).+?)return ([A-Za-z_$][\w$]*)(?=}catch)/,
        replace: (_match: string, guildId: string, lurker: string, response: string) => `if(!${lurker}&&!${response}.body.join_request)$self.applyDefaultSettings(${guildId});return ${response}`
    } }
];
const disposers: (() => void)[] = [];
export async function start(ctx: RendererContext): Promise<void> {
    setContext(ctx);
    for (const [id, icon] of [['guild-context', false], ['guild-header-popout', true]] as const) disposers.push(ctx.contextMenus.patch(id, makeContextMenuPatch(icon)));
    const dispatcher = await ctx.webpack.waitFor<any>(value => typeof value?.dispatch === 'function' && typeof value?.subscribe === 'function');
    if (ctx.signal.aborted) return;
    const listener = ({ guildId, request, status }: any) => {
        if (status === 'APPROVED' && request?.user_id === UserStore.getCurrentUser()?.id) applyDefaultSettings(guildId);
    };
    dispatcher.subscribe('GUILD_JOIN_REQUEST_UPDATE', listener);
    disposers.push(() => dispatcher.unsubscribe('GUILD_JOIN_REQUEST_UPDATE', listener));
}
export function stop(): void { for (const dispose of disposers.splice(0)) dispose(); }
