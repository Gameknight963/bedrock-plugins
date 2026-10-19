/* Copyright (c) 2026 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
export type Preset = { label: string; value: number };
export const defaultResolutions: Preset[] = [{ label: '480p', value: 480 }, { label: '720p', value: 720 }, { label: '1080p', value: 1080 }, { label: '1440p', value: 1440 }, { label: 'Source', value: 0 }];
export const defaultFrameRates: Preset[] = [{ label: '15fps', value: 15 }, { label: '30fps', value: 30 }, { label: '60fps', value: 60 }];
export function readPresets(value: unknown, fallback: Preset[]): Preset[] {
    if (!Array.isArray(value)) return structuredClone(fallback);
    return value.filter((item): item is Preset => !!item && typeof item.label === 'string' && Number.isInteger(item.value) && item.value >= 0).map(item => ({ label: item.label, value: item.value }));
}
let context: RendererContext;
export function setContext(ctx: RendererContext): void { context = ctx; }
export const React: any = new Proxy({}, { get: (_target, key) => (context.react as any)[key] });
declare global { namespace JSX { interface IntrinsicElements { [tag: string]: any } interface IntrinsicAttributes { key?: string | number } } }
export function useState<T>(initial: T): [T, (value: T | ((previous: T) => T)) => void] { return context.react.useState(initial); }
export function useMemo<T>(factory: () => T, dependencies: readonly unknown[]): T { return context.react.useMemo(factory, dependencies); }
export function useEffect(effect: () => void | (() => void), dependencies: readonly unknown[]): void { context.react.useEffect(effect, dependencies); }
function find(predicate: (value: any) => boolean): any {
    const value = context.webpack.find(predicate);
    if (!value) throw new Error('A Discord module needed by Limitless Screenshare has not loaded.');
    return value;
}
export const Menu: any = new Proxy({}, { get: (_target, key) => find(value => value?.MenuControlItem && value?.MenuSliderControl)[key] });
export const MediaEngineStore: any = { getState: () => find(value => value?.getName?.() === 'MediaEngineStore').getState() };
export function getPresets(): { resolutions: Preset[]; fpss: Preset[] } {
    return { resolutions: readPresets(context.settings.get('resolutions', defaultResolutions), defaultResolutions), fpss: readPresets(context.settings.get('fpss', defaultFrameRates), defaultFrameRates) };
}
export function throttle(callback: (value: number) => void, delay: number): ((value: number) => void) & { cancel(): void } {
    const activation = context;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let previous = -Infinity;
    let pending: number | undefined;
    const invoke = () => {
        timer = undefined;
        if (pending === undefined || activation.signal.aborted) return;
        const value = pending; pending = undefined; previous = Date.now(); callback(value);
    };
    const cancel = () => { clearTimeout(timer); timer = undefined; pending = undefined; };
    activation.signal.addEventListener('abort', cancel, { once: true });
    return Object.assign((value: number) => {
        if (activation.signal.aborted) return;
        pending = value;
        const remaining = delay - (Date.now() - previous);
        if (remaining <= 0) { clearTimeout(timer); invoke(); }
        else timer ??= setTimeout(invoke, remaining);
    }, { cancel() { cancel(); activation.signal.removeEventListener('abort', cancel); } });
}
export async function loadStyles(ctx: RendererContext): Promise<void> {
    const response = await fetch(new URL('./style.css', import.meta.url), { signal: ctx.signal });
    if (!response.ok) throw new Error(`Could not load screenshare styles (HTTP ${response.status}).`);
    const css = await response.text();
    if (!ctx.signal.aborted) ctx.styles.add(css);
}
function canonicalize(value: string, regex: boolean): string {
    return value.replace(/#\{intl::([\w]+)(::raw)?\}/g, (_match, name: string, raw: string) => {
        const hash = ({ SCREENSHARE_FRAME_RATE: 'SkkeIt', STREAM_RESOLUTION: 'rHyPXg' } as Record<string, string>)[name] ?? name;
        return raw ? hash : regex ? `\\.${hash}` : `.${hash}`;
    }).replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)');
}
export function normalizePatches(definitions: any[]): SourcePatch[] {
    return definitions.map((patch, index) => ({ id: `limitless-screenshare-${index}`, find: patch.find, replacement: {
        match: /^[\s\S]*$/, replace(source: string): string {
            for (const replacement of Array.isArray(patch.replacement) ? patch.replacement : [patch.replacement]) {
                const match = new RegExp(canonicalize(replacement.match.source, true), replacement.match.flags);
                if (!match.test(source)) throw new Error(`Limitless Screenshare replacement did not match: ${replacement.match}`);
                source = source.replace(match, replacement.replace.replaceAll('$self', '$self.plugin'));
            }
            return source;
        }
    } }));
}
