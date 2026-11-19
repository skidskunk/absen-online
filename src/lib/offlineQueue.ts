export interface QueuedAttendance {
  id: string;
  type: "datang" | "pulang";
  payload: any;
  timestamp: number;
}

const STORAGE_KEY = "absensi_offline_queue";

export function getOfflineQueue(): QueuedAttendance[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveToOfflineQueue(
  type: "datang" | "pulang",
  payload: any
): QueuedAttendance {
  const current = getOfflineQueue();
  const newItem: QueuedAttendance = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type,
    payload,
    timestamp: Date.now(),
  };
  current.push(newItem);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.error("Gagal menyimpan ke offline queue:", err);
  }
  return newItem;
}

export function removeOfflineQueueItem(id: string) {
  const current = getOfflineQueue();
  const updated = current.filter((item) => item.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Gagal update offline queue:", err);
  }
}

export async function processOfflineQueue(
  onItemSynced?: (item: QueuedAttendance, success: boolean, message: string) => void
): Promise<{ total: number; synced: number }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { total: 0, synced: 0 };

  let synced = 0;

  for (const item of queue) {
    const endpoint =
      item.type === "datang" ? "/api/absen/datang" : "/api/absen/pulang";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        removeOfflineQueueItem(item.id);
        synced++;
        if (onItemSynced) onItemSynced(item, true, data.message);
      } else {
        if (onItemSynced) onItemSynced(item, false, data.message || "Gagal sinkron");
      }
    } catch (err: any) {
      if (onItemSynced) onItemSynced(item, false, err.message || "Network error");
    }
  }

  return { total: queue.length, synced };
}
