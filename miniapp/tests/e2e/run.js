/*
 * E2E runner skeleton (WeChat Mini Program)
 *
 * This is intended to run on a Windows machine with WeChat DevTools installed.
 * The DevTools path and project path should be configured via env vars.
 *
 * Required env:
 *   MINIPROGRAM_PROJECT_PATH - absolute path to the miniapp project
 *
 * Optional env:
 *   WECHAT_DEVTOOLS_CLI - absolute path to WeChat DevTools `cli.bat`
 *     Example: D:\\微信web开发者工具\\cli.bat
 */

const automator = require('miniprogram-automator');

async function main() {
  const projectPath = process.env.MINIPROGRAM_PROJECT_PATH;
  if (!projectPath) {
    throw new Error('Missing env MINIPROGRAM_PROJECT_PATH');
  }

  const cliPath = process.env.WECHAT_DEVTOOLS_CLI;

  const miniProgram = await automator.launch({
    projectPath,
    ...(cliPath ? { cliPath } : {})
  });

  try {
    // app.json first page
    const page = await miniProgram.reLaunch('/pages/album/index');
    await page.waitFor(1500);

    // Minimal smoke checks: page is loaded and we can query body.
    const body = await page.$('page');
    if (!body) throw new Error('Page did not render: /pages/album/index');

    console.log('[e2e] smoke ok: /pages/album/index');
  } finally {
    await miniProgram.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
