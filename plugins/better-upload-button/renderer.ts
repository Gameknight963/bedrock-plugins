/* Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { SourcePatch } from '@bedrock/renderer';

const identifier = '[A-Za-z_$][\\w$]*';
export const patches: SourcePatch[] = [{ id: 'attachment-button-clicks', find: '.CHAT_INPUT_BUTTON_NOTIFICATION,', replacement: {
    match: new RegExp(String.raw`onClick:(\i\?void 0:\i)(?=,onDoubleClick:(\i\?void 0:\i),)`.replaceAll('\\i', identifier)),
    replace: '$&,...$self.getOverrides(arguments[0],$1,$2)'
} }];

export function getOverrides(props: { className?: string } | undefined, onClick: unknown, onDoubleClick: unknown): object {
    if (!props?.className?.includes('attachButton')) return {};
    return { onClick: onDoubleClick, onContextMenu: onClick };
}

export function start(): void {}
