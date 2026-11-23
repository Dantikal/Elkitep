import { Alert, Platform, Pressable, Text, View } from 'react-native';

export async function confirmDelete(message: string): Promise<boolean> {
  if (Platform.OS === 'web') return window.confirm(message);
  return new Promise(resolve => Alert.alert('Өчүрүүнү ырастоо', message, [
    { text: 'Жокко чыгаруу', style: 'cancel', onPress: () => resolve(false) },
    { text: 'Өчүрүү', style: 'destructive', onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) }));
}

export function AdminActions({ onEdit, onDelete, disabled = false }: { onEdit: () => void; onDelete: () => void; disabled?: boolean }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Өзгөртүү" disabled={disabled} onPress={onEdit} style={styles.button}><Text style={styles.edit}>✎</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Өчүрүү" disabled={disabled} onPress={onDelete} style={styles.button}><Text style={styles.delete}>⌫</Text></Pressable>
  </View>;
}
const styles = { button: { minWidth: 40, minHeight: 40, borderRadius: 10, backgroundColor: '#edf3e9', alignItems: 'center' as const, justifyContent: 'center' as const }, edit: { color: '#193f31', fontSize: 20, fontWeight: '700' as const }, delete: { color: '#a04435', fontSize: 20, fontWeight: '700' as const } };
