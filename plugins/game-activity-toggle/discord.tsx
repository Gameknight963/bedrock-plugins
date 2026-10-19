/* Copyright (c) 2023, 2025 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
let context: RendererContext;
export function setContext(ctx: RendererContext): void { context = ctx; }
export function active(): boolean { return !!context && !context.signal.aborted; }
export const React: any = new Proxy({}, { get: (_target, key) => (context.react as any)[key] });
declare global { namespace JSX { interface IntrinsicElements { [tag: string]: any } } }
function find(predicate: (value: any) => boolean): any {
    const value = context.webpack.find(predicate);
    if (!value) throw new Error('A Discord module needed by Game Activity Toggle has not loaded.');
    return value;
}
export function useRef<T>(value: T): { current: T } { return context.react.useRef(value); }
export function useState<T>(value: T): [T, (value: T | ((previous: T) => T)) => void] { return context.react.useState(value); }
export function useStateFromStores(stores: any[], getValue: () => any): any {
    const [, refresh] = context.react.useState(0);
    context.react.useEffect(() => {
        const update = () => refresh(value => value + 1);
        for (const store of stores) store.addChangeListener(update);
        return () => { for (const store of stores) store.removeChangeListener(update); };
    }, stores);
    return getValue();
}
export const ConnectedAccountsStore: any = new Proxy({}, { get(_target, key) {
    const value = find(value => typeof value?.getName === 'function' && value.getName() === 'ConnectedAccountsStore');
    return typeof value[key] === 'function' ? value[key].bind(value) : value[key];
} });
export const ConnectedAccountActions: any = new Proxy({}, { get(_target, key) {
    const value = find(value => typeof value?.setShowActivity === 'function');
    return value[key].bind(value);
} });
export const ShowCurrentGame: any = new Proxy({}, { get(_target, key) {
    const value = find(value => value?.bedrockGameActivityGroup === 'status' && value?.bedrockGameActivityName === 'showCurrentGame');
    return value[key].bind(value);
} });
export const Menu: any = new Proxy({}, { get: (_target, key) => find(value => value?.MenuCheckboxItem && value?.Menu)[key] });
export function Popout(props: any): any { return React.createElement(find(value => value?.Popout && value?.Tooltip).Popout, props); }
export const Button: any = { $$typeof: Symbol.for('react.forward_ref'), render(props: any, ref: any): any {
    const Native = find(value => (typeof value === 'function' || typeof value?.render === 'function') && String(value.render ?? value).includes('.GREEN,positionKeyStemOverride:'));
    return React.createElement(Native, { ...props, ref });
} };
export function normalizePatches(): SourcePatch[] {
    const definitions = [{ find: '5fWB8U', replacement: [
        { match: /children:\[(?=.{0,50}accountContainerRef:\i)/, replace: 'children:[$self.renderButton(arguments[0]),' },
        { match: /(?<=\{ref:\i,)style:(\i)/, replace: 'style:{...$1,minWidth:0}' }
    ] }, { find: ',updateSetting:', replacement: [
        { match: /\.updateAsync\(.+?(?=,useSetting:)/, replace: '$&,bedrockGameActivityGroup:arguments[0],bedrockGameActivityName:arguments[1]' },
        { match: /updateSetting:.{0,100}SELECTIVELY_SYNCED_USER_SETTINGS_UPDATE/, replace: 'bedrockGameActivityGroup:arguments[0].bedrockGameActivityGroup,bedrockGameActivityName:arguments[0].bedrockGameActivityName,$&' },
        { match: /updateSetting:.{0,60}USER_SETTINGS_OVERRIDE_CLEAR/, replace: 'bedrockGameActivityGroup:arguments[0].bedrockGameActivityGroup,bedrockGameActivityName:arguments[0].bedrockGameActivityName,$&' }
    ] }];
    return definitions.map((patch, index) => ({ id: `game-activity-${index}`, find: patch.find, replacement: {
        match: /^[\s\S]*$/, replace(source: string): string {
            for (const replacement of patch.replacement) {
                const match = new RegExp(replacement.match.source.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)'), replacement.match.flags);
                if (!match.test(source)) throw new Error(`Game Activity Toggle replacement did not match: ${replacement.match}`);
                source = source.replace(match, replacement.replace);
            }
            return source;
        }
    } }));
}
