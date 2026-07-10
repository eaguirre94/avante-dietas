import { expect, test } from "@playwright/test";

test("la página de login carga con usuario y contraseña", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Avante Dietas")).toBeVisible();
  await expect(page.locator('input[autocomplete="username"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.getByRole("button", { name: /Ingresar/i })).toBeVisible();
});

test("una ruta protegida sin sesión ofrece iniciar sesión", async ({ page }) => {
  await page.goto("/cocina");
  await expect(page.getByText(/iniciar sesión/i)).toBeVisible();
});
