import { main as runExecutor } from "./agent-executor";
import { main as runSimulator } from "./depin-node-simulator";

/**
 * Consolidated Service Manager
 * Runs both the Agent Executor and DePIN Node Simulator in a single process
 * to reduce memory and CPU overhead.
 */
async function startAll() {
  console.log(">>> Starting Consolidated ARES Services...");
  
  // Run both in parallel within the same Node process
  await Promise.all([
    runExecutor().catch(e => console.error("Executor Error:", e)),
    runSimulator().catch(e => console.error("Simulator Error:", e))
  ]);
}

if (require.main === module) {
  startAll().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
