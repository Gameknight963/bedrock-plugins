/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { MenuChild, MenuElement, RendererContext, SourcePatch } from '@bedrock/renderer';

declare global { namespace JSX { interface IntrinsicElements { [tag: string]: any } } }
interface Guild { id: string; name: string; ownerId: string }
interface Role { id: string; name: string; position: number; permissions: bigint; colorString?: string }
interface Member { userId: string; nick?: string; roles: string[] }
interface Permission { id?: string; type: number; permissions?: bigint; overwriteAllow?: bigint; overwriteDeny?: bigint }
interface Spec { title: string; description?: string | ((...args: any[]) => unknown) }
let context: RendererContext, React: any, Boundary: any;
let preparation: Promise<void> | undefined;
const modals = new Map<string, () => void>();
const popouts = new Set<() => void>();
export const settings = Bedrock.definePluginSettings({
    permissionsSortOrder: { type: Bedrock.OptionType.SELECT, label: 'Permissions Sort Order',
        description: 'Choose which role is shown as granting a permission.', default: 0,
        options: [{ label: 'Highest Role', value: 0 }, { label: 'Lowest Role', value: 1 }] }
});
export const patches: SourcePatch[] = [{ id: 'profile-permissions', find: 'XnXtCt', replacement: {
    match: /(?<=[A-Za-z_$][\w$]*\.id\)\),[A-Za-z_$][\w$]*\(\))(?=,[A-Za-z_$][\w$]*\?)/,
    replace: ',$self.ViewPermissionsButton(arguments[0])'
} }];

function find<T = any>(predicate: (value: any) => boolean, name: string): T {
    const value = context.webpack.find<T>(predicate);
    if (!value) throw new Error(`Discord's ${name} is not available yet.`);
    return value;
}
function byCode(name: string, ...parts: string[]): any {
    return find(value => typeof value === 'function' && parts.every(part => Function.prototype.toString.call(value).includes(part)), name);
}
function store(name: string): any { return find(value => value?.getName?.() === name, name); }
function bits(): bigint[] {
    const values = find<Record<string, unknown>>(value => typeof value?.ADMINISTRATOR === 'bigint' && typeof value?.VIEW_CHANNEL === 'bigint', 'permission flags');
    return [...new Set(Object.values(values).filter((value): value is bigint => typeof value === 'bigint'))];
}
function specs(guild: Guild): Record<string, Spec> {
    return find(value => typeof value?.getGuildPermissionSpecMap === 'function', 'permission descriptions').getGuildPermissionSpecMap(guild);
}
function active(activation: RendererContext): void {
    if (activation !== context || activation.signal.aborted) throw new DOMException('Permissions Viewer was disabled.', 'AbortError');
}
async function prepare(): Promise<void> {
    const activation = context;
    active(activation);
    if (context.webpack.find(value => typeof value?.getGuildPermissionSpecMap === 'function')) return;
    if (!preparation) {
        const work = context.webpack.loadChunks({ find: '.PRIMARY,badgeTooltipDelay:' }).then(() => {
            active(activation);
            find(value => typeof value?.getGuildPermissionSpecMap === 'function', 'permission descriptions');
        });
        preparation = work;
        work.catch(() => { if (preparation === work) preparation = undefined; });
    }
    await preparation;
    active(activation);
}
function notifyError(error: unknown): void {
    if (!context.signal.aborted) context.notifications.show({ title: 'Could not show permissions', type: 'error', body: error instanceof Error ? error.message : String(error) });
}
function Tooltip({ text, children, ...props }: any): MenuElement {
    const Component = find(value => typeof value?.prototype?.shouldShowTooltip === 'function' && typeof value?.prototype?.render === 'function', 'tooltip');
    return <Component text={text} {...props}>{children}</Component>;
}
function Shield(props: any = {}): MenuElement {
    return <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" {...props}><path fill="currentColor" d="M12 2 3 6v6c0 5 6 9 9 10 3-1 9-5 9-10V6l-9-4Zm0 3 6 3v4c0 3-3.5 6-6 7.5C9.5 18 6 15 6 12V8l6-3Z" /></svg>;
}
function PermissionIcon({ allowed }: { allowed: boolean }): MenuElement {
    return <svg height="24" width="24" viewBox="0 0 24 24"><title>{allowed ? 'Allowed' : 'Denied'}</title><path fill={allowed ? 'var(--status-positive)' : 'var(--status-danger)'} d={allowed ? 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41Z' : 'M18.4 4 12 10.4 5.6 4 4 5.6 10.4 12 4 18.4 5.6 20 12 13.6 18.4 20 20 18.4 13.6 12 20 5.6Z'} /></svg>;
}
function rolePermissions(guild: Guild, member: Member): Permission[] {
    const result: Permission[] = store('GuildRoleStore').getSortedRoles(guild.id)
        .filter((role: Role) => role.id === guild.id || member.roles.includes(role.id)).map((role: Role) => ({ ...role, type: 0 }));
    if (guild.ownerId === member.userId) result.push({ type: 2, permissions: bits().reduce((a, b) => a | b, 0n) });
    return result;
}
export function grantedPermissions(guild: Guild, member: Member): { permission: string; roleName: string; roleColor: string; rolePosition: number }[] {
    const descriptions = specs(guild);
    const roles: Role[] = store('GuildRoleStore').getSortedRoles(guild.id).filter((role: Role) => role.id === guild.id || member.roles.includes(role.id));
    roles.sort((a, b) => settings.store.permissionsSortOrder === 0 ? b.position - a.position : a.position - b.position);
    const granted = guild.ownerId === member.userId ? [{ permission: 'Server Owner', roleName: 'Owner', roleColor: 'var(--primary-300)', rolePosition: Infinity }] : [];
    for (const bit of bits()) {
        const role = roles.find(role => (role.permissions & bit) === bit);
        if (role && descriptions[String(bit)]) granted.push({ permission: descriptions[String(bit)].title, roleName: role.name,
            roleColor: role.colorString || 'var(--primary-300)', rolePosition: role.position });
    }
    return granted.sort((a, b) => b.rolePosition - a.rolePosition);
}
function RolePill({ text, color, ...props }: any): MenuElement {
    const classes = find(value => ['role', 'roleName', 'roleRemoveButton', 'roleNameOverflow', 'root'].every(key => typeof value?.[key] === 'string'), 'role styles');
    const border = find(value => typeof value?.roleCircle === 'string' && typeof value?.dotBorderColor === 'string', 'role color styles');
    return <div {...props} className={classes.role}><div className={classes.roleRemoveButton}><span className={border.roleCircle} style={{ backgroundColor: color }} /></div>
        <div className={classes.roleName}><span className={classes.roleNameOverflow} style={{ fontSize: 12, fontWeight: 500 }}>{text}</span></div></div>;
}
function UserPermissions({ guild, member, closePopout }: { guild: Guild; member: Member; closePopout(): void }): MenuElement {
    const { permissionsSortOrder } = settings.use(['permissionsSortOrder']);
    const granted = grantedPermissions(guild, member);
    return <div><div className="vc-permviewer-user-header-container"><h3 className="bedrock-permviewer-heading">Permissions</h3>
        <div className="vc-permviewer-user-header-btns">
            <Tooltip text={`Sorting by ${permissionsSortOrder === 0 ? 'Highest Role' : 'Lowest Role'}`}>
                {(props: any) => <button {...props} className="vc-permviewer-user-header-btn" aria-label="Change role sorting" onClick={() => { settings.store.permissionsSortOrder = permissionsSortOrder === 0 ? 1 : 0; }}>
                    <svg width="24" height="24" viewBox="0 96 960 960" transform={permissionsSortOrder === 0 ? 'scale(1 1)' : 'scale(1 -1)'}><path fill="currentColor" d="M440 896V409L216 633l-56-57 320-320 320 320-56 57-224-224v487h-80Z" /></svg>
                </button>}
            </Tooltip>
            <Tooltip text="Role Details">{(props: any) => <button {...props} className="vc-permviewer-user-header-btn" aria-label="Role Details" onClick={() => {
                closePopout(); void openPermissions(rolePermissions(guild, member), guild, member.nick || store('UserStore').getUser(member.userId)?.username || member.userId);
            }}><svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M5 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" /></svg></button>}</Tooltip>
        </div></div>
        <div className={find(value => typeof value?.roleNameOverflow === 'string' && typeof value?.root === 'string', 'role styles').root}>
            {granted.map(item => <Tooltip key={item.permission} text={<div className="vc-permviewer-granted-by-content"><span>Granted By</span><RolePill text={item.roleName} color={item.roleColor} /></div>} tooltipClassName="vc-permviewer-granted-by-container">
                {(props: any) => <RolePill {...props} text={item.permission} color={item.roleColor} />}</Tooltip>)}
        </div></div>;
}
function ProfileButton({ className, guild, userId }: { className: string; guild: Guild; userId: string }): MenuElement | null {
    const buttonRef = React.useRef(null);
    const [ready, setReady] = React.useState(false), [error, setError] = React.useState('');
    React.useEffect(() => {
        let mounted = true;
        void prepare().then(() => { if (mounted) setReady(true); }, reason => { if (mounted && !context.signal.aborted) setError(String(reason.message)); });
        return () => { mounted = false; };
    }, []);
    const member = store('GuildMemberStore').getMember(guild.id, userId);
    if (!member) return null;
    const Popout = byCode('popout', 'ref:this.ref,', 'renderPopout:this.renderPopout,');
    const Dialog = byCode('dialog', 'role:"dialog",tabIndex:-1');
    const classes = find(value => typeof value?.container === 'string' && typeof value?.popoutRoleDot === 'string', 'profile popout styles');
    return <Popout position="bottom" align="center" targetElementRef={buttonRef} renderPopout={({ closePopout }: any) =>
        <PermissionPopout closePopout={closePopout}><Dialog className={classes.container} style={{ width: 500 }}>
            {ready ? <UserPermissions guild={guild} member={member} closePopout={closePopout} /> : <p role={error ? 'alert' : 'status'}>{error || 'Loading permissions…'}</p>}
        </Dialog></PermissionPopout>}>
        {(props: any) => <Tooltip text="View Permissions">{(tooltipProps: any) => <button {...props} {...tooltipProps} ref={buttonRef} className={`${className || ''} vc-permviewer-role-button`} aria-label="View Permissions"><Shield /></button>}</Tooltip>}
    </Popout>;
}
function PermissionPopout({ closePopout, children }: any): MenuElement {
    React.useEffect(() => { popouts.add(closePopout); return () => { popouts.delete(closePopout); }; }, [closePopout]);
    return children;
}
export function ViewPermissionsButton(props: any): MenuElement | null {
    if (!context || context.signal.aborted) return null;
    return <Boundary><ProfileButton {...props} /></Boundary>;
}
function description(spec: Spec): unknown {
    if (typeof spec.description !== 'function') return spec.description || '';
    return find(value => typeof value?.intl?.format === 'function', 'localization').intl.format(spec.description, {});
}
function copyId(event: any, id: string, type: string): void {
    event.preventDefault();
    const menus = find(value => typeof value?.Menu === 'function' && value?.MenuItem && value?.MenuGroup, 'menu components');
    const actions = find(value => typeof value?.openContextMenu === 'function' && typeof value?.closeContextMenu === 'function', 'context menus');
    actions.openContextMenu(event, () => <menus.Menu navId="bedrock-permissions-id" onClose={actions.closeContextMenu} aria-label={`${type} Options`}>
        <menus.MenuItem id="copy-permission-id" label={`Copy ${type} ID`} action={() => { void navigator.clipboard.writeText(id).catch(notifyError); }} />
    </menus.Menu>);
}
function PermissionsDialog({ permissions, guild }: { permissions: Permission[]; guild: Guild }): MenuElement {
    const [selected, select] = React.useState(0);
    const memberStore = store('GuildMemberStore');
    React.useEffect(() => {
        const missing = permissions.filter(permission => permission.type === 1 && permission.id && !memberStore.isMember(guild.id, permission.id)).map(permission => permission.id);
        if (missing.length) find(value => typeof value?.dispatch === 'function' && typeof value?.subscribe === 'function', 'dispatcher')
            .dispatch({ type: 'GUILD_MEMBERS_REQUEST', guildIds: [guild.id], userIds: missing });
    }, []);
    const [, refresh] = React.useReducer((value: number) => value + 1, 0);
    React.useEffect(() => {
        memberStore.addChangeListener(refresh);
        return () => memberStore.removeChangeListener(refresh);
    }, [memberStore]);
    const roles = store('GuildRoleStore').getRolesSnapshot(guild.id), users = store('UserStore');
    const descriptions = specs(guild), item = permissions[selected];
    if (!item) return <div className="vc-permviewer-modal-no-perms">No permissions to display!</div>;
    const roleIcon = context.webpack.find<any>(value => typeof value === 'function' && ['convertSurrogateToName', 'customIconSrc', 'unicodeEmoji'].every(part => String(value).includes(part)));
    return <div className="vc-permviewer-modal-container"><div className="vc-permviewer-modal-list">
        {permissions.map((permission, index) => {
            const role = roles[permission.id || ''], user = users.getUser(permission.id || '');
            const icon = role && roleIcon?.(role, 20), src = icon?.customIconSrc || icon?.unicodeEmoji?.url;
            return <button key={`${permission.type}:${permission.id || 'owner'}`} className={`vc-permviewer-modal-list-item vc-permviewer-modal-list-item-btn${index === selected ? ' vc-permviewer-modal-list-item-active' : ''}`}
                aria-pressed={index === selected} onClick={() => select(index)} onContextMenu={permission.id ? (event: any) => copyId(event, permission.id!, permission.type === 0 ? 'Role' : 'User') : undefined}>
                {permission.type !== 1 && <span className="vc-permviewer-modal-role-circle" style={{ backgroundColor: role?.colorString || 'var(--primary-300)' }} />}
                {permission.type === 0 && src && <img className="vc-permviewer-modal-role-image" src={src} alt="" />}
                {permission.type === 1 && user && <img className="vc-permviewer-modal-user-img" src={user.getAvatarURL(undefined, undefined, false)} alt="" />}
                <span className="vc-permviewer-modal-list-item-text">{permission.type === 0 ? role?.name || 'Unknown Role' : permission.type === 1 ? user?.globalName || user?.username || 'Unknown User' : <span>@owner <span aria-label="Server Owner">♛</span></span>}</span>
            </button>;
        })}
    </div><div className="vc-permviewer-modal-divider" /><div className="vc-permviewer-modal-perms">
        {bits().map(bit => {
            const allowed = item.permissions !== undefined ? (item.permissions & bit) === bit : !!item.overwriteAllow && (item.overwriteAllow & bit) === bit;
            const denied = item.permissions !== undefined ? !allowed : !!item.overwriteDeny && (item.overwriteDeny & bit) === bit;
            const spec = descriptions[String(bit)];
            if ((!allowed && !denied) || !spec) return null;
            return <div key={String(bit)} className="vc-permviewer-modal-perms-item"><div className="vc-permviewer-modal-perms-item-icon"><PermissionIcon allowed={allowed} /></div>
                <span>{spec.title}</span><Tooltip text={description(spec)}>{(props: any) => <svg {...props} className="vc-info-icon" aria-label={`About ${spec.title}`} width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 16h-2v-7h2v7Zm0-9h-2V6h2v3Z" /></svg>}</Tooltip>
            </div>;
        })}
    </div></div>;
}
export async function openPermissions(permissions: Permission[], guild: Guild, header: string): Promise<void> {
    const activation = context;
    try {
        await prepare(); active(activation);
        const Modal = byCode('modal', 'leadingLayout:', 'actions:', '.message');
        const open = byCode('modal opener', ',instant:'), close = byCode('modal closer', '.onCloseCallback()');
        const sorted = [...permissions].sort((a, b) => a.type - b.type);
        const key: string = open((props: any) => <Boundary><Modal {...props} title={`${header} Permissions`} size="xl"><PermissionsDialog permissions={sorted} guild={guild} /></Modal></Boundary>, { onCloseCallback() { modals.delete(key); } });
        modals.set(key, () => close(key));
    } catch (error) { if (activation === context && !activation.signal.aborted) notifyError(error); }
}
function insert(children: MenuChild[], ids: string[], item: MenuElement): boolean {
    for (const child of children) {
        if (Array.isArray(child)) { if (insert(child, ids, item)) return true; }
        else if (context.react.isValidElement(child) && Array.isArray(child.props.children)) {
            const group = child.props.children;
            if (group.some((value: any) => ids.includes(value?.props?.id))) { group.push(item); return true; }
            if (insert(group, ids, item)) return true;
        }
    }
    if (children.some(child => context.react.isValidElement(child) && typeof child.props.id === 'string' && ids.includes(child.props.id))) { children.push(item); return true; }
    return false;
}
export function start(ctx: RendererContext): void {
    context = ctx; preparation = undefined;
    // Source-patched components may be called before React has executed its module.
    React = new Proxy({}, { get(_target, key) { return (context.react as any)[key]; } });
    let NativeBoundary: any;
    Boundary = (props: any) => {
        NativeBoundary ||= class extends React.Component {
            state = { failed: false };
            static getDerivedStateFromError() { return { failed: true }; }
            componentDidCatch(error: unknown) { context.log.error(error); }
            render() { return this.state.failed ? null : this.props.children; }
        };
        return React.createElement(NativeBoundary, props);
    };
    for (const [navId, type, anchors] of [
        ['user-context', 'user', ['roles']], ['channel-context', 'channel', ['mute-channel', 'unmute-channel']],
        ['guild-context', 'guild', ['privacy']], ['guild-header-popout', 'guild', ['privacy']]
    ] as const) ctx.contextMenus.patch(navId, (children, props: any) => {
        const guildId = props.guildId || props.guild?.id || props.channel?.guild_id;
        if (!guildId || (type === 'user' && !props.user) || (type === 'channel' && !props.channel)) return;
        const guild: Guild = store('GuildStore').getGuild(guildId);
        if (!guild) return;
        const member: Member | undefined = type === 'user' ? store('GuildMemberStore').getMember(guildId, props.user.id) : undefined;
        if (type === 'user' && !member) return;
        const item = ctx.contextMenus.item({ id: 'perm-viewer-permissions', label: 'View Permissions', ...(navId === 'guild-header-popout' ? { icon: Shield } : {}), action() {
            let permissions: Permission[], header: string;
            if (type === 'user') { permissions = rolePermissions(guild, member!); header = member!.nick || props.user.username; }
            else if (type === 'channel') {
                const roles = store('GuildRoleStore').getRolesSnapshot(guild.id);
                permissions = Object.values(props.channel.permissionOverwrites || {}).map((overwrite: any) => ({ id: overwrite.id, type: overwrite.type, overwriteAllow: overwrite.allow, overwriteDeny: overwrite.deny }))
                    .sort((a, b) => a.type - b.type || (a.type === 0 ? (roles[b.id]?.position ?? -Infinity) - (roles[a.id]?.position ?? -Infinity) : 0));
                header = props.channel.name;
            } else { permissions = store('GuildRoleStore').getSortedRoles(guild.id).map((role: Role) => ({ ...role, type: 0 })); header = guild.name; }
            return openPermissions(permissions, guild, header);
        } });
        if (!insert(children, [...anchors], item)) children.splice(Math.max(0, children.length - 1), 0, item);
    });
    void fetch(new URL('./styles.css', import.meta.url), { signal: ctx.signal }).then(response => {
        if (!response.ok) throw new Error(`Could not load permission styles (${response.status}).`);
        return response.text();
    }).then(css => { if (!ctx.signal.aborted && context === ctx) ctx.styles.add(css); }).catch(error => { if (!ctx.signal.aborted) ctx.log.error(error); });
}
export function stop(): void {
    for (const close of [...modals.values()]) close(); modals.clear();
    for (const close of [...popouts]) close(); popouts.clear();
    preparation = undefined;
}
