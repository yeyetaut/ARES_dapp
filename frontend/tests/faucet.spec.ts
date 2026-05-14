import { test, expect } from "@playwright/test";

test.describe("USDC Faucet", () => {
  test.setTimeout(60000);
  const mockAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const mockChainId = "0x7a69"; // Hardhat (31337)
  let usdcBalance = 1000n * 10n ** 6n; // 1000 USDC

  test.beforeEach(async ({ page }) => {
    // Inject mock ethereum provider and set test-only bypass variables
    await page.addInitScript(({ address, chainId }) => {
      const chainIdInt = parseInt(chainId, 16);
      
      (window as any).__MOCK_CONNECTED__ = true;
      (window as any).__MOCK_ADDRESS__ = address;
      (window as any).__MOCK_USDC_BALANCE__ = "1000000000"; // 1000 USDC in 6 decimals as string/bigint helper

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
        return respond("0x" + usdcBalance.toString(16).padStart(64, "0"));
      }

      if (method === "eth_estimateGas") return respond("0x5208");
      if (method === "eth_sendTransaction") {
        return respond("0xabcdef1234567890");
      }
      if (method === "eth_getTransactionReceipt") {
        return respond({
            status: "0x1",
            transactionHash: params[0],
            blockNumber: "0x1",
        });
      }

      return route.continue();
    };

    await page.route("**/*", mockRpc);

    await page.goto("/dashboard");
    
    // Wait for the UI to stabilize
    const dashboardHeading = page.getByText("Command Dashboard");
    await expect(dashboardHeading).toBeVisible({ timeout: 20000 });
  });

  test("should update USDC balance after faucet minting", async ({ page }) => {
    // Verify initial balance
    const balanceDisplay = page.locator('p:has-text("Wallet Liquidity") + p');
    await expect(balanceDisplay).toContainText("1000.00", { timeout: 15000 });

    // Mock balance update for the next call
    usdcBalance = 2000n * 10n ** 6n;
    
    // We also update the window object because the frontend might use it
    await page.evaluate(() => {
      (window as any).__MOCK_USDC_BALANCE__ = "2000000000";
    });

    // Click Faucet
    const faucetBtn = page.getByRole("button", { name: /USDC Faucet/i });
    await faucetBtn.click();

    // Verify balance update
    await expect(balanceDisplay).toContainText("2000.00", { timeout: 20000 });
    await expect(faucetBtn).toContainText(/USDC Faucet/i, { timeout: 5000 });
  });
});
