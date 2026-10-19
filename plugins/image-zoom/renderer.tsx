/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { MenuChild, RendererContext } from '@bedrock/renderer';
import { React, Menu, createRoot, debounce, normalizePatches, setContext, disposeContext, Logger } from './discord.js';
import { Magnifier } from './Magnifier.js';
import { ELEMENT_ID } from './constants.js';
const { definePluginSettings, OptionType } = Bedrock;
declare global { namespace JSX { interface IntrinsicElements { [tag: string]: any } } }
export const settings = definePluginSettings({
    saveZoomValues: {
        label: "Save zoom values",
        type: OptionType.BOOLEAN,
        description: "Remember zoom and lens size changes.",
        default: true,
    },

    invertScroll: {
        label: "Invert scroll",
        type: OptionType.BOOLEAN,
        description: "Reverse the scroll direction for zoom and lens size.",
        default: true,
    },

    nearestNeighbour: {
        label: "Nearest-neighbour scaling",
        type: OptionType.BOOLEAN,
        description: "Keep individual pixels sharp when magnifying images.",
        default: false,
    },

    square: {
        label: "Square lens",
        type: OptionType.BOOLEAN,
        description: "Use a square magnifying lens.",
        default: false,
    },

    zoom: {
        label: "Zoom",
        description: "Magnification of the lens.",
        type: OptionType.SLIDER,
        default: 2,

        min: 1, max: 50, step: 0.1,
    },
    size: {
        label: "Lens size",
        description: "Diameter of the lens in pixels.",
        type: OptionType.SLIDER,
        default: 100,

        min: 50, max: 1000, step: 1,
    },

    zoomSpeed: {
        label: "Zoom speed",
        description: "How quickly scrolling changes zoom and lens size.",
        type: OptionType.SLIDER,
        default: 0.5,

        min: 0.1, max: 5, step: 0.1,
    },
});

const imageContextMenuPatch = (children: MenuChild[], props: any) => {
    // Discord re-uses the image context menu for links to for the copy and open buttons
    if ("href" in props) return;
    // emojis in user statuses
    if (props.target?.classList?.contains("emoji")) return;

    children.push(<ImageZoomControls />);
};
function ImageZoomControls() {
    const { square, nearestNeighbour } = settings.use(["square", "nearestNeighbour", "zoom", "size", "zoomSpeed"]);

    return (
        <Menu.MenuGroup id="image-zoom">
            <Menu.MenuCheckboxItem
                id="vc-square"
                label="Square Lens"
                checked={square}
                action={() => {
                    settings.store.square = !square;
                }}
            />
            <Menu.MenuCheckboxItem
                id="vc-nearest-neighbour"
                label="Nearest Neighbour"
                checked={nearestNeighbour}
                action={() => {
                    settings.store.nearestNeighbour = !nearestNeighbour;
                }}
            />
            <Menu.MenuControlItem
                id="vc-zoom"
                label="Zoom"
                control={(props: any, ref: any) => (
                    <Menu.MenuSliderControl
                        ref={ref}
                        {...props}
                        minValue={1}
                        maxValue={50}
                        value={settings.store.zoom}
                        onChange={debounce((value: number) => settings.store.zoom = value, 100)}
                    />
                )}
            />
            <Menu.MenuControlItem
                id="vc-size"
                label="Lens Size"
                control={(props: any, ref: any) => (
                    <Menu.MenuSliderControl
                        ref={ref}
                        {...props}
                        minValue={50}
                        maxValue={1000}
                        value={settings.store.size}
                        onChange={debounce((value: number) => settings.store.size = value, 100)}
                    />
                )}
            />
            <Menu.MenuControlItem
                id="vc-zoom-speed"
                label="Zoom Speed"
                control={(props: any, ref: any) => (
                    <Menu.MenuSliderControl
                        ref={ref}
                        {...props}
                        minValue={0.1}
                        maxValue={5}
                        value={settings.store.zoomSpeed}
                        onChange={debounce((value: number) => settings.store.zoomSpeed = value, 100)}
                        renderValue={(value: number) => `${value.toFixed(3)}x`}
                    />
                )}
            />
        </Menu.MenuGroup>
    );
}

export const plugin: any = {
    name: "ImageZoom",
    description: "Lets you zoom in to images and gifs. Use scroll wheel to zoom in and shift + scroll wheel to increase lens radius / size",
    tags: ["Media", "Utility"],
    searchTerms: ["ImageUtilities"],


    patches: [
        {
            find: "disableArrowKeySeek:!0",
            replacement: [
                {
                    match: /useFullWidth:!0,shouldLink:/,
                    replace: `id:"${ELEMENT_ID}",$&`
                },
                {
                    match: /(?<=null!=(\i)\?.{0,20})\i(?:\.\i)?,{children:\1/, // TODO: (?:\.\i)? is stable compat
                    replace: "'div',{onClick:e=>e.stopPropagation(),children:$1"
                }
            ]
        },
        // Make media viewer options not hide when zoomed in with the default Discord feature
        {
            find: '="FOCUS_SENSITIVE",',
            replacement: {
                match: /(?<=\[\i\.\i]:)\i&&!\i&&"PINNED"!==\i/,
                replace: "false"
            }
        },

        {
            find: ".handleImageLoad)",
            replacement: [
                {
                    match: /placeholderVersion:\i,(?=.{0,50}children:)/,
                    replace: "...$self.makeProps(this),$&"
                },

                {
                    match: /componentDidMount\(\){/,
                    replace: "$&$self.renderMagnifier(this);",
                },

                {
                    match: /componentWillUnmount\(\){/,
                    replace: "$&$self.unMountMagnifier();"
                },

                {
                    match: /componentDidUpdate\(\i\){/,
                    replace: "$&$self.updateMagnifier(this);"
                }
            ]
        }
    ],

    settings,
    contextMenus: {
        "image-context": imageContextMenuPatch
    },

    // to stop from rendering twice /shrug
    currentMagnifierElement: null as any,
    element: null as HTMLDivElement | null,

    Magnifier,
    root: null as any,
    makeProps(instance: any) {
        return {
            onMouseOver: () => this.onMouseOver(instance),
            onMouseOut: () => this.onMouseOut(instance),
            onMouseDown: (e: MouseEvent) => this.onMouseDown(e, instance),
            onMouseUp: () => this.onMouseUp(instance),
            id: instance.props.id,
        };
    },

    renderMagnifier(instance: any) {
        try {
            if (instance.props.id === ELEMENT_ID) {
                if (!this.root) {
                    this.root = createRoot(this.element!);
                }

                this.currentMagnifierElement = <Magnifier size={settings.store.size} zoom={settings.store.zoom} instance={instance} />;
                this.root.render(this.currentMagnifierElement);
            }
        } catch (error) {
            new Logger("ImageZoom").error("Failed to render magnifier:", error);
        }
    },

    updateMagnifier(instance: any) {
        this.renderMagnifier(instance);
    },

    unMountMagnifier() {
        this.root?.unmount();
        this.currentMagnifierElement = null;
        this.root = null;
    },

    onMouseOver(instance: any) {
        instance.setState((state: any) => ({ ...state, mouseOver: true }));
    },
    onMouseOut(instance: any) {
        instance.setState((state: any) => ({ ...state, mouseOver: false }));
    },
    onMouseDown(e: MouseEvent, instance: any) {
        if (e.button === 0 /* left */)
            instance.setState((state: any) => ({ ...state, mouseDown: true }));
    },
    onMouseUp(instance: any) {
        instance.setState((state: any) => ({ ...state, mouseDown: false }));
    },

    start() {
        this.element = document.createElement("div");
        this.element.classList.add("MagnifierContainer");
        (document.body || document.documentElement).appendChild(this.element);
    },

    stop() {
        // so componenetWillUnMount gets called if Magnifier component is still alive
        this.root && this.root.unmount();
        this.element?.remove();
    }
};

export const patches = normalizePatches(plugin.patches);
export function start(ctx: RendererContext): void {
    setContext(ctx); plugin.start();
    ctx.contextMenus.patch('image-context', imageContextMenuPatch);
    void fetch(new URL('./styles.css', import.meta.url), { signal: ctx.signal }).then(response => {
        if (!response.ok) throw new Error(`Could not load Image Zoom styles (HTTP ${response.status}).`);
        return response.text();
    }).then(css => { if (!ctx.signal.aborted) ctx.styles.add(css); }).catch(error => { if (!ctx.signal.aborted) ctx.log.error(error); });
}
export function stop(): void { plugin.stop(); plugin.root = null; plugin.currentMagnifierElement = null; plugin.element = null; disposeContext(); }
