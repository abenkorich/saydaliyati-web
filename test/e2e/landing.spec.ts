import { test, expect } from "@playwright/test";
const locales = [
  {
    code: "en",
    dir: "ltr",
    heading: "Your medicines.",
    next: "Français",
    nextCode: "fr",
  },
  {
    code: "ar",
    dir: "rtl",
    heading: "أدويتك معًا.",
    next: "English",
    nextCode: "en",
  },
  {
    code: "fr",
    dir: "ltr",
    heading: "Vos médicaments.",
    next: "العربية",
    nextCode: "ar",
  },
];
for (const locale of locales) {
  test(`landing ${locale.code}: layout, language, FAQ and portal entry`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const api: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/"))
        api.push(request.url());
    });
    await page.goto(`/${locale.code}`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale.code);
    await expect(page.locator("html")).toHaveAttribute("dir", locale.dir);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      locale.heading,
    );
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.locator("summary").first().click();
    await expect(page.locator("details").first()).toHaveAttribute("open", "");
    await page.locator("summary").first().focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("details").first()).not.toHaveAttribute(
      "open",
      "",
    );
    await page.locator("summary").first().blur();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: testInfo.outputPath(`landing-${locale.code}.png`),
      fullPage: true,
    });
    expect(api).toEqual([]);
    expect(errors).toEqual([]);
    await page.getByRole("link", { name: locale.next, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale.nextCode}$`));
    await expect(page.locator("html")).toHaveAttribute("lang", locale.nextCode);
    await page.route("**/api/session", (route) =>
      route.fulfill({ json: { data: { authenticated: false } } }),
    );
    await page.locator(".lp-hero .lp-button").click();
    await expect(page).toHaveURL(/\/portal$/);
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
}
test("public root opens English and unsupported locale is not found", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
  const response = await page.goto("/es");
  expect(response?.status()).toBe(404);
});
test("Arabic fits a narrow phone and keeps all languages accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/ar");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (const name of ["English", "Français", "العربية"])
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
