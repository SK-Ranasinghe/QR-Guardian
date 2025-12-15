import { ScanHistoryItem, getScanHistory } from '@/utils/historyService';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type RangeKey = '7d' | '30d' | 'all';

export default function DashboardScreen() {
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [range, setRange] = useState<RangeKey>('7d');

  useEffect(() => {
    const load = async () => {
      const data = await getScanHistory();
      setHistory(data);
    };
    load();
  }, []);

  const now = new Date();

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
  } = useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000;

    let start = new Date();
    start.setHours(0, 0, 0, 0);

    if (range === '7d') {
      start.setDate(start.getDate() - 6);
    } else if (range === '30d') {
      start.setDate(start.getDate() - 29);
    } else {
      // all-time: start from first scan date if available
      if (history.length > 0) {
        const first = history[history.length - 1];
        const firstDate = new Date(first.timestamp);
        firstDate.setHours(0, 0, 0, 0);
        start = firstDate;
      }
    }

    const totalDays = Math.max(1, Math.floor((now.getTime() - start.getTime()) / dayMs) + 1);
    const maxBuckets = range === '7d' ? 7 : range === '30d' ? 30 : 30; // cap all-time chart to last 30 days
    const bucketCount = Math.min(totalDays, maxBuckets);

    const buckets: {
      weekday: string;
      dateLabel: string;
      safe: number;
      caution: number;
      dangerous: number;
    }[] = [];

    const weekdayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 0; i < bucketCount; i++) {
      const d = new Date(start.getTime() + i * dayMs);
      const weekday = weekdayShort[d.getDay()];
      const day = d.getDate();
      const month = d.getMonth() + 1;
      const dateLabel = `${day}/${month}`; // e.g., 11/10
      buckets.push({ weekday, dateLabel, safe: 0, caution: 0, dangerous: 0 });
    }

    let safe = 0;
    let caution = 0;
    let dangerous = 0;

    const inRange: ScanHistoryItem[] = [];

    history.forEach((item) => {
      const ts = new Date(item.timestamp);
      if (ts < start || ts > now) return;
      inRange.push(item);

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
    });

    const totalCount = safe + caution + dangerous;
    const risky = caution + dangerous;

    const safeP = totalCount === 0 ? 0 : Math.round((safe / totalCount) * 100);
    const riskyP = totalCount === 0 ? 0 : 100 - safeP;

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
        : 'Your overall QR security history';

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
    };
  }, [history, now, range]);

  const maxPerDay = Math.max(
    1,
    ...dailyBuckets.map((d) => d.safe + d.caution + d.dangerous)
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
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
            <View style={styles.statsRow}>
              <View style={styles.statCardPrimary}>
                <View style={styles.statPrimaryHeaderRow}>
                  <Text style={styles.statLabel}>
                    Total scans {range === '7d' ? '(7 days)' : range === '30d' ? '(30 days)' : '(all time)'}
                  </Text>
                  <View style={[styles.gradePill, { borderColor: gradeColor }]}> 
                    <Text style={[styles.gradePillGrade, { color: gradeColor }]}>{grade}</Text>
                    <Text style={styles.gradePillLabel}>{gradeLabel}</Text>
                  </View>
                </View>
                <Text style={styles.statNumber}>{total}</Text>
                <Text style={styles.statHint}>
                  {safePercent}% safe • {riskyPercent}% risky
                </Text>
              </View>

              <View style={styles.statColumnRight}>
                <View style={styles.statCardSmall}>
                  <Text style={[styles.statBadge, { color: '#34C759' }]}>SAFE</Text>
                  <Text style={styles.statNumberSmall}>{safeCount}</Text>
                </View>
                <View style={styles.statCardSmall}>
                  <Text style={[styles.statBadge, { color: '#FF3B30' }]}>RISKY</Text>
                  <Text style={styles.statNumberSmall}>{riskyCount}</Text>
                </View>
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Caution</Text>
                <Text style={[styles.detailValue, { color: '#FF9500' }]}>{cautionCount}</Text>
              </View>
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>Dangerous</Text>
                <Text style={[styles.detailValue, { color: '#FF3B30' }]}>
                  {dangerousCount}
                </Text>
              </View>
            </View>

            <View style={styles.chartCard}>
              <View style={styles.chartHeaderRow}>
                <Text style={styles.chartTitle}>Scan activity</Text>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: '#34C759' }]} />
                  <Text style={styles.legendLabel}>Safe</Text>
                  <View style={[styles.legendDot, { backgroundColor: '#F59E0B', marginLeft: 12 }]} />
                  <Text style={styles.legendLabel}>Caution</Text>
                  <View style={[styles.legendDot, { backgroundColor: '#EF4444', marginLeft: 12 }]} />
                  <Text style={styles.legendLabel}>Dangerous</Text>
                </View>
              </View>

              <View style={styles.chartBody}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chartScrollContent}
                >
                  {dailyBuckets.map((day) => {
                    const safeHeight = (day.safe / maxPerDay) * 80;
                    const cautionHeight = (day.caution / maxPerDay) * 80;
                    const dangerousHeight = (day.dangerous / maxPerDay) * 80;

                    return (
                      <View
                        key={`${day.weekday}-${day.dateLabel}`}
                        style={styles.chartBarWrapper}
                      >
                        <View style={styles.chartBarStack}>
                          <View
                            style={[
                              styles.chartBar,
                              {
                                height: safeHeight,
                                backgroundColor: '#34C759',
                              },
                            ]}
                          />
                          <View
                            style={[
                              styles.chartBar,
                              {
                                height: cautionHeight,
                                backgroundColor: '#F59E0B',
                              },
                            ]}
                          />
                          <View
                            style={[
                              styles.chartBar,
                              {
                                height: dangerousHeight,
                                backgroundColor: '#EF4444',
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.chartLabel}>{day.weekday}</Text>
                        <Text style={styles.chartSubLabel}>{day.dateLabel}</Text>
                      </View>
                    );
                  })}
                </ScrollView>
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
    backgroundColor: '#1C1C1E',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  rangePillsRow: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    padding: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  rangePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginHorizontal: 2,
    backgroundColor: 'transparent',
  },
  rangePillActive: {
    backgroundColor: '#0F172A',
  },
  rangePillLabel: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '600',
  },
  rangePillLabelActive: {
    color: '#E5E7EB',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#8E8E93',
    fontSize: 14,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statCardPrimary: {
    flex: 2,
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    padding: 16,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  statPrimaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  statColumnRight: {
    flex: 1,
    justifyContent: 'space-between',
  },
  statCardSmall: {
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  statLabel: {
    color: '#8E8E93',
    fontSize: 12,
    marginBottom: 6,
  },
  statNumber: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  statHint: {
    color: '#A1A1AA',
    fontSize: 12,
    marginTop: 4,
  },
  gradePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#020617',
  },
  gradePillGrade: {
    fontSize: 13,
    fontWeight: '700',
    marginRight: 6,
  },
  gradePillLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '500',
  },
  statBadge: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  statNumberSmall: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  detailCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  detailLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 4,
  },
  detailValue: {
    color: '#F9FAFB',
    fontSize: 22,
    fontWeight: '700',
  },
  chartCard: {
    backgroundColor: '#020617',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  chartTitle: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '600',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    marginLeft: 4,
  },
  chartBody: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  chartScrollContent: {
    paddingHorizontal: 4,
  },
  chartBarWrapper: {
    alignItems: 'center',
    flex: 0,
    width: 28,
  },
  chartBarStack: {
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'center',
    height: 90,
    width: 16,
  },
  chartBar: {
    width: 10,
    borderRadius: 999,
    marginTop: 2,
  },
  chartLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 4,
  },
  chartSubLabel: {
    color: '#6B7280',
    fontSize: 10,
    marginTop: 2,
  },
});
