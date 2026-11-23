import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { API_URL, Profile } from '../api';

export function UserAvatar({ user, token, size = 44 }: { user: Profile; token: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const dimensions = { width: size, height: size, borderRadius: size / 2 };
  return <View style={[s.frame, dimensions]}>{failed ? <Text style={[s.initial, { fontSize: size * 0.36 }]}>{user.email.charAt(0).toUpperCase()}</Text> : <Image accessibilityLabel="Профиль сүрөтү" source={{ uri: `${API_URL}/photo/`, headers: { Authorization: `Token ${token}` } }} onError={() => setFailed(true)} style={dimensions} />}</View>;
}
const s = StyleSheet.create({ frame: { backgroundColor: '#e3ebdc', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: '#c3b071' }, initial: { color: '#193f31', fontWeight: '700' } });
