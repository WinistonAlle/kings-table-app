import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius, Space } from '@/constants/tokens';
import { preparePresetPayload } from '@/lib/sync-preset-model';
import { createOperation, type SyncOperation } from '@/lib/sync-operation';
import { novaIdentidade } from '@/lib/identidade';
import type { BlindLevel } from '@/types';
import { usePresetSync } from './PresetSync';
import { KTButton } from './ui/Button';
import { KTText } from './ui/Text';

export function SaveAccountStructure({ ownerId, levels, disabled, onBusyChange }: {
  ownerId: string; levels: BlindLevel[]; disabled: boolean; onBusyChange: (busy: boolean) => void;
}) {
  const sync = usePresetSync();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(false);
  const [message, setMessage] = useState('');
  const operation = useRef<SyncOperation | null>(null);
  const busy = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { onBusyChange(saving || retry); return () => onBusyChange(false); }, [saving, retry, onBusyChange]);
  if (!sync) return null;

  async function save() {
    if (!sync || busy.current || !sync.available || (!operation.current && disabled)) return;
    busy.current = true; setSaving(true); onBusyChange(true); setMessage('');
    try {
      if (!operation.current) {
        const payload = preparePresetPayload({ name, levels });
        operation.current = createOperation({ ownerId, entityId: novaIdentidade(), entity: 'preset',
          kind: 'preset.save', expectedRevision: 0, payload });
      }
      await sync.enqueue(operation.current);
      if (!alive.current) return;
      operation.current = null; setRetry(false); setName('');
      setMessage('Registrada na biblioteca. Confira a confirmação da conta.');
    } catch {
      if (!alive.current) return;
      setRetry(!!operation.current);
      setMessage(operation.current ? 'Registro não confirmado. Repita a mesma tentativa para evitar duplicações.'
        : 'Confira o nome, os blinds e a duração de cada linha antes de salvar.');
    } finally { busy.current = false; if (alive.current) setSaving(false); }
  }

  return <View style={styles.section}>
    <KTText papel="corpoForte">Salvar para outras mesas</KTText>
    <TextInput accessibilityLabel="Nome da nova estrutura na biblioteca" placeholder="Nome da estrutura"
      placeholderTextColor={Colors.text2} value={name} onChangeText={setName} maxLength={240}
      editable={!disabled && !saving && !retry} style={styles.input} />
    <KTButton label={saving ? 'Registrando na biblioteca…' : retry ? 'Tentar salvar na biblioteca novamente' : 'Salvar nova estrutura na biblioteca'}
      variant="fantasma" disabled={saving || !sync.available || (!retry && (disabled || !name.trim() || Array.from(name.trim()).length > 120))}
      onPress={() => { void save(); }} icone={<Ionicons name="bookmark-outline" size={18} color={Colors.gold200} />} />
    {message ? <KTText accessibilityLiveRegion="polite" papel="apoio" color={Colors.gold200}>{message}</KTText> : null}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: Space.sm, paddingVertical: Space.md, borderTopWidth: 1, borderColor: Colors.border },
  input: { minHeight: 48, padding: 14, borderWidth: 1, borderColor: Colors.borderStrong,
    borderRadius: Radius.sm, color: Colors.text0, backgroundColor: Colors.bg1, fontFamily: Fonts.ui, fontSize: 16 },
});
