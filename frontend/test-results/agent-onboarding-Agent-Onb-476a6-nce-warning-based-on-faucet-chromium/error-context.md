# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: agent-onboarding.spec.ts >> Agent Onboarding >> should show and hide insufficient balance warning based on faucet
- Location: tests/agent-onboarding.spec.ts:179:7

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('p:has-text("Wallet Liquidity") + p')
Expected substring: "0.00"
Received string:    "— USDC"
Timeout: 15000ms

Call log:
  - Expect "toContainText" with timeout 15000ms
  - waiting for locator('p:has-text("Wallet Liquidity") + p')
    34 × locator resolved to <p class="text-2xl font-mono font-bold text-white">…</p>
       - unexpected value "— USDC"

```

```yaml
- paragraph: — USDC
```

# Test source

```ts
  97  |       if (method === "eth_chainId") return respond(mockChainId);
  98  |       if (method === "net_version") return respond(parseInt(mockChainId, 16).toString());
  99  |       if (method === "eth_blockNumber") return respond("0x1");
  100 | 
  101 |       if (method === "eth_call") {
  102 |         if (params[0].data.startsWith("0x70a08231")) { // balanceOf
  103 |             return respond("0x" + usdcBalance.toString(16).padStart(64, "0"));
  104 |         }
  105 |         if (params[0].data.startsWith("0xdd62ed3e")) { // allowance
  106 |             return respond("0x" + usdcAllowance.toString(16).padStart(64, "0"));
  107 |         }
  108 |         return respond("0x0000000000000000000000000000000000000000000000000000000000000000");
  109 |       }
  110 | 
  111 |       if (method === "eth_estimateGas") return respond("0x5208");
  112 |       if (method === "eth_sendTransaction") {
  113 |         if (params[0].data && params[0].data.startsWith("0x095ea7b3")) {
  114 |            usdcAllowance = 1000n * 10n ** 6n;
  115 |         }
  116 |         return respond("0xabcdef1234567890");
  117 |       }
  118 |       if (method === "eth_getTransactionReceipt") {
  119 |         return respond({
  120 |             status: "0x1",
  121 |             transactionHash: params[0] || "0xabcdef1234567890",
  122 |             blockNumber: "0x1",
  123 |         });
  124 |       }
  125 | 
  126 |       return route.continue();
  127 |     };
  128 | 
  129 |     await page.route("**/*", mockRpc);
  130 | 
  131 |     await page.goto("/dashboard");
  132 |     
  133 |     const dashboardHeading = page.getByText("Command Dashboard");
  134 |     await expect(dashboardHeading).toBeVisible({ timeout: 20000 });
  135 |   });
  136 | 
  137 |   test("should complete agent onboarding process", async ({ page }) => {
  138 |     usdcBalance = 1000n * 10n ** 6n;
  139 |     usdcAllowance = 0n;
  140 | 
  141 |     // c. Click the "Onboard Agent" button.
  142 |     const onboardBtn = page.getByRole("button", { name: /Onboard Agent/i });
  143 |     await onboardBtn.click();
  144 |     
  145 |     // Check that modal is open
  146 |     const modalHeading = page.locator("h2", { hasText: "Onboard AI Agent" });
  147 |     await expect(modalHeading).toBeVisible({ timeout: 10000 });
  148 | 
  149 |     // d. Fill the modal with valid test data
  150 |     // Funding: 100
  151 |     await page.locator('label:has-text("Initial Funding (USDC)") + input').fill("100");
  152 |     
  153 |     // Max Price: 100
  154 |     await page.locator('label:has-text("Max Auto-Price") + input').fill("100");
  155 |     
  156 |     // Budget: 200
  157 |     await page.locator('label:has-text("Daily Budget") + input').fill("200");
  158 |     
  159 |     // Max Single: 50
  160 |     await page.locator('label:has-text("Max Single Trade") + input').fill("50");
  161 | 
  162 |     // e. Simulate the "Approve USDC" transaction
  163 |     const actionBtn = page.getByRole("button", { name: /Approve USDC/i });
  164 |     await expect(actionBtn).toBeVisible({ timeout: 10000 });
  165 |     
  166 |     await actionBtn.click();
  167 |     
  168 |     // f. Simulate the "Initialize Agent" (onboardAgent) transaction
  169 |     // It should change to "Initialize Agent" after approval.
  170 |     const initializeBtn = page.getByRole("button", { name: /Initialize Agent/i });
  171 |     await expect(initializeBtn).toBeVisible({ timeout: 15000 });
  172 |     await initializeBtn.click();
  173 | 
  174 |     // g. Verify the success state
  175 |     const successBtn = page.getByRole("button", { name: /Success!/i });
  176 |     await expect(successBtn).toBeVisible({ timeout: 15000 });
  177 |   });
  178 | 
  179 |   test("should show and hide insufficient balance warning based on faucet", async ({ page }) => {
  180 |     // 3. Initially set a low USDC balance (0)
  181 |     usdcBalance = 0n;
  182 |     usdcAllowance = 0n;
  183 |     await page.evaluate(() => {
  184 |       (window as any).__MOCK_USDC_BALANCE__ = "0";
  185 |     });
  186 | 
  187 |     // Need to trigger a re-render or wait for balance fetch to notice 0 balance if it already loaded 1000
  188 |     // But since this test just started, usdcBalance was 1000 before page load, wait...
  189 |     // In beforeEach, the page.goto is called. And at that time usdcBalance is 1000.
  190 |     // Let's reload the page to make sure it loads with 0 balance
  191 |     await page.goto("/dashboard");
  192 |     const dashboardHeading = page.getByText("Command Dashboard");
  193 |     await expect(dashboardHeading).toBeVisible({ timeout: 20000 });
  194 |     
  195 |     // Ensure Wallet Liquidity is 0
  196 |     const balanceDisplay = page.locator('p:has-text("Wallet Liquidity") + p');
> 197 |     await expect(balanceDisplay).toContainText("0.00", { timeout: 15000 });
      |                                  ^ Error: expect(locator).toContainText(expected) failed
  198 | 
  199 |     // 4. Click "Onboard Agent" to open the modal
  200 |     const onboardBtn = page.getByRole("button", { name: /Onboard Agent/i });
  201 |     await onboardBtn.click();
  202 | 
  203 |     // 5. Verify that the "Insufficient USDC Balance" warning is visible
  204 |     const modalHeading = page.locator("h2", { hasText: "Onboard AI Agent" });
  205 |     await expect(modalHeading).toBeVisible({ timeout: 10000 });
  206 |     
  207 |     const warningText = page.getByText("Insufficient USDC Balance", { exact: false });
  208 |     await expect(warningText).toBeVisible({ timeout: 10000 });
  209 | 
  210 |     // 6. Close the modal
  211 |     // It has a Cancel button or we can click an overlay/Escape. Let's try Cancel or Escape.
  212 |     const cancelBtn = page.getByRole("button", { name: /Cancel/i });
  213 |     if (await cancelBtn.count() > 0) {
  214 |       await cancelBtn.first().click();
  215 |     } else {
  216 |       await page.keyboard.press('Escape');
  217 |     }
  218 |     await expect(modalHeading).not.toBeVisible({ timeout: 10000 });
  219 | 
  220 |     // 7. Click the "USDC Faucet" button and simulate a successful transaction
  221 |     usdcBalance = 1000n * 10n ** 6n;
  222 |     await page.evaluate(() => {
  223 |       (window as any).__MOCK_USDC_BALANCE__ = "1000000000";
  224 |     });
  225 | 
  226 |     const faucetBtn = page.getByRole("button", { name: /USDC Faucet/i });
  227 |     await faucetBtn.click();
  228 | 
  229 |     // 8. Wait for the balance update to reflect on the dashboard (Wallet Liquidity)
  230 |     await expect(balanceDisplay).toContainText("1000.00", { timeout: 20000 });
  231 | 
  232 |     // 9. Click "Onboard Agent" again
  233 |     await onboardBtn.click();
  234 |     await expect(modalHeading).toBeVisible({ timeout: 10000 });
  235 | 
  236 |     // 10. Verify that the "Insufficient USDC Balance" warning is NOT visible
  237 |     await expect(warningText).not.toBeVisible({ timeout: 10000 });
  238 | 
  239 |     // 11. Verify that the "Approve USDC" or "Initialize Agent" button is now active/visible
  240 |     // We might need to fill out inputs to activate the button, depending on how OnboardingModal works
  241 |     await page.locator('label:has-text("Initial Funding (USDC)") + input').fill("100");
  242 |     await page.locator('label:has-text("Max Auto-Price") + input').fill("100");
  243 |     await page.locator('label:has-text("Daily Budget") + input').fill("200");
  244 |     await page.locator('label:has-text("Max Single Trade") + input').fill("50");
  245 | 
  246 |     const actionBtn = page.locator('button', { hasText: /(Approve USDC|Initialize Agent)/ });
  247 |     await expect(actionBtn).toBeVisible({ timeout: 10000 });
  248 |     await expect(actionBtn).toBeEnabled();
  249 |   });
  250 | });
  251 | 
```