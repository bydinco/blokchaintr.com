import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

interface CurrentAccount {
  _id: string;
  name: string;
  phone?: string;
  type: string;
  balance: number;
  created_at: string;
}

interface CurrentAccountTransaction {
  _id: string;
  current_account_id: string;
  type: string;
  amount: number;
  description: string;
  date: string;
  created_at: string;
}

export default function CurrentAccounts() {
  const [accounts, setAccounts] = useState<CurrentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [transactionModalVisible, setTransactionModalVisible] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<CurrentAccount | null>(null);
  const [transactions, setTransactions] = useState<CurrentAccountTransaction[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Account form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [accountType, setAccountType] = useState<'customer' | 'supplier'>('customer');
  
  // Transaction form
  const [transactionType, setTransactionType] = useState<'debt' | 'credit'>('credit');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchAccounts();
    }, [])
  );

  const fetchAccounts = async () => {
    try {
      const response = await api.get('/current-accounts');
      setAccounts(response.data);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (accountId: string) => {
    try {
      const response = await api.get(`/current-accounts/${accountId}/transactions`);
      setTransactions(response.data);
    } catch (error) {
      console.error('Fetch transactions error:', error);
    }
  };

  const openModal = (account?: CurrentAccount) => {
    if (account) {
      setEditingId(account._id);
      setName(account.name);
      setPhone(account.phone || '');
      setAccountType(account.type as 'customer' | 'supplier');
    } else {
      resetForm();
    }
    setModalVisible(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPhone('');
    setAccountType('customer');
  };

  const resetTransactionForm = () => {
    setTransactionType('credit');
    setAmount('');
    setDescription('');
  };

  const handleSubmit = async () => {
    if (!name) {
      Alert.alert('Hata', 'Lütfen cari hesap adı girin');
      return;
    }

    setSubmitting(true);
    try {
      const data = {
        name,
        phone: phone || undefined,
        type: accountType,
      };

      if (editingId) {
        await api.put(`/current-accounts/${editingId}`, data);
      } else {
        await api.post('/current-accounts', data);
      }

      setModalVisible(false);
      resetForm();
      fetchAccounts();
    } catch (error: any) {
      Alert.alert('Hata', error.response?.data?.detail || 'Cari hesap kaydedilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransactionSubmit = async () => {
    if (!amount || !description || !selectedAccount) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun');
      return;
    }

    setSubmitting(true);
    try {
      const data = {
        current_account_id: selectedAccount._id,
        type: transactionType,
        amount: parseFloat(amount),
        description,
        date: new Date().toISOString(),
      };

      await api.post(`/current-accounts/${selectedAccount._id}/transactions`, data);

      setTransactionModalVisible(false);
      resetTransactionForm();
      fetchAccounts();
      fetchTransactions(selectedAccount._id);
    } catch (error: any) {
      Alert.alert('Hata', error.response?.data?.detail || 'İşlem kaydedilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Cari Hesabı Sil',
      'Bu cari hesabı ve tüm hareketlerini silmek istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/current-accounts/${id}`);
              fetchAccounts();
            } catch (error) {
              Alert.alert('Hata', 'Cari hesap silinemedi');
            }
          },
        },
      ]
    );
  };

  const handleDeleteTransaction = async (accountId: string, transactionId: string) => {
    Alert.alert(
      'İşlemi Sil',
      'Bu işlemi silmek istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/current-accounts/${accountId}/transactions/${transactionId}`);
              fetchTransactions(accountId);
              fetchAccounts();
            } catch (error) {
              Alert.alert('Hata', 'İşlem silinemedi');
            }
          },
        },
      ]
    );
  };

  const openAccountDetail = (account: CurrentAccount) => {
    setSelectedAccount(account);
    fetchTransactions(account._id);
    setTransactionModalVisible(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
    }).format(amount);
  };

  const getBalanceColor = (balance: number) => {
    if (balance > 0) return '#10B981'; // Alacak (green)
    if (balance < 0) return '#EF4444'; // Borç (red)
    return '#64748B'; // Balanced (gray)
  };

  const getBalanceLabel = (balance: number) => {
    if (balance > 0) return 'Alacak';
    if (balance < 0) return 'Borç';
    return 'Dengede';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0F172A" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {accounts.map((account) => (
          <TouchableOpacity
            key={account._id}
            style={styles.accountCard}
            onPress={() => openAccountDetail(account)}
            onLongPress={() => handleDelete(account._id)}
          >
            <View style={styles.accountLeft}>
              <View
                style={[
                  styles.accountIcon,
                  {
                    backgroundColor:
                      account.type === 'customer' ? '#DBEAFE' : '#FEF3C7',
                  },
                ]}
              >
                <Ionicons
                  name={account.type === 'customer' ? 'person' : 'business'}
                  size={28}
                  color={account.type === 'customer' ? '#3B82F6' : '#F59E0B'}
                />
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.accountName}>{account.name}</Text>
                {account.phone && (
                  <Text style={styles.accountPhone}>{account.phone}</Text>
                )}
                <Text style={styles.accountType}>
                  {account.type === 'customer' ? 'Müşteri' : 'Tedarikçi'}
                </Text>
              </View>
            </View>
            <View style={styles.accountRight}>
              <Text
                style={[
                  styles.accountBalance,
                  { color: getBalanceColor(account.balance) },
                ]}
              >
                {formatCurrency(Math.abs(account.balance))}
              </Text>
              <Text
                style={[
                  styles.accountBalanceLabel,
                  { color: getBalanceColor(account.balance) },
                ]}
              >
                {getBalanceLabel(account.balance)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
        {accounts.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#94A3B8" />
            <Text style={styles.emptyText}>Henüz cari hesap yok</Text>
            <Text style={styles.emptySubtext}>
              Yeni cari hesap eklemek için + butonuna tıklayın
            </Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => openModal()}>
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Account Form Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId ? 'Cari Hesabı Düzenle' : 'Yeni Cari Hesap'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={28} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    accountType === 'customer' && styles.typeButtonActive,
                  ]}
                  onPress={() => setAccountType('customer')}
                >
                  <Ionicons
                    name="person"
                    size={24}
                    color={accountType === 'customer' ? '#FFFFFF' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.typeButtonText,
                      accountType === 'customer' && styles.typeButtonTextActive,
                    ]}
                  >
                    Müşteri
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    accountType === 'supplier' && styles.typeButtonActive,
                  ]}
                  onPress={() => setAccountType('supplier')}
                >
                  <Ionicons
                    name="business"
                    size={24}
                    color={accountType === 'supplier' ? '#FFFFFF' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.typeButtonText,
                      accountType === 'supplier' && styles.typeButtonTextActive,
                    ]}
                  >
                    Tedarikçi
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Ad / Firma Adı</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Örn: Ahmet Yılmaz, ABC Ltd."
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Telefon (Opsiyonel)</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="0555 123 45 67"
                  keyboardType="phone-pad"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {editingId ? 'Güncelle' : 'Kaydet'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Transaction Modal */}
      <Modal
        visible={transactionModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setTransactionModalVisible(false)}
      >
        <View style={styles.detailContainer}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setTransactionModalVisible(false)}>
              <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.detailHeaderInfo}>
              <Text style={styles.detailTitle}>{selectedAccount?.name}</Text>
              <Text style={styles.detailPhone}>{selectedAccount?.phone}</Text>
            </View>
            <TouchableOpacity onPress={() => openModal(selectedAccount!)}>
              <Ionicons name="create" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.balanceCard}>
            <Text style={styles.balanceTitle}>Toplam Bakiye</Text>
            <Text
              style={[
                styles.balanceAmount,
                { color: getBalanceColor(selectedAccount?.balance || 0) },
              ]}
            >
              {formatCurrency(Math.abs(selectedAccount?.balance || 0))}
            </Text>
            <Text
              style={[
                styles.balanceLabel,
                { color: getBalanceColor(selectedAccount?.balance || 0) },
              ]}
            >
              {getBalanceLabel(selectedAccount?.balance || 0)}
            </Text>
          </View>

          <View style={styles.transactionForm}>
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  transactionType === 'credit' && styles.typeButtonActive,
                ]}
                onPress={() => setTransactionType('credit')}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    transactionType === 'credit' && styles.typeButtonTextActive,
                  ]}
                >
                  Alacak (+)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  transactionType === 'debt' && styles.typeButtonActive,
                ]}
                onPress={() => setTransactionType('debt')}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    transactionType === 'debt' && styles.typeButtonTextActive,
                  ]}
                >
                  Borç (-)
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="Tutar (₺)"
              placeholderTextColor="#94A3B8"
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Açıklama"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={2}
            />

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleTransactionSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>İşlem Ekle</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.transactionList}>
            <Text style={styles.transactionListTitle}>İşlem Geçmişi</Text>
            <ScrollView>
              {transactions.map((transaction) => (
                <TouchableOpacity
                  key={transaction._id}
                  style={styles.transactionItem}
                  onLongPress={() =>
                    handleDeleteTransaction(selectedAccount!._id, transaction._id)
                  }
                >
                  <View style={styles.transactionItemLeft}>
                    <View
                      style={[
                        styles.transactionItemIcon,
                        {
                          backgroundColor:
                            transaction.type === 'credit' ? '#D1FAE5' : '#FEE2E2',
                        },
                      ]}
                    >
                      <Ionicons
                        name={transaction.type === 'credit' ? 'arrow-down' : 'arrow-up'}
                        size={20}
                        color={transaction.type === 'credit' ? '#10B981' : '#EF4444'}
                      />
                    </View>
                    <View style={styles.transactionItemInfo}>
                      <Text style={styles.transactionItemDescription}>
                        {transaction.description}
                      </Text>
                      <Text style={styles.transactionItemDate}>
                        {format(new Date(transaction.date), 'dd MMM yyyy, HH:mm', {
                          locale: tr,
                        })}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.transactionItemAmount,
                      {
                        color: transaction.type === 'credit' ? '#10B981' : '#EF4444',
                      },
                    ]}
                  >
                    {transaction.type === 'credit' ? '+' : '-'}
                    {formatCurrency(transaction.amount)}
                  </Text>
                </TouchableOpacity>
              ))}
              {transactions.length === 0 && (
                <View style={styles.emptyTransactions}>
                  <Text style={styles.emptyTransactionsText}>
                    Henüz işlem yapılmadı
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
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
  scrollView: {
    flex: 1,
    padding: 16,
  },
  accountCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  accountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  accountIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountInfo: {
    marginLeft: 12,
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  accountPhone: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 2,
  },
  accountType: {
    fontSize: 12,
    color: '#94A3B8',
  },
  accountRight: {
    alignItems: 'flex-end',
  },
  accountBalance: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  accountBalanceLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
    marginTop: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalScroll: {
    padding: 20,
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  typeButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  typeButtonActive: {
    backgroundColor: '#0F172A',
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  detailContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  detailHeader: {
    backgroundColor: '#0F172A',
    padding: 20,
    paddingTop: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  detailHeaderInfo: {
    flex: 1,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  detailPhone: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  balanceCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  balanceTitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  balanceLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  transactionForm: {
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
  amountInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    textAlign: 'center',
  },
  transactionList: {
    flex: 1,
    margin: 16,
    marginTop: 0,
  },
  transactionListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 12,
  },
  transactionItem: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionItemInfo: {
    marginLeft: 12,
    flex: 1,
  },
  transactionItemDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  transactionItemDate: {
    fontSize: 12,
    color: '#64748B',
  },
  transactionItemAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyTransactions: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTransactionsText: {
    fontSize: 14,
    color: '#94A3B8',
  },
});
