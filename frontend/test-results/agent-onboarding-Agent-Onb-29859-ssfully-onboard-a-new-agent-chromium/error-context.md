# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: agent-onboarding.spec.ts >> Agent Onboarding >> should successfully onboard a new agent
- Location: tests/agent-onboarding.spec.ts:89:7

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('button', { name: /Approve USDC|Initialize Agent/i })
Expected substring: "Success!"
Received string:    "Initialize Agent"
Timeout: 15000ms

Call log:
  - Expect "toContainText" with timeout 15000ms
  - waiting for getByRole('button', { name: /Approve USDC|Initialize Agent/i })
    34 × locator resolved to <button class="flex-[2] px-4 py-3 rounded-xl bg-accent text-xs font-bold text-white hover:bg-blue-400 disabled:opacity-50 transition-all uppercase tracking-widest">Initialize Agent</button>
       - unexpected value "Initialize Agent"

```

```yaml
- button "Initialize Agent"
```

# Test source

```ts
  19  |         isMetaMask: true,
  20  |         isConnected: () => true,
  21  |         request: async ({ method, params }: any) => {
  22  |           if (method === "eth_accounts" || method === "eth_requestAccounts") return [address];
  23  |           if (method === "eth_chainId") return chainId;
  24  |           if (method === "net_version") return parseInt(chainId, 16).toString();
  25  |           if (method === "eth_blockNumber") return "0x1";
  26  |           if (method === "eth_estimateGas") return "0x5208";
  27  |           if (method === "eth_sendTransaction") return "0xabcdef1234567890";
  28  |           if (method === "eth_getTransactionReceipt") {
  29  |             return {
  30  |               status: "0x1",
  31  |               transactionHash: "0xabcdef1234567890",
  32  |               blockNumber: "0x1",
  33  |             };
  34  |           }
  35  |           return null;
  36  |         },
  37  |         on: (event: string, cb: Function) => {
  38  |           if (!listeners[event]) listeners[event] = [];
  39  |           listeners[event].push(cb);
  40  |         },
  41  |         removeListener: (event: string, cb: Function) => {
  42  |           if (listeners[event]) listeners[event] = listeners[event].filter(l => l !== cb);
  43  |         },
  44  |         emit: (event: string, ...args: any[]) => {
  45  |           if (listeners[event]) listeners[event].forEach(cb => cb(...args));
  46  |         }
  47  |       };
  48  |       (window as any).ethereum = provider;
  49  |     }, { address: mockAddress, chainId: mockChainId });
  50  | 
  51  |     // Mock RPC calls - even if we use bypasses, we should handle these to avoid 404s
  52  |     const mockRpc = async (route: any) => {
  53  |       const request = route.request();
  54  |       if (request.method() !== "POST") return route.continue();
  55  |       
  56  |       const body = request.postDataJSON();
  57  |       const respond = (result: any) => route.fulfill({
  58  |         status: 200,
  59  |         contentType: "application/json",
  60  |         body: JSON.stringify({ jsonrpc: "2.0", id: body.id, result }),
  61  |       });
  62  | 
  63  |       if (body.method === "eth_accounts") return respond([mockAddress]);
  64  |       if (body.method === "eth_chainId") return respond(mockChainId);
  65  |       if (body.method === "net_version") return respond(parseInt(mockChainId, 16).toString());
  66  |       if (body.method === "eth_blockNumber") return respond("0x1");
  67  |       if (body.method === "eth_call") return respond("0x0000000000000000000000000000000000000000000000000000000000000000");
  68  |       if (body.method === "eth_estimateGas") return respond("0x5208");
  69  |       if (body.method === "eth_sendTransaction") return respond("0xabcdef1234567890");
  70  |       if (body.method === "eth_getTransactionReceipt") {
  71  |         return respond({ status: "0x1", transactionHash: body.params[0], blockNumber: "0x1" });
  72  |       }
  73  |       return route.continue();
  74  |     };
  75  | 
  76  |     await page.route("**/*", async (route) => {
  77  |       const url = route.request().url();
  78  |       if (url.includes("8545") || url.includes("rpc") || url.includes("infura")) {
  79  |         return mockRpc(route);
  80  |       }
  81  |       return route.continue();
  82  |     });
  83  | 
  84  |     await page.goto("/dashboard");
  85  |     page.on("console", msg => console.log(`[BROWSER] ${msg.text()}`));
  86  |     await expect(page.getByText("Command Dashboard")).toBeVisible({ timeout: 20000 });
  87  |   });
  88  | 
  89  |   test("should successfully onboard a new agent", async ({ page }) => {
  90  |     // 1. Open Modal
  91  |     const onboardBtn = page.getByRole("button", { name: /Onboard Agent/i }).first();
  92  |     await onboardBtn.click();
  93  | 
  94  |     const modal = page.locator("div:has-text('Onboard AI Agent')").last();
  95  |     await expect(modal).toBeVisible();
  96  | 
  97  |     // 2. Fill Form
  98  |     await page.locator('input[type="number"]').nth(0).fill("100"); // Funding
  99  |     await page.locator('input[type="number"]').nth(1).fill("100"); // Max Price
  100 |     await page.locator('input[type="number"]').nth(2).fill("200"); // Budget
  101 |     await page.locator('input[type="number"]').nth(3).fill("50");  // Max Single
  102 | 
  103 |     // 3. Approve USDC
  104 |     const actionBtn = page.getByRole("button", { name: /Approve USDC|Initialize Agent/i });
  105 |     await expect(actionBtn).toContainText("Approve USDC");
  106 |     
  107 |     await actionBtn.click();
  108 |     
  109 |     // Update mock for next calls (simulating successful approval)
  110 |     await page.evaluate(() => {
  111 |       (window as any).__MOCK_ALLOWANCE__ = "1000000000";
  112 |     });
  113 |     
  114 |     // 4. Initialize Agent
  115 |     await expect(actionBtn).toContainText("Initialize Agent", { timeout: 15000 });
  116 |     await actionBtn.click();
  117 | 
  118 |     // 5. Verify Success
> 119 |     await expect(actionBtn).toContainText("Success!", { timeout: 15000 });
      |                             ^ Error: expect(locator).toContainText(expected) failed
  120 |     await expect(page.getByText("Success!")).toBeVisible();
  121 |   });
  122 | });
  123 | 
```