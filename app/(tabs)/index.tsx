import { GlassCard, ShimmerBlock } from '@/components/ui/premium-ui';
import { saveScanToHistory } from '@/utils/historyService';
import { initializeNotifications } from '@/utils/notificationService';
import { analyzeUrl } from '@/utils/safetycheck';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window'); 
const SCAN_FRAME_SIZE = width * 0.72;
const LASER_TRAVEL = SCAN_FRAME_SIZE - 18;
const CAMERA_CARD_HEIGHT = Math.max(420, Math.min(height * 0.66, 620));

export default function TabOneScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const laserProgress = useSharedValue(0);
  const scannerPulse = useSharedValue(0.35);

  useEffect(() => {
    initializeNotifications(); 
  }, []);

  useEffect(() => {
    if (isScanning && !isAnalyzing) {
      laserProgress.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );

      scannerPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.35, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
      return;
    }

    laserProgress.value = withTiming(0, { duration: 300 });
    scannerPulse.value = withTiming(0.25, { duration: 300 });
  }, [isAnalyzing, isScanning, laserProgress, scannerPulse]);

  const laserStyle = useAnimatedStyle(() => ({
    opacity: isScanning && !isAnalyzing ? 0.95 : 0,
    transform: [{ translateY: laserProgress.value * LASER_TRAVEL }],
  }));

  const scanFrameStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      scannerPulse.value,
      [0.35, 1],
      ['rgba(56,189,248,0.45)', 'rgba(0,255,65,0.95)'],
    ),
    shadowOpacity: 0.25 + scannerPulse.value * 0.45,
    shadowRadius: 12 + scannerPulse.value * 18,
  }));

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <LinearGradient
          colors={['#000000', '#020617', '#000000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <GlassCard style={styles.permissionCard} glowColor="rgba(56,189,248,0.26)">
          <View style={styles.permissionIconWrap}>
            <Ionicons name="camera-outline" size={64} color="#38BDF8" />
          </View>
          <Text style={styles.permissionTitle}>Camera Access</Text>
          <Text style={styles.permissionText}>
            QR Guardian needs camera access to scan QR codes and intercept unsafe links before they open.
          </Text>
          <TouchableOpacity onPress={requestPermission} style={styles.permissionButton} activeOpacity={0.9}>
            <LinearGradient
              colors={['#0EA5E9', '#22D3EE', '#00FF41']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.permissionButtonGradient}
            >
              <Text style={styles.permissionButtonText}>Grant Camera Access</Text>
            </LinearGradient>
          </TouchableOpacity>
        </GlassCard>
      </View>
    );
  }

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (!isScanning || isAnalyzing) return;
    
    setIsScanning(false);
    setIsAnalyzing(true);
    
    const result = await analyzeUrl(data);

    if (result.rating === 'SAFE') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (result.rating === 'DANGEROUS') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

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
      <LinearGradient
        colors={['#000000', '#020617', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <GlassCard style={styles.headerCard} glowColor="rgba(0,255,65,0.14)">
        <View style={styles.header}>
          <View style={styles.headerBrandWrap}>
            <LinearGradient
              colors={['rgba(14,165,233,0.28)', 'rgba(0,255,65,0.18)']}
              style={styles.headerIconBubble}
            >
              <Ionicons name="qr-code" size={24} color="#E2F3FF" />
            </LinearGradient>
            <View style={styles.headerTextGroup}>
              <Text style={styles.title}>QR Guardian</Text>
              <Text style={styles.subtitle}>Premium cyber-security interception</Text>
            </View>
          </View>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Live protection active</Text>
          </View>
        </View>
      </GlassCard>

      <GlassCard style={styles.cameraGradient} glowColor="rgba(56,189,248,0.18)" contentStyle={styles.cameraGlassInner} fill>
        <View style={styles.cameraContainer}>
          <CameraView 
            style={styles.camera}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            enableTorch={isTorchOn}
            onBarcodeScanned={isScanning ? handleBarcodeScanned : undefined}
          />

          <LinearGradient
            colors={['rgba(2,6,23,0.12)', 'rgba(2,6,23,0.62)', 'rgba(0,0,0,0.88)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.cameraOverlay}
          />
          
          <Animated.View style={[styles.scanFrame, scanFrameStyle]}>
            <LinearGradient
              colors={['rgba(56,189,248,0.08)', 'rgba(0,255,65,0.02)']}
              style={StyleSheet.absoluteFillObject}
            />
            <Animated.View style={[styles.laserLineWrap, laserStyle]}>
              <LinearGradient
                colors={['rgba(0,255,65,0)', 'rgba(0,255,65,0.85)', 'rgba(255,255,255,0.95)', 'rgba(0,255,65,0)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.laserLine}
              />
            </Animated.View>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            <View style={styles.scanHintPill}>
              <Text style={styles.scanHintText}>ACTIVE SCANNING</Text>
            </View>
          </Animated.View>

          {isScanning && (
            <View style={styles.scanningTextContainer}>
              <Text style={styles.scanningText}>Align the QR code inside the secure frame</Text>
              <Text style={styles.scanningSubtext}>Execution is paused until QR Guardian completes its audit.</Text>
            </View>
          )}

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
                    color={isTorchOn ? '#03120B' : '#FFD60A'}
                  />
                </View>
                <Text style={styles.flashLabel}>{isTorchOn ? 'Torch On' : 'Torch Off'}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </GlassCard>

      {isAnalyzing && (
        <View style={styles.analyzingOverlay}>
          <GlassCard style={styles.analyzingCard} glowColor="rgba(56,189,248,0.24)">
            <LinearGradient
              colors={['rgba(14,165,233,0.18)', 'rgba(0,255,65,0.12)']}
              style={styles.analyzingIconShell}
            >
              <Ionicons name="shield-outline" size={40} color="#9BE7FF" />
            </LinearGradient>
            <View style={styles.analyzingStatusPill}>
              <View style={styles.analyzingStatusDot} />
              <Text style={styles.analyzingStatusText}>SECURITY INTERCEPTION ACTIVE</Text>
            </View>
            <Text style={styles.analyzingTitle}>Analyzing QR Payload</Text>
            <Text style={styles.analyzingText}>Holding execution while QR Guardian scores the destination and checks live threat signals.</Text>
            <View style={styles.analyzingSkeletonGroup}>
              <ShimmerBlock height={14} width="90%" />
              <ShimmerBlock height={14} width="76%" style={styles.skeletonSpacing} />
              <ShimmerBlock height={14} width="64%" style={styles.skeletonSpacing} />
            </View>
            <View style={styles.analyzingChipRow}>
              <View style={styles.analyzingChip}>
                <Ionicons name="scan-outline" size={13} color="#38BDF8" />
                <Text style={styles.analyzingChipText}>Parsing QR</Text>
              </View>
              <View style={styles.analyzingChip}>
                <Ionicons name="shield-checkmark-outline" size={13} color="#00FF41" />
                <Text style={styles.analyzingChipText}>Risk scoring</Text>
              </View>
              <View style={styles.analyzingChip}>
                <Ionicons name="globe-outline" size={13} color="#FFD700" />
                <Text style={styles.analyzingChipText}>Intel checks</Text>
              </View>
            </View>
          </GlassCard>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 18,
  },
  headerCard: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  headerBrandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconBubble: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextGroup: {
    flexDirection: 'column',
    flexShrink: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 3,
    letterSpacing: 0.4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(2,12,27,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,65,0.16)',
    marginLeft: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00FF41',
    marginRight: 8,
    shadowColor: '#00FF41',
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  statusText: {
    color: '#D1FAE5',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  permissionCard: {
    width: '100%',
    maxWidth: 380,
  },
  permissionIconWrap: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,165,233,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.22)',
    alignSelf: 'center',
    marginTop: 28,
    marginBottom: 18,
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  permissionText: {
    color: '#94A3B8',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
    paddingHorizontal: 24,
  },
  permissionButton: {
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  permissionButtonGradient: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    alignItems: 'center',
  },
  permissionButtonText: {
    color: '#04120C',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cameraGradient: {
    height: CAMERA_CARD_HEIGHT,
    marginBottom: 10,
  },
  cameraGlassInner: {
    padding: 0,
  },
  cameraContainer: {
    flex: 1,
    minHeight: 560,
    borderRadius: 23,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  scanFrame: {
    position: 'absolute',
    top: '20%',
    alignSelf: 'center',
    width: SCAN_FRAME_SIZE,
    height: SCAN_FRAME_SIZE,
    borderWidth: 1.5,
    borderRadius: 24,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    backgroundColor: 'rgba(2,6,23,0.12)',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#7DD3FC',
  },
  cornerTL: {
    top: -1,
    left: -1,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderTopLeftRadius: 24,
  },
  cornerTR: {
    top: -1,
    right: -1,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderTopRightRadius: 24,
  },
  cornerBL: {
    bottom: -1,
    left: -1,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderBottomLeftRadius: 24,
  },
  cornerBR: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderBottomRightRadius: 24,
  },
  laserLineWrap: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 8,
  },
  laserLine: {
    height: 4,
    borderRadius: 999,
    shadowColor: '#00FF41',
    shadowOpacity: 0.95,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  scanHintPill: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(2,12,27,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.22)',
  },
  scanHintText: {
    color: '#A5F3FC',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  scanningTextContainer: {
    position: 'absolute',
    bottom: 74,
    left: 24,
    right: 24,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  scanningText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  scanningSubtext: {
    marginTop: 6,
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  flashContainer: {
    position: 'absolute',
    bottom: 20,
    right: 18,
  },
  flashPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    backgroundColor: 'rgba(2,12,27,0.72)',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 6,
  },
  flashPillActive: {
    borderColor: '#FFD60A',
    backgroundColor: 'rgba(255,214,10,0.16)',
  },
  flashPillInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flashIconWrapper: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,214,10,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  flashIconWrapperActive: {
    backgroundColor: '#FFD60A',
  },
  flashLabel: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  analyzingCard: {
    width: '100%',
    maxWidth: 360,
    paddingHorizontal: 22,
    paddingVertical: 24,
    alignItems: 'center',
  },
  analyzingIconShell: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  analyzingStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(2,12,27,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.18)',
    marginBottom: 14,
  },
  analyzingStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#00FF41',
    marginRight: 8,
    shadowColor: '#00FF41',
    shadowOpacity: 0.85,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  analyzingStatusText: {
    color: '#A5F3FC',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  analyzingTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  analyzingText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  analyzingSkeletonGroup: {
    width: '100%',
    marginTop: 18,
  },
  analyzingChipRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  analyzingChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    marginHorizontal: 4,
  },
  analyzingChipText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 6,
  },
  skeletonSpacing: {
    marginTop: 10,
  },
});