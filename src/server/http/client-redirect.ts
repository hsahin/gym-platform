import { NextResponse } from "next/server";

export function createClientRedirectResponse(
  targetPath: string,
) {
  const escapedTarget = targetPath.replace(/"/g, "&quot;");

  return new NextResponse(
    `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0;url=${escapedTarget}" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Doorsturen...</title>
  </head>
  <body>
    <script>
      window.location.replace(${JSON.stringify(targetPath)});
    </script>
    <p>Je wordt doorgestuurd. <a href="${escapedTarget}">Ga verder</a>.</p>
  </body>
</html>`,
    {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}
