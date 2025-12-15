import { saveScanToHistory } from '@/utils/historyService';
import { initializeNotifications } from '@/utils/notificationService';
import { analyzeUrl } from '@/utils/safetycheck';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window'); 

useEffect(() => {
  initializeNotifications(); 
}, []);

export default function TabOneScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={80} color="#007AFF" />
        <Text style={styles.permissionTitle}>Camera Access</Text>
        <Text style={styles.permissionText}>
          QR Guardian needs camera access to scan QR codes and protect you from malicious links.
        </Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permissionButton}>
          <Text style={styles.permissionButtonText}>Grant Camera Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (!isScanning || isAnalyzing) return;
    
    setIsScanning(false);
    setIsAnalyzing(true);
    
    const result = await analyzeUrl(data);

    await saveScanToHistory({ 
      url: data,
      safetyRating: result.rating,
      score: result.score,
      issues: result.issues,
    });

    setIsAnalyzing(false);

    // Ensure torch is turned off when leaving the scanner
    setIsTorchOn(false);

    // Navigate to dedicated result screen, passing data via params
    router.push({
      pathname: '/result',
      params: {
        url: data,
        rating: result.rating,
        score: String(result.score),
        issues: JSON.stringify(result.issues),
      },
    });

    // Re-enable scanning when user comes back
    setIsScanning(true);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="qr-code" size={28} color="#FFFFFF" />
        <View style={styles.headerTextGroup}>
          <Text style={styles.title}>QR Guardian</Text>
          <Text style={styles.subtitle}>Real-time QR safety scanner</Text>
        </View>
        <View style={styles.headerIcon} />
      </View>

      <View style={styles.statusRow}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>Live protection is active</Text>
      </View>

      {/* Camera View */}
      <LinearGradient
        colors={["#2F80ED", "#1C1C1E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cameraGradient}
      >
        <View style={styles.cameraContainer}>
          <CameraView 
            style={styles.camera}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            enableTorch={isTorchOn}
            onBarcodeScanned={isScanning ? handleBarcodeScanned : undefined}
          />
          
          {/* Scanning Frame Overlay */}
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>

          {/* Scanning Text */}
          {isScanning && (
            <View style={styles.scanningTextContainer}>
              <Text style={styles.scanningText}>Align QR code within frame</Text>
            </View>
          )}

          {/* Flashlight Toggle */}
          <View style={styles.flashContainer}>
            <TouchableOpacity
              style={[styles.flashPill, isTorchOn && styles.flashPillActive]}
              onPress={() => setIsTorchOn((prev) => !prev)}
              activeOpacity={0.9}
            >
              <View style={styles.flashPillInner}>
                <View
                  style={[
                    styles.flashIconWrapper,
                    isTorchOn && styles.flashIconWrapperActive,
                  ]}
                >
                  <Ionicons
                    name={isTorchOn ? 'flash' : 'flash-off'}
                    size={18}
                    color={isTorchOn ? '#000000' : '#FFD60A'}
                  />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Results moved to dedicated /result screen */}

      {/* Analyzing Overlay */}
      {isAnalyzing && (
        <View style={styles.analyzingOverlay}>
          <View style={styles.analyzingCard}>
            <Ionicons name="shield-outline" size={50} color="#007AFF" />
            <Text style={styles.analyzingTitle}>Analyzing Safety</Text>
            <Text style={styles.analyzingText}>Checking against security databases...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTextGroup: {
    flexDirection: 'column',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 2,
  },
  headerIcon: {
    width: 28,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
    marginRight: 8,
  },
  statusText: {
    color: '#8E8E93',
    fontSize: 12,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  permissionText: {
    color: '#8E8E93',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cameraGradient: {
    flex: 1,
    marginHorizontal: 20,
    marginVertical: 16,
    borderRadius: 24,
    padding: 2,
  },
  cameraContainer: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  scanFrame: {
    position: 'absolute',
    top: '25%',
    left: '10%',
    right: '10%',
    bottom: '25%',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 12,
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#007AFF',
  },
  cornerTL: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  scanningTextContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scanningText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  flashContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  flashPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(0,0,0,0.55)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  flashPillActive: {
    borderColor: '#FFD60A',
    backgroundColor: 'rgba(255,214,10,0.15)',
  },
  flashPillInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flashIconWrapper: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,214,10,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  flashIconWrapperActive: {
    backgroundColor: '#FFD60A',
  },
  flashLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  scanAgainButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 12, // Added margin to separate from favorite button
  },
  scanAgainText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzingCard: {
    backgroundColor: '#2C2C2E',
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    margin: 20,
  },
  analyzingTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  analyzingText: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
  },
});