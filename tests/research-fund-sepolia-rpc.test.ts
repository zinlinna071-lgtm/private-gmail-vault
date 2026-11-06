import { describe, expect, it, vi } from "vitest";
import {
  verifySepoliaTransaction,
  type JsonRpcClient
} from "../lib/research-fund/sepolia-rpc";

const hash = "0x" + "a".repeat(64);
const wallet = "0x1111111111111111111111111111111111111111";
const token = "0x2222222222222222222222222222222222222222";
const blockHash = "0x" + "b".repeat(64);
const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const recipientTopic = "0x" + "0".repeat(24) + wallet.slice(2);

function fixture(overrides: Record<string, unknown> = {}) {
  const tx = {
    hash,
    to: wallet,
    value: "0x38d7ea4c68000",
    input: "0x",
    blockNumber: "0x64",
    blockHash
  };
  const receipt = {
    transactionHash: hash,
    status: "0x1",
    blockNumber: "0x64",
    blockHash,
    logs: []
  };
  const latest = { number: "0x66" };
  const canonical = { number: "0x64", hash: blockHash, timestamp: "0x6553f100" };
  const responses: Record<string, unknown> = {
    eth_chainId: "0xaa36a7",
    eth_getTransactionByHash: tx,
    eth_getTransactionReceipt: receipt,
    "eth_getBlockByNumber:latest": latest,
    "eth_getBlockByNumber:0x64": canonical
  };
  Object.assign(responses, overrides);
  const rpc: JsonRpcClient = {
    request: vi.fn(async (method: string, params: readonly unknown[]) => {
      const key = method === "eth_getBlockByNumber" ? method + ":" + params[0] : method;
      return responses[key] as never;
    })
  };
  return { rpc, tx, receipt, responses };
}

describe("read-only Sepolia RPC transfer verifier", () => {
  it("confirms a plain native transfer only after canonical inclusion and confirmations", async () => {
    const { rpc } = fixture();
    const result = await verifySepoliaTransaction(rpc, {
      transactionHash: hash,
      expectedRecipient: wallet,
      asset: "ETH",
      minimumAmountBaseUnits: 1n
    });
    expect(result).toMatchObject({
      status: "CONFIRMED",
      chainId: 11155111,
      asset: "ETH",
      amountBaseUnits: "1000000000000000",
      blockNumber: "100",
      transferIndex: null
    });
  });

  it("rejects a non-Sepolia RPC chain", async () => {
    const { rpc } = fixture({ eth_chainId: "0x1" });
    await expect(verifySepoliaTransaction(rpc, {
      transactionHash: hash, expectedRecipient: wallet, asset: "ETH", minimumAmountBaseUnits: 1n
    })).resolves.toMatchObject({ status: "REJECTED", reason: "RPC endpoint is not Sepolia" });
  });

  it("keeps an unknown transaction pending", async () => {
    const { rpc } = fixture({
      eth_getTransactionByHash: null,
      eth_getTransactionReceipt: null
    });
    await expect(verifySepoliaTransaction(rpc, {
      transactionHash: hash, expectedRecipient: wallet, asset: "ETH", minimumAmountBaseUnits: 1n
    })).resolves.toMatchObject({ status: "PENDING", confirmations: 0n });
  });

  it("rejects failed receipts and wrong recipients", async () => {
    const failed = fixture();
    failed.receipt.status = "0x0";
    await expect(verifySepoliaTransaction(failed.rpc, {
      transactionHash: hash, expectedRecipient: wallet, asset: "ETH", minimumAmountBaseUnits: 1n
    })).resolves.toMatchObject({ status: "REJECTED" });

    const wrong = fixture();
    wrong.tx.to = "0x3333333333333333333333333333333333333333";
    await expect(verifySepoliaTransaction(wrong.rpc, {
      transactionHash: hash, expectedRecipient: wallet, asset: "ETH", minimumAmountBaseUnits: 1n
    })).resolves.toMatchObject({ status: "REJECTED" });
  });

  it("rejects contract calls masquerading as native transfers", async () => {
    const { rpc, tx } = fixture();
    tx.input = "0xa9059cbb";
    await expect(verifySepoliaTransaction(rpc, {
      transactionHash: hash, expectedRecipient: wallet, asset: "ETH", minimumAmountBaseUnits: 1n
    })).resolves.toMatchObject({ status: "REJECTED" });
  });

  it("requires the exact configured token contract and recipient Transfer log", async () => {
    const log = {
      address: token,
      topics: [transferTopic, "0x" + "0".repeat(64), recipientTopic],
      data: "0x" + BigInt(2500000).toString(16).padStart(64, "0"),
      logIndex: "0x2"
    };
    const { rpc, tx, receipt } = fixture();
    tx.to = token;
    tx.input = "0xa9059cbb";
    receipt.logs = [log];

    const result = await verifySepoliaTransaction(rpc, {
      transactionHash: hash,
      expectedRecipient: wallet,
      asset: "USDT",
      expectedTokenContract: token,
      minimumAmountBaseUnits: 1n
    });
    expect(result).toMatchObject({
      status: "CONFIRMED",
      asset: "USDT",
      amountBaseUnits: "2500000",
      transferIndex: "2"
    });
  });

  it("requires a token contract configuration and rejects spoofed contracts", async () => {
    const { rpc, tx, receipt } = fixture();
    tx.to = token;
    receipt.logs = [{
      address: "0x4444444444444444444444444444444444444444",
      topics: [transferTopic, "0x" + "0".repeat(64), recipientTopic],
      data: "0x" + "1".padStart(64, "0"),
      logIndex: "0x0"
    }];
    await expect(verifySepoliaTransaction(rpc, {
      transactionHash: hash, expectedRecipient: wallet, asset: "USDT", minimumAmountBaseUnits: 1n
    })).resolves.toMatchObject({ status: "REJECTED" });

    await expect(verifySepoliaTransaction(rpc, {
      transactionHash: hash, expectedRecipient: wallet, asset: "USDT",
      expectedTokenContract: token, minimumAmountBaseUnits: 1n
    })).resolves.toMatchObject({ status: "REJECTED" });
  });

  it("moves inconsistent block evidence to review instead of confirming", async () => {
    const { rpc, receipt } = fixture();
    receipt.blockHash = "0x" + "c".repeat(64);
    await expect(verifySepoliaTransaction(rpc, {
      transactionHash: hash, expectedRecipient: wallet, asset: "ETH", minimumAmountBaseUnits: 1n
    })).resolves.toMatchObject({ status: "REVIEW_REQUIRED" });
  });

  it("keeps transfers pending below the configured confirmation threshold", async () => {
    const { rpc } = fixture({ "eth_getBlockByNumber:latest": { number: "0x65" } });
    await expect(verifySepoliaTransaction(rpc, {
      transactionHash: hash, expectedRecipient: wallet, asset: "ETH",
      minimumAmountBaseUnits: 1n, requiredConfirmations: 3
    })).resolves.toMatchObject({ status: "PENDING", confirmations: 2n, requiredConfirmations: 3n });
  });

  it("rejects an amount below the configured minimum", async () => {
    const { rpc, tx } = fixture();
    tx.value = "0x1";
    await expect(verifySepoliaTransaction(rpc, {
      transactionHash: hash, expectedRecipient: wallet, asset: "ETH", minimumAmountBaseUnits: 2n
    })).resolves.toMatchObject({ status: "REJECTED" });
  });
});
