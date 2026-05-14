import { test, expect } from "@playwright/test";

test.describe("Agent Onboarding", () => {
  test.setTimeout(60000);
  const mockAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const mockChainId = "0x7a69"; // Hardhat (31337)
  let usdcBalance = 1000n * 10n ** 6n; // 1000 USDC
  let usdcAllowance = 0n; // Initial allowance is 0

  test.beforeEach(async ({ page }) => {
    // Inject mock ethereum provider and set test-only bypass variables
    await page.addInitScript(({ address, chainId }) => {
      const chainIdInt = parseInt(chainId, 16);
      
      (window as any).__MOCK_CONNECTED__ = true;
      (window as any).__MOCK_ADDRESS__ = address;

      const listeners: Record<string, Function[]> = {};
      
      const provider = {
        isMetaMask: true,
        isConnected: () => true,
        request: async ({ method, params }: any) => {
          if (method === "eth_accounts" || method === "eth_requestAccounts") {
            return [address];
          }
          if (method === "eth_chainId") {
            return chainId;
          }
          if (method === "net_version") {
            return chainIdInt.toString();
          }
          if (method === "eth_blockNumber") {
            return "0x1";
          }
          if (method === "personal_sign" || method === "eth_signTypedData_v4") {
            return "0x";
          }
          if (method === "wallet_switchEthereumChain") {
            return null;
          }
          if (method === "eth_estimateGas") {
            return "0x5208";
          }
          if (method === "eth_sendTransaction") {
            return "0xabcdef1234567890";
          }
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
          if (listeners[event]) {
            listeners[event] = listeners[event].filter(l => l !== cb);
          }
        },
        emit: (event: string, ...args: any[]) => {
          if (listeners[event]) {
            listeners[event].forEach(cb => cb(...args));
          }
        }
      };
      (window as any).ethereum = provider;
    }, { address: mockAddress, chainId: mockChainId });

    // Mock RPC calls for both localhost and 127.0.0.1
    const mockRpc = async (route: any) => {
      const request = route.request();
      if (request.method() !== "POST") return route.continue();

      let body;
      try {
        body = request.postDataJSON();
      } catch (e) {
        return route.continue();
      }
      
      if (!body || !body.method) return route.continue();
      const { method, params, id } = body;

      const respond = (result: any) => route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ jsonrpc: "2.0", id, result }),
      });

      if (method === "eth_accounts") return respond([mockAddress]);
      if (method === "eth_chainId") return respond(mockChainId);
      if (method === "net_version") return respond(parseInt(mockChainId, 16).toString());
      if (method === "eth_blockNumber") return respond("0x1");

      if (method === "eth_call") {
        if (params[0].data.startsWith("0x70a08231")) { // balanceOf
            return respond("0x" + usdcBalance.toString(16).padStart(64, "0"));
        }
        if (params[0].data.startsWith("0xdd62ed3e")) { // allowance
            return respond("0x" + usdcAllowance.toString(16).padStart(64, "0"));
        }
        return respond("0x0000000000000000000000000000000000000000000000000000000000000000");
      }

      if (method === "eth_estimateGas") return respond("0x5208");
      if (method === "eth_sendTransaction") {
        if (params[0].data && params[0].data.startsWith("0x095ea7b3")) {
           usdcAllowance = 1000n * 10n ** 6n;
        }
        return respond("0xabcdef1234567890");
      }
      if (method === "eth_getTransactionReceipt") {
        return respond({
            status: "0x1",
            transactionHash: params[0] || "0xabcdef1234567890",
            blockNumber: "0x1",
        });
      }

      return route.continue();
    };

    await page.route("**/*", mockRpc);

    await page.goto("/dashboard");
    
    const dashboardHeading = page.getByText("Command Dashboard");
    await expect(dashboardHeading).toBeVisible({ timeout: 20000 });
  });

  test("should complete agent onboarding process", async ({ page }) => {
    // c. Click the "Onboard Agent" button.
    const onboardBtn = page.getByRole("button", { name: /Onboard Agent/i });
    await onboardBtn.click();
    
    // Check that modal is open
    const modalHeading = page.locator("h2", { hasText: "Onboard AI Agent" });
    await expect(modalHeading).toBeVisible({ timeout: 10000 });

    // d. Fill the modal with valid test data
    // Funding: 100
    await page.locator('label:has-text("Initial Funding (USDC)") + input').fill("100");
    
    // Max Price: 100
    await page.locator('label:has-text("Max Auto-Price") + input').fill("100");
    
    // Budget: 200
    await page.locator('label:has-text("Daily Budget") + input').fill("200");
    
    // Max Single: 50
    await page.locator('label:has-text("Max Single Trade") + input').fill("50");

    // e. Simulate the "Approve USDC" transaction
    const actionBtn = page.getByRole("button", { name: /Approve USDC/i });
    await expect(actionBtn).toBeVisible({ timeout: 10000 });
    
    await actionBtn.click();
    
    // f. Simulate the "Initialize Agent" (onboardAgent) transaction
    // It should change to "Initialize Agent" after approval.
    const initializeBtn = page.getByRole("button", { name: /Initialize Agent/i });
    await expect(initializeBtn).toBeVisible({ timeout: 15000 });
    await initializeBtn.click();

    // g. Verify the success state
    const successBtn = page.getByRole("button", { name: /Success!/i });
    await expect(successBtn).toBeVisible({ timeout: 15000 });
  });
});
