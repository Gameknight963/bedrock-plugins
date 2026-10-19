const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { discover } = require(path.join(path.resolve(process.argv[2]), 'Runtime/storage.cjs'));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'bedrock-packages-'));
try {
    fs.cpSync(path.resolve(process.argv[3]), path.join(temporary, 'plugins'), { recursive: true });
    const result = discover(temporary);
    if (result.errors.length) throw new Error(result.errors.map(error => `${error.folder}: ${error.error}`).join('\n'));
    const entries = [];
    for (const plugin of result.plugins.values()) {
        for (const [environment, definition] of Object.entries(plugin.manifest.entrypoints)) {
            if (definition.runtime === 'javascript' && ['main', 'renderer'].includes(environment))
                entries.push({ id: plugin.manifest.id, environment, path: definition.path, filename: plugin.entries[environment] });
        }
    }
    const program = ts.createProgram(entries.map(entry => entry.filename), {
        allowJs: true, checkJs: false, noEmit: true, target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
        strictNullChecks: true, skipLibCheck: true, types: []
    });
    const checker = program.getTypeChecker();
    const errors = [];
    for (const entry of entries) {
        const prefix = `${entry.id}: ${entry.environment} entry point ${entry.path}`;
        const source = program.getSourceFile(entry.filename);
        if (!source) { errors.push(`${prefix}: could not read the JavaScript module.`); continue; }
        const diagnostics = program.getSyntacticDiagnostics(source);
        if (diagnostics.length) {
            errors.push(`${prefix}: invalid JavaScript: ${diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')).join('; ')}`);
            continue;
        }
        const module = checker.getSymbolAtLocation(source);
        let start = module && checker.getExportsOfModule(module).find(symbol => symbol.getName() === 'start');
        if (!start) { errors.push(`${prefix}: must export a start function.`); continue; }
        if (start.flags & ts.SymbolFlags.Alias) start = checker.getAliasedSymbol(start);
        const declaration = start.valueDeclaration ?? start.declarations?.[0] ?? source;
        const type = checker.getTypeOfSymbolAtLocation(start, declaration);
        if (!checker.getSignaturesOfType(type, ts.SignatureKind.Call).length)
            errors.push(`${prefix}: export start is not a statically callable function (inferred ${checker.typeToString(type)}).`);
    }
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(`Validated ${result.plugins.size} packages and ${entries.length} JavaScript entry points with the pinned Bedrock loader and TypeScript compiler.`);
} finally {
    fs.rmSync(temporary, { recursive: true, force: true });
}
