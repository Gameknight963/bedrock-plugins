/* Copyright (c) 2025 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import { React, classes } from './discord.js';
type IconProps = { height?: number | string; width?: number | string; className?: string; [key: string]: any };
function Icon({ height = 24, width = 24, children, ...props }: IconProps) {
    return <svg height={height} width={width} {...props}>{children}</svg>;
}
export function LinkIcon({ height = 24, width = 24, className }: IconProps) {
    return (
        <Icon
            height={height}
            width={width}
            className={classes(className, "vc-link-icon")}
            viewBox="0 0 24 24"
        >
            <g fill="none" fillRule="evenodd">
                <path fill="currentColor" d="M10.59 13.41c.41.39.41 1.03 0 1.42-.39.39-1.03.39-1.42 0a5.003 5.003 0 0 1 0-7.07l3.54-3.54a5.003 5.003 0 0 1 7.07 0 5.003 5.003 0 0 1 0 7.07l-1.49 1.49c.01-.82-.12-1.64-.4-2.42l.47-.48a2.982 2.982 0 0 0 0-4.24 2.982 2.982 0 0 0-4.24 0l-3.53 3.53a2.982 2.982 0 0 0 0 4.24zm2.82-4.24c.39-.39 1.03-.39 1.42 0a5.003 5.003 0 0 1 0 7.07l-3.54 3.54a5.003 5.003 0 0 1-7.07 0 5.003 5.003 0 0 1 0-7.07l1.49-1.49c-.01.82.12 1.64.4 2.43l-.47.47a2.982 2.982 0 0 0 0 4.24 2.982 2.982 0 0 0 4.24 0l3.53-3.53a2.982 2.982 0 0 0 0-4.24.973.973 0 0 1 0-1.42z" />
                <rect width={width} height={height} />
            </g>
        </Icon>
    );
}

export function OpenExternalIcon(props: IconProps) {
    return (
        <Icon
            {...props}
            className={classes(props.className, "vc-open-external-icon")}
            viewBox="0 0 24 24"
        >
            <path fill="currentColor" d="M15 2a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V4.41l-4.3 4.3a1 1 0 1 1-1.4-1.42L19.58 3H16a1 1 0 0 1-1-1Z" />
            <path fill="currentColor" d="M5 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-6a1 1 0 1 0-2 0v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6a1 1 0 1 0 0-2H5Z" />
        </Icon>
    );
}

export function PencilIcon(props: IconProps) {
    return (
        <Icon
            {...props}
            className={classes(props.className, "vc-pencil-icon")}
            viewBox="0 0 24 24"
        >
            <path
                fill="currentColor"
                d="m13.96 5.46 4.58 4.58a1 1 0 0 0 1.42 0l1.38-1.38a2 2 0 0 0 0-2.82l-3.18-3.18a2 2 0 0 0-2.82 0l-1.38 1.38a1 1 0 0 0 0 1.42ZM2.11 20.16l.73-4.22a3 3 0 0 1 .83-1.61l7.87-7.87a1 1 0 0 1 1.42 0l4.58 4.58a1 1 0 0 1 0 1.42l-7.87 7.87a3 3 0 0 1-1.6.83l-4.23.73a1.5 1.5 0 0 1-1.73-1.73Z"
            />
        </Icon>
    );
}

export function StarFilled(props: IconProps) {
    return (
        <Icon
            {...props}
            viewBox="0 0 24 24"
        >
            <path
                fill={props.fill || "currentColor"}
                d="M10.81 2.86c.38-1.15 2-1.15 2.38 0l1.89 5.83h6.12c1.2 0 1.71 1.54.73 2.25l-4.95 3.6 1.9 5.82a1.25 1.25 0 0 1-1.93 1.4L12 18.16l-4.95 3.6c-.98.7-2.3-.25-1.92-1.4l1.89-5.82-4.95-3.6a1.25 1.25 0 0 1 .73-2.25h6.12l1.9-5.83Z"
            />
        </Icon>
    );
}

export function StarOutlined(props: IconProps) {
    return (
        <Icon
            {...props}
            viewBox="0 0 24 24"
        >
            <path
                fill={props.fill || "currentColor"}
                fillRule="evenodd"
                d="M2.07 10.94a1.25 1.25 0 0 1 .73-2.25h6.12l1.9-5.83c.37-1.15 2-1.15 2.37 0l1.89 5.83h6.12c1.2 0 1.71 1.54.73 2.25l-4.95 3.6 1.9 5.82a1.25 1.25 0 0 1-1.93 1.4L12 18.16l-4.95 3.6c-.98.7-2.3-.25-1.92-1.4l1.89-5.82-4.95-3.6Zm11.55-.25h5.26l-4.25 3.09 1.62 5-4.25-3.1-4.25 3.1 1.62-5-4.25-3.1h5.26l1.62-5 1.62 5Z" />
        </Icon>
    );
}

export function XLargeBoldIcon(props: IconProps) {
    return (
        <Icon
            {...props}
            viewBox="0 0 24 24"
        >
            <path
                fill={props.fill || "currentColor"}
                d="M18.94 21.06a1.5 1.5 0 1 0 2.12-2.12L14.12 12l6.94-6.94a1.5 1.5 0 1 0-2.12-2.12L12 9.88 5.06 2.94a1.5 1.5 0 1 0-2.12 2.12L9.88 12l-6.94 6.94a1.5 1.5 0 1 0 2.12 2.12L12 14.12l6.94 6.94Z"
            />
        </Icon>
    );
}

export function UnsendIcon(props: IconProps) {
    return (
        <Icon
            {...props}
            viewBox="0 0 24 24"
        >
            <path
                fill={props.fill || "currentColor"}
                d="M3 2a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 0-2H5.07a8 8 0 1 1 13.29 8.86l-.01.01a7.97 7.97 0 0 1-1.9 1.78 1 1 0 0 0 1.1 1.67c.19-.12.36-.25.53-.38.7-.54 1.32-1.16 1.85-1.85l.01-.01A9.95 9.95 0 0 0 22 12 10 10 0 0 0 4 6V3a1 1 0 0 0-1-1ZM3.18 14.06a1 1 0 0 0-.61 1.27c.11.33.24.64.4.95a1 1 0 0 0 1.8-.86c-.12-.24-.22-.5-.32-.75a1 1 0 0 0-1.27-.61ZM5.33 18.12a1 1 0 0 0 .09 1.41c.51.45 1.07.85 1.67 1.18a1 1 0 0 0 .98-1.74 8.02 8.02 0 0 1-1.33-.95 1 1 0 0 0-1.41.1ZM14.17 20.8a1 1 0 0 0-1.12-.87 8.08 8.08 0 0 1-1.87.03 1 1 0 1 0-.2 1.99 10.1 10.1 0 0 0 2.32-.03 1 1 0 0 0 .87-1.13Z"
            />
        </Icon>
    );
}

export function WindowTopOutlineIcon(props: IconProps) {
    return (
        <Icon
            {...props}
            viewBox="0 0 24 24"
        >
            <path
                fill={props.fill || "currentColor"}
                d="M4 5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v.18a1 1 0 1 0 2 0V5a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h.18a1 1 0 1 0 0-2H5a1 1 0 0 1-1-1V5Z"
            />
            <path
                fill={props.fill || "currentColor"}
                fillRule="evenodd"
                d="M8 11a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3v-8Zm2 0a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-8Z"
                clipRule="evenodd"
            />
        </Icon>
    );
}

export function BookCheckIcon(props: IconProps) {
    return (
        <Icon
            {...props}
            viewBox="0 0 24 24"
        >
            <path
                fill={props.fill || "currentColor"}
                fillRule="evenodd"
                d="M15 2a3 3 0 0 1 3 3v12H5.5a1.5 1.5 0 0 0 0 3h14a.5.5 0 0 0 .5-.5V5h1a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3h10Zm-.3 5.7a1 1 0 0 0-1.4-1.4L9 10.58l-2.3-2.3a1 1 0 0 0-1.4 1.42l3 3a1 1 0 0 0 1.4 0l5-5Z"
                clipRule="evenodd"
            />
        </Icon>
    );
}

export function TrashIcon(props: IconProps) {
    return (
        <Icon
            {...props}
            viewBox="0 0 24 24"
        >
            <path
                fill={props.fill || "currentColor"}
                d="M14.25 1c.41 0 .75.34.75.75V3h5.25c.41 0 .75.34.75.75v.5c0 .41-.34.75-.75.75H3.75A.75.75 0 0 1 3 4.25v-.5c0-.41.34-.75.75-.75H9V1.75c0-.41.34-.75.75-.75h4.5Z"
            />
            <path
                fill={props.fill || "currentColor"}
                fillRule="evenodd"
                d="M5.06 7a1 1 0 0 0-1 1.06l.76 12.13a3 3 0 0 0 3 2.81h8.36a3 3 0 0 0 3-2.81l.75-12.13a1 1 0 0 0-1-1.06H5.07ZM11 12a1 1 0 1 0-2 0v6a1 1 0 1 0 2 0v-6Zm3-1a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0v-6a1 1 0 0 1 1-1Z"
                clipRule="evenodd"
            />
        </Icon>
    );
}
