import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

export interface PickedImage {
  dataUri: string;
}

export async function pickImageAsDataUri(): Promise<{
  ok: boolean;
  image?: PickedImage;
  reason?: string;
}> {
  try {
    if (Platform.OS !== "web") {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        return { ok: false, reason: "Permissão à galeria negada" };
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.6,
      allowsMultipleSelection: false,
    });
    if (result.canceled) return { ok: false };
    const asset = result.assets?.[0];
    if (!asset) return { ok: false, reason: "Sem imagem selecionada" };
    if (asset.base64) {
      const mime = asset.mimeType ?? "image/jpeg";
      return {
        ok: true,
        image: { dataUri: `data:${mime};base64,${asset.base64}` },
      };
    }
    if (asset.uri && asset.uri.startsWith("data:")) {
      return { ok: true, image: { dataUri: asset.uri } };
    }
    return { ok: false, reason: "Não foi possível ler a imagem" };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Erro inesperado",
    };
  }
}

export function daysUntilExpiry(addedAtIso: string, lifetimeDays: number): number {
  const ms = lifetimeDays * 24 * 60 * 60 * 1000;
  const remaining = new Date(addedAtIso).getTime() + ms - Date.now();
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
}
