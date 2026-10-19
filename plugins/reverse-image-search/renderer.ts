/* Copyright (c) 2022 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-18. See NOTICE. */
import type { MenuChild, RendererContext, SourcePatch } from '@bedrock/renderer';

const identifier = '[A-Za-z_$][\\w$]*';
export const patches: SourcePatch[] = [{ id: 'image-menu-type', find: '}),shouldHideMediaOptions:', replacement: {
    match: new RegExp(String.raw`favoriteableType:\i,(?<=(\i)\.getAttribute\("data-type"\).+?)`.replaceAll('\\i', identifier)),
    replace: (match, target) => `${match}reverseImageSearchType:${target}.getAttribute("data-role"),`
} }];

const engines = {
    Google: 'https://lens.google.com/uploadbyurl?url=', Yandex: 'https://yandex.com/images/search?rpt=imageview&url=',
    SauceNAO: 'https://saucenao.com/search.php?url=', IQDB: 'https://iqdb.org/?url=',
    Bing: 'https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:',
    TinEye: 'https://www.tineye.com/search?url=', ImgOps: 'https://imgops.com/start?url='
};

export function start(ctx: RendererContext): void {
    function group(children: MenuChild[], id: string): MenuChild[] | undefined {
        if (children.some(child => ctx.react.isValidElement(child) && child.props.id === id)) return children;
        for (const child of children) {
            const nested = Array.isArray(child) ? child : ctx.react.isValidElement(child) ? child.props.children : undefined;
            if (Array.isArray(nested)) { const found = group(nested, id); if (found) return found; }
        }
    }
    function item(src: string) {
        const search = (engine: string) => { window.open(engine + encodeURIComponent(src), '_blank'); };
        return ctx.contextMenus.item({ id: 'search-image', label: 'Search Image', children: [
            ...Object.entries(engines).map(([name, url]) => ctx.contextMenus.item({ id: `search-image-${name}`, label: name,
                leadingAccessory: { type: 'image', src: `https://icons.duckduckgo.com/ip3/${new URL(url).host}.ico` }, action: () => search(url) })),
            ctx.contextMenus.item({ id: 'search-image-all', label: 'All', action: () => Object.values(engines).forEach(search) })
        ] });
    }
    ctx.contextMenus.patch<{ reverseImageSearchType?: string; itemHref?: string; itemSrc?: string }>('message', (children, props) => {
        if (props.reverseImageSearchType !== 'img') return;
        const src = props.itemHref ?? props.itemSrc;
        const target = group(children, 'copy-link');
        if (src && target) target.push(item(src));
    });
    ctx.contextMenus.patch<{ src?: string }>('image-context', (children, props) => {
        if (props.src) (group(children, 'copy-native-link') ?? children).push(item(props.src));
    });
}
