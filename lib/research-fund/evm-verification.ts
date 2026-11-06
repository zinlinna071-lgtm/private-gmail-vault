export type EvmTransferCandidate = {
  chainId: number;
  transactionHash: string;
  transactionSucceeded: boolean;
  blockNumber: bigint;
  latestBlockNumber: bigint;
  recipient: string;
  expectedRecipient: string;
  asset: "ETH" | "USDT";
  tokenContract?: string;
  expectedTokenContract?: string;
  amountBaseUnits: bigint;
  minimumAmountBaseUnits: bigint;
};

export type EvmVerificationResult =
  | { status: "REJECTED"; reason: string }
  | { status: "PENDING"; confirmations: bigint; requiredConfirmations: bigint }
  | { status: "CONFIRMED"; confirmations: bigint; requiredConfirmations: bigint; transactionHash: string; amountBaseUnits: string; asset: "ETH" | "USDT"; chainId: number };

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_MIN_CONFIRMATIONS = 3;

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HASH = /^0x[0-9a-fA-F]{64}$/;

export function normalizeEvmAddress(value: string): string {
  if (!ADDRESS.test(value)) throw new Error("Invalid EVM address");
  return value.toLowerCase();
}

export function normalizeEvmTransactionHash(value: string): string {
  if (!HASH.test(value)) throw new Error("Invalid EVM transaction hash");
  return value.toLowerCase();
}

/**
 * Pure policy evaluator for already-decoded RPC facts.
 * This function does not contact a blockchain and its output is not proof
 * until an RPC/indexer adapter independently verifies every supplied fact.
 */
export function evaluateSepoliaTransfer(
  candidate: EvmTransferCandidate,
  requiredConfirmations = SEPOLIA_MIN_CONFIRMATIONS
): EvmVerificationResult {
  let transactionHash: string;
  let recipient: string;
  let expectedRecipient: string;
  try {
    transactionHash = normalizeEvmTransactionHash(candidate.transactionHash);
    recipient = normalizeEvmAddress(candidate.recipient);
    expectedRecipient = normalizeEvmAddress(candidate.expectedRecipient);
  } catch {
    return { status: "REJECTED", reason: "Malformed transaction hash or wallet address" };
  }

  if (candidate.chainId !== SEPOLIA_CHAIN_ID) {
    return { status: "REJECTED", reason: "Unsupported chain; Sepolia testnet only" };
  }
  if (!candidate.transactionSucceeded) {
    return { status: "REJECTED", reason: "Transaction execution failed" };
  }
  if (recipient !== expectedRecipient) {
    return { status: "REJECTED", reason: "Receiving address does not match configured test wallet" };
  }
  if (candidate.asset === "USDT") {
    try {
      if (!candidate.tokenContract || !candidate.expectedTokenContract ||
          normalizeEvmAddress(candidate.tokenContract) !== normalizeEvmAddress(candidate.expectedTokenContract)) {
        return { status: "REJECTED", reason: "Token contract does not match configured test token" };
      }
    } catch {
      return { status: "REJECTED", reason: "Malformed token contract address" };
    }
  }
  if (candidate.amountBaseUnits <= 0n || candidate.amountBaseUnits < candidate.minimumAmountBaseUnits) {
    return { status: "REJECTED", reason: "Transfer amount is below the configured minimum" };
  }
  if (candidate.blockNumber <= 0n || candidate.latestBlockNumber < candidate.blockNumber) {
    return { status: "PENDING", confirmations: 0n, requiredConfirmations: BigInt(requiredConfirmations) };
  }
  if (!Number.isSafeInteger(requiredConfirmations) || requiredConfirmations < 1) {
    return { status: "REJECTED", reason: "Invalid confirmation policy" };
  }

  const confirmations = candidate.latestBlockNumber - candidate.blockNumber + 1n;
  const required = BigInt(requiredConfirmations);
  if (confirmations < required) {
    return { status: "PENDING", confirmations, requiredConfirmations: required };
  }

  return {
    status: "CONFIRMED",
    confirmations,
    requiredConfirmations: required,
    transactionHash,
    amountBaseUnits: candidate.amountBaseUnits.toString(),
    asset: candidate.asset,
    chainId: candidate.chainId
  };
}
