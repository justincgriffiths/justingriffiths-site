// The Google Fonts request is blocked so every run lays text out in the same fallback fonts.
export async function open(page, path) {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(path, { waitUntil: "load" });
}

