/* Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-18. See NOTICE. */
import type { RendererContext, SourcePatch } from '@bedrock/renderer';

export const patches: SourcePatch[] = [{ id: 'display-indentation', find: 'inQuote:',
    replacement: { match: /,content:([^,]+),inQuote/, replace: ',content:$self.unindent($1),inQuote' } }];

export function unindent(text: string): string {
    text = text.replace(/\t/g, '    ');
    const indent = text.match(/^ *(?=\S)/gm)?.reduce((minimum, spaces) => Math.min(minimum, spaces.length), Infinity) ?? 0;
    return indent && Number.isFinite(indent) ? text.replace(new RegExp(`^ {${indent}}`, 'gm'), '') : text;
}

export function unindentMessage(content: string): string {
    return content.replace(/```[\s\S]*?```/g, block => {
        const lines = block.split('\n');
        if (lines.length < 2) return block;
        const suffix = lines.at(-1) === '```' ? lines.pop() : '';
        return `${lines[0]}\n${unindent(lines.slice(1).join('\n'))}\n${suffix}`;
    });
}

export function start(ctx: RendererContext): void {
    ctx.messages.beforeSend(event => { event.message.content = unindentMessage(event.message.content); });
    ctx.messages.beforeEdit(event => { event.message.content = unindentMessage(event.message.content); });
}
