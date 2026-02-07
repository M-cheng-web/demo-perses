const userAgent = process.env.npm_config_user_agent ?? '';

if (!userAgent.includes('pnpm')) {
  // Keep this message short and actionable; it commonly shows up in CI logs.
  console.error('This repo uses pnpm. Please run: pnpm install');
  process.exit(1);
}

const REQUIRED_NODE = { major: 20, minor: 19, patch: 0 };

function parseNodeVersion(version) {
  const [major, minor, patch] = String(version)
    .trim()
    .replace(/^v/, '')
    .split('.')
    .map((v) => Number(v));
  return { major, minor, patch };
}

function isAtLeast(version, required) {
  if (version.major !== required.major) return version.major > required.major;
  if (version.minor !== required.minor) return version.minor > required.minor;
  return version.patch >= required.patch;
}

const currentNode = parseNodeVersion(process.versions.node);
if (!isAtLeast(currentNode, REQUIRED_NODE)) {
  console.error(
    [
      `Node.js >=${REQUIRED_NODE.major}.${REQUIRED_NODE.minor}.${REQUIRED_NODE.patch} is required (current: v${process.versions.node}).`,
      'If you use nvm: run `nvm use` (or `nvm install 20.19.0`).',
    ].join(' ')
  );
  process.exit(1);
}
