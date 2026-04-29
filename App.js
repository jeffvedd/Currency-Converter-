import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  FlatList,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';

const CurrencyItem = ({ currency, onPress, selected }) => (
  <TouchableOpacity
    style={[styles.currencyItem, selected && styles.selectedCurrency]}
    onPress={() => onPress(currency)}
  >
    <Text style={styles.currencyCode}>{currency.code}</Text>
    <Text style={styles.currencyName}>{currency.name}</Text>
  </TouchableOpacity>
);

const HistoryItem = ({ item }) => (
  <View style={styles.historyItem}>
    <Text style={styles.historyText}>
      {item.amount} {item.from} = {item.result} {item.to}
    </Text>
    <Text style={styles.historyDate}>{item.date}</Text>
  </View>
);

export default function App() {
  const [currencies, setCurrencies] = useState([]);
  const [fromCurrency, setFromCurrency] = useState({ code: 'USD', name: 'US Dollar' });
  const [toCurrency, setToCurrency] = useState({ code: 'BRL', name: 'Brazilian Real' });
  const [amount, setAmount] = useState('1');
  const [result, setResult] = useState('');
  const [rates, setRates] = useState({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState([]);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

  const currencyList = {
    USD: 'US Dollar',
    EUR: 'Euro',
    BRL: 'Brazilian Real',
    JPY: 'Japanese Yen',
    GBP: 'British Pound',
    AUD: 'Australian Dollar',
    CAD: 'Canadian Dollar',
    CHF: 'Swiss Franc',
    CNY: 'Chinese Yuan',
    INR: 'Indian Rupee',
    MXN: 'Mexican Peso',
    BTC: 'Bitcoin',
    ETH: 'Ethereum',
    ADA: 'Cardano',
    DOGE: 'Dogecoin',
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await loadCurrencies();
      await loadHistory();
    } catch (error) {
      console.error('Error loading initial data:', error);
      Alert.alert('Error', 'Failed to load data. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrencies = async () => {
    try {
      const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
      setRates(response.data.rates);
      setLastUpdated(new Date().toLocaleString('en-US'));

      const formattedCurrencies = Object.keys(response.data.rates).map(code => ({
        code,
        name: currencyList[code] || code,
      }));
      setCurrencies(formattedCurrencies);

      return true;
    } catch (error) {
      console.error('Error loading rates:', error);
      throw error;
    }
  };

  const loadHistory = async () => {
    try {
      const savedHistory = await AsyncStorage.getItem('conversionHistory');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const saveHistory = async (newHistory) => {
    try {
      await AsyncStorage.setItem('conversionHistory', JSON.stringify(newHistory));
    } catch (error) {
      console.error('Error saving history:', error);
    }
  };

  const convert = () => {
    if (!amount || isNaN(amount) || amount <= 0) {
      setResult('0.00');
      return;
    }

    const fromRate = rates[fromCurrency.code];
    const toRate = rates[toCurrency.code];

    if (!fromRate || !toRate) {
      setResult('Error');
      return;
    }

    const amountInUSD = parseFloat(amount) / fromRate;
    const converted = (amountInUSD * toRate).toFixed(2);
    setResult(converted);
  };

  useEffect(() => {
    if (Object.keys(rates).length > 0) {
      convert();
    }
  }, [amount, fromCurrency, toCurrency, rates]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadCurrencies();
    } catch (error) {
      Alert.alert('Error', 'Failed to update exchange rates.');
    } finally {
      setRefreshing(false);
    }
  };

  const addToHistory = () => {
    if (!amount || isNaN(amount) || amount <= 0 || !result) return;

    const newEntry = {
      id: Date.now().toString(),
      amount,
      from: fromCurrency.code,
      to: toCurrency.code,
      result: result,
      date: new Date().toLocaleDateString('en-US'),
    };

    const newHistory = [newEntry, ...history.slice(0, 9)];
    setHistory(newHistory);
    saveHistory(newHistory);
  };

  useEffect(() => {
    if (result && !isNaN(result) && result !== '0.00') {
      addToHistory();
    }
  }, [result]);

  const selectCurrency = (currency, isFrom = true) => {
    if (isFrom) {
      setFromCurrency(currency);
    } else {
      setToCurrency(currency);
    }
    setShowFromPicker(false);
    setShowToPicker(false);
  };

  const clearHistory = async () => {
    setHistory([]);
    await AsyncStorage.removeItem('conversionHistory');
  };

  const renderCurrencyPicker = (isFrom = true) => {
    const selectedCurrency = isFrom ? fromCurrency : toCurrency;
    return (
      <Modal
        visible={isFrom ? showFromPicker : showToPicker}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select a Currency</Text>
              <TouchableOpacity
                onPress={() => isFrom ? setShowFromPicker(false) : setShowToPicker(false)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={currencies}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <CurrencyItem
                  currency={item}
                  onPress={() => selectCurrency(item, isFrom)}
                  selected={item.code === selectedCurrency.code}
                />
              )}
            />
          </View>
        </View>
      </Modal>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4e73df" />
          <Text style={styles.loadingText}>Loading exchange rates...</Text>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        <ScrollView
          style={styles.scrollContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={{ paddingBottom: 30 }}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Currency Converter</Text>
            <Text style={styles.subtitle}>Last updated: {lastUpdated}</Text>
          </View>

          <View style={styles.converterContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Amount</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter amount"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
            </View>

            <View style={styles.currencySelectors}>
              <TouchableOpacity
                style={styles.currencySelector}
                onPress={() => setShowFromPicker(true)}
              >
                <Text style={styles.currencyCode}>{fromCurrency.code}</Text>
                <Text style={styles.currencyName}>{fromCurrency.name}</Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.swapButton}
                onPress={() => {
                  setFromCurrency(toCurrency);
                  setToCurrency(fromCurrency);
                }}
              >
                <Ionicons name="swap-horizontal" size={24} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.currencySelector}
                onPress={() => setShowToPicker(true)}
              >
                <Text style={styles.currencyCode}>{toCurrency.code}</Text>
                <Text style={styles.currencyName}>{toCurrency.name}</Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.resultContainer}>
              <Text style={styles.resultLabel}>Result</Text>
              <Text style={styles.resultValue}>
                {amount || '0'} {fromCurrency.code} = {result || '0.00'} {toCurrency.code}
              </Text>
            </View>
          </View>

          <View style={styles.historyContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Conversion History</Text>
              {history.length > 0 && (
                <TouchableOpacity onPress={clearHistory}>
                  <Text style={styles.clearHistory}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>

            {history.length === 0 ? (
              <Text style={styles.emptyHistory}>No conversions yet</Text>
            ) : (
              <FlatList
                data={history}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <HistoryItem item={item} />}
                scrollEnabled={false}
              />
            )}
          </View>

          {renderCurrencyPicker(true)}
          {renderCurrencyPicker(false)}
        </ScrollView>
      </View>
    );
  };

  return renderContent();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  converterContainer: {
    backgroundColor: '#fff',
    margin: 15,
    borderRadius: 10,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 18,
    backgroundColor: '#f9f9f9',
  },
  currencySelectors: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  currencySelector: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  currencyCode: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  currencyName: {
    fontSize: 12,
    color: '#666',
    marginTop: 3,
  },
  swapButton: {
    backgroundColor: '#4e73df',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
    elevation: 3,
  },
  resultContainer: {
    backgroundColor: '#e8f4ff',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  resultValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4e73df',
  },
  historyContainer: {
    backgroundColor: '#fff',
    margin: 15,
    marginTop: 0,
    borderRadius: 10,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  clearHistory: {
    color: '#e74a3b',
    fontSize: 14,
  },
  emptyHistory: {
    textAlign: 'center',
    color: '#999',
    padding: 20,
  },
  historyItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  historyText: {
    fontSize: 16,
    color: '#333',
  },
  historyDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 3,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  currencyItem: {
    padding: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedCurrency: {
    backgroundColor: '#e8f4ff',
  },
});
