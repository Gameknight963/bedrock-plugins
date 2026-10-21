/* Copyright (c) 2023-2026 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-21. See NOTICE. */
import type { RendererContext, ReactRuntime } from '@bedrock/renderer';
let context: RendererContext;
const modals = new Map<string, () => void>();
export function setContext(ctx: RendererContext): void { context = ctx; }
export const getContext = () => context;
function find(predicate: (value: any) => boolean, name: string): any {
    const value = context.webpack.find(predicate);
    if (!value) throw new Error(`Discord's ${name} is not available.`);
    return value;
}
function lazy(factory: () => any): any {
    return new Proxy(function () {}, {
        get(_target, key) { const target = factory(), value = target[key]; return typeof value === 'function' ? value.bind(target) : value; },
        apply(_target, receiver, args) { return Reflect.apply(factory(), receiver, args); }
    });
}
function byCode(name: string, ...markers: string[]): any {
    return find(value => { const component = value?.type || value?.render || value; return typeof component === 'function' && markers.every(marker => String(component).includes(marker)); }, name);
}
function store(name: string): any { return lazy(() => find(value => value?.getName?.() === name, name)); }
export const UserStore = store('UserStore'), AuthSessionsStore = store('AuthSessionsStore');
export const RestAPI = lazy(() => find(value => value?.get && value?.post && value?.put && value?.del && value?.patch, 'REST client'));
export const SettingsRouter = lazy(() => find(value => typeof value?.openUserSettings === 'function', 'settings router'));
export const React: ReactRuntime = new Proxy({} as ReactRuntime, { get(_target, key: keyof ReactRuntime) {
    if (key === 'Fragment') return context.react.Fragment;
    return (...args: unknown[]) => Reflect.apply(context.react[key] as Function, context.react, args);
} });
export const classNameFactory = (prefix: string) => (suffix: string) => prefix + suffix;
export function findComponentByCodeLazy(...markers: string[]): any { return (props: any) => React.createElement(byCode(markers[0], ...markers), props); }
export function findCssClassesLazy(...names: string[]): any {
    return lazy(() => {
        const mapped = (value: any, name: string) => typeof value?.[name] === 'string' ? value[name] : Object.values(value || {}).find(item => typeof item === 'string' && item.split(' ').some(part => part.startsWith(name + '_')));
        const value = find(value => names.every(name => mapped(value, name)), names.join(', ') + ' styles');
        return Object.fromEntries(names.map(name => [name, mapped(value, name)]));
    });
}
export const Tooltip = (props: any): any => React.createElement(find(value => typeof value === 'function' && value.prototype?.shouldShowTooltip && value.prototype?.render, 'tooltip'), props);
export function Paragraph({ size = 'sm', weight = 'normal', color = 'text-default', children, style, ...props }: any): any {
    return React.createElement('p', { ...props, style: { fontFamily: 'var(--font-primary)', fontSize: size === 'md' ? '16px' : '14px', lineHeight: size === 'md' ? '1.25' : '1.28571', fontWeight: weight === 'semibold' ? 600 : 400, margin: 0, color: `var(--${color})`, ...style } }, children);
}
export function Heading({ tag = 'h5', children, ...props }: any): any { return React.createElement(tag, { ...props, className: `vc-${tag} vc-${tag}-defaultMargin` }, children); }
export function Button({ variant = 'primary', size = 'medium', className, children, ...props }: any): any { return React.createElement('button', { ...props, 'data-mana-component': 'button', className: ['vc-btn-base', 'vc-btn-' + variant, 'vc-btn-' + size, className].filter(Boolean).join(' ') }, children); }
export function TextButton({ variant = 'primary', className, ...props }: any): any { return React.createElement('button', { ...props, className: ['vc-text-btn-base', 'vc-text-btn-' + variant, className].filter(Boolean).join(' ') }); }
export const TextInput = (props: any): any => React.createElement(byCode('text input', 'setHasValue?.(""!==', '="text",'), props);
export const Modal = (props: any): any => React.createElement(byCode('modal', 'leadingLayout:', 'actions:', '.message'), props);
let Boundary: any;
export const ErrorBoundary = { wrap(component: any, _options?: any): any {
    return (props: any) => {
        if (!context || context.signal.aborted) return null;
        Boundary ||= class extends (context.react as any).Component {
            state = { error: null as Error | null };
            static getDerivedStateFromError(error: Error) { return { error }; }
            componentDidCatch(error: unknown) { context.log.error('Could not display device session details.', error); }
            render() { return this.state.error ? null : this.props.children; }
        };
        return React.createElement(Boundary, null, React.createElement(component, props));
    };
} };
export function openModal(render: (props: any) => any): void {
    if (context.signal.aborted) return;
    const close = byCode('modal closer', '.onCloseCallback()');
    const key = byCode('modal opener', ',instant:')((props: any) => React.createElement(ErrorBoundary.wrap(render), props), { onCloseCallback() { modals.delete(key); } });
    modals.set(key, () => close(key));
}
export function closeModals(): void { for (const close of modals.values()) close(); modals.clear(); }
declare global { namespace JSX { interface IntrinsicElements { [tag: string]: any } interface IntrinsicAttributes { key?: string | number } } }
