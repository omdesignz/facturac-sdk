import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

test('packed SDK installs offline with public exports, types and no application files', () => {
    const directory = mkdtempSync(join(tmpdir(), 'facturac-package-'));
    const environment = {
        ...process.env,
        npm_config_cache: join(directory, 'cache'),
    };
    try {
        const [archive] = JSON.parse(
            execFileSync(
                'npm',
                [
                    'pack',
                    '--ignore-scripts',
                    '--json',
                    '--pack-destination',
                    directory,
                ],
                { cwd: root, env: environment, encoding: 'utf8' },
            ),
        );
        assert.ok(archive.files.some((file) => file.path === 'README.md'));
        assert.ok(
            archive.files.every(
                (file) =>
                    file.path.startsWith('dist/') ||
                    file.path.startsWith('examples/') ||
                    ['README.md', 'package.json'].includes(file.path),
            ),
        );
        const manifest = JSON.parse(
            readFileSync(join(root, 'package.json'), 'utf8'),
        );
        assert.equal(Object.keys(manifest.dependencies ?? {}).length, 0);
        writeFileSync(
            join(directory, 'package.json'),
            JSON.stringify({ private: true, type: 'module' }),
        );
        execFileSync(
            'npm',
            [
                'install',
                join(directory, archive.filename),
                '--offline',
                '--ignore-scripts',
                '--no-audit',
                '--no-fund',
            ],
            { cwd: directory, env: environment, stdio: 'pipe' },
        );
        const help = execFileSync(
            'npm',
            ['exec', '--offline', '--', 'facturac-export', '--help'],
            {
                cwd: directory,
                env: environment,
                stdio: 'pipe',
                encoding: 'utf8',
            },
        );
        assert.match(help, /Usage: facturac-export/);
        const demoOutput = execFileSync(
            'npm',
            [
                'exec',
                '--offline',
                '--',
                'facturac-export',
                '--demo',
                join(directory, 'demo.csv'),
            ],
            {
                cwd: directory,
                env: environment,
                stdio: 'pipe',
                encoding: 'utf8',
            },
        );
        assert.match(demoOutput, /DEMO.*Exported 2 documents/);
        assert.match(
            readFileSync(join(directory, 'demo.csv'), 'utf8'),
            /FT DEMO/,
        );
        const consumer = `import { Facturac } from '${manifest.name}';
import type { Service } from '${manifest.name}';
const id = '01J00000000000000000000000';
const service: Service.CatalogueServiceCreateRequest = { code: 'S1', name: 'Service', currency_code: 'AOA', tax_treatment: 'IVA_NOR_14', unit_price_minor: '500' };
// @ts-expect-error Monetary strings must not silently become floating-point numbers.
service.unit_price_minor = 500;
const client = new Facturac({ baseUrl: 'https://example.test', token: 'fcr1.' + id + '.' + 'a'.repeat(43), workspacePublicId: id, entityPublicId: id, environment: 'production', fetch: async () => Response.json({ data: [], meta: { page: 1, last_page: 1 } }) });
const result = await client.documents.list();
if (result.data.length !== 0) throw new Error('Unexpected SDK response');
`;
        writeFileSync(join(directory, 'consumer.mts'), consumer);
        execFileSync(
            process.execPath,
            [
                join(root, 'node_modules/typescript/bin/tsc'),
                join(directory, 'consumer.mts'),
                '--strict',
                '--module',
                'NodeNext',
                '--moduleResolution',
                'NodeNext',
                '--target',
                'ES2022',
                '--skipLibCheck',
            ],
            { cwd: directory, stdio: 'pipe' },
        );
        execFileSync(process.execPath, [join(directory, 'consumer.mjs')], {
            cwd: directory,
            stdio: 'pipe',
        });
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});
