import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

const apkFiles = [
  ['arm64-v8a', 'cardvault.apk'],
  ['armeabi-v7a', 'cardvault-armeabi-v7a.apk'],
  ['x86', 'cardvault-x86.apk'],
  ['x86_64', 'cardvault-x86_64.apk'],
] as const;
const script = path.resolve('scripts/package-apk-release.ts');

for (const layout of [
  'root',
  'nested',
  'dot-prefixed',
  'missing',
  'ambiguous',
] as const) {
  test(`packages APK archive: ${layout}`, (t) => {
    const directory = mkdtempSync(path.join(tmpdir(), 'cardvault-apk-test-'));
    t.after(() => rmSync(directory, {recursive: true, force: true}));
    const archiveRoot = path.join(directory, 'archive');
    const output = path.join(directory, 'output');
    mkdirSync(archiveRoot);
    const members: string[] = [];
    for (const [abi] of apkFiles) {
      if (layout === 'missing' && abi === 'arm64-v8a') continue;
      const contents = path.join(directory, abi);
      mkdirSync(path.join(contents, 'lib', abi), {recursive: true});
      writeFileSync(path.join(contents, 'AndroidManifest.xml'), 'manifest');
      writeFileSync(
        path.join(contents, 'lib', abi, 'libapp.so'),
        'native-library'
      );
      const prefix =
        layout === 'root' ? '' : 'android/app/build/outputs/apk/release/';
      const member = `${prefix}app-${abi}-release.apk`;
      mkdirSync(path.dirname(path.join(archiveRoot, member)), {
        recursive: true,
      });
      execFileSync('zip', ['-qr', path.join(archiveRoot, member), '.'], {
        cwd: contents,
      });
      members.push(layout === 'dot-prefixed' ? `./${member}` : member);
      if (layout === 'ambiguous' && abi === 'arm64-v8a') {
        const duplicate = `other/app-${abi}-release.apk`;
        mkdirSync(path.join(archiveRoot, 'other'));
        writeFileSync(
          path.join(archiveRoot, duplicate),
          readFileSync(path.join(archiveRoot, member))
        );
        members.push(duplicate);
      }
    }
    const archive = path.join(directory, 'artifacts.tar.gz');
    execFileSync('tar', ['-czf', archive, '-C', archiveRoot, ...members]);
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', script, archive, output],
      {
        encoding: 'utf8',
      }
    );
    if (layout === 'missing' || layout === 'ambiguous') {
      assert.notEqual(result.status, 0);
      assert.match(
        result.stderr,
        new RegExp(
          `Expected exactly one app-arm64-v8a-release.apk in the APK archive; found ${layout === 'missing' ? 0 : 2}`
        )
      );
      return;
    }
    assert.equal(result.status, 0, result.stderr);
    const expectedChecksums = apkFiles.map(([abi, filename]) => {
      const prefix =
        layout === 'root' ? '' : 'android/app/build/outputs/apk/release/';
      const expected = readFileSync(
        path.join(archiveRoot, `${prefix}app-${abi}-release.apk`)
      );
      assert.deepEqual(readFileSync(path.join(output, filename)), expected);
      return `${createHash('sha256').update(expected).digest('hex')}  ${filename}`;
    });
    assert.equal(
      readFileSync(path.join(output, 'SHA256SUMS.txt'), 'utf8'),
      `${expectedChecksums.join('\n')}\n`
    );
  });
}
