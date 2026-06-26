"use client";

import { useState, useEffect } from "react";
import { validateStellarAddress } from "@/lib/validate";

export function BlockListSection() {
  const [blockedList, setBlockedList] = useState<string[]>([]);
  const [newAddress, setNewAddress] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("linkora_blocked_accounts");
    if (stored) {
      try {
        setBlockedList(JSON.parse(stored));
      } catch (err) {
        console.error("Failed to parse blocked accounts", err);
      }
    }
  }, []);

  function saveBlockedList(list: string[]) {
    setBlockedList(list);
    localStorage.setItem("linkora_blocked_accounts", JSON.stringify(list));
  }

  function handleBlockAddress(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const trimmed = newAddress.trim();
    if (!trimmed) {
      setError("Please enter a wallet address.");
      return;
    }

    const validation = validateStellarAddress(trimmed);
    if (!validation.valid) {
      setError(validation.error || "Invalid Stellar address.");
      return;
    }

    if (blockedList.includes(trimmed)) {
      setError("Address is already blocked.");
      return;
    }

    const updated = [...blockedList, trimmed];
    saveBlockedList(updated);
    setNewAddress("");
    setSuccess("Address blocked successfully.");
    setTimeout(() => setSuccess(""), 3000);
  }

  function handleUnblockAddress(addressToUnblock: string) {
    setError("");
    setSuccess("");
    const updated = blockedList.filter((addr) => addr !== addressToUnblock);
    saveBlockedList(updated);
    setSuccess("Address unblocked successfully.");
    setTimeout(() => setSuccess(""), 3000);
  }

  return (
    <section className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-xl font-semibold mb-4">Block List</h2>
      <p className="text-sm text-gray-600 mb-4">
        Manage accounts you have blocked. Blocked accounts cannot follow you or view your posts.
      </p>

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          {success}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleBlockAddress} className="flex gap-3 mb-6" aria-label="Block an account">
        <div className="flex-1">
          <label htmlFor="block-address-input" className="sr-only">
            Stellar Wallet Address to Block
          </label>
          <input
            id="block-address-input"
            type="text"
            value={newAddress}
            onChange={(e) => {
              setNewAddress(e.target.value);
              if (error) setError("");
            }}
            placeholder="Enter Stellar address (G...)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors whitespace-nowrap"
        >
          Block Address
        </button>
      </form>

      {blockedList.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
          No blocked accounts.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-150 rounded-lg max-h-60 overflow-y-auto">
          {blockedList.map((addr) => (
            <li key={addr} className="flex items-center justify-between p-3 gap-4">
              <span className="text-xs font-mono text-gray-700 break-all select-all">{addr}</span>
              <button
                type="button"
                onClick={() => handleUnblockAddress(addr)}
                className="px-2.5 py-1 text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 rounded hover:bg-red-50 transition-colors"
              >
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
