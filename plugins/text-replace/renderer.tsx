/* Copyright (c) 2023 Vendicated and contributors. SPDX-License-Identifier: GPL-3.0-or-later
 * Modified for Bedrock on 2026-10-19. See NOTICE. */
import type { RendererContext, RendererSettingsProps, RendererSettingsContext, SourcePatch } from '@bedrock/renderer';
import { React, useState, Button, ExpandableSection, Flex, HeadingSecondary, Paragraph, Span,
    TooltipContainer, Select, TextInput, UiProvider, classNameFactory, setReact, loadStyles } from './ui.js';
declare global { namespace JSX { interface IntrinsicElements { [tag: string]: any } interface IntrinsicAttributes { key?: string | number } } }
let context: RendererContext;
const cl = classNameFactory("vc-textReplace-");

export interface Rule {
    name?: string;
    find: string;
    replace: string;
    onlyIfIncludes: string;
    scope: string;
    id: string;
    [key: string]: string | undefined;
}

interface TextReplaceProps {
    title: string;
    description: string;
    rulesArray: Rule[];
    onRulesChange(rules: Rule[]): void;
    isRegex?: boolean;
}

interface RuleWithIndex {
    rule: Rule;
    index: number;
}

const makeEmptyRule: () => Rule = () => ({
    name: "",
    find: "",
    replace: "",
    onlyIfIncludes: "",
    scope: "myMessages",
    id: crypto.randomUUID()
});

const makeEmptyRuleArray = () => [makeEmptyRule()];

type RuleLists = { stringRules: Rule[]; regexRules: Rule[] };
function readRules(ctx: RendererSettingsContext): RuleLists {
    const read = (key: string): Rule[] => {
        const saved = ctx.settings.get<unknown>(key, null);
        if (!Array.isArray(saved)) return makeEmptyRuleArray();
        return saved.filter(rule => rule && typeof rule.find === 'string' && typeof rule.replace === 'string')
            .map(rule => ({ name: typeof rule.name === 'string' ? rule.name : '', find: rule.find, replace: rule.replace,
                onlyIfIncludes: typeof rule.onlyIfIncludes === 'string' ? rule.onlyIfIncludes : '',
                scope: ['myMessages', 'othersMessages', 'allMessages'].includes(rule.scope) ? rule.scope : 'myMessages',
                id: typeof rule.id === 'string' ? rule.id : crypto.randomUUID() }));
    };
    return { stringRules: read('stringRules'), regexRules: read('regexRules') };
}
export function Settings({ ctx }: RendererSettingsProps) {
    setReact(ctx.react);
    const [rules, setRules] = React.useState(() => readRules(ctx));
    const [error, setError] = React.useState('');
    const pending = React.useRef<Partial<RuleLists>>({});
    React.useEffect(() => {
        loadStyles(ctx);
        return ctx.events.on('settings.changed', (event: any) => {
            if (event.id === ctx.id) setRules({ ...readRules(ctx), ...pending.current });
        });
    }, [ctx]);
    const save = (key: keyof RuleLists, value: Rule[]) => {
        pending.current[key] = value;
        setRules(previous => ({ ...previous, [key]: value }));
        setError('');
        void ctx.settings.set(key, structuredClone(value)).catch(error => {
            if (!ctx.signal.aborted) { setError(String(error.message || error)); ctx.log.error(error); }
        }).finally(() => {
            if (pending.current[key] === value) {
                delete pending.current[key];
                if (!ctx.signal.aborted) setRules({ ...readRules(ctx), ...pending.current });
            }
        });
    };
    return <UiProvider ctx={ctx}>
        {error && <p role="alert" className="bedrock-error">{error}</p>}
        <TextReplaceTesting rules={rules} />
        <TextReplace title="Simple Replacements" description="Simple find and replace rules. For example, find 'brb' and replace it with 'be right back'"
            rulesArray={rules.stringRules} onRulesChange={value => save('stringRules', value)} />
        <TextReplace title="Regex Replacements" description="Find and replace text using regular expressions."
            rulesArray={rules.regexRules} onRulesChange={value => save('regexRules', value)} isRegex />
    </UiProvider>;
}

function stringToRegex(str: string) {
    const match = str.match(/^(\/)?(.+?)(?:\/([gimsuyv]*))?$/); // Regex to match regex
    return match
        ? new RegExp(
            match[2], // Pattern
            match[3]
                ?.split("") // Remove duplicate flags
                .filter((char, pos, flagArr) => flagArr.indexOf(char) === pos)
                .join("")
            ?? "g"
        )
        : new RegExp(str); // Not a regex, return string
}

function renderFindError(find: string) {
    try {
        stringToRegex(find);
        return null;
    } catch (e) {
        return (
            <span style={{ color: "var(--text-feedback-critical)" }}>
                {String(e)}
            </span>
        );
    }
}

function Input({ initialValue, onChange, placeholder }: {
    placeholder: string;
    initialValue: string;
    onChange(value: string): void;
}) {
    const [value, setValue] = useState(initialValue);
    React.useEffect(() => setValue(initialValue), [initialValue]);
    return (
        <TextInput
            placeholder={placeholder}
            value={value}
            onChange={setValue}
            spellCheck={false}
            onBlur={() => { if (value !== initialValue) onChange(value); }}
        />
    );
}

function TextRow({ label, description, value, onChange }: { label: string; description: string; value: string; onChange(value: string): void; }) {
    return (
        <>
            <TooltipContainer text={description}>
                <Span weight="medium" size="md">{label}</Span>
            </TooltipContainer>
            <Input
                placeholder={description}
                initialValue={value}
                onChange={onChange}
            />
        </>
    );
}

const isEmptyRule = (rule: Rule) => !rule.find;

function matchesRuleSearch(rule: Rule, query: string) {
    if (!query) return true;

    const normalizedQuery = query.trim().toLowerCase();
    return [rule.name ?? "", rule.find, rule.replace, rule.onlyIfIncludes]
        .some(value => value.toLowerCase().includes(normalizedQuery));
}

type DropIndicator = { index: number; position: "before" | "after"; };

function TextReplace({ title, description, rulesArray, onRulesChange, isRegex = false }: TextReplaceProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);

    function onClickRemove(index: number) {
        onRulesChange(rulesArray.filter((_rule, position) => position !== index));
    }

    function onChange(value: string, index: number, key: string) {
        const next = rulesArray.map((rule, position) => position === index ? { ...rule, [key]: value } : rule);
        const rule = next[index];
        if (!rule.name && !rule.find && !rule.replace && !rule.onlyIfIncludes && index !== next.length - 1) next.splice(index, 1);
        onRulesChange(next);
    }

    const scopeOptions = [
        { label: "Apply to your messages (visible to everyone)", value: "myMessages" },
        { label: "Apply to others' messages (only visible to you)", value: "othersMessages" },
        { label: "Apply to all messages", value: "allMessages" }
    ];

    const filteredRules = rulesArray.reduce((acc: RuleWithIndex[], rule, index) => {
        if (matchesRuleSearch(rule, searchQuery)) {
            acc.push({ rule, index });
        }

        return acc;
    }, []);

    const handleDragOver = (index: number) => (e: any) => {
        e.preventDefault();
        if (draggedIndex === null || searchQuery) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const position = e.clientY - rect.top < rect.height / 2 ? "before" : "after";
        setDropIndicator(prev =>
            prev?.index === index && prev.position === position ? prev : { index, position }
        );
    };

    const handleDrop = (e: any) => {
        e.preventDefault();
        if (draggedIndex === null || !dropIndicator || searchQuery) {
            setDraggedIndex(null);
            setDropIndicator(null);
            return;
        }

        let targetIndex = dropIndicator.index + (dropIndicator.position === "after" ? 1 : 0);
        if (targetIndex > draggedIndex) targetIndex -= 1;

        if (targetIndex !== draggedIndex) {
            const next = [...rulesArray];
            const draggedRule = next.splice(draggedIndex, 1)[0];
            next.splice(targetIndex, 0, draggedRule);
            onRulesChange(next);
        }

        setDraggedIndex(null);
        setDropIndicator(null);
    };

    return (
        <>
            <div>
                <HeadingSecondary>{title}</HeadingSecondary>
                <Paragraph>{description}</Paragraph>
                <div className={cl("search-input")}>
                    <TextInput
                        placeholder="Search for a rule..."
                        value={searchQuery}
                        onChange={setSearchQuery}
                    />
                </div>
            </div>
            <Flex flexDirection="column" style={{ gap: "0.5em", paddingBottom: "1.25em" }}>
                {!filteredRules.length && searchQuery && (
                    <Paragraph>No rules match your search criteria.</Paragraph>
                )}
                {filteredRules.map(({ rule, index }) =>
                    <div
                        key={rule.id}
                        onDragOver={handleDragOver(index)}
                        onDrop={handleDrop}
                        style={{ opacity: draggedIndex === index ? 0.5 : 1, position: "relative" }}
                    >
                        {dropIndicator?.index === index && dropIndicator.position === "before" && (
                            <div className={cl("drop-indicator")} style={{ top: 0 }} />
                        )}
                        {dropIndicator?.index === index && dropIndicator.position === "after" && (
                            <div className={cl("drop-indicator")} style={{ bottom: 0 }} />
                        )}
                        <ExpandableSection
                            renderContent={() => (
                                <>
                                    <div className={cl("input-grid")}>
                                        <TextRow
                                            label="Name"
                                            description="An optional name to help you identify this rule."
                                            value={rule.name ?? ""}
                                            onChange={e => onChange(e, index, "name")}
                                        />
                                        <TextRow
                                            label="Find"
                                            description={isRegex ? "The regex pattern" : "The text to replace"}
                                            value={rule.find}
                                            onChange={e => onChange(e, index, "find")}
                                        />
                                        <TextRow
                                            label="Replace"
                                            description="The text to replace the found text with"
                                            value={rule.replace}
                                            onChange={e => onChange(e, index, "replace")}
                                        />
                                        <TextRow
                                            label="Only if includes"
                                            description="Optionally, only apply this rule if the message includes this text."
                                            value={rule.onlyIfIncludes}
                                            onChange={e => onChange(e, index, "onlyIfIncludes")}
                                        />
                                    </div>
                                    <div style={{ marginTop: "0.25em" }}>
                                        <Select
                                            options={scopeOptions}
                                            isSelected={(e: string) => e === rule.scope}
                                            select={(e: string) => onChange(e, index, "scope")}
                                            serialize={(e: string) => e}
                                        />
                                    </div>
                                    {isRegex && renderFindError(rule.find)}
                                    <Button
                                        className={cl("delete-button")}
                                        variant="dangerPrimary"
                                        onClick={() => onClickRemove(index)}
                                    >
                                        Delete Rule
                                    </Button>
                                </>
                            )}
                        >
                            <div
                                draggable={!searchQuery}
                                onDragStart={(e: any) => {
                                    setDraggedIndex(index);
                                    e.dataTransfer.setData("text/plain", index.toString());
                                }}
                                onDragEnd={() => {
                                    setDraggedIndex(null);
                                    setDropIndicator(null);
                                }}
                                style={{ cursor: searchQuery ? "default" : "grab", flex: 1 }}
                            >
                                <Paragraph weight="medium" size="md">
                                    {rule.name
                                        ? rule.name
                                        : isEmptyRule(rule)
                                            ? `Empty Rule ${index + 1}`
                                            : `Rule ${index + 1} - ${rule.find}`
                                    }
                                </Paragraph>
                            </div>
                        </ExpandableSection>
                    </div>
                )}
                <Button
                    onClick={() => {
                        setSearchQuery("");
                        onRulesChange([...rulesArray, makeEmptyRule()]);
                    }}
                    disabled={rulesArray.length > 0 && isEmptyRule(rulesArray[rulesArray.length - 1])}
                >
                    Add Rule
                </Button>
            </Flex>
        </>
    );
}

function TextReplaceTesting({ rules }: { rules: RuleLists }) {
    const [value, setValue] = useState("");

    return (
        <div>
            <HeadingSecondary>Rule Tester</HeadingSecondary>
            <Flex flexDirection="column" gap={6}>
                <TextInput placeholder="Type a message to test rules on" onChange={setValue} />
                <TextInput placeholder="Message with rules applied" editable={false} value={applyRules(value, "allMessages", rules)} style={{ opacity: 0.7 }} />
            </Flex>
        </div>
    );
}

export function applyRules(content: string, scope: "myMessages" | "othersMessages" | "allMessages", rules: RuleLists = readRules(context)): string {
    if (content.length === 0) {
        return content;
    }

    for (const rule of rules.stringRules) {
        if (!rule.find) continue;
        if (rule.onlyIfIncludes && !content.includes(rule.onlyIfIncludes)) continue;
        if (rule.scope !== "allMessages" && rule.scope !== scope && scope !== "allMessages") continue;

        content = ` ${content} `.replaceAll(rule.find, rule.replace.replaceAll("\\n", "\n")).replace(/^\s|\s$/g, "");
    }

    for (const rule of rules.regexRules) {
        if (!rule.find) continue;
        if (rule.onlyIfIncludes && !content.includes(rule.onlyIfIncludes)) continue;
        if (rule.scope !== "allMessages" && rule.scope !== scope && scope !== "allMessages") continue;

        try {
            const regex = stringToRegex(rule.find);
            content = content.replace(regex, rule.replace.replaceAll("\\n", "\n"));
        } catch (e) {
            // Invalid patterns are displayed in the rule editor. Skip them when applying rules.
        }
    }

    content = content.trim();
    return content;
}

export function modifyIncomingMessage(message: any) {
    if (!context || context.signal.aborted || !message) return message?.content;
    const currentUser = context.webpack.find<any>(value => value?.getName?.() === "UserStore")?.getCurrentUser();
    const messageAuthor = message.author;

    if (!message.content || !currentUser?.id || !messageAuthor?.id || messageAuthor.id === currentUser.id) {
        return message.content;
    }

    return applyRules(message.content, "othersMessages");
}

export const patches: SourcePatch[] = [{ id: 'incoming-replacements', find: '!1,hideSimpleEmbedContent', replacement: {
    match: new RegExp(String.raw`(let{toAST:.{0,125}?)\(\i\?\?\i\).content`.replaceAll('\\i', '(?:[A-Za-z_$][\\w$]*)')),
    replace: 'const textReplaceContent=$self.modifyIncomingMessage(arguments[2]?.contentMessage??arguments[1]);$1textReplaceContent'
} }];
export function start(ctx: RendererContext): void {
    context = ctx;
    ctx.messages.beforeSend(event => { event.message.content = applyRules(event.message.content, 'myMessages'); });
}
