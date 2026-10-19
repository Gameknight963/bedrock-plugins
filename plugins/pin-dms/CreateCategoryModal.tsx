/* Copyright (c) 2024 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import { React, Heading, ColorPicker, Modal, openModalLazy, TextInput, useMemo, useState, classNameFactory,
    findComponentByCodeLazy, loadSettingsModal } from './discord.js';
import type { RenderModalProps } from './discord.js';
import { DEFAULT_COLOR, SWATCHES } from './constants.js';
import { categoryLen, createCategory, getCategory, saveCategories } from './data.js';
interface ColorPickerWithSwatchesProps {
    className?: string;
    defaultColor: number;
    colors: number[];
    value: number;
    disabled?: boolean;
    onChange(value: number | null): void;
    renderDefaultButton?: () => any;
    renderCustomButton?: () => any;
}

const ColorPickerWithSwatches = findComponentByCodeLazy<ColorPickerWithSwatchesProps>('id:"color-picker"');

export const requireSettingsModal = loadSettingsModal;

const cl = classNameFactory("vc-pindms-modal-");

interface Props {
    categoryId: string | null;
    initialChannelId: string | null;
    modalProps: RenderModalProps;
}

function useCategory(categoryId: string | null, initalChannelId: string | null) {
    const category = useMemo(() => {
        if (categoryId) {
            return getCategory(categoryId);
        } else if (initalChannelId) {
            return {
                id: crypto.randomUUID(),
                name: `Pin Category ${categoryLen() + 1}`,
                color: DEFAULT_COLOR,
                collapsed: false,
                channels: [initalChannelId]
            };
        }
    }, [categoryId, initalChannelId]);

    return category;
}

export function NewCategoryModal({ categoryId, modalProps, initialChannelId }: Props) {
    const category = useCategory(categoryId, initialChannelId);
    if (!category) return null;

    const [name, setName] = useState(category.name);
    const [color, setColor] = useState(category.color);

    const onSave = () => {
        category.name = name;
        category.color = color;

        if (!categoryId) {
            createCategory(category);
        } else { saveCategories(); }

        modalProps.onClose();
    };

    return (
        <Modal
            {...modalProps}
            title={`${categoryId ? "Edit" : "New"} Category`}
            actions={[{
                text: categoryId ? "Save" : "Create",
                variant: "primary",
                onClick: onSave,
                disabled: !name
            }]}
        >
            <form
                className={cl("content")}
                onSubmit={(e: any) => {
                    e.preventDefault();
                    onSave();
                }}
            >
                <section>
                    <Heading tag="h5">Name</Heading>
                    <TextInput
                        value={name}
                        onChange={(value: string) => setName(value)}
                    />
                </section>
                <section>
                    <Heading tag="h5">Color</Heading>
                    <ColorPickerWithSwatches
                        className={cl("color-picker")}
                        key={category.id}
                        defaultColor={DEFAULT_COLOR}
                        colors={SWATCHES}
                        onChange={(value: number | null) => setColor(value ?? DEFAULT_COLOR)}
                        value={color}
                        renderDefaultButton={() => null}
                        renderCustomButton={() => (
                            <ColorPicker
                                color={color}
                                onChange={(value: number | null) => setColor(value ?? DEFAULT_COLOR)}
                                key={category.id}
                                showEyeDropper={false}
                            />
                        )}
                    />
                </section>
            </form>
        </Modal>
    );
}

export const openCategoryModal = (categoryId: string | null, channelId: string | null) =>
    openModalLazy(async () => {
        await requireSettingsModal();
        return (modalProps: RenderModalProps) => <NewCategoryModal categoryId={categoryId} modalProps={modalProps} initialChannelId={channelId} />;
    });
