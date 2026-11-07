import { describe, expect, it } from "vitest";
import {
  evaluateSepoliaTransfer,
  normalizeEvmAddress,
  normalizeEvmTransactionHash,
  SEPOLIA_CHAIN_ID
} from "../lib/research-fund/evm-verification";

const base = {
  chainId: SEPOLIA_CHAIN_ID,
  transactionHash: "0x" + "a".repeat(64),
  transactionSucceeded: true,
  blockNumber: 100n,
  // 2 confirmations; the policy requires 3.
  latestBlockNumber: 101n,
  recipient: "0x1111111111111111111111111111111111111111",
  expectedRecipient: "0x1111111111111111111111111111111111111111",
  asset: "ETH" as const,
  amountBaseUnits: 1000000000000000n,
  minimumAmountBaseUnits: 1n
};

describe("Sepolia research-fund transfer policy", () => {
  it("normalizes valid EVM identifiers", () => {
    expect(normalizeEvmAddress("0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")).toBe("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(normalizeEvmTransactionHash("0x" + "A".repeat(64))).toBe("0x" + "a".repeat(64));
  });

  it("rejects malformed identifiers", () => {
    expect(() => normalizeEvmAddress("0x1234")).toThrow();
    expect(() => normalizeEvmTransactionHash("bad")).toThrow();
  });

  it("keeps transfers pending until the confirmation threshold", () => {
    expect(evaluateSepoliaTransfer(base)).toMatchObject({ status: "PENDING", confirmations: 2n });
    expect(evaluateSepoliaTransfer({ ...base, latestBlockNumber: 100n })).toMatchObject({ status: "PENDING", confirmations: 1n });
  });

  it("confirms only matching successful Sepolia transfers after threshold", () => {
    expect(evaluateSepoliaTransfer({ ...base, latestBlockNumber: 102n })).toMatchObject({
      status: "CONFIRMED",
      chainId: SEPOLIA_CHAIN_ID,
      amountBaseUnits: "1000000000000000"
    });
  });

  it("rejects mainnet or any unconfigured chain", () => {
    expect(evaluateSepoliaTransfer({ ...base, chainId: 1 })).toMatchObject({ status: "REJECTED" });
  });

  it("rejects failed transactions and wrong receiving wallets", () => {
    expect(evaluateSepoliaTransfer({ ...base, transactionSucceeded: false })).toMatchObject({ status: "REJECTED" });
    expect(evaluateSepoliaTransfer({ ...base, recipient: "0x2222222222222222222222222222222222222222" })).toMatchObject({ status: "REJECTED" });
  });

  it("rejects zero and below-minimum amounts without floating-point conversion", () => {
    expect(evaluateSepoliaTransfer({ ...base, amountBaseUnits: 0n })).toMatchObject({ status: "REJECTED" });
    expect(evaluateSepoliaTransfer({ ...base, amountBaseUnits: 1n, minimumAmountBaseUnits: 2n })).toMatchObject({ status: "REJECTED" });
  });

  it("requires the exact configured token contract for USDT-like token tests", () => {
    const token = {
      ...base,
      asset: "USDT" as const,
      tokenContract: "0x3333333333333333333333333333333333333333",
      expectedTokenContract: "0x3333333333333333333333333333333333333333"
    };
    expect(evaluateSepoliaTransfer(token)).toMatchObject({ status: "PENDING" });
    expect(evaluateSepoliaTransfer({ ...token, tokenContract: "0x4444444444444444444444444444444444444444" })).toMatchObject({ status: "REJECTED" });
  });

  it("does not treat a future or unknown block as confirmed", () => {
    expect(evaluateSepoliaTransfer({ ...base, latestBlockNumber: 99n })).toMatchObject({ status: "PENDING", confirmations: 0n });
  });
});
