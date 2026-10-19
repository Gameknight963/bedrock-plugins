const path = require('node:path');
const ts = require('typescript');
const [plugin, sdk] = process.argv.slice(2).map(value => path.resolve(value));
if (!plugin || !sdk) throw new Error('Expected the plugin folder and Bedrock SDK folder.');
const config = ts.readConfigFile(path.join(plugin, 'tsconfig.json'), ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, plugin, {
    outDir: path.join(plugin, 'obj', 'runtime'),
    paths: { '@bedrock/renderer': [path.join(sdk, 'include', 'bedrock', 'renderer.d.ts')] }
});
const program = ts.createProgram(parsed.fileNames, parsed.options);
const result = program.emit();
const diagnostics = [config.error, ...parsed.errors, ...ts.getPreEmitDiagnostics(program), ...result.diagnostics].filter(Boolean);
if (diagnostics.length) {
    process.stderr.write(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: name => name, getCurrentDirectory: ts.sys.getCurrentDirectory, getNewLine: () => '\n'
    }));
    process.exitCode = 1;
}
