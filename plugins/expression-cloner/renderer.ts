/* Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { MenuChild, MenuElement, RendererContext } from '@bedrock/renderer';

interface Expression { kind: 'Emoji' | 'Sticker'; id: string; name: string; isAnimated?: boolean; format_type?: number; tags?: string; description?: string }
interface Guild { id: string; name: string; ownerId: string; icon?: string; features: Set<string> | string[]; premiumTier: number; premiumFeatures?: { additionalEmojiSlots?: number } }
interface ModalProps { onClose(): void; [key: string]: unknown }
type OpenModal = (render: (props: ModalProps) => MenuElement, options?: { onCloseCallback(): void }) => string;
type CloseModal = (key: string) => void;
interface Rest { get(options: { url: string }): Promise<{ body: any }>; post(options: { url: string; body: unknown }): Promise<{ body: any }>; del: unknown; put: unknown }
let context: RendererContext;
const openModals = new Set<string>();
let closeModal: CloseModal | undefined;

function find<T>(predicate: (value: any) => boolean, name: string): T {
    const result = context.webpack.find<T>(predicate);
    if (!result) throw new Error(`Discord's ${name} is not available yet. Try opening the menu again.`);
    return result;
}
function byCode<T>(name: string, ...parts: string[]): T {
    return find<T>(value => typeof value === 'function' && parts.every(part => Function.prototype.toString.call(value).includes(part)), name);
}
function guildStore() { return find<{ getGuilds(): Record<string, Guild>; getGuild(id: string): Guild | undefined }>(value => typeof value?.getGuilds === 'function' && typeof value?.getGuild === 'function', 'server list'); }
function emojiStore() { return find<{ getGuildEmoji(id: string): { animated: boolean; managed: boolean }[]; getCustomEmojiById(id: string): { name: string } | undefined }>(value => typeof value?.getGuildEmoji === 'function' && typeof value?.getCustomEmojiById === 'function', 'emoji store'); }
function stickerStore() { return find<{ getStickerById(id: string): any; getStickersByGuildId(id: string): unknown[] | undefined }>(value => typeof value?.getStickerById === 'function' && typeof value?.getStickersByGuildId === 'function', 'sticker store'); }
function rest() { return find<Rest>(value => typeof value?.get === 'function' && typeof value?.post === 'function' && typeof value?.del === 'function' && typeof value?.put === 'function', 'HTTP client'); }
function dispatch(event: Record<string, unknown>): void {
    find<{ dispatch(event: Record<string, unknown>): void }>(value => typeof value?.dispatch === 'function' && typeof value?.subscribe === 'function', 'dispatcher').dispatch(event);
}
function currentUser(): { id: string } {
    return find<{ getCurrentUser(): { id: string } }>(value => typeof value?.getCurrentUser === 'function' && typeof value?.getUser === 'function', 'user store').getCurrentUser();
}
function checkActive(activation = context): void { if (activation !== context || activation.signal.aborted) throw new DOMException('The plugin was disabled.', 'AbortError'); }
function errorMessage(error: unknown): string {
    const value = error as { body?: { message?: string }; text?: string; message?: string };
    if (typeof value?.body?.message === 'string') return value.body.message;
    try { const body = JSON.parse(value.text ?? ''); if (typeof body.message === 'string') return body.message; } catch {}
    return typeof value?.message === 'string' ? value.message : 'Discord rejected the upload.';
}
function notifyError(error: unknown): void {
    if (context.signal.aborted) return;
    context.notifications.show({ title: 'Could not clone expression', body: errorMessage(error), type: 'error' });
}
function feature(guild: Guild, name: string): boolean { return guild.features instanceof Set ? guild.features.has(name) : guild.features?.includes(name); }
export function getGuildCandidates(data: Expression): Guild[] {
    const permissionStore = find<{ getGuildPermissions(guild: { id: string }): bigint }>(value => typeof value?.getGuildPermissions === 'function' && typeof value?.can === 'function', 'permission store');
    const bits = find<{ CREATE_GUILD_EXPRESSIONS: bigint }>(value => typeof value?.CREATE_GUILD_EXPRESSIONS === 'bigint', 'expression permissions');
    const me = currentUser().id;
    return Object.values(guildStore().getGuilds()).filter(guild => {
        if (guild.ownerId !== me && (permissionStore.getGuildPermissions({ id: guild.id }) & bits.CREATE_GUILD_EXPRESSIONS) !== bits.CREATE_GUILD_EXPRESSIONS) return false;
        if (data.kind === 'Sticker') {
            const limit = feature(guild, 'MORE_STICKERS') && guild.premiumTier === 3 ? 120 : [5, 15, 30, 60][guild.premiumTier] ?? 5;
            return (stickerStore().getStickersByGuildId(guild.id)?.length ?? 0) < limit;
        }
        const limit = Math.max(feature(guild, 'MORE_EMOJI') ? 200 : 50, 50 + (guild.premiumFeatures?.additionalEmojiSlots ?? 0));
        return (emojiStore().getGuildEmoji(guild.id) ?? []).filter(emoji => emoji.animated === !!data.isAnimated && !emoji.managed).length < limit;
    }).sort((a, b) => a.name.localeCompare(b.name));
}
export function expressionUrl(data: Expression, size: number): string {
    if (!/^\d+$/.test(data.id)) throw new Error('The expression has an invalid ID.');
    if (data.kind === 'Emoji') return `https://cdn.discordapp.com/emojis/${data.id}.webp?size=${size}&lossless=true&animated=true`;
    const extension = ['', 'png', 'png', 'json', 'gif'][data.format_type ?? 0];
    if (!extension || data.format_type === 3) throw new Error('This sticker format cannot be cloned.');
    return `https://media.discordapp.net/stickers/${data.id}.${extension}?size=${size}&lossless=true&animated=true`;
}
export function validateName(data: Expression, name: string): string | null {
    if (name.length < 2 || name.length > (data.kind === 'Emoji' ? 32 : 30)) return `Use a name between 2 and ${data.kind === 'Emoji' ? 32 : 30} characters.`;
    if (data.kind === 'Emoji' && !/^\w+$/.test(name)) return 'Emoji names can contain letters, numbers and underscores.';
    return null;
}
async function fetchSticker(id: string): Promise<Expression> {
    const activation = context;
    if (!/^\d+$/.test(id)) throw new Error('The sticker has an invalid ID.');
    let data = stickerStore().getStickerById(id);
    if (!data) {
        data = (await rest().get({ url: `/stickers/${id}` })).body;
        checkActive(activation);
        dispatch({ type: 'STICKER_FETCH_SUCCESS', sticker: data });
    }
    if (data.format_type === 3) throw new Error('Lottie stickers cannot be cloned.');
    return { ...data, kind: 'Sticker' };
}
export async function cloneExpression(guildId: string, data: Expression): Promise<void> {
    const activation = context;
    checkActive(activation);
    const invalid = validateName(data, data.name);
    if (invalid) throw new Error(invalid);
    if (!getGuildCandidates(data).some(guild => guild.id === guildId)) throw new Error('This server no longer has an available expression slot, or you do not have permission to upload.');
    const limit = (data.kind === 'Emoji' ? 256 : 512) * 1024;
    let blob: Blob | undefined;
    for (let size = 4096; size >= 16; size /= 2) {
        const response = await fetch(expressionUrl(data, size), { signal: activation.signal, credentials: 'omit' });
        if (!response.ok) throw new Error(`Could not download the ${data.kind.toLowerCase()} (HTTP ${response.status}).`);
        const candidate = await response.blob();
        checkActive(activation);
        if (candidate.size <= limit) { blob = candidate; break; }
    }
    if (!blob) throw new Error(`The ${data.kind.toLowerCase()} is too large to upload (${limit / 1024} KB limit).`);
    checkActive(activation);
    if (data.kind === 'Emoji') {
        const image = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Could not read the downloaded emoji.'));
            reader.onabort = () => reject(new DOMException('The upload was cancelled.', 'AbortError'));
            reader.readAsDataURL(blob!);
        });
        checkActive(activation);
        const upload = byCode<(options: { guildId: string; name: string; image: string }) => Promise<unknown>>('emoji uploader', '.GUILD_EMOJIS(', 'EMOJI_UPLOAD_START');
        await upload({ guildId, name: data.name.split('~')[0], image });
    } else {
        const form = new FormData();
        form.append('name', data.name);
        form.append('tags', data.tags || '\uD83D\uDE42');
        form.append('description', data.description ?? '');
        form.append('file', blob, `${data.id}.${data.format_type === 4 ? 'gif' : 'png'}`);
        const { body } = await rest().post({ url: `/guilds/${guildId}/stickers`, body: form });
        if (!activation.signal.aborted && activation === context) dispatch({ type: 'GUILD_STICKERS_CREATE_SUCCESS', guildId, sticker: { ...body, user: currentUser() } });
    }
    if (!activation.signal.aborted && activation === context) context.notifications.show({ title: `Cloned ${data.name} to ${guildStore().getGuild(guildId)?.name ?? 'your server'}`, type: 'success' });
}
function CloneBody({ data }: { data: Expression }): MenuElement {
    const activation = context;
    const React = context.react;
    const [name, setName] = React.useState(data.name.split('~')[0]);
    const [busy, setBusy] = React.useState(false);
    const [revision, setRevision] = React.useState(0);
    const [failure, setFailure] = React.useState('');
    const guilds = React.useMemo(() => getGuildCandidates(data), [data.id, revision]);
    const error = validateName(data, name);
    const TextInput = byCode<unknown>('text input', 'setHasValue?.(""!==', '="text",');
    return React.createElement('div', { className: 'bedrock-expression-cloner' },
        React.createElement('label', { htmlFor: 'bedrock-expression-name', className: 'bedrock-expression-label' }, 'Custom Name'),
        React.createElement(TextInput, { id: 'bedrock-expression-name', value: name, type: 'text', disabled: busy, error: error ?? undefined, onChange: setName }),
        failure ? React.createElement('p', { role: 'alert', className: 'bedrock-expression-error' }, failure) : null,
        !guilds.length ? React.createElement('p', null, 'No servers have an available slot and permission to create this expression.') : null,
        React.createElement('div', { className: 'bedrock-expression-servers', 'aria-busy': busy }, ...guilds.map(guild => {
            const acronym = guild.name.split(/\s+/).map(word => word[0]).join('').slice(0, 6);
            return React.createElement('button', { key: guild.id, className: 'bedrock-expression-server', type: 'button', title: guild.name, 'aria-label': `Clone to ${guild.name}`, disabled: busy || !!error,
                async onClick() {
                    if (busy || error) return;
                    setBusy(true); setFailure('');
                    try { await cloneExpression(guild.id, { ...data, name }); }
                    catch (error) { if (!activation.signal.aborted && activation === context) { setFailure(errorMessage(error)); notifyError(error); } }
                    finally { if (!activation.signal.aborted && activation === context) { setBusy(false); setRevision(value => value + 1); } }
                }
            }, guild.icon ? React.createElement('img', { alt: '', src: `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${guild.icon.startsWith('a_') ? 'gif' : 'png'}?size=128` }) :
                React.createElement('span', { style: { fontSize: [20, 20, 18, 18, 16, 14, 12][acronym.length] ?? 12 } }, acronym));
        })));
}
async function openClone(fetchData: () => Expression | Promise<Expression>): Promise<void> {
    const activation = context;
    try {
        const data = await fetchData();
        checkActive(activation);
        const open = byCode<OpenModal>('modal opener', ',instant:');
        closeModal = byCode<CloseModal>('modal closer', '.onCloseCallback()');
        const Modal = byCode<unknown>('modal', 'leadingLayout:', 'actions:', '.message');
        const key = open(props => context.react.createElement(Modal, { ...props, title: context.react.createElement('div', { className: 'bedrock-expression-title' },
            context.react.createElement('img', { src: expressionUrl(data, 128), alt: '', width: 24, height: 24 }), `Clone ${data.name}`) }, context.react.createElement(CloneBody, { data })),
            { onCloseCallback() { openModals.delete(key); } });
        openModals.add(key);
    } catch (error) { if (!activation.signal.aborted && activation === context) notifyError(error); }
}
function isAnimated(src?: string): boolean {
    try { const url = new URL(src ?? ''); return url.pathname.endsWith('.gif') || url.searchParams.get('animated') === 'true'; } catch { return false; }
}
function item(kind: Expression['kind'], fetchData: () => Expression | Promise<Expression>): MenuElement {
    return context.contextMenus.item({ id: 'emote-cloner', label: `Clone ${kind}`, leadingAccessory: { type: 'icon', icon: PlusIcon }, action() { void openClone(fetchData); } });
}
function PlusIcon(): MenuElement {
    return context.react.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'currentColor' }, context.react.createElement('path', { d: 'M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z' }));
}
function addToCopyGroup(children: MenuChild[], entry: MenuElement): boolean {
    for (const child of children) {
        if (Array.isArray(child)) { if (addToCopyGroup(child, entry)) return true; }
        else if (context.react.isValidElement(child) && Array.isArray(child.props.children)) {
            const nested = child.props.children as MenuChild[];
            if (nested.some(value => context.react.isValidElement(value) && value.props.id === 'copy-link')) { nested.push(entry); return true; }
            if (addToCopyGroup(nested, entry)) return true;
        }
    }
    return false;
}
export function start(ctx: RendererContext): void {
    context = ctx;
    ctx.styles.add('.bedrock-expression-title{display:flex;align-items:center;gap:.5em}.bedrock-expression-title img{object-fit:contain}.bedrock-expression-cloner{padding:0 4px 12px}.bedrock-expression-label{display:block;margin-bottom:8px;font-weight:600;color:var(--text-default)}.bedrock-expression-servers{display:flex;flex-wrap:wrap;gap:1em;padding:1em .5em;justify-content:center;align-items:center}.bedrock-expression-server{border:0;border-radius:50%;background:var(--background-base-lower);color:var(--text-default);display:inline-flex;align-items:center;justify-content:center;width:4em;height:4em;cursor:pointer;padding:0;overflow:hidden}.bedrock-expression-server:disabled{cursor:not-allowed;filter:brightness(.5)}.bedrock-expression-server:focus-visible{outline:2px solid var(--focus-primary);outline-offset:3px}.bedrock-expression-server img{width:100%;height:100%;border-radius:50%}.bedrock-expression-error{color:var(--text-danger);margin-top:8px}');
    ctx.contextMenus.patch<any>('message', (children, props) => {
        const { favoriteableId: id, favoriteableType: type, message } = props;
        if (!/^\d+$/.test(id)) return;
        let entry: MenuElement | undefined;
        if (type === 'emoji') {
            const name = emojiStore().getCustomEmojiById(id)?.name ?? message?.reactions?.find((reaction: any) => reaction.emoji.id === id)?.emoji.name ??
                message?.content?.match(new RegExp(`<a?:(\\w+)(?:~\\d+)?:${id}>`))?.[1] ?? 'ClonedEmoji';
            entry = item('Emoji', () => ({ kind: 'Emoji', id, name, isAnimated: isAnimated(props.itemHref || props.itemSrc) }));
        } else if (type === 'sticker' && message?.stickerItems?.find((sticker: any) => sticker.id === id)?.format_type !== 3) entry = item('Sticker', () => fetchSticker(id));
        if (entry && !addToCopyGroup(children, entry)) children.push(entry);
    });
    ctx.contextMenus.patch<{ target?: HTMLElement }>('expression-picker', (children, { target }) => {
        const { id, name, type } = target?.dataset ?? {};
        if (!id || !/^\d+$/.test(id)) return;
        if (type === 'emoji' && name) children.push(item('Emoji', () => ({ kind: 'Emoji', id, name, isAnimated: isAnimated(target?.querySelector('img')?.src) })));
        else if (type === 'sticker' && !String(target?.className).includes('lottieCanvas')) children.push(item('Sticker', () => fetchSticker(id)));
    });
    ctx.cleanup(() => { for (const key of openModals) closeModal?.(key); openModals.clear(); });
}
