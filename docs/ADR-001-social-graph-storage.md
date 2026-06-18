# ADR-001: Social Graph Storage Redesign

## Status

**Accepted** — 2026-06-18

## Context

The current social graph implementation in `linkora-contracts` stores follow
relationships as `Vec<Address>` under `StorageKey::Following(Address)` and
`StorageKey::Followers(Address)`.  This design has three fundamental scaling
problems:

1. **Unbounded vector growth.**  A user with 100 000 followers stores a ~3.2 MB
   XDR blob under a single storage key.  Soroban's max entry size is ~64 KB.
   The contract will panic once a user crosses ~2 000 followers.

2. **O(n) unfollow.**  `unfollow` iterates the full `Vec` to find the target.
   At 2 000 followers this is 2 000 comparisons inside a metered environment.

3. **Monolithic TTL bumps.**  Each write bumps a single giant entry.  There is
   no way to batch-extend TTL for a large social graph without hitting the
   instruction limit.

## Decision Drivers

- Follow / unfollow must complete within **500 000 CPU instructions** at any
  realistic follower count.
- Pagination (`get_followers`, `get_following`) must be **O(limit)**, not O(n).
- TTL bumps must be batchable in **sub-50-ledger** windows.
- Migration from the current `Vec` layout must be chunk-safe and idempotent.
- No breaking changes to the public contract API.

---

## Options Considered

### Option 1: Linked-List Sharding

Split the follower list into fixed-size buckets (e.g. 200 entries per shard),
each stored under `StorageKey::FollowingShard(Address, u32)` with a head pointer.

| Metric | 10k followers | 100k followers | 1M followers |
|---|---|---|---|
| `follow` instructions | ~5 000 (append to tail shard) | ~5 000 | ~5 000 |
| `unfollow` instructions | ~100 000 (scan one shard, worst-case 200 comparisons + shard compaction) | ~100 000 | ~100 000 |
| `get_followers(50)` instructions | ~10 000 (single shard read) | ~10 000 | ~10 000 |
| Storage bytes per follower | ~40 bytes (in-shard) | ~40 bytes | ~40 bytes |

**TTL strategy:** Bump each shard independently.  At 200 entries/shard,
10k followers = 50 shards; batch-bump 50 shards per call = 1 call.

**Pros:**
- Pagination is straightforward (read shard by index).
- Bounded shard size stays within Soroban's 64 KB limit.

**Cons:**
- Unfollow requires scanning up to 200 entries within a shard to find the
  target, then compacting (shifting) elements — still O(shard_size).
- Cross-shard unfollow requires reading the shard containing the target,
  which needs either a secondary index or a linear scan across shards — O(n/shard_size).
- Complex migration: must repack existing Vec into multiple shard entries.

### Option 2: Bitmap Index

Represent the follow relationship as a per-user bitmap over a deterministic
address-to-index mapping.

| Metric | 10k followers | 100k followers | 1M followers |
|---|---|---|---|
| `follow` instructions | ~3 000 (set bit) | ~3 000 | ~3 000 |
| `unfollow` instructions | ~3 000 (clear bit) | ~3 000 | ~3 000 |
| `get_followers(50)` instructions | ~50 000 (scan bitmap for set bits) | ~500 000 | ~5 000 000 |
| Storage bytes per user | 1.25 KB (10k users) | 12.5 KB (100k users) | 125 KB (1M users — exceeds 64 KB limit) |

**TTL strategy:** Bump the bitmap entry.

**Pros:**
- O(1) follow/unfollow by bit manipulation.

**Cons:**
- **Bootstrapping problem:** Requires a global, deterministic `Address → index`
  mapping that must be established before any follow operation.  New addresses
  need to be assigned an index atomically.
- **Storage explosion:** At 1M users the bitmap is 125 KB — exceeds Soroban's
  64 KB entry limit, so the bitmap itself needs sharding.
- **Pagination is O(n):** Finding the k-th set bit in a bitmap requires
  scanning from the start.  Not suitable for efficient pagination.
- **Sparse users waste space:** Most users follow a tiny fraction of all users;
  bitmaps waste space on zeros.

### Option 3: Adjacency Set with Per-User Counters (Chosen)

Store each directed edge as an independent key:
`StorageKey::Edge(follower, followee) → bool`, and maintain per-user counters
(`FollowingCount`, `FollowersCount`) and ordered index entries
(`FollowingIdx(user, seq)`, `FollowersIdx(user, seq)`) for pagination.

| Metric | 10k followers | 100k followers | 1M followers |
|---|---|---|---|
| `follow` instructions | ~8 000 | ~8 000 | ~8 000 |
| `unfollow` instructions | ~6 000 | ~6 000 | ~6 000 |
| `get_followers(50)` instructions | ~15 000 | ~15 000 | ~15 000 |
| Storage bytes per edge | ~80 bytes (edge key + index entry × 2 sides) | ~80 bytes | ~80 bytes |

**TTL strategy:** Each edge and index entry is an independent storage key.
Batch-bump up to 50 keys per call using `extend_ttl` in a loop.

**Pros:**
- **O(1) follow/unfollow:** Single key write for the edge; O(1) counter
  increment/decrement; O(1) index append (follow) or O(1) edge removal +
  swap-remove on index (unfollow).
- **O(limit) pagination:** Read sequential index entries `[offset..offset+limit]`.
- **No size limits:** Each key is ~80 bytes; no single entry exceeds Soroban's
  64 KB limit regardless of follower count.
- **Independent TTL:** Each edge has its own TTL; batch bumps are trivial.
- **Simple migration:** Read old Vec entries, write new edge + index entries
  in chunks.

**Cons:**
- Higher per-edge storage overhead (two index entries + edge key vs. one Vec
  entry).
- Swap-remove on unfollow changes the order of the index, but pagination by
  insertion order is not required by the API.

---

## Decision

**Option 3: Adjacency Set with Per-User Counters** is chosen.

The constant-time operations, absence of size limits, and straightforward
pagination model make this the best fit for Soroban's metered execution
environment.

## Storage Layout

```
StorageKey::Edge(follower, followee)         → bool       // existence check
StorageKey::FollowingCount(user)             → u32        // total following count
StorageKey::FollowersCount(user)             → u32        // total followers count
StorageKey::FollowingIdx(user, seq)          → Address    // ordered index for pagination
StorageKey::FollowersIdx(user, seq)          → Address    // ordered index for pagination
```

### Follow Algorithm

1. Check `Edge(follower, followee)` does not exist.
2. Write `Edge(follower, followee) = true`.
3. Read `FollowingCount(follower)`, append `FollowingIdx(follower, count) = followee`,
   increment count.
4. Read `FollowersCount(followee)`, append `FollowersIdx(followee, count) = follower`,
   increment count.

### Unfollow Algorithm

1. Check `Edge(follower, followee)` exists; remove it.
2. Find the index position of `followee` in `FollowingIdx(follower, *)`.
   Swap with the last entry, remove the last entry, decrement `FollowingCount`.
3. Find the index position of `follower` in `FollowersIdx(followee, *)`.
   Swap with the last entry, remove the last entry, decrement `FollowersCount`.

> **Note:** Finding the index position for unfollow requires a reverse-lookup.
> We store `StorageKey::FollowingPos(follower, followee) → u32` to track
> each followee's position in the following-index, enabling O(1) swap-remove.
> Similarly `StorageKey::FollowersPos(followee, follower) → u32`.

### Pagination

```
get_following(user, offset, limit):
  count = FollowingCount(user)
  for seq in offset..min(offset+limit, count):
    result.push(FollowingIdx(user, seq))
  return result
```

This is O(limit), reading exactly `limit` storage keys.

## Migration Path

The `migrate_follow_graph(env, users: Vec<Address>)` admin function:

1. For each user in the batch (up to 50 per call):
   a. Read `Following(user)` → `Vec<Address>` (old layout).
   b. For each followee in the Vec, write the new edge + index entries.
   c. Remove the old `Following(user)` entry.
   d. Read `Followers(user)` → `Vec<Address>` (old layout).
   e. For each follower in the Vec, write the new edge + index entries
      (if not already written from the follower's side).
   f. Remove the old `Followers(user)` entry.
2. The function is **idempotent**: if `Edge(a, b)` already exists, skip it.
3. The function is **chunk-safe**: callers can split the user list across
   multiple transactions.

## Consequences

- **Storage cost increases** from ~32 bytes/edge (Vec entry) to ~80 bytes/edge
  (edge key + 2 index entries + 2 position entries).  This is acceptable given
  that the Vec approach hits the 64 KB wall at ~2 000 followers.
- All existing tests continue to pass because the public API signatures
  (`follow`, `unfollow`, `get_following`, `get_followers`) are unchanged.
- New stress tests validate O(1) instruction costs at 500 followers.

