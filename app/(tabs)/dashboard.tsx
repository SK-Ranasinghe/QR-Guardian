import { ScanHistoryItem, getScanHistory } from '@/utils/historyService';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type RangeKey = '7d' | '30d' | 'all';

export default function DashboardScreen() {
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [range, setRange] = useState<RangeKey>('7d');

  const loadHistory = useCallback(async () => {
    const data = await getScanHistory();
    setHistory(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const {
    total,
    safeCount,
    riskyCount,
    cautionCount,
    dangerousCount,
    safePercent,
    riskyPercent,
    dailyBuckets,
    grade,
    gradeColor,
    gradeLabel,
    subtitleLabel,
    periodLabel,
    activeDaysCount,
    averageDailyScans,
    busiestDayCount,
    busiestDayLabel,
    latestScanLabel,
  } = useMemo(() => {
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formatShortLabel = (date: Date) => `${monthShort[date.getMonth()]} ${date.getDate()}`;

    let start = new Date(now);
    start.setHours(0, 0, 0, 0);

    if (range === '7d') {
      start.setDate(start.getDate() - 6);
    } else if (range === '30d') {
      start.setDate(start.getDate() - 29);
    } else {
      const oldestHistoryMs = history.reduce((oldest, item) => {
        const itemMs = new Date(item.timestamp).getTime();
        if (Number.isNaN(itemMs)) {
          return oldest;
        }
        return Math.min(oldest, itemMs);
      }, Number.POSITIVE_INFINITY);

      if (oldestHistoryMs !== Number.POSITIVE_INFINITY) {
        start = new Date(oldestHistoryMs);
        start.setHours(0, 0, 0, 0);
      }
    }

    const totalDays = Math.max(1, Math.floor((now.getTime() - start.getTime()) / dayMs) + 1);
    const bucketCount = range === 'all' ? totalDays : Math.min(totalDays, range === '7d' ? 7 : 30);

    const buckets: {
      weekday: string;
      dateLabel: string;
      fullLabel: string;
      safe: number;
      caution: number;
      dangerous: number;
      total: number;
    }[] = [];

    const weekdayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 0; i < bucketCount; i++) {
      const d = new Date(start.getTime() + i * dayMs);
      const weekday = weekdayShort[d.getDay()];
      const day = d.getDate();
      const month = d.getMonth() + 1;
      const dateLabel = `${day}/${month}`;
      buckets.push({
        weekday,
        dateLabel,
        fullLabel: formatShortLabel(d),
        safe: 0,
        caution: 0,
        dangerous: 0,
        total: 0,
      });
    }

    let safe = 0;
    let caution = 0;
    let dangerous = 0;
    let latestScanTime: number | null = null;

    history.forEach((item) => {
      const ts = new Date(item.timestamp);
      if (Number.isNaN(ts.getTime()) || ts < start || ts > now) return;

      if (latestScanTime === null || ts.getTime() > latestScanTime) {
        latestScanTime = ts.getTime();
      }

      if (item.safetyRating === 'SAFE') safe++;
      else if (item.safetyRating === 'CAUTION') caution++;
      else if (item.safetyRating === 'DANGEROUS') dangerous++;

      const idx = Math.min(
        bucketCount - 1,
        Math.max(0, Math.floor((ts.getTime() - start.getTime()) / dayMs))
      );

      if (item.safetyRating === 'SAFE') {
        buckets[idx].safe += 1;
      } else if (item.safetyRating === 'CAUTION') {
        buckets[idx].caution += 1;
      } else if (item.safetyRating === 'DANGEROUS') {
        buckets[idx].dangerous += 1;
      }

      buckets[idx].total += 1;
    });

    const totalCount = safe + caution + dangerous;
    const risky = caution + dangerous;

    const safeP = totalCount === 0 ? 0 : Math.round((safe / totalCount) * 100);
    const riskyP = totalCount === 0 ? 0 : 100 - safeP;
    const activeDays = buckets.filter((bucket) => bucket.total > 0).length;
    const averageRaw = totalCount / Math.max(1, bucketCount);
    const averageDaily = totalCount === 0
      ? '0.0'
      : averageRaw >= 10
      ? Math.round(averageRaw).toString()
      : averageRaw.toFixed(1);
    const busiestBucket = buckets.reduce(
      (currentBest, bucket) => (bucket.total > currentBest.total ? bucket : currentBest),
      {
        weekday: '--',
        dateLabel: '--',
        fullLabel: '--',
        safe: 0,
        caution: 0,
        dangerous: 0,
        total: 0,
      }
    );

    let gradeLocal = 'C';
    let gradeColorLocal = '#FACC15';
    let gradeLabelLocal = 'Moderate risk';

    if (safeP >= 90) {
      gradeLocal = 'A+';
      gradeColorLocal = '#22C55E';
      gradeLabelLocal = 'Excellent hygiene';
    } else if (safeP >= 80) {
      gradeLocal = 'A';
      gradeColorLocal = '#4ADE80';
      gradeLabelLocal = 'Very good';
    } else if (safeP >= 65) {
      gradeLocal = 'B';
      gradeColorLocal = '#A3E635';
      gradeLabelLocal = 'Good, but can improve';
    } else if (safeP >= 50) {
      gradeLocal = 'C';
      gradeColorLocal = '#FACC15';
      gradeLabelLocal = 'Be cautious';
    } else {
      gradeLocal = 'D';
      gradeColorLocal = '#F97316';
      gradeLabelLocal = 'High risk';
    }

    const subtitleLocal =
      range === '7d'
        ? 'Your last 7 days of QR security'
        : range === '30d'
        ? 'Your last 30 days of QR security'
        : 'Your full QR security history';

    const periodLocal =
      buckets.length > 0
        ? `${buckets[0].fullLabel} - ${buckets[buckets.length - 1].fullLabel}`
        : 'Waiting for scans';

    const latestScanLocal = latestScanTime !== null
      ? new Date(latestScanTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : 'No scans yet';

    return {
      total: totalCount,
      safeCount: safe,
      riskyCount: risky,
      cautionCount: caution,
      dangerousCount: dangerous,
      safePercent: safeP,
      riskyPercent: riskyP,
      dailyBuckets: buckets,
      grade: gradeLocal,
      gradeColor: gradeColorLocal,
      gradeLabel: gradeLabelLocal,
      subtitleLabel: subtitleLocal,
      periodLabel: periodLocal,
      activeDaysCount: activeDays,
      averageDailyScans: averageDaily,
      busiestDayCount: busiestBucket.total,
      busiestDayLabel: busiestBucket.total > 0 ? busiestBucket.fullLabel : '--',
      latestScanLabel: latestScanLocal,
    };
  }, [history, range]);

  const maxPerDay = Math.max(
    1,
    ...dailyBuckets.map((d) => d.safe + d.caution + d.dangerous)
  );
  const chartMaxValue = Math.max(4, Math.ceil(maxPerDay * 1.15));

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#000000', '#020617', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Dashboard</Text>
            <Text style={styles.subtitle}>{subtitleLabel}</Text>
          </View>
          <View style={styles.rangePillsRow}>
            {(
              [
                { key: '7d' as RangeKey, label: '7D' },
                { key: '30d' as RangeKey, label: '30D' },
                { key: 'all' as RangeKey, label: 'All' },
              ]
            ).map((item) => {
              const active = range === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => setRange(item.key)}
                  style={[
                    styles.rangePill,
                    active && styles.rangePillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.rangePillLabel,
                      active && styles.rangePillLabelActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {total === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="stats-chart" size={60} color="#8E8E93" />
            <Text style={styles.emptyTitle}>No data yet</Text>
            <Text style={styles.emptyText}>
              Start scanning QR codes and your weekly security stats will appear here.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.snapshotRow}>
              <View style={styles.snapshotCard}>
                <View style={styles.snapshotIconWrap}>
                  <Ionicons name="shield-checkmark" size={16} color="#22C55E" />
                </View>
                <Text style={styles.snapshotValue}>{safePercent}%</Text>
                <Text style={styles.snapshotLabel}>Protection rate</Text>
              </View>
              <View style={styles.snapshotCard}>
                <View style={styles.snapshotIconWrap}>
                  <Ionicons name="calendar-clear" size={16} color="#38BDF8" />
                </View>
                <Text style={styles.snapshotValue}>{activeDaysCount}</Text>
                <Text style={styles.snapshotLabel}>Active days</Text>
              </View>
              <View style={styles.snapshotCard}>
                <View style={styles.snapshotIconWrap}>
                  <Ionicons name="pulse" size={16} color="#A78BFA" />
                </View>
                <Text style={styles.snapshotValue}>{averageDailyScans}</Text>
                <Text style={styles.snapshotLabel}>Daily avg</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCardPrimary}>
                <View style={styles.statPrimaryHeaderRow}>
                  <View>
                    <Text style={styles.statLabel}>
                      Total scans {range === '7d' ? '(7 days)' : range === '30d' ? '(30 days)' : '(all time)'}
                    </Text>
                    <Text style={styles.statPeriod}>{periodLabel}</Text>
                  </View>
                  <View style={[styles.gradePill, { borderColor: gradeColor }]}> 
                    <Text style={[styles.gradePillGrade, { color: gradeColor }]}>{grade}</Text>
                    <Text style={styles.gradePillLabel}>{gradeLabel}</Text>
                  </View>
                </View>
                <Text style={styles.statNumber}>{total}</Text>
                <Text style={styles.statHint}>
                  {safePercent}% safe • {riskyPercent}% flagged • Last scan {latestScanLabel}
                </Text>
                <View style={styles.heroMetricsRow}>
                  <View style={styles.heroMetricChip}>
                    <Ionicons name="flame" size={14} color="#F97316" />
                    <Text style={styles.heroMetricChipText}>{busiestDayCount} on {busiestDayLabel}</Text>
                  </View>
                  <View style={styles.heroMetricChip}>
                    <Ionicons name="warning" size={14} color="#F59E0B" />
                    <Text style={styles.heroMetricChipText}>{riskyCount} risky results</Text>
                  </View>
                </View>
              </View>

              <View style={styles.statColumnRight}>
                <View style={styles.statCardSmall}>
                  <Text style={[styles.statBadge, { color: '#34C759' }]}>SAFE</Text>
                  <Text style={styles.statNumberSmall}>{safeCount}</Text>
                  <Text style={styles.statSmallHint}>trusted scans</Text>
                </View>
                <View style={styles.statCardSmall}>
                  <Text style={[styles.statBadge, { color: '#38BDF8' }]}>AVG / DAY</Text>
                  <Text style={styles.statNumberSmall}>{averageDailyScans}</Text>
                  <Text style={styles.statSmallHint}>across this range</Text>
                </View>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Caution</Text>
                <Text style={[styles.detailValue, { color: '#FF9500' }]}>{cautionCount}</Text>
                <Text style={styles.detailCaption}>Needs a closer look</Text>
              </View>
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Dangerous</Text>
                <Text style={[styles.detailValue, { color: '#FF3B30' }]}>{dangerousCount}</Text>
                <Text style={styles.detailCaption}>High-risk detections</Text>
              </View>
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Busiest day</Text>
                <Text style={[styles.detailValue, { color: '#38BDF8' }]}>{busiestDayCount}</Text>
                <Text style={styles.detailCaption}>{busiestDayLabel}</Text>
              </View>
            </View>

            <View style={styles.chartCard}>
              <View style={styles.chartHeaderRow}>
                <View>
                  <Text style={styles.chartTitle}>Scan activity</Text>
                  <Text style={styles.chartSubtitle}>{periodLabel}</Text>
                </View>
                <View style={styles.chartMetaBadge}>
                  <Ionicons name="analytics" size={14} color="#38BDF8" />
                  <Text style={styles.chartMetaText}>{total} scans tracked</Text>
                </View>
              </View>

              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#34C759' }]} />
                  <Text style={styles.legendLabel}>Safe</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.legendLabel}>Caution</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                  <Text style={styles.legendLabel}>Dangerous</Text>
                </View>
              </View>

              <View style={styles.chartBody}>
                <View style={styles.chartYAxis}>
                  <Text style={styles.chartAxisLabel}>{chartMaxValue}</Text>
                  <Text style={styles.chartAxisLabel}>{Math.max(1, Math.ceil(chartMaxValue / 2))}</Text>
                  <Text style={styles.chartAxisLabel}>0</Text>
                </View>

                <View style={styles.chartPlot}>
                  <View style={[styles.chartGridLine, styles.chartGridLineTop]} />
                  <View style={[styles.chartGridLine, styles.chartGridLineMiddle]} />
                  <View style={[styles.chartGridLine, styles.chartGridLineBottom]} />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chartScrollContent}
                  >
                    {dailyBuckets.map((day) => {
                      const totalForDay = day.total;
                      const trackHeight = 104;
                      const safeHeight = day.safe === 0
                        ? 0
                        : Math.max(6, (day.safe / chartMaxValue) * trackHeight);
                      const cautionHeight = day.caution === 0
                        ? 0
                        : Math.max(6, (day.caution / chartMaxValue) * trackHeight);
                      const dangerousHeight = day.dangerous === 0
                        ? 0
                        : Math.max(6, (day.dangerous / chartMaxValue) * trackHeight);

                      return (
                        <View
                          key={`${day.weekday}-${day.dateLabel}`}
                          style={styles.chartBarWrapper}
                        >
                          <View style={styles.chartBarGroup}>
                            <View style={styles.chartMiniBarTrack}>
                              {safeHeight > 0 && (
                                <View style={[styles.chartMiniBar, styles.chartBarSafe, { height: safeHeight }]} />
                              )}
                            </View>
                            <View style={styles.chartMiniBarTrack}>
                              {cautionHeight > 0 && (
                                <View style={[styles.chartMiniBar, styles.chartBarCaution, { height: cautionHeight }]} />
                              )}
                            </View>
                            <View style={styles.chartMiniBarTrack}>
                              {dangerousHeight > 0 && (
                                <View style={[styles.chartMiniBar, styles.chartBarDangerous, { height: dangerousHeight }]} />
                              )}
                            </View>
                          </View>
                          <Text style={styles.chartValueText}>{totalForDay > 0 ? totalForDay : ''}</Text>
                          <Text style={styles.chartLabel}>{day.weekday}</Text>
                          <Text style={styles.chartSubLabel}>{day.dateLabel}</Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(9,12,28,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.14)',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  rangePillsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(2,6,23,0.86)',
    padding: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.14)',
  },
  rangePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginHorizontal: 2,
    backgroundColor: 'transparent',
  },
  rangePillActive: {
    backgroundColor: 'rgba(14,165,233,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.18)',
  },
  rangePillLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  rangePillLabelActive: {
    color: '#E0F2FE',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 3,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 44,
    paddingHorizontal: 32,
    paddingVertical: 42,
    borderRadius: 24,
    backgroundColor: 'rgba(9,12,28,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.12)',
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
  snapshotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  snapshotCard: {
    width: '31.5%',
    backgroundColor: 'rgba(9,12,28,0.88)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
  },
  snapshotIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.9)',
    marginBottom: 10,
  },
  snapshotValue: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  snapshotLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  statCardPrimary: {
    flex: 1.85,
    backgroundColor: 'rgba(9,12,28,0.9)',
    borderRadius: 24,
    padding: 18,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  statPrimaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  statColumnRight: {
    flex: 1,
    justifyContent: 'space-between',
  },
  statCardSmall: {
    backgroundColor: 'rgba(9,12,28,0.9)',
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    minHeight: 104,
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 4,
  },
  statPeriod: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  statNumber: {
    color: '#F8FAFC',
    fontSize: 38,
    fontWeight: '800',
  },
  statHint: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18,
  },
  heroMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  heroMetricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(2,6,23,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.12)',
    marginRight: 8,
    marginTop: 8,
  },
  heroMetricChipText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 6,
  },
  gradePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(2,6,23,0.8)',
  },
  gradePillGrade: {
    fontSize: 13,
    fontWeight: '800',
    marginRight: 6,
  },
  gradePillLabel: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  statBadge: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.6,
  },
  statNumberSmall: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
  },
  statSmallHint: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailCard: {
    width: '31.5%',
    backgroundColor: 'rgba(9,12,28,0.9)',
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
  },
  detailLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 6,
  },
  detailValue: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '800',
  },
  detailCaption: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 4,
  },
  chartCard: {
    backgroundColor: 'rgba(9,12,28,0.92)',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.12)',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  chartTitle: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '700',
  },
  chartSubtitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  chartMetaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(2,6,23,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.12)',
  },
  chartMetaText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 6,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 14,
    marginBottom: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    color: '#94A3B8',
    fontSize: 11,
    marginLeft: 4,
  },
  chartBody: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  chartYAxis: {
    width: 28,
    justifyContent: 'space-between',
    paddingBottom: 24,
    marginRight: 8,
  },
  chartAxisLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
  },
  chartPlot: {
    flex: 1,
    minHeight: 160,
  },
  chartGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
  },
  chartGridLineTop: {
    top: 8,
  },
  chartGridLineMiddle: {
    top: 64,
  },
  chartGridLineBottom: {
    top: 120,
  },
  chartScrollContent: {
    alignItems: 'flex-end',
    paddingLeft: 4,
    paddingRight: 14,
  },
  chartBarWrapper: {
    alignItems: 'center',
    flex: 0,
    width: 46,
  },
  chartBarGroup: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    width: 32,
  },
  chartMiniBarTrack: {
    width: 8,
    height: 104,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.10)',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  chartMiniBar: {
    width: '100%',
    borderRadius: 999,
  },
  chartBarSafe: {
    backgroundColor: '#34C759',
  },
  chartBarCaution: {
    backgroundColor: '#F59E0B',
  },
  chartBarDangerous: {
    backgroundColor: '#EF4444',
  },
  chartValueText: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '700',
    minHeight: 16,
    marginTop: 8,
  },
  chartLabel: {
    color: '#CBD5E1',
    fontSize: 11,
    marginTop: 2,
  },
  chartSubLabel: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
});
