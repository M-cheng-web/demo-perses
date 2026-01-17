const userAgent = process.env.npm_config_user_agent ?? '';

if (!userAgent.includes('pnpm')) {
  // Keep this message short and actionable; it commonly shows up in CI logs.
  console.error('This repo uses pnpm. Please run: pnpm install');
  process.exit(1);
}
