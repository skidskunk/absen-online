import { SupabaseClient } from "@supabase/supabase-js";
import { OfficeConfig } from "@/types/database";

export const DEFAULT_OFFICE_CONFIG: OfficeConfig = {
  kantorLat: -5.144764422898236,
  kantorLng: 119.45574635175397,
  kantorNama: "Kantor Dinas - Mamuju",
  radiusMeter: 200,
};

export async function getOfficeConfig(
  supabase: SupabaseClient
): Promise<OfficeConfig> {
  try {
    const { data, error } = await supabase.from("app_config").select("key, value");

    if (error || !data || data.length === 0) {
      return DEFAULT_OFFICE_CONFIG;
    }

    const configMap: Record<string, string> = {};
    for (const item of data) {
      configMap[item.key] = item.value;
    }

    return {
      kantorLat: configMap["kantor_lat"]
        ? parseFloat(configMap["kantor_lat"])
        : DEFAULT_OFFICE_CONFIG.kantorLat,
      kantorLng: configMap["kantor_lng"]
        ? parseFloat(configMap["kantor_lng"])
        : DEFAULT_OFFICE_CONFIG.kantorLng,
      kantorNama: configMap["kantor_nama"] || DEFAULT_OFFICE_CONFIG.kantorNama,
      radiusMeter: configMap["radius_meter"]
        ? parseInt(configMap["radius_meter"], 10)
        : DEFAULT_OFFICE_CONFIG.radiusMeter,
    };
  } catch (err) {
    console.error("Gagal mengambil app_config, menggunakan default:", err);
    return DEFAULT_OFFICE_CONFIG;
  }
}
