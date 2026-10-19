/* Copyright (c) 2026 Bedrock contributors. SPDX-License-Identifier: GPL-3.0-or-later */
import type { ReactRuntime, RendererContext, SourcePatch } from '@bedrock/renderer';

let context: RendererContext;
const timers = new Set<ReturnType<typeof setTimeout>>(), frames = new Set<number>();
export function setContext(ctx: RendererContext): void { context = ctx; }
export function disposeContext(): void {
    for (const timer of timers) clearTimeout(timer); timers.clear();
    for (const frame of frames) cancelAnimationFrame(frame); frames.clear();
}
export const React: ReactRuntime = new Proxy({} as ReactRuntime, { get(_target, key: keyof ReactRuntime) {
    if (key === 'Fragment') return context.react.Fragment;
    return (...args: unknown[]) => Reflect.apply(context.react[key] as Function, context.react, args);
} });
function find(predicate: (value: any) => boolean, name: string): any {
    const value = context.webpack.find(predicate);
    if (!value) throw new Error(`Discord's ${name} is not available.`);
    return value;
}
export const Menu: any = new Proxy({}, { get(_target, key) {
    return find(value => value?.Menu && value?.MenuItem && value?.MenuCheckboxItem, 'menu components')[key];
} });
export function createRoot(element: HTMLElement): any {
    const namespace = context.webpack.find<any>(value => typeof value?.createRoot === 'function');
    const create = namespace?.createRoot || find(value => typeof value === 'function' && String(value).includes('(299));') && String(value).includes('.onRecoverableError'), 'React root creator');
    return create(element);
}
export class Logger {
    constructor(_name: string) {}
    error(...values: unknown[]): void { context.log.error(...values); }
}
export const FluxDispatcher = { dispatch(event: unknown): void {
    find(value => typeof value?.dispatch === 'function' && typeof value?.subscribe === 'function', 'dispatcher').dispatch(event);
} };
export const ErrorBoundary = { wrap(component: (props: any) => any, _options?: unknown): (props: any) => any {
    let Boundary: any;
    return props => {
        const React = context.react as any;
        Boundary ||= class extends React.Component {
            state = { failed: false };
            static getDerivedStateFromError() { return { failed: true }; }
            componentDidCatch(error: unknown) { context.log.error(error); }
            render() { return this.state.failed ? null : this.props.children; }
        };
        return React.createElement(Boundary, null, React.createElement(component, props));
    };
} };
export function classNameFactory(prefix: string): (name: string, flags?: Record<string, boolean>) => string {
    return (name, flags) => [prefix + name, ...Object.entries(flags || {}).filter(([, enabled]) => enabled).map(([name]) => prefix + name)].join(' ');
}
export function debounce(callback: (value: number) => void, delay: number): (value: number) => void {
    const activation = context;
    let timer: ReturnType<typeof setTimeout>;
    return value => {
        if (timer) { clearTimeout(timer); timers.delete(timer); }
        timer = setTimeout(() => { timers.delete(timer); if (!activation.signal.aborted && activation === context) callback(value); }, delay);
        timers.add(timer);
    };
}
export function waitFor(condition: () => boolean, callback: () => void): () => void {
    const activation = context;
    let canceled = false, frame = 0;
    function check(): void {
        frames.delete(frame);
        if (canceled || activation !== context || activation.signal.aborted) return;
        if (condition()) callback();
        else { frame = requestAnimationFrame(check); frames.add(frame); }
    }
    check();
    return () => { canceled = true; cancelAnimationFrame(frame); frames.delete(frame); };
}
export function normalizePatches(definitions: any[]): SourcePatch[] {
    return definitions.map((patch, index) => ({
        id: ['viewer-image', 'keep-viewer-controls', 'magnifier-lifecycle'][index], find: patch.find,
        replacement: (Array.isArray(patch.replacement) ? patch.replacement : [patch.replacement]).map((replacement: any) => ({
            match: new RegExp(replacement.match.source.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)'), replacement.match.flags),
            replace: replacement.replace.replaceAll('$self', '$self.plugin')
        }))
    }));
}
