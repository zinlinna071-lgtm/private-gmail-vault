import {
  evaluateSepoliaTransfer,
  normalizeEvmAddress,
  normalizeEvmTransactionHash,
  SEPOLIA_CHAIN_ID,
  SEPOLIA_MIN_CONFIRMATIONS,
  type EvmVerificationResult
} from "./evm-verification";

export type JsonRpcClient = {
  request<T>(method: string, params: readonly unknown[]): Promise<T>;
};

type RpcTransaction = {
  hash?: string;
  to?: string | null;
  value?: string;
  input?: string;
  blockNumber?: string | null;
  blockHash?: string | null;
};

type RpcReceiptLog = {
  address?: string;
  topics?: string[];
  data?: string;
  logIndex?: string;
};

type RpcReceipt = {
  transactionHash?: string;
  status?: string;
  blockNumber?: string | null;
  blockHash?: string | null;
  logs?: RpcReceiptLog[];
};

type RpcBlock = {
  number?: string;
  hash?: string;
  timestamp?: string;
};

export type SepoliaVerificationRequest = {
  transactionHash: string;
  expectedRecipient: string;
  asset: "ETH" | "USDT";
  minimumAmountBaseUnits: bigint;
  expectedTokenContract?: string;
  requiredConfirmations?: number;
};

export type SepoliaVerificationResult =
  | { status: "REJECTED"; reason: string }
  | { status: "PENDING"; reason: string; confirmations: bigint; requiredConfirmations: bigint }
  | { status: "REVIEW_REQUIRED"; reason: string }
  | {
      status: "CONFIRMED";
      transactionHash: string;
      chainId: number;
      asset: "ETH" | "USDT";
      amountBaseUnits: string;
      confirmations: bigint;
      requiredConfirmations: bigint;
      blockNumber: string;
      blockHash: string;
      blockTimestamp: string;
      transferIndex: string | null;
    };

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const HEX_QUANTITY = /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
const HEX_DATA_32 = /^0x[0-9a-fA-F]{64}$/;

function parseQuantity(value: unknown, field: string): bigint {
  if (typeof value !== "string" || !HEX_QUANTITY.test(value)) {
    throw new Error("Malformed RPC " + field);
  }
  return BigInt(value);
}

function parseHash(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error("Missing RPC " + field);
  return normalizeEvmTransactionHash(value);
}

function parseBlockNumber(value: unknown, field: string): bigint {
  return parseQuantity(value, field);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidLog(log: RpcReceiptLog): boolean {
  return typeof log.address === "string" &&
    Array.isArray(log.topics) &&
    typeof log.data === "string" &&
    HEX_DATA_32.test(log.data) &&
    typeof log.logIndex === "string" &&
    HEX_QUANTITY.test(log.logIndex);
}

function topicAddress(topic: string): string {
  if (!/^0x[0-9a-fA-F]{64}$/.test(topic) || !/^0{24}[0-9a-fA-F]{40}$/.test(topic.slice(2))) {
    throw new Error("Malformed indexed transfer address");
  }
  return normalizeEvmAddress("0x" + topic.slice(-40));
}

/**
 * Reads and validates one Sepolia transfer using a server-controlled RPC client.
 * It never signs, broadcasts, or accesses wallet secrets.
 *
 * A CONFIRMED result is still a testnet verification result, not a real donation
 * or an independently audited accounting entry.
 */
export async function verifySepoliaTransaction(
  rpc: JsonRpcClient,
  request: SepoliaVerificationRequest
): Promise<SepoliaVerificationResult> {
  let transactionHash: string;
  let expectedRecipient: string;
  let expectedTokenContract: string | undefined;
  try {
    transactionHash = normalizeEvmTransactionHash(request.transactionHash);
    expectedRecipient = normalizeEvmAddress(request.expectedRecipient);
    if (request.asset === "USDT") {
      if (!request.expectedTokenContract) {
        return { status: "REJECTED", reason: "A configured Sepolia token contract is required" };
      }
      expectedTokenContract = normalizeEvmAddress(request.expectedTokenContract);
    }
    if (request.minimumAmountBaseUnits < 0n) {
      return { status: "REJECTED", reason: "Minimum amount cannot be negative" };
    }
  } catch {
    return { status: "REJECTED", reason: "Malformed verification request" };
  }

  const requiredConfirmations = request.requiredConfirmations ?? SEPOLIA_MIN_CONFIRMATIONS;
  if (!Number.isSafeInteger(requiredConfirmations) || requiredConfirmations < 1) {
    return { status: "REJECTED", reason: "Invalid confirmation policy" };
  }

  try {
    const chainId = Number(parseQuantity(await rpc.request<string>("eth_chainId", []), "chain ID"));
    if (chainId !== SEPOLIA_CHAIN_ID) {
      return { status: "REJECTED", reason: "RPC endpoint is not Sepolia" };
    }

    const [txValue, receiptValue, latestBlockValue] = await Promise.all([
      rpc.request<unknown>("eth_getTransactionByHash", [transactionHash]),
      rpc.request<unknown>("eth_getTransactionReceipt", [transactionHash]),
      rpc.request<unknown>("eth_getBlockByNumber", ["latest", false])
    ]);

    if (txValue === null || receiptValue === null) {
      return {
        status: "PENDING",
        reason: "Transaction or receipt is not yet available",
        confirmations: 0n,
        requiredConfirmations: BigInt(requiredConfirmations)
      };
    }
    if (!isRecord(txValue) || !isRecord(receiptValue) || !isRecord(latestBlockValue)) {
      return { status: "REVIEW_REQUIRED", reason: "RPC returned an unexpected response shape" };
    }

    const tx = txValue as RpcTransaction;
    const receipt = receiptValue as RpcReceipt;
    const latestBlock = latestBlockValue as RpcBlock;

    if (parseHash(tx.hash, "transaction hash") !== transactionHash ||
        parseHash(receipt.transactionHash, "receipt transaction hash") !== transactionHash) {
      return { status: "REVIEW_REQUIRED", reason: "RPC transaction identifiers do not agree" };
    }
    if (receipt.status !== "0x1") {
      return { status: "REJECTED", reason: "Transaction execution failed or status is not successful" };
    }

    const txBlock = parseBlockNumber(tx.blockNumber, "transaction block number");
    const receiptBlock = parseBlockNumber(receipt.blockNumber, "receipt block number");
    const txBlockHash = parseHash(tx.blockHash, "transaction block hash");
    const receiptBlockHash = parseHash(receipt.blockHash, "receipt block hash");
    if (txBlock !== receiptBlock || txBlockHash !== receiptBlockHash) {
      return { status: "REVIEW_REQUIRED", reason: "Transaction and receipt block inclusion disagree" };
    }

    const canonicalBlockValue = await rpc.request<unknown>("eth_getBlockByNumber", [
      "0x" + txBlock.toString(16), false
    ]);
    if (!isRecord(canonicalBlockValue)) {
      return { status: "PENDING", reason: "Included block is not currently available", confirmations: 0n,
        requiredConfirmations: BigInt(requiredConfirmations) };
    }
    const canonicalBlock = canonicalBlockValue as RpcBlock;
    if (parseHash(canonicalBlock.hash, "canonical block hash") !== receiptBlockHash) {
      return { status: "REVIEW_REQUIRED", reason: "Receipt block is not the canonical block at this height" };
    }
    if (parseBlockNumber(canonicalBlock.number, "canonical block number") !== txBlock) {
      return { status: "REVIEW_REQUIRED", reason: "Canonical block height does not match receipt" };
    }

    const latestBlockNumber = parseBlockNumber(latestBlock.number, "latest block number");
    const blockTimestamp = parseQuantity(canonicalBlock.timestamp, "block timestamp");
    const confirmations = latestBlockNumber >= txBlock ? latestBlockNumber - txBlock + 1n : 0n;

    let recipient: string;
    let amountBaseUnits: bigint;
    let transferIndex: string | null = null;
    let tokenContract: string | undefined;

    if (request.asset === "ETH") {
      if (typeof tx.to !== "string" || normalizeEvmAddress(tx.to) !== expectedRecipient) {
        return { status: "REJECTED", reason: "Native transfer recipient does not match configured test wallet" };
      }
      if (tx.input !== "0x") {
        return { status: "REJECTED", reason: "Contract interaction is not a plain native-asset transfer" };
      }
      recipient = expectedRecipient;
      amountBaseUnits = parseQuantity(tx.value, "native transfer value");
    } else {
      if (typeof tx.to !== "string" || normalizeEvmAddress(tx.to) !== expectedTokenContract) {
        return { status: "REJECTED", reason: "Transaction target is not the configured token contract" };
      }
      const logs = Array.isArray(receipt.logs) ? receipt.logs : [];
      const matches = logs.filter((log) => {
        if (!isValidLog(log) || log.topics!.length !== 3) return false;
        try {
          return normalizeEvmAddress(log.address!) === expectedTokenContract &&
            log.topics![0].toLowerCase() === TRANSFER_TOPIC &&
            topicAddress(log.topics![2]) === expectedRecipient;
        } catch {
          return false;
        }
      });
      if (matches.length === 0) {
        return { status: "REJECTED", reason: "No matching configured-token Transfer event was found" };
      }
      if (matches.length !== 1) {
        return { status: "REVIEW_REQUIRED", reason: "Multiple matching token transfers require separate log-level review" };
      }
      const log = matches[0];
      recipient = expectedRecipient;
      amountBaseUnits = BigInt(log.data!);
      transferIndex = parseQuantity(log.logIndex, "token transfer log index").toString();
      tokenContract = normalizeEvmAddress(log.address!);
    }

    const policy: EvmVerificationResult = evaluateSepoliaTransfer({
      chainId,
      transactionHash,
      transactionSucceeded: true,
      blockNumber: txBlock,
      latestBlockNumber,
      recipient,
      expectedRecipient,
      asset: request.asset,
      tokenContract,
      expectedTokenContract,
      amountBaseUnits,
      minimumAmountBaseUnits: request.minimumAmountBaseUnits
    }, requiredConfirmations);

    if (policy.status === "REJECTED") return policy;
    if (policy.status === "PENDING") {
      return {
        status: "PENDING",
        reason: "Transfer is valid so far but has not reached the confirmation threshold",
        confirmations: policy.confirmations,
        requiredConfirmations: policy.requiredConfirmations
      };
    }

    return {
      status: "CONFIRMED",
      transactionHash: policy.transactionHash,
      chainId: policy.chainId,
      asset: policy.asset,
      amountBaseUnits: policy.amountBaseUnits,
      confirmations: policy.confirmations,
      requiredConfirmations: policy.requiredConfirmations,
      blockNumber: txBlock.toString(),
      blockHash: receiptBlockHash,
      blockTimestamp: blockTimestamp.toString(),
      transferIndex
    };
  } catch {
    return { status: "REVIEW_REQUIRED", reason: "RPC response was unavailable or failed strict validation" };
  }
}
