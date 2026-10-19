/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-18. See NOTICE. */
import type { RendererContext } from '@bedrock/renderer';

export function start(ctx: RendererContext): void {
    function LinkIcon() {
        return ctx.react.createElement('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
            ctx.react.createElement('path', { d: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2' }));
    }
    ctx.contextMenus.patch<{ user?: { id: string } }>('user-context', (children, { user }) => {
        if (!user) return;
        children.push(ctx.contextMenus.item({ id: 'bedrock-copy-user-url', label: 'Copy User URL',
            leadingAccessory: { type: 'icon', icon: LinkIcon },
            action() { navigator.clipboard.writeText(`<https://discord.com/users/${user.id}>`).catch(ctx.log.error); } }));
    });
}
