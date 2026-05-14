import { test, expect } from "@playwright/test";

test.describe("Agent Onboarding", () => {
  test.setTimeout(60000);
  const mockAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const mockChainId = "0x7a69"; // Hardhat (31337)

  test.beforeEach(async ({ page }) => {
    // Inject mock ethereum provider and set test-only bypass variables
    await page.addInitScript(({ address, chainId }) => {
      (window as any).__MOCK_CONNECTED__ = true;
      (window as any).__MOCK_ADDRESS__ = address;
      (window as any).__MOCK_USDC_BALANCE__ = "1000000000"; // 1000 USDC
      (window as any).__MOCK_ALLOWANCE__ = "0";

      const listeners: Record<string, Function[]> = {};
      
      const provider = {
        isMetaMask: true,
        isConnected: () => true,
        request: async ({ method, params }: any) => {
          if (method === "eth_accounts" || method === "eth_requestAccounts") return [address];
          if (method === "eth_chainId") return chainId;
          if (method === "net_version") return parseInt(chainId, 16).toString();
          if (method === "eth_blockNumber") return "0x1";
          if (method === "eth_estimateGas") return "0x5208";
          if (method === "eth_sendTransaction") return "0xabcdef1234567890";
          if (method === "eth_getTransactionReceipt") {
            return {
              status: "0x1",
              transactionHash: "0xabcdef1234567890",
              blockNumber: "0x1",
            };
          }
          return null;
        },
        on: (event: string, cb: Function) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(cb);
        },
        removeListener: (event: string, cb: Function) => {
          if (listeners[event]) listeners[event] = listeners[event].filter(l => l !== cb);
        },
        emit: (event: string, ...args: any[]) => {
          if (listeners[event]) listeners[event].forEach(cb => cb(...args));
        }
      };
      (window as any).ethereum = provider;
    }, { address: mockAddress, chainId: mockChainId });

    // Mock RPC calls - even if we use bypasses, we should handle these to avoid 404s
    const mockRpc = async (route: any) => {
      const request = route.request();
      if (request.method() !== "POST") return route.continue();
      
      const body = request.postDataJSON();
      const respond = (result: any) => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jsonrpc: "2.0", id: body.id, result }),
      });

      if (body.method === "eth_accounts") return respond([mockAddress]);
      if (body.method === "eth_chainId") return respond(mockChainId);
      if (body.method === "net_version") return respond(parseInt(mockChainId, 16).toString());
      if (body.method === "eth_blockNumber") return respond("0x1");
      if (body.method === "eth_call") return respond("0x0000000000000000000000000000000000000000000000000000000000000000");
      if (body.method === "eth_estimateGas") return respond("0x5208");
      if (body.method === "eth_sendTransaction") return respond("0xabcdef1234567890");
      if (body.method === "eth_getTransactionReceipt") {
        return respond({ status: "0x1", transactionHash: body.params[0], blockNumber: "0x1" });
      }
      return route.continue();
    };

    await page.route("**/*", async (route) => {
      const url = route.request().url();
      if (url.includes("8545") || url.includes("rpc") || url.includes("infura")) {
        return mockRpc(route);
      }
      return route.continue();
    });

    await page.goto("/dashboard");
    page.on("console", msg => console.log(`[BROWSER] ${msg.text()}`));
    await expect(page.getByText("Command Dashboard")).toBeVisible({ timeout: 20000 });
  });

  test("should successfully onboard a new agent", async ({ page }) => {
    // 1. Open Modal
    const onboardBtn = page.getByRole("button", { name: /Onboard Agent/i }).first();
    await onboardBtn.click();

    const modal = page.locator("div:has-text('Onboard AI Agent')").last();
    await expect(modal).toBeVisible();

    // 2. Fill Form
    await page.locator('input[type="number"]').nth(0).fill("100"); // Funding
    await page.locator('input[type="number"]').nth(1).fill("100"); // Max Price
    await page.locator('input[type="number"]').nth(2).fill("200"); // Budget
    await page.locator('input[type="number"]').nth(3).fill("50");  // Max Single

    // 3. Approve USDC
    const actionBtn = page.getByRole("button", { name: /Approve USDC|Initialize Agent/i });
    await expect(actionBtn).toContainText("Approve USDC");
    
    await actionBtn.click();
    
    // Update mock for next calls (simulating successful approval)
    await page.evaluate(() => {
      (window as any).__MOCK_ALLOWANCE__ = "1000000000";
    });
    
    // 4. Initialize Agent
    await expect(actionBtn).toContainText("Initialize Agent", { timeout: 15000 });
    await actionBtn.click();

    // 5. Verify Success
    await expect(actionBtn).toContainText("Success!", { timeout: 15000 });
    await expect(page.getByText("Success!")).toBeVisible();
  });
});
