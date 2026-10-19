/* Copyright (c) 2026 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { MenuElement, RendererContext } from '@bedrock/renderer';

interface Attachment { filename: string; proxy_url?: string; url?: string }
let context: RendererContext;
const downloads = new Map<string, ReturnType<typeof setTimeout>>();
export const settings = Bedrock.definePluginSettings({
    downloadAllFileTypes: { type: Bedrock.OptionType.BOOLEAN, label: 'Download non-media files',
        description: 'Also use original attachment URLs to download files that Discord cannot proxy as media.', default: false }
});
function DownloadIcon(): MenuElement {
    return context.react.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true },
        context.react.createElement('path', { d: 'M6.5 20Q4.22 20 2.61 18.43 1 16.85 1 14.58 1 12.63 2.17 11.1 3.35 9.57 5.25 9.15 5.83 7.13 7.39 5.75 8.95 4.38 11 4.08V12.15L9.4 10.6L8 12L12 16L16 12L14.6 10.6L13 12.15V4.08Q15.58 4.43 17.29 6.39 19 8.35 19 11 20.73 11.2 21.86 12.5 23 13.78 23 15.5 23 17.38 21.69 18.69 20.38 20 18.5 20Z' }));
}
export async function downloadAll(attachments: Attachment[]): Promise<void> {
    const activation = context, names = new Set<string>();
    const allTypes = settings.store.downloadAllFileTypes;
    const results = await Promise.allSettled(attachments.map(async attachment => {
        let filename = attachment.filename, suffix = 0;
        const dot = attachment.filename.lastIndexOf('.');
        while (names.has(filename)) {
            suffix++;
            filename = dot <= 0 ? `${attachment.filename}_${suffix}` : `${attachment.filename.slice(0, dot)}_${suffix}${attachment.filename.slice(dot)}`;
        }
        names.add(filename);
        const sources = [attachment.proxy_url, ...(allTypes ? [attachment.url] : [])].filter((value): value is string => !!value);
        if (!sources.length) throw new Error(`${filename}: no ${allTypes ? 'attachment' : 'media proxy'} URL is available.`);
        let blob: Blob | undefined, failure: unknown;
        for (const source of [...new Set(sources)]) {
            activation.signal.throwIfAborted();
            try {
                const response = await fetch(source, { credentials: 'omit', signal: AbortSignal.any([activation.signal, AbortSignal.timeout(30000)]) });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                blob = await response.blob();
                break;
            } catch (error) { failure = error; }
        }
        activation.signal.throwIfAborted();
        if (activation !== context) return;
        if (!blob) throw new Error(`${filename}: ${failure instanceof Error ? failure.message : 'Download failed.'}`, { cause: failure });
        const url = URL.createObjectURL(blob), anchor = document.createElement('a');
        const release = () => { URL.revokeObjectURL(url); downloads.delete(url); };
        downloads.set(url, setTimeout(release, 10000));
        anchor.href = url; anchor.download = filename; anchor.click();
    }));
    if (activation.signal.aborted || activation !== context) return;
    const failed = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    for (const result of failed) activation.log.warn(result.reason);
    const succeeded = attachments.length - failed.length;
    activation.notifications.show({ title: failed.length ? `Downloaded ${succeeded} of ${attachments.length} attachments. ${failed.length} failed.` :
        `Downloaded ${succeeded} attachment${succeeded === 1 ? '' : 's'}.`, type: failed.length ? 'error' : 'success' });
}
export function start(ctx: RendererContext): void {
    context = ctx;
    ctx.messages.addButton('download-all-attachments', ({ message }) => {
        const attachments = message.attachments as Attachment[] | undefined;
        return attachments?.length ? { label: 'Download All Attachments', icon: DownloadIcon, onClick: () => downloadAll(attachments) } : null;
    });
}
export function stop(): void {
    for (const [url, timer] of downloads) { clearTimeout(timer); URL.revokeObjectURL(url); }
    downloads.clear();
}
