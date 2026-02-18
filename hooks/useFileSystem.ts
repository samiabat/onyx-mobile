import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { CHART_DIR, ROOT_DIR } from '@/constants/appConfig';
import type { Trade } from '@/utils/calculators';

export function useFileSystem() {
  const [status, requestPermission] = ImagePicker.useMediaLibraryPermissions();

  const initFileSystem = async () => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(CHART_DIR);
      if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(CHART_DIR, { intermediates: true });
    } catch (e) { console.error("Init Error:", e); }
  };

  const pickImages = async (): Promise<string[]> => {
    let perm = status;
    if (!perm?.granted) perm = await requestPermission();
    if (!perm.granted) { Alert.alert("Permission Denied", "Enable photo access."); return []; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, quality: 0.7 });
    if (!result.canceled) {
      const newUris: string[] = [];
      const dirInfo = await FileSystem.getInfoAsync(CHART_DIR);
      if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(CHART_DIR, { intermediates: true });
      for (const asset of result.assets) {
        const fileName = `chart_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.jpg`;
        await FileSystem.copyAsync({ from: asset.uri, to: CHART_DIR + fileName });
        newUris.push(CHART_DIR + fileName);
      }
      return newUris;
    }
    return [];
  };

  const exportData = async (
    history: Trade[],
    activeTrades: Trade[],
    strategies: any[],
    tags: string[],
    profile: any
  ): Promise<void> => {
    const allImagePaths = new Set<string>();
    const collectImages = (list: Trade[]) => {
      for (const trade of list) {
        for (const entry of trade.journal ?? []) {
          if (Array.isArray(entry.imageUris)) {
            entry.imageUris.forEach(uri => allImagePaths.add(uri));
          } else if (entry.imageUri) {
            allImagePaths.add(entry.imageUri);
          }
        }
      }
    };
    collectImages(history);
    collectImages(activeTrades);

    const imageBundle: Record<string, string> = {};
    for (const uri of allImagePaths) {
      if (!uri) continue;
      try {
        const filename = uri.split('/').pop()!;
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        imageBundle[filename] = base64;
      } catch (err) {
        console.log("Skip:", uri);
      }
    }

    const backupData = { history, activeTrades, strategies, tags, profile, imageBundle, timestamp: new Date().toISOString(), version: "4.1" };
    const fileUri = ROOT_DIR + `ONYX_Backup_${Date.now()}.json`;
    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(backupData));
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(fileUri);
  };

  const importData = async (): Promise<{
    history?: Trade[];
    activeTrades?: Trade[];
    strategies?: any[];
    tags?: string[];
    profile?: any;
  } | null> => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
    if (result.canceled) return null;
    const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri);
    const data = JSON.parse(fileContent);
    if (data.imageBundle) {
      await FileSystem.makeDirectoryAsync(CHART_DIR, { intermediates: true });
      for (const [filename, base64] of Object.entries(data.imageBundle)) {
        await FileSystem.writeAsStringAsync(CHART_DIR + filename, base64 as string, { encoding: FileSystem.EncodingType.Base64 });
      }
    }
    const fixPaths = (list: Trade[]) => list.map(t => ({ ...t, journal: t.journal?.map(j => ({ ...j, imageUris: j.imageUris ? j.imageUris.map(u => CHART_DIR + u.split('/').pop()) : [] })) }));
    return {
      strategies: data.strategies,
      tags: data.tags,
      profile: data.profile,
      history: data.history ? fixPaths(data.history) : undefined,
      activeTrades: data.activeTrades ? fixPaths(data.activeTrades) : undefined,
    };
  };

  return { initFileSystem, pickImages, exportData, importData };
}
