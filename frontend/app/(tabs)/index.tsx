import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

interface DashboardData {
  total_income: number;
  total_expense: number;
  balance: number;
  recent_transactions: any[];
  top_categories: any[];
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();

  const fetchDashboard = async () => {
    try {
      const response = await api.get('/dashboard');
      setData(response.data);
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
    }).format(amount);
  };

  const getTypeColor = (type: string) => {
    return type === 'income' ? '#10B981' : '#EF4444';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0F172A" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Merhaba,</Text>
          <Text style={styles.userName}>{user?.full_name}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#0F172A" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={[styles.statCard, styles.incomeCard]}>
          <Ionicons name="arrow-down-circle" size={32} color="#10B981" />
          <Text style={styles.statLabel}>Gelir</Text>
          <Text style={[styles.statValue, styles.incomeText]}>
            {formatCurrency(data?.total_income || 0)}
          </Text>
        </View>

        <View style={[styles.statCard, styles.expenseCard]}>
          <Ionicons name="arrow-up-circle" size={32} color="#EF4444" />
          <Text style={styles.statLabel}>Gider</Text>
          <Text style={[styles.statValue, styles.expenseText]}>
            {formatCurrency(data?.total_expense || 0)}
          </Text>
        </View>

        <View style={[styles.statCard, styles.balanceCard]}>
          <Ionicons name="wallet" size={32} color="#0F172A" />
          <Text style={styles.statLabel}>Kar/Zarar</Text>
          <Text style={[styles.statValue, styles.balanceText]}>
            {formatCurrency(data?.balance || 0)}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Son İşlemler</Text>
        {data?.recent_transactions && data.recent_transactions.length > 0 ? (
          data.recent_transactions.map((transaction) => (
            <TouchableOpacity
              key={transaction._id}
              style={styles.transactionCard}
              onPress={() => router.push('/transactions')}
            >
              <View style={styles.transactionLeft}>
                <View
                  style={[
                    styles.transactionIcon,
                    {
                      backgroundColor:
                        transaction.type === 'income' ? '#D1FAE5' : '#FEE2E2',
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      transaction.type === 'income'
                        ? 'arrow-down'
                        : 'arrow-up'
                    }
                    size={20}
                    color={getTypeColor(transaction.type)}
                  />
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionDescription}>
                    {transaction.description}
                  </Text>
                  <Text style={styles.transactionDate}>
                    {format(new Date(transaction.date), 'dd MMM yyyy', {
                      locale: tr,
                    })}
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  styles.transactionAmount,
                  { color: getTypeColor(transaction.type) },
                ]}
              >
                {transaction.type === 'income' ? '+' : '-'}
                {formatCurrency(transaction.amount)}
              </Text>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="#94A3B8" />
            <Text style={styles.emptyText}>Henüz işlem yok</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>En Çok Harcanan Kategoriler</Text>
        {data?.top_categories && data.top_categories.length > 0 ? (
          data.top_categories.map((category, index) => (
            <View key={index} style={styles.categoryCard}>
              <Text style={styles.categoryName}>{category.category_name}</Text>
              <Text style={styles.categoryAmount}>
                {formatCurrency(category.total)}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="pricetags-outline" size={48} color="#94A3B8" />
            <Text style={styles.emptyText}>Henüz kategori yok</Text>
          </View>
        )}
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => router.push('/transactions')}
        >
          <Ionicons name="add-circle" size={24} color="#FFFFFF" />
          <Text style={styles.quickActionText}>Yeni İşlem</Text>
        </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0F172A',
    paddingTop: 48,
  },
  greeting: {
    fontSize: 16,
    color: '#94A3B8',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  statsContainer: {
    padding: 16,
    gap: 12,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  incomeCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  expenseCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  balanceCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#0F172A',
  },
  statLabel: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 12,
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  incomeText: {
    color: '#10B981',
  },
  expenseText: {
    color: '#EF4444',
  },
  balanceText: {
    color: '#0F172A',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 16,
  },
  transactionCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionInfo: {
    marginLeft: 12,
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#64748B',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  categoryCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryName: {
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '500',
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 8,
  },
  quickActions: {
    padding: 16,
    paddingBottom: 32,
  },
  quickActionButton: {
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  quickActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
