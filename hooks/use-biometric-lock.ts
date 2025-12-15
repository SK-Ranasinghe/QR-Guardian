import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useState } from 'react';

export function useBiometricLock() {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const runAuth = async () => {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (!hasHardware || !isEnrolled) {
          // No biometrics available; allow access
          if (!cancelled) {
            setIsAuthenticated(true);
            setIsChecking(false);
          }
          return;
        }

        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock QRGuardian',
          fallbackLabel: 'Use device passcode',
        });

        if (!cancelled) {
          setIsAuthenticated(result.success);
          setErrorMessage(result.success ? null : 'Authentication failed');
          setIsChecking(false);
        }
      } catch (error) {
        console.log('Biometric auth error', error);
        if (!cancelled) {
          setIsAuthenticated(true); // fail open to avoid locking user out
          setIsChecking(false);
        }
      }
    };

    runAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  return { isChecking, isAuthenticated, errorMessage };
}
