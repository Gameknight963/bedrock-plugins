const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { discover } = require(path.join(path.resolve(process.argv[2]), 'Runtime/storage.cjs'));
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'bedrock-packages-'));
try {
    fs.cpSync(path.resolve(process.argv[3]), path.join(temporary, 'plugins'), { recursive: true });
    const result = discover(temporary);
    if (result.errors.length) throw new Error(result.errors.map(error => `${error.folder}: ${error.error}`).join('\n'));
    console.log(`Validated ${result.plugins.size} packages with the pinned Bedrock loader.`);
} finally {
    fs.rmSync(temporary, { recursive: true, force: true });
}
