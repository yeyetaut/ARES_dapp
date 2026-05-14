import { useEffect } from "react";
import { toast } from "react-hot-toast";

export function useTxToast(
  actionName: string,
  writeError: Error | null,
  txSuccess: boolean,
  txError: Error | null
) {
  useEffect(() => {
    if (writeError) {
      const msg = writeError.message.split("\n")[0] || "Transaction failed";
      toast.error(`${actionName} failed: ${msg}`);
    }
  }, [writeError, actionName]);

  useEffect(() => {
    if (txError) {
      toast.error(`${actionName} failed on-chain.`);
    }
    if (txSuccess) {
      toast.success(`${actionName} successful!`);
    }
  }, [txSuccess, txError, actionName]);
}
