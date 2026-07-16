import { mkdir, writeFile } from "node:fs/promises";

const destination = "https://southwest-virginia-chihuahua-os.dswillia74.chatgpt.site";
const outputDirectory = new URL("../vercel-static/", import.meta.url);

await mkdir(outputDirectory, { recursive: true });
await writeFile(
  new URL("index.html", outputDirectory),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="refresh" content="0;url=${destination}">
    <title>Southwest Virginia Operating System</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #071d1b; color: #eafff8; font: 16px system-ui, sans-serif; }
      main { max-width: 32rem; padding: 2rem; text-align: center; }
      p { color: #9fc8bd; }
      a { color: #55e0ba; }
    </style>
  </head>
  <body>
    <main>
      <h1>Southwest Virginia Operating System</h1>
      <p>Opening the private workspace…</p>
      <a href="${destination}">Continue to the application</a>
    </main>
  </body>
</html>
`,
  "utf8",
);
