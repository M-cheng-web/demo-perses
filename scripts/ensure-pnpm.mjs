/**
 * 安装前检查：强制使用 pnpm，并校验 Node.js 版本满足仓库要求。
 */
const userAgent = process.env.npm_config_user_agent ?? '';

if (!userAgent.includes('pnpm')) {
  // 提示信息保持简短且可执行；通常会出现在 CI 日志中。
  console.error('本仓库使用 pnpm，请执行：pnpm install');
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
      `需要 Node.js >=${REQUIRED_NODE.major}.${REQUIRED_NODE.minor}.${REQUIRED_NODE.patch}（当前：v${process.versions.node}）。`,
      '若使用 nvm：执行 `nvm use`（或 `nvm install 20.19.0`）。',
    ].join(' ')
  );
  process.exit(1);
}
