/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import { settings } from './renderer.js';
import { ELEMENT_ID } from './constants.js';
import { React, ErrorBoundary, FluxDispatcher, waitFor, classNameFactory } from './discord.js';
const { useLayoutEffect, useMemo, useRef, useState } = React;
interface Vec2 {
    x: number,
    y: number;
}

export interface MagnifierProps {
    zoom: number;
    size: number,
    instance: any;
}

const cl = classNameFactory("vc-imgzoom-");

export const Magnifier = ErrorBoundary.wrap(({ instance, size: initialSize, zoom: initalZoom }: MagnifierProps) => {
    const { square, nearestNeighbour } = settings.use(["square", "nearestNeighbour"]);
    const [ready, setReady] = useState(false);

    const [lensPosition, setLensPosition] = useState<Vec2>({ x: 0, y: 0 });
    const [imagePosition, setImagePosition] = useState<Vec2>({ x: 0, y: 0 });
    const [opacity, setOpacity] = useState(0);

    const isShiftDown = useRef(false);

    const zoom = useRef(initalZoom);
    const size = useRef(initialSize);

    const element = useRef<HTMLDivElement | null>(null);
    const currentVideoElementRef = useRef<HTMLVideoElement | null>(null);
    const originalVideoElementRef = useRef<HTMLVideoElement | null>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);

    // since we accessing document im gonna use useLayoutEffect
    useLayoutEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Shift") {
                isShiftDown.current = true;
            }
        };
        const onKeyUp = (e: KeyboardEvent) => {
            if (e.key === "Shift") {
                isShiftDown.current = false;
            }
        };
        const syncVideos = () => {
            if (currentVideoElementRef.current && originalVideoElementRef.current)
                currentVideoElementRef.current.currentTime = originalVideoElementRef.current.currentTime;
        };

        const updateMousePosition = (e: MouseEvent) => {
            if (!element.current) return;

            if (instance.state.mouseOver && instance.state.mouseDown) {
                const offset = size.current / 2;
                const pos = { x: e.pageX, y: e.pageY };
                const x = -((pos.x - element.current.getBoundingClientRect().left) * zoom.current - offset);
                const y = -((pos.y - element.current.getBoundingClientRect().top) * zoom.current - offset);
                setLensPosition({ x: e.x - offset, y: e.y - offset });
                setImagePosition({ x, y });
                setOpacity(1);
            } else {
                setOpacity(0);
            }

        };

        const onMouseDown = (e: MouseEvent) => {
            if (instance.state.mouseOver && e.button === 0 /* left click */) {
                zoom.current = settings.store.zoom;
                size.current = settings.store.size;

                // close context menu if open
                if (document.getElementById("image-context")) {
                    FluxDispatcher.dispatch({ type: "CONTEXT_MENU_CLOSE" });
                }

                updateMousePosition(e);
                setOpacity(1);
            }
        };

        const onMouseUp = () => {
            setOpacity(0);
        };

        const onWheel = (e: WheelEvent) => {
            if (instance.state.mouseOver && instance.state.mouseDown) e.preventDefault();
            if (instance.state.mouseOver && instance.state.mouseDown && !isShiftDown.current) {
                const val = zoom.current + ((e.deltaY / 100) * (settings.store.invertScroll ? -1 : 1)) * settings.store.zoomSpeed;
                zoom.current = Math.min(50, Math.max(1, val));
                if (settings.store.saveZoomValues) settings.store.zoom = zoom.current;
                updateMousePosition(e);
            }
            if (instance.state.mouseOver && instance.state.mouseDown && isShiftDown.current) {
                const val = size.current + (e.deltaY * (settings.store.invertScroll ? -1 : 1)) * settings.store.zoomSpeed;
                size.current = Math.min(1000, Math.max(50, val));
                if (settings.store.saveZoomValues) settings.store.size = size.current;
                updateMousePosition(e);
            }
        };

        const cancelWait = waitFor(() => instance.state.readyState === "READY" && !!document.getElementById(ELEMENT_ID), () => {
            const elem = document.getElementById(ELEMENT_ID) as HTMLDivElement;
            if (!elem) return;
            element.current = elem;
            elem.querySelector("img,video")?.setAttribute("draggable", "false");
            if (instance.props.animated) {
                originalVideoElementRef.current = elem!.querySelector("video")!;
                originalVideoElementRef.current.addEventListener("timeupdate", syncVideos);
            }

            setReady(true);
        });

        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("keyup", onKeyUp);
        document.addEventListener("mousemove", updateMousePosition);
        document.addEventListener("mousedown", onMouseDown);
        document.addEventListener("mouseup", onMouseUp);
        document.addEventListener("wheel", onWheel, { passive: false });

        return () => {
            cancelWait();
            originalVideoElementRef.current?.removeEventListener("timeupdate", syncVideos);
            document.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("keyup", onKeyUp);
            document.removeEventListener("mousemove", updateMousePosition);
            document.removeEventListener("mousedown", onMouseDown);
            document.removeEventListener("mouseup", onMouseUp);
            document.removeEventListener("wheel", onWheel);
        };
    }, []);

    const imageSrc = useMemo(() => {
        try {
            const imageUrl = new URL(instance.props.src);

            if (imageUrl.protocol !== "http:" && imageUrl.protocol !== "https:")
                return instance.props.src;

            if (imageUrl.pathname.startsWith("/attachments/"))
                imageUrl.hostname = "cdn.discordapp.com";

            imageUrl.searchParams.set("animated", "true");
            return imageUrl.toString();
        } catch {
            return instance.props.src;
        }
    }, [instance.props.src]);

    if (!ready) return null;

    const box = element.current?.getBoundingClientRect();

    if (!box) return null;

    return (
        <div
            className={cl("lens", { "nearest-neighbor": nearestNeighbour, square })}
            style={{
                opacity,
                width: size.current + "px",
                height: size.current + "px",
                transform: `translate(${lensPosition.x}px, ${lensPosition.y}px)`,
            }}
        >
            {instance.props.animated ?
                (
                    <video
                        className={cl("image")}
                        ref={currentVideoElementRef}
                        style={{
                            position: "absolute",
                            left: `${imagePosition.x}px`,
                            top: `${imagePosition.y}px`
                        }}
                        width={`${box.width * zoom.current}px`}
                        height={`${box.height * zoom.current}px`}
                        poster={instance.props.src}
                        src={originalVideoElementRef.current?.src ?? instance.props.src}
                        autoPlay
                        loop
                        muted
                    />
                ) : (
                    <img
                        className={cl("image")}
                        ref={imageRef}
                        style={{
                            position: "absolute",
                            transform: `translate(${imagePosition.x}px, ${imagePosition.y}px)`
                        }}
                        width={`${box.width * zoom.current}px`}
                        height={`${box.height * zoom.current}px`}
                        src={imageSrc}
                        alt=""
                    />
                )}
        </div>
    );
}, { noop: true });
