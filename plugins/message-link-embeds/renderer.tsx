/* Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, RendererSettingsProps, SourcePatch } from '@bedrock/renderer';
import { React, BaseText, ChannelStore, GuildStore, IconUtils, MessageStore, Parser, PermissionStore,
    PermissionsBits, UserStore, Embed, ChannelMessage, MessageDisplayCompact, EmbedClasses,
    setContext, updateMessage, requestMessage } from './discord.js';
import type { Message, Channel, Attachment } from './discord.js';
const { definePluginSettings, OptionType } = Bedrock;
declare global { namespace JSX { interface IntrinsicElements { [tag: string]: any } interface IntrinsicAttributes { key?: string | number } } }
let context: RendererContext;
let AutoModEmbed: any;
let queue: Promise<unknown> = Promise.resolve();
interface ParentMessage { id: string; channel_id: string }
interface CacheEntry { message?: Message; missing?: boolean; fetching?: boolean; parents: Map<string, ParentMessage> }
const messageCache = new Map<string, CacheEntry>();
const observedParents = new Map<string, ParentMessage & { references: number }>();
const getCacheKey = (channelId: string, messageId: string) => `${channelId}:${messageId}`;
const messageLinkRegex = /(?<!<)https?:\/\/(?:\w+\.)?discord(?:app)?\.com\/channels\/(?:\d{17,20}|@me)\/(\d{17,20})\/(\d{17,20})/g;
const tenorRegex = /^https:\/\/(?:www\.)?tenor\.com\//;
interface MessageEmbedProps { message: Message; channel: Channel }
export const settings = definePluginSettings({
    messageBackgroundColor: { label: 'Message background', description: 'Add a background behind messages in rich previews.', type: OptionType.BOOLEAN, default: false },
    automodEmbeds: { label: 'Preview style', description: 'Choose compact AutoMod-style previews or full message previews.', type: OptionType.SELECT, default: 'never', options: [
        { label: 'Always use AutoMod previews', value: 'always' },
        { label: 'Prefer AutoMod previews, using rich previews for unsupported content', value: 'prefer' },
        { label: 'Always use rich previews', value: 'never' }
    ] },
    listMode: { label: 'ID list mode', description: 'Exclude the listed IDs, or only show previews for those IDs.', type: OptionType.SELECT, default: 'blacklist', options: [
        { label: 'Blacklist', value: 'blacklist' }, { label: 'Whitelist', value: 'whitelist' }
    ] },
    idList: { label: 'ID list', description: 'Server, channel or message-author IDs, separated by commas.', type: OptionType.STRING, default: '', multiline: true }
});
export function Settings({ ctx }: RendererSettingsProps) {
    return ctx.react.createElement('button', { className: 'bedrock-button', onClick: clearCache }, 'Clear the linked message cache');
}
function clearCache(): void {
    messageCache.clear();
    queue = Promise.resolve();
    if (context && !context.signal.aborted) for (const message of observedParents.values()) updateMessage(message.channel_id, message.id);
}
function getLinkedMessage(channelId: string, messageId: string, parent: Message): Message | undefined {
    const key = getCacheKey(channelId, messageId);
    let entry = messageCache.get(key);
    const existing = MessageStore.getMessage(channelId, messageId);
    if (existing) {
        if (!entry) messageCache.set(key, entry = { parents: new Map() });
        entry.message = existing;
        return existing;
    }
    if (entry?.message) return entry.message;
    if (!entry) messageCache.set(key, entry = { parents: new Map() });
    entry.parents.set(getCacheKey(parent.channel_id, parent.id), { id: parent.id, channel_id: parent.channel_id });
    if (entry.fetching || entry.missing) return;
    entry.fetching = true;
    const activation = context, pending = entry;
    queue = queue.catch(() => {}).then(async () => {
        if (activation.signal.aborted || activation !== context || messageCache.get(key) !== pending) return;
        try {
            const response = await requestMessage(channelId, messageId);
            if (activation.signal.aborted || activation !== context || messageCache.get(key) !== pending) return;
            const raw = response?.body?.find((message: any) => message.id === messageId);
            pending.message = raw ? MessageStore.getMessages(channelId).receiveMessage(raw).get(messageId) : undefined;
            pending.missing = !pending.message;
            pending.fetching = false;
            for (const message of pending.parents.values()) updateMessage(message.channel_id, message.id);
            pending.parents.clear();
        } catch (error: any) {
            if (activation.signal.aborted || activation !== context || messageCache.get(key) !== pending) return;
            pending.fetching = false; pending.missing = true;
            activation.log.error(`Could not fetch linked message ${messageId} in channel ${channelId}: ${error.message || String(error)}`);
        }
    });
}
function getImages(message: Message): Attachment[] {
    const attachments: Attachment[] = [];

    for (const { content_type, height, width, url, proxy_url } of message.attachments ?? []) {
        if (content_type?.startsWith("image/"))
            attachments.push({
                height: height!,
                width: width!,
                url: url,
                proxyURL: proxy_url!
            });
    }

    for (const { type, image, thumbnail, url } of message.embeds ?? []) {
        if (type === "image")
            attachments.push({ ...(image ?? thumbnail!) });
        else if (url && type === "gifv" && !tenorRegex.test(url))
            attachments.push({
                height: thumbnail!.height,
                width: thumbnail!.width,
                url
            });
    }

    return attachments;
}

function noContent(attachments: number, embeds: number) {
    if (!attachments && !embeds) return "";
    if (!attachments) return `[no content, ${embeds} embed${embeds !== 1 ? "s" : ""}]`;
    if (!embeds) return `[no content, ${attachments} attachment${attachments !== 1 ? "s" : ""}]`;
    return `[no content, ${attachments} attachment${attachments !== 1 ? "s" : ""} and ${embeds} embed${embeds !== 1 ? "s" : ""}]`;
}

function requiresRichEmbed(message: Message) {
    if (message.components?.length) return true;
    if (message.attachments.some(a => !a.content_type?.startsWith("image/"))) return true;
    if (message.embeds.some((e: any) => e.type !== "image" && (e.type !== "gifv" || tenorRegex.test(e.url!)))) return true;

    return false;
}

function computeWidthAndHeight(width: number, height: number) {
    const maxWidth = 400;
    const maxHeight = 300;

    if (width > height) {
        const adjustedWidth = Math.min(width, maxWidth);
        return { width: adjustedWidth, height: Math.round(height / (width / adjustedWidth)) };
    }

    const adjustedHeight = Math.min(height, maxHeight);
    return { width: Math.round(width / (height / adjustedHeight)), height: adjustedHeight };
}

function withEmbeddedBy(message: Message, embeddedBy: string[]) {
    return new Proxy(message, {
        get(_, prop) {
            if (prop === "vencordEmbeddedBy") return embeddedBy;
            return Reflect.get(message, prop);
        }
    });
}

function MessageEmbedAccessory({ message }: { message: Message }) {
    settings.use(['messageBackgroundColor', 'automodEmbeds', 'listMode', 'idList']);
    const embeddedBy: string[] = message.vencordEmbeddedBy ?? [];
    const accessories: any[] = [], seen = new Set<string>();
    let count = 0;
    React.useEffect(() => {
        const key = getCacheKey(message.channel_id, message.id);
        let entry = observedParents.get(key);
        if (!entry) observedParents.set(key, entry = { id: message.id, channel_id: message.channel_id, references: 0 });
        entry.references++;
        return () => { if (--entry.references === 0) observedParents.delete(key); };
    }, [message.channel_id, message.id]);
    for (const [, channelId, messageId] of (message.content || '').matchAll(messageLinkRegex)) {
        if (embeddedBy.includes(messageId) || embeddedBy.length > 2 || seen.has(messageId) || count >= 5) continue;
        seen.add(messageId); count++;
        const linkedChannel = ChannelStore.getChannel(channelId);
        if (!linkedChannel || !linkedChannel.isPrivate() && !PermissionStore.can(PermissionsBits.VIEW_CHANNEL, linkedChannel)) continue;
        const ids = new Set(settings.store.idList.split(',').map(value => value.trim()).filter(Boolean));
        const listed = [linkedChannel.guild_id, channelId, message.author.id].some(id => id && ids.has(id));
        if (settings.store.listMode === 'blacklist' ? listed : !listed) continue;
        const linkedMessage = getLinkedMessage(channelId, messageId, message);
        if (!linkedMessage) continue;
        const props = { message: withEmbeddedBy(linkedMessage, [...embeddedBy, message.id]), channel: linkedChannel };
        const type = settings.store.automodEmbeds;
        accessories.push(type === 'always' || type === 'prefer' && !requiresRichEmbed(linkedMessage)
            ? <AutomodEmbedAccessory key={messageId} {...props} /> : <ChannelMessageEmbedAccessory key={messageId} {...props} />);
    }
    return accessories.length ? <>{accessories}</> : null;
}

function getChannelLabelAndIconUrl(channel: Channel) {
    if (channel.isDM()) {
        const recipient = UserStore.getUser(channel.recipients[0]);
        return ["Direct Message", recipient ? IconUtils.getUserAvatarURL(recipient) : undefined];
    }
    if (channel.isGroupDM()) return ["Group DM", IconUtils.getChannelIconURL(channel)];
    return ["Server", IconUtils.getGuildIconURL(GuildStore.getGuild(channel.guild_id))];
}

function ChannelMessageEmbedAccessory({ message, channel }: MessageEmbedProps): any {
    const compact = MessageDisplayCompact.useSetting();

    const dmReceiver = UserStore.getUser(ChannelStore.getChannel(channel.id).recipients?.[0]);

    const [channelLabel, iconUrl] = getChannelLabelAndIconUrl(channel);

    return (
        <Embed
            embed={{
                rawDescription: "",
                color: "var(--background-base-lower)",
                author: {
                    name: <BaseText size="xs" weight="medium" tag="span">
                        <span>{channelLabel} - </span>
                        {Parser.parse(channel.isDM() ? `<@${dmReceiver?.id ?? channel.recipients[0]}>` : `<#${channel.id}>`)}
                    </BaseText>,
                    iconProxyURL: iconUrl
                }
            }}
            renderDescription={() => (
                <div key={message.id} style={!settings.store.messageBackgroundColor ? undefined : {
                    backgroundColor: "var(--background-base-lower)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "8px",
                    paddingBottom: "8px",
                }}>
                    <ChannelMessage
                        id={`message-link-embeds-${message.id}`}
                        message={message}
                        channel={channel}
                        subscribeToComponentDispatch={false}
                        compact={compact}
                    />
                </div>
            )}
        />
    );
}

function AutomodEmbedAccessory(props: MessageEmbedProps): any {
    const { message, channel } = props;
    const compact = MessageDisplayCompact.useSetting();
    const images = getImages(message);
    const { parse } = Parser;

    const [channelLabel, iconUrl] = getChannelLabelAndIconUrl(channel);

    if (!AutoModEmbed) return <BaseText tag="p" color="text-muted">Discord's AutoMod preview component has not loaded.</BaseText>;

    return <AutoModEmbed
        channel={channel}
        childrenAccessories={
            <BaseText size="xs" weight="medium" color="text-muted" tag="span" className={`${EmbedClasses.embedAuthor} ${EmbedClasses.embedMargin}`}>
                {iconUrl && <img src={iconUrl} className={EmbedClasses.embedAuthorIcon} alt="" />}
                <span>
                    <span>{channelLabel} - </span>
                    {channel.isDM()
                        ? Parser.parse(`<@${ChannelStore.getChannel(channel.id).recipients[0]}>`)
                        : Parser.parse(`<#${channel.id}>`)
                    }
                </span>
            </BaseText>
        }
        compact={compact}
        content={
            <>
                {message.content || message.attachments.length <= images.length
                    ? parse(message.content)
                    : [noContent(message.attachments.length, message.embeds.length)]
                }
                {images.map((a, idx) => {
                    const { width, height } = computeWidthAndHeight(a.width, a.height);
                    return (
                        <div key={idx}>
                            <img src={a.proxyURL ?? a.url} width={width} height={height} />
                        </div>
                    );
                })}
            </>
        }
        hideTimestamp={false}
        message={message}
        _messageEmbed="automod"
    />;
}


export function setAutoModEmbed(component: any): void {
    AutoModEmbed = component;
    for (const message of observedParents.values()) updateMessage(message.channel_id, message.id);
}
const identifier = '(?:[A-Za-z_$][\\w$]*)';
export const patches: SourcePatch[] = [
    { id: 'compact-preview', find: '!1,withFooter:', replacement: {
        match: new RegExp(String.raw`(?=function (\i)\(\i\){let{message:\i,channel:\i,[^}]+?withFooter:)`.replaceAll('\\i', identifier)),
        replace: '$self.setAutoModEmbed($1);'
    } },
    { id: 'message-refresh', find: '}renderStickersAccessories(', replacement: {
        match: new RegExp(String.raw`(?<=this.props,\i,\[)(?:"message",)?`.replaceAll('\\i', identifier)), replace: ''
    } }
];
export function start(ctx: RendererContext): void {
    context = ctx; setContext(ctx);
    messageCache.clear(); observedParents.clear(); queue = Promise.resolve();
    ctx.messages.addAccessory('linked-messages', ({ message }: any) => {
        if (!String(message.content || '').match(messageLinkRegex)) return null;
        return <MessageEmbedAccessory message={message} />;
    }, { order: 4 });
}
export function stop(): void { messageCache.clear(); observedParents.clear(); queue = Promise.resolve(); }
