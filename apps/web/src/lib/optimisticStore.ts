"use client";

import { useSyncExternalStore } from "react";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

export type FollowState = {
  isFollowing: boolean;
  followersCount: number;
  followingCount: number;
};

export type PendingState = {
  isPending: boolean;
};

export type LikeState = {
  isLiked: boolean;
  likeCount: number;
};

export type TipState = {
  tipTotal: number;
};

/* ────────────────────────────────────────────────────────────────────────── */
/*  Store internals                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

// Key format: `${followerAddress}:${followeeAddress}`
const followStateMap = new Map<string, FollowState>();
// Key format: `${followerAddress}:${followeeAddress}`
const pendingStateMap = new Map<string, PendingState>();
// Key format: `${userAddress}:${postId}`
const likeStateMap = new Map<string, LikeState>();
// Key format: `${postId}`
const tipStateMap = new Map<string, TipState>();

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Public API                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export const OptimisticStore = {
  setFollowState(key: string, state: FollowState) {
    followStateMap.set(key, state);
    notify();
  },

  getFollowState(key: string): FollowState | undefined {
    return followStateMap.get(key);
  },

  clearFollowState(key: string) {
    followStateMap.delete(key);
    notify();
  },

  setPending(key: string, state: PendingState) {
    pendingStateMap.set(key, state);
    notify();
  },

  getPending(key: string): PendingState | undefined {
    return pendingStateMap.get(key);
  },

  clearPending(key: string) {
    pendingStateMap.delete(key);
    notify();
  },

  isFollowing(address: string): boolean {
    for (const [key, state] of followStateMap) {
      if (key.endsWith(`:${address}`) && state.isFollowing) {
        return true;
      }
    }
    return false;
  },

  setFollowing(address: string, isFollowing: boolean): void {
    // Find and update all follow states for this address as followee
    for (const [key, state] of followStateMap) {
      if (key.endsWith(`:${address}`)) {
        followStateMap.set(key, { ...state, isFollowing });
      }
    }
    notify();
  },

  isPending(address: string): boolean {
    for (const [, state] of pendingStateMap) {
      if (state.isPending) return true;
    }
    return false;
  },

  setLikeState(key: string, state: LikeState) {
    likeStateMap.set(key, state);
    notify();
  },

  getLikeState(key: string): LikeState | undefined {
    return likeStateMap.get(key);
  },

  clearLikeState(key: string) {
    likeStateMap.delete(key);
    notify();
  },

  setTipState(key: string, state: TipState) {
    tipStateMap.set(key, state);
    notify();
  },

  getTipState(key: string): TipState | undefined {
    return tipStateMap.get(key);
  },

  clearTipState(key: string) {
    tipStateMap.delete(key);
    notify();
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/* ────────────────────────────────────────────────────────────────────────── */
/*  Hooks                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Returns the optimistic follow state if one exists, otherwise falls back
 * to `initialState`.
 */
export function useOptimisticFollow(
  follower: string | null,
  followee: string,
  initialState: FollowState
): FollowState {
  const key = `${follower}:${followee}`;

  const optimistic = useSyncExternalStore(
    subscribe,
    () => (follower ? OptimisticStore.getFollowState(key) : undefined),
    () => undefined
  );

  return optimistic ?? initialState;
}

/**
 * Returns the optimistic like state if one exists, otherwise falls back
 * to `initialState`.
 */
export function useOptimisticLike(
  user: string | null,
  postId: string | number,
  initialState: LikeState
): LikeState {
  const key = `${user}:${postId}`;

  const optimistic = useSyncExternalStore(
    subscribe,
    () => (user ? OptimisticStore.getLikeState(key) : undefined),
    () => undefined
  );

  return optimistic ?? initialState;
}

/**
 * Returns the optimistic tip state if one exists, otherwise falls back
 * to `initialState`.
 */
export function useOptimisticTip(postId: string | number, initialState: TipState): TipState {
  const key = `${postId}`;

  const optimistic = useSyncExternalStore(
    subscribe,
    () => OptimisticStore.getTipState(key),
    () => undefined
  );

  return optimistic ?? initialState;
}
