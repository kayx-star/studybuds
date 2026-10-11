import { ImageResponse } from "next/og";

const SIZES = new Set([180, 192, 512]);

/** Generates the app icon (/icons/192.png etc.): purple background with a book */
export async function GET(_req: Request, ctx: RouteContext<"/icons/[size]">) {
  const size = Number((await ctx.params).size.replace(/\.png$/, ""));
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #6d6de6, #4a4ac4)",
          fontSize: size * 0.55,
        }}
      >
        📚
      </div>
    ),
    { width: size, height: size },
  );
}
