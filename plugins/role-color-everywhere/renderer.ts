/* Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
import { setContext, getContext, ChannelStore, GuildMemberStore, GuildRoleStore, GuildStore, useMessageAuthor, Logger, normalizePatches } from './discord.js';
export const settings = Bedrock.definePluginSettings({
    chatMentions: { type: Bedrock.OptionType.BOOLEAN, label: 'Mentions', description: 'Color user mentions in chat and the message box', default: true, restartNeeded: true },
    memberList: { type: Bedrock.OptionType.BOOLEAN, label: 'Member list', description: 'Color member list role headings', default: true, restartNeeded: true },
    voiceUsers: { type: Bedrock.OptionType.BOOLEAN, label: 'Voice users', description: 'Color names in voice channel user lists', default: true, restartNeeded: true },
    reactorsList: { type: Bedrock.OptionType.BOOLEAN, label: 'Reactions', description: 'Color names in reaction lists', default: true, restartNeeded: true },
    pollResults: { type: Bedrock.OptionType.BOOLEAN, label: 'Poll results', description: 'Color names in poll results', default: true, restartNeeded: true },
    colorChatMessages: { type: Bedrock.OptionType.BOOLEAN, label: 'Message text', description: 'Color message text using the author’s role color', default: false, restartNeeded: true },
    messageSaturation: { type: Bedrock.OptionType.SLIDER, label: 'Message color intensity', description: 'How much role color to blend into message text', default: 30, min: 0, max: 100, step: 10 }
});
const plugin = {
    patches: [
        // Chat Mentions
        {
            find: ".USER_MENTION)",
            replacement: [
                {
                    match: /(?<=user:(\i),guildId:([^,]+?),.{0,100}?children:\i=>\i)\((\i)\)/,
                    replace: "({...$3,color:$self.getColorInt($1?.id,$2)})",
                }
            ],
            predicate: () => settings.store.chatMentions
        },
        // Slate
        {
            // Same find as FullUserInChatbox
            find: '"text":"locked"',
            replacement: [
                {
                    match: /let\{id:(\i),guildId:\i,channelId:(\i)[^}]*\}.*?\.\i,{(?=children)/,
                    replace: "$&color:$self.getColorInt($1,$2),"
                }
            ],
            predicate: () => settings.store.chatMentions
        },
        // Member List Role Headers (in threads)
        {
            find: 'tutorialId:"whos-online',
            replacement: [
                {
                    match: /(?<=#{intl::CHANNEL_MEMBERS_A11Y_LABEL}.{0,400}?)children:(?=.{0,20}?(?:â€”|\\u2014) ",\i\])/,
                    replace: "style:{color:$self.getRoleColor(arguments[0])},$&"
                },
            ],
            predicate: () => settings.store.memberList
        },
        // Member List Role Headers
        {
            find: "?null:new Intl.NumberFormat",
            replacement: [
                {
                    match: /(?<=#{intl::CHANNEL_MEMBERS_A11Y_LABEL},\{title:\i,count:\i\}\)\}\),\(0,\i\.jsxs\)\("div",\{)/,
                    replace: "style:{color:$self.getRoleColor(arguments[0])},"
                },
            ],
            predicate: () => settings.store.memberList
        },
        // Voice Users
        {
            find: "#{intl::GUEST_NAME_SUFFIX})]",
            replacement: [
                {
                    match: /#{intl::GUEST_NAME_SUFFIX}.{0,50}?"".*?\](?=\})(?<=guildId:(\i),.+?user:(\i).+?)/,
                    replace: "$&,style:$self.getColorStyle($2.id,$1),"
                }
            ],
            predicate: () => settings.store.voiceUsers
        },
        // Reaction List
        {
            find: "MessageReactions.render:",
            replacement: {
                match: /tag:"strong",variant:"text-md\/medium"(?<=onContextMenu:.{0,15}\((\i),(\i),\i\).+?)/,
                replace: "$&,style:$self.getColorStyle($2?.id,$1?.channel?.id)"
            },
            predicate: () => settings.store.reactorsList,
        },
        // Poll Results
        {
            find: ",reactionVoteCounts",
            replacement: {
                match: /\.SIZE_32.+?variant:"text-md\/normal",className:\i\.\i,(?="aria-label":)/,
                replace: "$&style:$self.getColorStyle(arguments[0]?.user?.id,arguments[0]?.channel?.id),"
            },
            predicate: () => settings.store.pollResults
        },
        // Messages
        {
            find: ".SEND_FAILED,",
            replacement: {
                match: /(?<=\]:(\i)\.isUnsupported.{0,50}?,)(?=children:\[)/,
                replace: "style:$self.useMessageColorsStyle($1),"
            },
            predicate: () => settings.store.colorChatMessages
        }
    ],

    getColorString(userId: string, channelOrGuildId: string) {
        try {
            const guildId = ChannelStore.getChannel(channelOrGuildId)?.guild_id ?? GuildStore.getGuild(channelOrGuildId)?.id;
            if (guildId == null) return null;

            return GuildMemberStore.getMember(guildId, userId)?.colorString ?? null;
        } catch (e) {
            new Logger("RoleColorEverywhere").error("Failed to get color string", e);
        }

        return null;
    },

    getColorInt(userId: string, channelOrGuildId: string) {
        const colorString = this.getColorString(userId, channelOrGuildId);
        return colorString && parseInt(colorString.slice(1), 16);
    },

    getColorStyle(userId: string, channelOrGuildId: string) {
        const colorString = this.getColorString(userId, channelOrGuildId);

        return colorString && {
            color: colorString
        };
    },

    useMessageColorsStyle(message: any) {
        try {
            const { messageSaturation } = settings.use(["messageSaturation"]);
            const author = useMessageAuthor(message);

            // Do not apply role color if the send fails, otherwise it becomes indistinguishable
            if (message.state === "SEND_FAILED") return;

            if (author.colorString != null && messageSaturation !== 0) {
                const value = `color-mix(in oklab, ${author.colorString} ${messageSaturation}%, var({DEFAULT}))`;

                return {
                    color: value.replace("{DEFAULT}", "--text-default"),
                    "--text-strong": value.replace("{DEFAULT}", "--text-strong"),
                    "--text-muted": value.replace("{DEFAULT}", "--text-muted")
                };
            }
        } catch (e) {
            new Logger("RoleColorEverywhere").error("Failed to get message color", e);
        }

        return null;
    },

    getRoleColor(props: any) {
        try {
            return GuildRoleStore.getRole(props?.guildId, props?.id)?.colorString;
        } catch (e) { }
    }
};
export const patches: SourcePatch[] = normalizePatches(plugin.patches);
export function getColorString(userId: string, channelOrGuildId: string): string | null {
    return !getContext() || getContext().signal.aborted ? null : plugin.getColorString(userId, channelOrGuildId);
}
export function getColorInt(userId: string, channelOrGuildId: string): number | null {
    return !getContext() || getContext().signal.aborted ? null : plugin.getColorInt(userId, channelOrGuildId);
}
export function getColorStyle(userId: string, channelOrGuildId: string): any {
    return !getContext() || getContext().signal.aborted ? null : plugin.getColorStyle(userId, channelOrGuildId);
}
export function useMessageColorsStyle(message: any): any {
    return !getContext() || getContext().signal.aborted ? null : plugin.useMessageColorsStyle(message);
}
export function getRoleColor(props: any): string | undefined {
    return !getContext() || getContext().signal.aborted ? undefined : plugin.getRoleColor(props);
}
export function start(ctx: RendererContext): void { setContext(ctx); }
