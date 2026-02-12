import React, { useState, useEffect, useCallback } from 'react';
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
  Image,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../utils/api';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import * as ImagePicker from 'expo-image-picker';

interface Transaction {
  _id: string;
  type: string;
  amount: number;
  category_id: string;
  payment_method: string;
  description: string;
  date: string;
  photo?: string;
}

interface Category {
  _id: string;
  name: string;
  type: string;
  color: string;
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form states
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'credit_card'>('cash');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = async () => {
    try {
      const [transResponse, catResponse] = await Promise.all([
        api.get('/transactions'),
        api.get('/categories'),
      ]);
      setTransactions(transResponse.data);
      setCategories(catResponse.data);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('İzin Gerekli', 'Galeriye erişim izni vermeniz gerekiyor.');
      return;
    }

    const result = await ImagePicker.launchImagePickerAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('İzin Gerekli', 'Kameraya erişim izni vermeniz gerekiyor.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const openModal = (transaction?: Transaction) => {
    if (transaction) {
      setEditingId(transaction._id);
      setType(transaction.type as 'income' | 'expense');
      setAmount(transaction.amount.toString());
      setCategoryId(transaction.category_id);
      setPaymentMethod(transaction.payment_method as any);
      setDescription(transaction.description);
      setPhoto(transaction.photo || null);
    } else {
      resetForm();
    }
    setModalVisible(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setType('expense');
    setAmount('');
    setCategoryId('');
    setPaymentMethod('cash');
    setDescription('');
    setPhoto(null);
  };

  const handleSubmit = async () => {
    if (!amount || !categoryId || !description) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun');
      return;
    }

    setSubmitting(true);
    try {
      const data = {
        type,
        amount: parseFloat(amount),
        category_id: categoryId,
        payment_method: paymentMethod,
        description,
        date: new Date().toISOString(),
        photo: photo || undefined,
      };

      if (editingId) {
        await api.put(`/transactions/${editingId}`, data);
      } else {
        await api.post('/transactions', data);
      }

      setModalVisible(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      Alert.alert('Hata', error.response?.data?.detail || 'İşlem kaydedilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
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
              await api.delete(`/transactions/${id}`);
              fetchData();
            } catch (error) {
              Alert.alert('Hata', 'İşlem silinemedi');
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
    }).format(amount);
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: any = {
      cash: 'Nakit',
      bank: 'Banka',
      credit_card: 'Kredi Kartı',
    };
    return labels[method] || method;
  };

  const filteredCategories = categories.filter((cat) => cat.type === type);

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
        {transactions.map((transaction) => {
          const category = categories.find((c) => c._id === transaction.category_id);
          return (
            <TouchableOpacity
              key={transaction._id}
              style={styles.transactionCard}
              onPress={() => openModal(transaction)}
              onLongPress={() => handleDelete(transaction._id)}
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
                    name={transaction.type === 'income' ? 'arrow-down' : 'arrow-up'}
                    size={24}
                    color={transaction.type === 'income' ? '#10B981' : '#EF4444'}
                  />
                </View>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionDescription}>
                    {transaction.description}
                  </Text>
                  <Text style={styles.transactionMeta}>
                    {category?.name} • {getPaymentMethodLabel(transaction.payment_method)}
                  </Text>
                  <Text style={styles.transactionDate}>
                    {format(new Date(transaction.date), 'dd MMM yyyy, HH:mm', {
                      locale: tr,
                    })}
                  </Text>
                </View>
              </View>
              <View style={styles.transactionRight}>
                <Text
                  style={[
                    styles.transactionAmount,
                    {
                      color: transaction.type === 'income' ? '#10B981' : '#EF4444',
                    },
                  ]}
                >
                  {transaction.type === 'income' ? '+' : '-'}
                  {formatCurrency(transaction.amount)}
                </Text>
                {transaction.photo && (
                  <Ionicons name="camera" size={16} color="#64748B" style={{ marginTop: 4 }} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
        {transactions.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#94A3B8" />
            <Text style={styles.emptyText}>Henüz işlem yok</Text>
            <Text style={styles.emptySubtext}>Yeni işlem eklemek için + butonuna tıklayın</Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => openModal()}
      >
        <Ionicons name="add" size={32} color="#FFFFFF" />
      </TouchableOpacity>

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
                {editingId ? 'İşlemi Düzenle' : 'Yeni İşlem'}
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
                    type === 'income' && styles.typeButtonActive,
                  ]}
                  onPress={() => setType('income')}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      type === 'income' && styles.typeButtonTextActive,
                    ]}
                  >
                    Gelir
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    type === 'expense' && styles.typeButtonActive,
                  ]}
                  onPress={() => setType('expense')}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      type === 'expense' && styles.typeButtonTextActive,
                    ]}
                  >
                    Gider
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Tutar (₺)</Text>
                <TextInput
                  style={styles.input}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Kategori</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {filteredCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat._id}
                      style={[
                        styles.categoryChip,
                        categoryId === cat._id && styles.categoryChipActive,
                      ]}
                      onPress={() => setCategoryId(cat._id)}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          categoryId === cat._id && styles.categoryChipTextActive,
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Ödeme Yöntemi</Text>
                <View style={styles.paymentMethods}>
                  {[
                    { value: 'cash', label: 'Nakit', icon: 'cash' },
                    { value: 'bank', label: 'Banka', icon: 'business' },
                    { value: 'credit_card', label: 'Kredi Kartı', icon: 'card' },
                  ].map((method) => (
                    <TouchableOpacity
                      key={method.value}
                      style={[
                        styles.paymentMethod,
                        paymentMethod === method.value && styles.paymentMethodActive,
                      ]}
                      onPress={() => setPaymentMethod(method.value as any)}
                    >
                      <Ionicons
                        name={method.icon as any}
                        size={24}
                        color={paymentMethod === method.value ? '#0F172A' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.paymentMethodText,
                          paymentMethod === method.value && styles.paymentMethodTextActive,
                        ]}
                      >
                        {method.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Açıklama</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="İşlem açıklaması"
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Fiş / Fatura Fotoğrafı</Text>
                <View style={styles.photoButtons}>
                  <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
                    <Ionicons name="camera" size={24} color="#0F172A" />
                    <Text style={styles.photoButtonText}>Fotoğraf Çek</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.photoButton} onPress={pickImage}>
                    <Ionicons name="images" size={24} color="#0F172A" />
                    <Text style={styles.photoButtonText}>Galeriden Seç</Text>
                  </TouchableOpacity>
                </View>
                {photo && (
                  <View style={styles.photoPreview}>
                    <Image source={{ uri: photo }} style={styles.photoImage} />
                    <TouchableOpacity
                      style={styles.photoRemove}
                      onPress={() => setPhoto(null)}
                    >
                      <Ionicons name="close-circle" size={28} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                )}
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
  transactionCard: {
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
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
  transactionMeta: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: '#94A3B8',
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
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
    maxHeight: '90%',
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
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#64748B',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  paymentMethods: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentMethod: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  paymentMethodActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#0F172A',
  },
  paymentMethodText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  paymentMethodTextActive: {
    color: '#0F172A',
    fontWeight: '600',
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  photoButtonText: {
    fontSize: 14,
    color: '#0F172A',
  },
  photoPreview: {
    marginTop: 12,
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  photoRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
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
});
