import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { getMyTickets } from '../services/ticketsApi.js';

const TABS = [
  { key: 'all', label: 'الكل' },
  { key: 'new', label: 'جديد' },
  { key: 'in_progress', label: 'جاري' },
  { key: 'awaiting_confirmation', label: 'انتظار تأكيد' }
];

export default function MyTicketsScreen() {
  const [tickets, setTickets] = useState([]);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    const unsubscribe = getMyTickets((res) => {
      if (res.status === 'success') setTickets(res.data || []);
      else {
        console.error(res.message || 'Error loading my tickets');
        setTickets([]);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const filtered = tickets.filter(t => {
    if (tab === 'all') return true;
    if (tab === 'new') return t.status === 'pending';
    if (tab === 'in_progress') return t.status === 'in_progress' || t.status === 'assigned';
    if (tab === 'awaiting_confirmation') return t.status === 'awaiting_confirmation';
    return true;
  });

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.title}>{item.title || item.issueId || item.summary || 'بدون عنوان'}</Text>
      <Text style={styles.meta}>الحالة: {translateStatus(item.status)}</Text>
      <Text style={styles.meta}>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={filtered.length === 0 && styles.emptyContainer}
        ListEmptyComponent={<Text style={styles.empty}>لا توجد تذاكر</Text>}
      />
    </View>
  );
}

function translateStatus(status) {
  switch (status) {
    case 'pending': return 'جديد';
    case 'assigned': return 'مُسنَد';
    case 'in_progress': return 'قيد التنفيذ';
    case 'awaiting_confirmation': return 'بانتظار تأكيد';
    case 'closed': return 'مغلق';
    default: return status || '';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, backgroundColor: '#fff' },
  tabs: { flexDirection: 'row', marginBottom: 8 },
  tab: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, marginRight: 8, backgroundColor: '#f0f0f0' },
  tabActive: { backgroundColor: '#007bff' },
  tabLabel: { color: '#333' },
  tabLabelActive: { color: '#fff' },
  card: { padding: 12, borderRadius: 8, backgroundColor: '#fafafa', marginBottom: 8, borderWidth: 1, borderColor: '#eee' },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  meta: { fontSize: 13, color: '#666' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', color: '#666', marginTop: 20 }
});
