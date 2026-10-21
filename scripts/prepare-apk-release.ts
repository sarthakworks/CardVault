import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const commitHash = z.string().regex(/^[0-9a-f]{40}$/);
const httpsUrl = z.string().regex(/^https:\/\/\S+$/).url();
const env = z.object({
  GITHUB_SHA: commitHash,
  GITHUB_REPOSITORY: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  GITHUB_SERVER_URL: httpsUrl,
  GITHUB_RUN_ID: z.string().regex(/^[1-9]\d*$/),
  GITHUB_OUTPUT: z.string().min(1),
  RUNNER_TEMP: z.string().min(1),
}).parse(process.env);
const buildFile = z.string().min(1).parse(process.argv[2]);
const [build] = z.tuple([z.object({
  status: z.literal('FINISHED'),
  platform: z.literal('ANDROID'),
  buildProfile: z.literal('release'),
  gitCommitHash: commitHash,
  appVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  appBuildVersion: z.string().regex(/^[1-9]\d*$/)
    .transform(Number).pipe(z.number().int().max(2_100_000_000)),
  artifacts: z.object({
    buildUrl: httpsUrl,
  }),
})]).parse(JSON.parse(readFileSync(buildFile, 'utf8')));

if (build.gitCommitHash !== env.GITHUB_SHA) {
  throw new Error('The EAS APK was built from a different commit; refusing to publish it.');
}

const tag = `v${build.appVersion}-build.${build.appBuildVersion}`;
appendFileSync(env.GITHUB_OUTPUT, [
  `tag=${tag}`,
  `version=${build.appVersion}`,
  `build_number=${build.appBuildVersion}`,
  `artifact_url=${build.artifacts.buildUrl}`,
  '',
].join('\n'));

const repositoryUrl = `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}`;
writeFileSync(path.join(env.RUNNER_TEMP, 'apk-release-notes.md'), [
  `Cardvault **${build.appVersion}**, Android build **${build.appBuildVersion}**.`,
  '',
  'Download **cardvault.apk** below and install it on an Android 10+ device. This is a standalone release build; Expo Go and a development server are not required.',
  '',
  `Source: [${env.GITHUB_SHA.slice(0, 7)}](${repositoryUrl}/commit/${env.GITHUB_SHA})`,
  `Build: [GitHub Actions run](${repositoryUrl}/actions/runs/${env.GITHUB_RUN_ID})`,
  '',
  '**Back up before changing versions.** Android can reject downgrades or updates signed by another key. Uninstalling deletes the local vault; export an encrypted backup first.',
  '',
  'To verify the download, save both assets in the same directory and run `sha256sum --check SHA256SUMS.txt` (Linux) or `shasum -a 256 --check SHA256SUMS.txt` (macOS).',
  '',
].join('\n'));
