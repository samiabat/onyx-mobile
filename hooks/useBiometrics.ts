import { useState } from 'react';
import { Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_PROFILE } from '@/constants/appConfig';

export function useBiometrics() {
  const [isLocked, setIsLocked] = useState(false);

  const authenticate = async () => {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock ONYX' });
    if (result.success) setIsLocked(false);
    else Alert.alert("Locked", "Authentication failed. Try again.", [{ text: "Retry", onPress: authenticate }]);
  };

  const checkBiometrics = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const savedProfile = await AsyncStorage.getItem('onyx_profile');
    const parsedProfile = savedProfile ? JSON.parse(savedProfile) : DEFAULT_PROFILE;

    if (hasHardware && isEnrolled && parsedProfile.biometricsEnabled) {
      setIsLocked(true);
      authenticate();
    }
  };

  return { isLocked, authenticate, checkBiometrics };
}
