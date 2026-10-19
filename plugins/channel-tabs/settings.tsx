/* Copyright (c) 2026 Bedrock contributors. SPDX-License-Identifier: GPL-3.0-or-later */
import type { RendererSettingsContext } from '@bedrock/renderer';
import { React, ErrorBoundary, editorContext, getContext, loadStyles } from './discord.js';

export function definePluginSettings(definitions: Record<string, any>): any {
    const visible: Record<string, any> = {}, hidden: Record<string, any> = {}, components: [string, any][] = [];
    for (const [key, source] of Object.entries(definitions)) {
        if (source.type === 'component') { components.push([key, source]); if (source.default !== undefined) hidden[key] = source; continue; }
        const definition = { ...source };
        definition.label ||= key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().replace(/^./, (letter: string) => letter.toUpperCase());
        if (definition.type === 'select') {
            definition.default ??= source.options.find((option: any) => option.default)?.value ?? source.options[0].value;
            definition.options = source.options.map(({ label, value }: any) => ({ label, value }));
        }
        if (definition.type === 'slider') {
            definition.min = Math.min(...source.markers);
            definition.max = Math.max(...source.markers);
            definition.step = 1;
        }
        if (source.hidden) hidden[key] = definition;
        else visible[key] = definition;
    }
    visible.onStartup.label = 'Startup behavior';
    visible.showStatusIndicators.label = 'DM status indicators';
    visible.rapidNavigationThreshold.label = 'Rapid navigation window';
    const settings: any = Bedrock.definePluginSettings(visible);
    const originalStore = settings.store, originalUse = settings.use, originalSet = settings.set;
    const pending = new Map<string, any>();
    const value = (key: string): any => {
        if (!Object.hasOwn(hidden, key)) return originalStore[key];
        if (pending.has(key)) return pending.get(key);
        const result = getContext().settings.get(key, hidden[key].default);
        return result !== null && typeof result === typeof hidden[key].default ? result : structuredClone(hidden[key].default);
    };
    const set = (key: string, next: any): Promise<void> => {
        if (!Object.hasOwn(hidden, key)) return originalSet(key, next);
        const ctx = getContext(), copy = structuredClone(next);
        if (copy === null || typeof copy !== typeof hidden[key].default || typeof copy === 'number' && !Number.isFinite(copy))
            return Promise.reject(new Error(`Invalid value for ${key}`));
        pending.set(key, copy);
        return ctx.settings.set(key, copy).finally(() => { if (pending.get(key) === copy) pending.delete(key); });
    };
    settings.store = new Proxy({}, {
        get(_target, key) { return typeof key === 'string' ? value(key) : undefined; },
        set(_target, key: string, next) { void set(key, next).catch(error => getContext().log.error(error)); return true; },
        ownKeys() { return [...Object.keys(visible), ...Object.keys(hidden)]; },
        getOwnPropertyDescriptor() { return { enumerable: true, configurable: true }; }
    });
    settings.set = set;
    settings.use = (keys: string[]): any => {
        originalUse(keys.filter(key => Object.hasOwn(visible, key)));
        const [, refresh] = React.useState(0);
        const ctx = getContext();
        React.useEffect(() => ctx.events.on('settings.changed', (event: any) => { if (event.id === ctx.id) refresh(value => value + 1); }), [ctx]);
        return Object.fromEntries(keys.map(key => [key, value(key)]));
    };
    Object.defineProperty(settings, '_editors', { value: components });
    Object.defineProperty(settings, '_hiddenKeys', { value: Object.keys(hidden) });
    return settings;
}

export function renderCustomSettings(ctx: RendererSettingsContext, settings: any): any {
    editorContext(ctx);
    settings.use(settings._hiddenKeys);
    React.useEffect(() => { loadStyles(ctx); }, [ctx]);
    return <ErrorBoundary>{settings._editors.map(([key, definition]: [string, any]) =>
        <div key={key} className="bedrock-ct-custom-settings">
            {React.createElement(definition.component, { setValue: (value: any) => settings.set(key, value), value: settings.store[key] })}
        </div>)}</ErrorBoundary>;
}
