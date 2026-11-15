import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const [archiveFile, outputDirectory] = z.tuple([
  z.string().min(1),
  z.string().min(1),
]).parse(process.argv.slice(2));
const apkFiles = [
  ['arm64-v8a', 'cardvault.apk'],
  ['armeabi-v7a', 'cardvault-armeabi-v7a.apk'],
  ['x86', 'cardvault-x86.apk'],
  ['x86_64', 'cardvault-x86_64.apk'],
] as const;
const maxApkBytes = 200_000_000;
const archiveMembers = execFileSync('tar', ['-tzf', archiveFile], { encoding: 'utf8' })
  .split('\n')
  .filter((member) => member && !member.endsWith('/'));
const checksums: string[] = [];
mkdirSync(outputDirectory, { recursive: true });

for (const [abi, filename] of apkFiles) {
  const apkName = `app-${abi}-release.apk`;
  const matches = archiveMembers.filter((member) => path.posix.basename(member) === apkName);
  const [member] = matches;
  if (matches.length !== 1 || member === undefined) {
    throw new Error(`Expected exactly one ${apkName} in the APK archive; found ${matches.length}.`);
  }
  const apk = execFileSync('tar', ['-xOzf', archiveFile, '--', member], {
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  if (apk.byteLength > maxApkBytes) {
    throw new Error(`${filename} is ${apk.byteLength} bytes, exceeding the 200,000,000-byte APK limit.`);
  }
  const apkPath = path.join(outputDirectory, filename);
  writeFileSync(apkPath, apk, { flag: 'wx' });
  execFileSync('unzip', ['-tq', apkPath], { stdio: 'inherit' });
  const entries = execFileSync('unzip', ['-Z', '-1', apkPath], { encoding: 'utf8' }).split('\n');
  if (!entries.includes('AndroidManifest.xml')) {
    throw new Error(`${filename} is missing AndroidManifest.xml.`);
  }
  const nativeAbis = new Set(entries
    .filter((entry) => /^lib\/[^/]+\/[^/]+\.so$/.test(entry))
    .map((entry) => entry.split('/')[1]));
  if (nativeAbis.size !== 1 || !nativeAbis.has(abi)) {
    throw new Error(`${filename} must contain only ${abi} native libraries; found ${[...nativeAbis].join(', ')}.`);
  }
  checksums.push(`${createHash('sha256').update(apk).digest('hex')}  ${filename}`);
  console.log(`${filename}: ${apk.byteLength} bytes (${(apk.byteLength / 1_000_000).toFixed(2)} MB).`);
}

writeFileSync(path.join(outputDirectory, 'SHA256SUMS.txt'), `${checksums.join('\n')}\n`, { flag: 'wx' });
