import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { PieChart } from 'react-native-gifted-charts';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { tr } from 'date-fns/locale';

const screenWidth = Dimensions.get('window').width;

interface ReportData {
  summary: {
    total_income: number;
    total_expense: number;
    balance: number;
  };
  category_breakdown: Array<{
    category_name: string;
    income: number;
    expense: number;
  }>;
  transaction_count: number;
}

type Period = 'today' | 'week' | 'month' | 'all';

export default function Reports() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('month');

  useFocusEffect(
    useCallback(() => {
      fetchReports();
    }, [selectedPeriod])
  );

  const getDateRange = () => {
    const now = new Date();
    let startDate, endDate;

    switch (selectedPeriod) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'week':
        startDate = subDays(now, 7);
        endDate = now;
        break;
      case 'month':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'all':
        startDate = new Date(2020, 0, 1);
        endDate = now;
        break;
    }

    return {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    };
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { start_date, end_date } = getDateRange();
      const response = await api.get('/reports', {
        params: { start_date, end_date },
      });
      setData(response.data);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
    }).format(amount);
  };

  const getPeriodLabel = (period: Period) => {
    const labels = {
      today: 'Bugün',
      week: 'Son 7 Gün',
      month: 'Bu Ay',
      all: 'Tüm Zamanlar',
    };
    return labels[period];
  };

  const generateChartData = () => {
    if (!data || !data.category_breakdown || data.category_breakdown.length === 0) {
      return [];
    }

    const colors = [
      '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
      '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
      '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
    ];

    return data.category_breakdown
      .filter((cat) => cat.expense > 0)
      .map((cat, index) => ({
        value: cat.expense,
        color: colors[index % colors.length],
        text: cat.category_name,
      }));
  };

  const chartData = generateChartData();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0F172A" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.periodSelector}>
        {(['today', 'week', 'month', 'all'] as Period[]).map((period) => (
          <TouchableOpacity
            key={period}
            style={[
              styles.periodButton,
              selectedPeriod === period && styles.periodButtonActive,
            ]}
            onPress={() => setSelectedPeriod(period)}
          >
            <Text
              style={[
                styles.periodButtonText,
                selectedPeriod === period && styles.periodButtonTextActive,
              ]}
            >
              {getPeriodLabel(period)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Özet</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Ionicons name="arrow-down-circle" size={32} color="#10B981" />
            <Text style={styles.summaryLabel}>Toplam Gelir</Text>
            <Text style={[styles.summaryValue, styles.incomeText]}>
              {formatCurrency(data?.summary.total_income || 0)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Ionicons name="arrow-up-circle" size={32} color="#EF4444" />
            <Text style={styles.summaryLabel}>Toplam Gider</Text>
            <Text style={[styles.summaryValue, styles.expenseText]}>
              {formatCurrency(data?.summary.total_expense || 0)}
            </Text>
          </View>
        </View>
        <View style={styles.summaryBalance}>
          <Text style={styles.balanceLabel}>Net Kar/Zarar</Text>
          <Text
            style={[
              styles.balanceValue,
              {
                color:
                  (data?.summary.balance || 0) >= 0 ? '#10B981' : '#EF4444',
              },
            ]}
          >
            {formatCurrency(data?.summary.balance || 0)}
          </Text>
        </View>
        <View style={styles.transactionCount}>
          <Ionicons name="document-text" size={20} color="#64748B" />
          <Text style={styles.transactionCountText}>
            {data?.transaction_count || 0} işlem
          </Text>
        </View>
      </View>

      {chartData.length > 0 ? (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Gider Dağılımı</Text>
          <View style={styles.chartContainer}>
            <PieChart
              data={chartData}
              donut
              radius={100}
              innerRadius={60}
              centerLabelComponent={() => (
                <View style={styles.chartCenter}>
                  <Text style={styles.chartCenterLabel}>Toplam</Text>
                  <Text style={styles.chartCenterValue}>
                    {formatCurrency(data?.summary.total_expense || 0)}
                  </Text>
                </View>
              )}
            />
          </View>
          <View style={styles.legend}>
            {chartData.map((item, index) => (
              <View key={index} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.legendText} numberOfLines={1}>
                  {item.text}
                </Text>
                <Text style={styles.legendValue}>
                  {formatCurrency(item.value)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.emptyChart}>
          <Ionicons name="pie-chart-outline" size={64} color="#94A3B8" />
          <Text style={styles.emptyChartText}>
            Bu dönem için gider bulunamadı
          </Text>
        </View>
      )}

      <View style={styles.categoryBreakdown}>
        <Text style={styles.breakdownTitle}>Kategori Detayları</Text>
        {data?.category_breakdown && data.category_breakdown.length > 0 ? (
          data.category_breakdown.map((cat, index) => (
            <View key={index} style={styles.breakdownItem}>
              <Text style={styles.breakdownName}>{cat.category_name}</Text>
              <View style={styles.breakdownValues}>
                <View style={styles.breakdownValue}>
                  <Text style={styles.breakdownLabel}>Gelir</Text>
                  <Text style={[styles.breakdownAmount, styles.incomeText]}>
                    {formatCurrency(cat.income)}
                  </Text>
                </View>
                <View style={styles.breakdownValue}>
                  <Text style={styles.breakdownLabel}>Gider</Text>
                  <Text style={[styles.breakdownAmount, styles.expenseText]}>
                    {formatCurrency(cat.expense)}
                  </Text>
                </View>
                <View style={styles.breakdownValue}>
                  <Text style={styles.breakdownLabel}>Net</Text>
                  <Text
                    style={[
                      styles.breakdownAmount,
                      {
                        color:
                          cat.income - cat.expense >= 0 ? '#10B981' : '#EF4444',
                      },
                    ]}
                  >
                    {formatCurrency(cat.income - cat.expense)}
                  </Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Bu dönem için veri yok</Text>
          </View>
        )}
      </View>

      <View style={styles.comparisonCard}>
        <Text style={styles.comparisonTitle}>Gelir vs Gider</Text>
        <View style={styles.comparisonBars}>
          <View style={styles.comparisonBar}>
            <Text style={styles.comparisonBarLabel}>Gelir</Text>
            <View style={styles.comparisonBarTrack}>
              <View
                style={[
                  styles.comparisonBarFill,
                  styles.incomeBar,
                  {
                    width: `${
                      data?.summary.total_income && data.summary.total_expense
                        ? (data.summary.total_income /
                            Math.max(
                              data.summary.total_income,
                              data.summary.total_expense
                            )) *
                          100
                        : 0
                    }%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.comparisonBarValue, styles.incomeText]}>
              {formatCurrency(data?.summary.total_income || 0)}
            </Text>
          </View>
          <View style={styles.comparisonBar}>
            <Text style={styles.comparisonBarLabel}>Gider</Text>
            <View style={styles.comparisonBarTrack}>
              <View
                style={[
                  styles.comparisonBarFill,
                  styles.expenseBar,
                  {
                    width: `${
                      data?.summary.total_income && data.summary.total_expense
                        ? (data.summary.total_expense /
                            Math.max(
                              data.summary.total_income,
                              data.summary.total_expense
                            )) *
                          100
                        : 0
                    }%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.comparisonBarValue, styles.expenseText]}>
              {formatCurrency(data?.summary.total_expense || 0)}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  periodSelector: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  periodButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  periodButtonActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  periodButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  periodButtonTextActive: {
    color: '#FFFFFF',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  incomeText: {
    color: '#10B981',
  },
  expenseText: {
    color: '#EF4444',
  },
  summaryBalance: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  transactionCount: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  transactionCountText: {
    fontSize: 14,
    color: '#64748B',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 16,
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  chartCenter: {
    alignItems: 'center',
  },
  chartCenterLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  chartCenterValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  legend: {
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  legendValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  emptyChart: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 0,
    padding: 48,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyChartText: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 16,
  },
  categoryBreakdown: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  breakdownTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 16,
  },
  breakdownItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  breakdownName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 12,
  },
  breakdownValues: {
    flexDirection: 'row',
    gap: 12,
  },
  breakdownValue: {
    flex: 1,
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  breakdownAmount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  comparisonCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 0,
    marginBottom: 32,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  comparisonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 16,
  },
  comparisonBars: {
    gap: 20,
  },
  comparisonBar: {
    gap: 8,
  },
  comparisonBarLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  comparisonBarTrack: {
    height: 32,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    overflow: 'hidden',
  },
  comparisonBarFill: {
    height: '100%',
    borderRadius: 16,
  },
  incomeBar: {
    backgroundColor: '#10B981',
  },
  expenseBar: {
    backgroundColor: '#EF4444',
  },
  comparisonBarValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
