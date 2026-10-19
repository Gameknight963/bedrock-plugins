/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { ChatBarProps, MenuElement, RendererContext } from '@bedrock/renderer';

interface Store { addChangeListener(callback: () => void): void; removeChangeListener(callback: () => void): void }
interface DraftStore extends Store { getDraft(channel: string, type: number): string }
interface Upload { isImage: boolean; filename: string; spoiler: boolean; item: { file: Blob }; getSize(): number }
interface UploadStore extends Store { getUploads(channel: string, type: number): Upload[] }
interface Dispatcher { subscribe(name: string, callback: (event: any) => void): void; unsubscribe(name: string, callback: (event: any) => void): void }
let context: RendererContext;
const urls = new Map<string, string[]>();
let unsubscribe: (() => void) | undefined;
let counter = 0;
function release(id: string): void { for (const url of urls.get(id) ?? []) URL.revokeObjectURL(url); urls.delete(id); }
function imageSize(url: string, signal: AbortSignal): Promise<{ width: number; height: number } | undefined> {
    return new Promise(resolve => {
        const image = new Image();
        const done = (result?: { width: number; height: number }) => {
            clearTimeout(timeout); image.onload = image.onerror = null; signal.removeEventListener('abort', abort); resolve(result);
        };
        const abort = () => done();
        const timeout = setTimeout(() => done(), 10000);
        image.onload = () => done({ width: image.width, height: image.height }); image.onerror = () => done();
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) done(); else image.src = url;
    });
}
export async function preview(channelId: string, includeAttachments: boolean): Promise<void> {
    const activation = context;
    const draft = activation.webpack.find<DraftStore>(value => typeof value?.getDraft === 'function' && typeof value?.getState === 'function');
    const uploads = activation.webpack.find<UploadStore>(value => typeof value?.getUploads === 'function' && typeof value?.getUpload === 'function');
    const actions = activation.webpack.find<{ receiveMessage(channel: string, message: object): void }>(value => typeof value?.receiveMessage === 'function' && typeof value?.sendMessage === 'function');
    const create = activation.webpack.find<(options: object) => Record<string, unknown>>(value => typeof value === 'function' && /username:\s*["']Clyde["']/.test(Function.prototype.toString.call(value)));
    const user = activation.webpack.find<{ getCurrentUser(): unknown }>(value => typeof value?.getCurrentUser === 'function')?.getCurrentUser();
    if (!draft || !actions || !create || !user) throw new Error('Discord message preview modules are not available.');
    const content = draft.getDraft(channelId, 0) ?? '';
    const pending = includeAttachments ? [...(uploads?.getUploads(channelId, 0) ?? [])] : [];
    if (!content && !pending.length) return;
    const id = `-${((BigInt(Date.now()) - 1420070400000n) << 22n) + BigInt(counter++ % 4194304)}`;
    const owned: string[] = [];
    urls.set(id, owned);
    try {
        const attachments = await Promise.all(pending.map(async (upload, index) => {
            const url = URL.createObjectURL(upload.item.file); owned.push(url);
            const size = upload.isImage ? await imageSize(url, activation.signal) : undefined;
            return { id: `${id}-${index}`, filename: upload.spoiler ? `SPOILER_${upload.filename}` : upload.filename,
                content_type: undefined, size: upload.getSize(), spoiler: upload.spoiler, url: `${url}#`, proxy_url: `${url}#`, ...size };
        }));
        if (activation.signal.aborted || activation !== context) { release(id); return; }
        actions.receiveMessage(channelId, { ...create({ channelId, content: '', embeds: [] }), id, content, author: user, attachments });
    } catch (error) { release(id); throw error; }
}
function PreviewButton(props: ChatBarProps): MenuElement | null {
    const activation = context, React = activation.react;
    const draft = activation.webpack.find<DraftStore>(value => typeof value?.getDraft === 'function' && typeof value?.getState === 'function');
    const uploads = activation.webpack.find<UploadStore>(value => typeof value?.getUploads === 'function' && typeof value?.getUpload === 'function');
    const [, update] = React.useState(0);
    React.useEffect(() => {
        const refresh = () => update(value => value + 1);
        draft?.addChangeListener(refresh); uploads?.addChangeListener(refresh);
        return () => { draft?.removeChangeListener(refresh); uploads?.removeChangeListener(refresh); };
    }, [draft, uploads]);
    const type = props.type;
    const includeAttachments = type?.attachments !== false;
    const hasUploads = includeAttachments && !!uploads?.getUploads(props.channel.id, 0).length;
    if (props.isAnyChat === false || props.disabled || (!draft?.getDraft(props.channel.id, 0)?.length && !hasUploads)) return null;
    return activation.chatBar.button({ label: 'Preview Message', icon: React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'currentColor', style: { scale: '1.096', translate: '0 -1px' } },
        React.createElement('path', { d: 'M12 5C7 5 2.73 8.11 1 12c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z' })),
        onClick: async () => { try { await preview(props.channel.id, includeAttachments); } catch (error) { if (!activation.signal.aborted) activation.notifications.show({ title: 'Could not preview this message.', body: error instanceof Error ? error.message : String(error), type: 'error' }); } } });
}
export async function start(ctx: RendererContext): Promise<void> {
    context = ctx;
    const flux = await ctx.webpack.waitFor<Dispatcher>(value => typeof value?.subscribe === 'function' && typeof value?.dispatch === 'function');
    if (ctx.signal.aborted) return;
    const deleted = (event: { id?: string; ids?: string[] }) => { for (const id of event.ids ?? (event.id ? [event.id] : [])) release(id); };
    flux.subscribe('MESSAGE_DELETE', deleted); flux.subscribe('MESSAGE_DELETE_BULK', deleted);
    unsubscribe = () => { flux.unsubscribe('MESSAGE_DELETE', deleted); flux.unsubscribe('MESSAGE_DELETE_BULK', deleted); };
    ctx.chatBar.addButton('preview-message', props => ctx.react.createElement(PreviewButton, props as unknown as Record<string, unknown>), { order: -100 });
}
export function stop(): void { unsubscribe?.(); unsubscribe = undefined; for (const id of urls.keys()) release(id); }
