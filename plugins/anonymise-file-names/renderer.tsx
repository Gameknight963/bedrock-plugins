/* Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';
declare global { namespace JSX { interface IntrinsicElements { [tag: string]: any } interface IntrinsicAttributes { key?: string | number } } }
let context: RendererContext | undefined, Boundary: any;
let originals = new WeakMap<object, string>();
const ANONYMISE_UPLOAD_SYMBOL = Symbol('BedrockAnonymousFilename');
interface CloudUpload { filename: string; spoiler?: boolean; [ANONYMISE_UPLOAD_SYMBOL]?: boolean }
const React: RendererContext['react'] = new Proxy({} as RendererContext['react'], { get(_target, key: keyof RendererContext['react']) {
    if (key === 'Fragment') return context?.react.Fragment;
    return (...args: unknown[]) => {
        if (!context) throw new Error('Anonymise File Names is disabled.');
        return Reflect.apply(context.react[key] as Function, context.react, args);
    };
} });
const useState = React.useState;
const Methods = { Random: 0, Consistent: 1, Timestamp: 2, Date: 3 };
export const tarExtMatcher = /\.tar\.\w+$/i;
export const settings = Bedrock.definePluginSettings({
    anonymiseByDefault: { type: Bedrock.OptionType.BOOLEAN, label: 'Anonymise by default', description: 'Use anonymous names for new uploads.', default: true },
    spoilerMessages: { type: Bedrock.OptionType.BOOLEAN, label: 'Mark uploads as spoilers', description: 'Prefix uploaded filenames with SPOILER_.', default: false },
    method: { type: Bedrock.OptionType.SELECT, label: 'Naming method', default: 0, options: [
        { label: 'Random Characters', value: 0 }, { label: 'Consistent', value: 1 }, { label: 'Timestamp', value: 2 }, { label: 'Date', value: 3 }] },
    randomisedLength: { type: Bedrock.OptionType.NUMBER, label: 'Random name length', description: 'Number of characters when using Random Characters.', default: 7, min: 1, max: 255, step: 1 },
    consistent: { type: Bedrock.OptionType.STRING, label: 'Consistent filename', description: 'Filename to use with the Consistent method, before the extension.', default: 'image' },
    dateFormat: { type: Bedrock.OptionType.STRING, label: 'Date format', description: 'Used by the Date method. Supported tokens: YYYY, MM, DD, HH, mm, ss, SSS.', default: 'YYYY-MM-DD_HH-mm-ss-SSS' }
});
function native(predicate: (value: any) => boolean, name: string): any {
    const value = context?.webpack.find(predicate);
    if (!value) throw new Error(`Discord's ${name} is not available.`);
    return value;
}
function ActionBarIcon(props: any): any { return React.createElement(native(value => typeof value === 'function' && ['Children.map', 'isValidElement', 'dangerous:'].every(part => String(value).includes(part)), 'attachment action button'), props); }
function wrap(Component: any, _options?: unknown): any {
    return (props: any) => {
        const NativeReact = context!.react as any;
        Boundary ||= class extends NativeReact.Component {
            state = { failed: false };
            static getDerivedStateFromError() { return { failed: true }; }
            componentDidCatch(error: unknown) { context?.log.error('Could not display the upload filename toggle.', error); }
            render() { return this.state.failed ? null : this.props.children; }
        };
        return React.createElement(Boundary, null, React.createElement(Component, props));
    };
}
const ToggleButton = wrap(({ upload }: { upload: CloudUpload; }) => {
        const { anonymiseByDefault } = settings.use(['anonymiseByDefault']);
        const [choice, setChoice] = useState<boolean | undefined>(upload[ANONYMISE_UPLOAD_SYMBOL]);
        const anonymise = choice ?? anonymiseByDefault;

        function onToggleAnonymise() {
            upload[ANONYMISE_UPLOAD_SYMBOL] = !anonymise;
            setChoice(!anonymise);
        }

        return (
            <ActionBarIcon
                tooltip={anonymise ? "Using anonymous file name" : "Using normal file name"}
                onClick={onToggleAnonymise}
            >
                {anonymise
                    ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M17.06 13C15.2 13 13.64 14.33 13.24 16.1C12.29 15.69 11.42 15.8 10.76 16.09C10.35 14.31 8.79 13 6.94 13C4.77 13 3 14.79 3 17C3 19.21 4.77 21 6.94 21C9 21 10.68 19.38 10.84 17.32C11.18 17.08 12.07 16.63 13.16 17.34C13.34 19.39 15 21 17.06 21C19.23 21 21 19.21 21 17C21 14.79 19.23 13 17.06 13M6.94 19.86C5.38 19.86 4.13 18.58 4.13 17S5.39 14.14 6.94 14.14C8.5 14.14 9.75 15.42 9.75 17S8.5 19.86 6.94 19.86M17.06 19.86C15.5 19.86 14.25 18.58 14.25 17S15.5 14.14 17.06 14.14C18.62 14.14 19.88 15.42 19.88 17S18.61 19.86 17.06 19.86M22 10.5H2V12H22V10.5M15.53 2.63C15.31 2.14 14.75 1.88 14.22 2.05L12 2.79L9.77 2.05L9.72 2.04C9.19 1.89 8.63 2.17 8.43 2.68L6 9H18L15.56 2.68L15.53 2.63Z" /></svg>
                    : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style={{ transform: "scale(-1,1)" }}><path fill="currentColor" d="M22.11 21.46L2.39 1.73L1.11 3L6.31 8.2L6 9H7.11L8.61 10.5H2V12H10.11L13.5 15.37C13.38 15.61 13.3 15.85 13.24 16.1C12.29 15.69 11.41 15.8 10.76 16.09C10.35 14.31 8.79 13 6.94 13C4.77 13 3 14.79 3 17C3 19.21 4.77 21 6.94 21C9 21 10.68 19.38 10.84 17.32C11.18 17.08 12.07 16.63 13.16 17.34C13.34 19.39 15 21 17.06 21C17.66 21 18.22 20.86 18.72 20.61L20.84 22.73L22.11 21.46M6.94 19.86C5.38 19.86 4.13 18.58 4.13 17C4.13 15.42 5.39 14.14 6.94 14.14C8.5 14.14 9.75 15.42 9.75 17C9.75 18.58 8.5 19.86 6.94 19.86M17.06 19.86C15.5 19.86 14.25 18.58 14.25 17C14.25 16.74 14.29 16.5 14.36 16.25L17.84 19.73C17.59 19.81 17.34 19.86 17.06 19.86M22 12H15.2L13.7 10.5H22V12M17.06 13C19.23 13 21 14.79 21 17C21 17.25 20.97 17.5 20.93 17.73L19.84 16.64C19.68 15.34 18.66 14.32 17.38 14.17L16.29 13.09C16.54 13.03 16.8 13 17.06 13M12.2 9L7.72 4.5L8.43 2.68C8.63 2.17 9.19 1.89 9.72 2.04L9.77 2.05L12 2.79L14.22 2.05C14.75 1.88 15.32 2.14 15.54 2.63L15.56 2.68L18 9H12.2Z" /></svg>
                }
            </ActionBarIcon>
        );
    }, { noop: true });

const identifier = '[A-Za-z_$][\\w$]*';
export const patches: SourcePatch[] = [
    { id: 'rename-uploaded-files', find: 'async uploadFiles(', replacement: {
        match: new RegExp(`async uploadFiles\\((${identifier})\\)\\{`), replace: '$&$1.forEach($self.anonymise);'
    } },
    { id: 'upload-filename-toggle', find: '.cuurzA', replacement: {
        match: /(?<=children:\[)(?=.{10,80}tooltip:.{0,100}cuurzA)/,
        replace: 'arguments[0].canEdit!==false?$self.AnonymiseUploadButton(arguments[0]):null,'
    } }
];
export function AnonymiseUploadButton(props: { upload: CloudUpload }): any {
    return context && !context.signal.aborted ? React.createElement(ToggleButton, props) : null;
}
export function setUploadAnonymised(upload: CloudUpload, value: boolean): void { upload[ANONYMISE_UPLOAD_SYMBOL] = value; }
export function anonymise(upload: CloudUpload): void {
    if (!context || context.signal.aborted || !upload || typeof upload.filename !== 'string') return;
    const original = originals.get(upload) ?? upload.filename;
    originals.set(upload, original);
    const tar = tarExtMatcher.exec(original), index = tar?.index ?? original.lastIndexOf('.');
    const extension = index > 0 ? original.slice(index) : '';
    const markSpoiler = settings.store.spoilerMessages || upload.spoiler === true || original.startsWith('SPOILER_');
    const spoiler = (name: string) => markSpoiler && !name.startsWith('SPOILER_') ? `SPOILER_${name}` : name;
    if ((upload[ANONYMISE_UPLOAD_SYMBOL] ?? settings.store.anonymiseByDefault) === false) { upload.filename = spoiler(original); return; }
    let name: string;
    switch (settings.store.method) {
        case Methods.Consistent: name = settings.store.consistent; break;
        case Methods.Timestamp: name = Date.now().toString(); break;
        case Methods.Date: {
            const now = new Date();
            const tokens: Record<string, string> = { YYYY: String(now.getFullYear()), MM: String(now.getMonth() + 1).padStart(2, '0'), DD: String(now.getDate()).padStart(2, '0'),
                HH: String(now.getHours()).padStart(2, '0'), mm: String(now.getMinutes()).padStart(2, '0'), ss: String(now.getSeconds()).padStart(2, '0'), SSS: String(now.getMilliseconds()).padStart(3, '0') };
            name = settings.store.dateFormat.replace(/YYYY|MM|DD|HH|mm|ss|SSS/g, token => tokens[token]) || Date.now().toString();
            break;
        }
        default: {
            const chars = '0123456789bdfhjkmnpqrstvwxz';
            const length = Math.max(1, Math.min(255, Math.floor(settings.store.randomisedLength)));
            name = Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        }
    }
    upload.filename = spoiler(name + extension);
}
function localStatus(channelId: string, content: string): void {
    const create = native(value => typeof value === 'function' && /username:\s*["']Clyde["']/.test(String(value)), 'local message factory');
    const actions = native(value => typeof value?.receiveMessage === 'function' && typeof value?.sendMessage === 'function', 'message actions');
    actions.receiveMessage(channelId, { ...create({ channelId, content: '', embeds: [] }), content });
}
export function start(ctx: RendererContext): void {
    context = ctx;
    ctx.commands.register({ name: 'spoiler-uploads', description: 'Toggle spoiler filenames for uploaded files', options: [{ name: 'value', description: 'Enable or disable spoiler filenames (omit to toggle)', type: 'boolean' }],
        async execute(values, command) {
            const value = typeof values.value === 'boolean' ? values.value : !settings.store.spoilerMessages;
            await settings.set('spoilerMessages', value);
            if (ctx.signal.aborted) return;
            if (command.channelId) localStatus(command.channelId, value ? 'Spoiler enabled!' : 'Spoiler disabled!');
            else ctx.notifications.show({ title: value ? 'Spoiler enabled!' : 'Spoiler disabled!', type: 'success' });
        }
    });
}
export function stop(): void { context = undefined; originals = new WeakMap(); }
