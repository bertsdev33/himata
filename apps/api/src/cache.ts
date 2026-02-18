const TTL_SECONDS = 60 * 60 * 24; // 24 hours

export async function getCached(kv: KVNamespace, key: string) {
  const raw = await kv.get(key, "json");
  return raw ?? null;
}

export async function setCached(kv: KVNamespace, key: string, value: unknown) {
  await kv.put(key, JSON.stringify(value), { expirationTtl: TTL_SECONDS });
}
