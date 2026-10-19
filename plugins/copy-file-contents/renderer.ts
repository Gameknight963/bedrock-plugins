/* Copyright (c) 2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { MenuElement, RendererContext, SourcePatch } from '@bedrock/renderer';

const identifier = '[A-Za-z_$][\\w$]*';
export const patches: SourcePatch[] = [{ id: 'preview-copy-buttons', find: 'bytesLeft:', replacement: [
    { match: new RegExp(String.raw`fileContents:(\i),bytesLeft:(\i)\}\):null,`.replaceAll('\\i', identifier)),
        replace: '$&$self.addCopyButton({fileContents:$1,bytesLeft:$2}),' },
    { match: new RegExp(String.raw`align:"\i"\}\),(?=\(0,\i\.jsx\)\(\i,\{wordWrap:\i,setWordWrap:\i)`.replaceAll('\\i', identifier)),
        replace: '$&$self.addCopyButton(arguments[0]),' }
] }];

interface PreviewProps { fileContents: string | null; bytesLeft: number }
let context: RendererContext;

function CopyButton({ fileContents, bytesLeft }: PreviewProps): MenuElement {
    const ctx = context;
    const [copied, setCopied] = ctx.react.useState(false);
    const [copying, setCopying] = ctx.react.useState(false);
    const pending = ctx.react.useRef(false);
    const mounted = ctx.react.useRef(true);
    const timer = ctx.react.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    ctx.react.useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; clearTimeout(timer.current); };
    }, []);
    const incomplete = bytesLeft > 0 || fileContents === null;
    const text = copied ? 'Copied!' : incomplete ? 'File too large to copy' : 'Copy File Contents';
    async function copy(): Promise<void> {
        if (copied || pending.current || incomplete || ctx.signal.aborted) return;
        pending.current = true;
        setCopying(true);
        try {
            await navigator.clipboard.writeText(fileContents!);
            if (!mounted.current || ctx.signal.aborted) return;
            setCopied(true);
            timer.current = setTimeout(() => { if (mounted.current && !ctx.signal.aborted) setCopied(false); }, 2000);
            ctx.notifications.show({ title: 'Copied to clipboard!', type: 'success' });
        } catch (error) {
            if (!ctx.signal.aborted) {
                ctx.log.error(error);
                ctx.notifications.show({ title: 'Could not copy file contents', body: error instanceof Error ? error.message : String(error), type: 'error' });
            }
        } finally { pending.current = false; if (mounted.current && !ctx.signal.aborted) setCopying(false); }
    }
    function button(tooltipProps: Record<string, unknown> = {}): MenuElement {
        const paths = copied
            ? ['M21.7 5.3a1 1 0 0 1 0 1.4l-12 12a1 1 0 0 1-1.4 0l-6-6a1 1 0 1 1 1.4-1.4L9 16.58l11.3-11.3a1 1 0 0 1 1.4 0Z']
            : incomplete
                ? ['M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8 0-1.85.63-3.55 1.69-4.9L16.9 18.31C15.55 19.37 13.85 20 12 20zm6.31-3.1L7.1 5.69C8.45 4.63 10.15 4 12 4c4.42 0 8 3.58 8 8 0 1.85-.63 3.55-1.69 4.9z']
                : ['M3 16a1 1 0 0 1-1-1v-5a8 8 0 0 1 8-8h5a1 1 0 0 1 1 1v.5a.5.5 0 0 1-.5.5H10a6 6 0 0 0-6 6v5.5a.5.5 0 0 1-.5.5H3Z',
                    'M6 18a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-4h-3a5 5 0 0 1-5-5V6h-4a4 4 0 0 0-4 4v8Z',
                    'M21.73 12a3 3 0 0 0-.6-.88l-4.25-4.24a3 3 0 0 0-.88-.61V9a3 3 0 0 0 3 3h2.73Z'];
        return ctx.react.createElement('div', { ...tooltipProps, className: 'vc-cfc-button', role: 'button', tabIndex: incomplete ? -1 : 0,
            'aria-label': text, 'aria-disabled': incomplete || copying, title: text, onClick: copy,
            onKeyDown(event: KeyboardEvent) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void copy(); } } },
            ctx.react.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true },
                ...paths.map((d, index) => ctx.react.createElement('path', { d, key: index }))));
    }
    const tooltip = ctx.webpack.find(value => typeof value === 'function' && value.prototype?.shouldShowTooltip && value.prototype.render);
    return tooltip ? ctx.react.createElement(tooltip, { text, children: button }) : button();
}

export function addCopyButton(props: PreviewProps): MenuElement | null {
    return !context || context.signal.aborted ? null : context.react.createElement(CopyButton, { ...props });
}

export function start(ctx: RendererContext): void {
    context = ctx;
    ctx.styles.add('.vc-cfc-button { display:flex; align-items:center; margin-left:16px; cursor:pointer; }');
}
