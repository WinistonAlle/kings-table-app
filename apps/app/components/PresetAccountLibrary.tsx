import { View, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';
import type { BlindLevel } from '@/types';
import { confirmarAcao } from '@/lib/confirmar';
import { presetPayloadSchema } from '@/lib/sync-preset-model';
import { usePresetSync } from './PresetSync';
import { KTText } from './ui/Text';
import { KTButton } from './ui/Button';

export function PresetAccountLibrary({onSelect,onError}:{onSelect:(levels:BlindLevel[])=>void;onError:(message:string)=>void}) {
  const sync=usePresetSync();
  if(!sync)return null;
  const {state}=sync;
  const rows=state.library.filter(row=>!row.confirmed?.deleted || row.pending.length);
  return <View style={{marginTop:24,gap:12}}>
    <View style={{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:12}}>
      <KTText papel="rotulo" color={Colors.text1}>Estruturas da conta</KTText>
      <KTButton label="Atualizar estruturas" variant="fantasma" disabled={state.phase==='syncing'}
        onPress={()=>{void sync.refresh();}} icone={<Ionicons name="refresh-outline" size={18} color={Colors.gold200}/>} />
    </View>
    {state.phase==='idle'||state.phase==='syncing'?<View style={{flexDirection:'row',alignItems:'center',gap:8}}><ActivityIndicator color={Colors.gold200}/><KTText papel="apoio" color={Colors.text1}>Atualizando biblioteca…</KTText></View>:null}
    {state.error?<KTText accessibilityLiveRegion="polite" color={Colors.danger}>{state.error==='local_storage'?'Não foi possível acessar a biblioteca local.':'Não foi possível atualizar a conta. As alterações pendentes continuam salvas.'}</KTText>:null}
    {!rows.length&&state.phase==='ready'?<KTText papel="apoio" color={Colors.text1}>Nenhuma estrutura salva na conta.</KTText>:null}
    {rows.map(row=>{
      const lastSave=[...row.pending].reverse().find(entry=>entry.operation.kind==='preset.save');
      const intention=presetPayloadSchema.safeParse(lastSave?.operation.payload);
      const payload=row.projected?.payload??row.confirmed?.payload??(intention.success?intention.data:null);
      const name=payload?.name??'Estrutura aguardando recuperação';
      const removed=!!row.projected?.deleted;
      const issue=row.pending.find(entry=>entry.issue)?.issue;
      const status=row.reconciliationNeeded?'Precisa de revisão':removed?'Exclusão pendente':row.pending.length?'Alteração pendente':'Confirmada na conta';
      return <View key={row.id} style={{borderBottomWidth:1,borderBottomColor:Colors.border,paddingVertical:12,gap:8}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
          <View style={{flex:1,minWidth:0,gap:4}}><KTText papel="corpoForte">{name}</KTText><KTText papel="apoio" color={row.reconciliationNeeded?Colors.danger:Colors.text1}>{status}</KTText></View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Excluir da conta: ${name}`}
            disabled={!sync.available||removed||row.reconciliationNeeded}
            onPress={()=>confirmarAcao(`Excluir ${name} da conta? Mesas que já usam esta estrutura não serão alteradas.`,()=>{
              void sync.remove(row.id).catch(()=>onError('Não foi possível registrar a exclusão. A estrutura foi preservada.'));
            })} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',opacity:removed||row.reconciliationNeeded?0.4:1}}>
            <Ionicons name="trash-outline" size={18} color={Colors.danger}/>
          </Pressable>
        </View>
        {issue?<KTText papel="apoio" color={Colors.danger}>{issue.message}</KTText>:null}
        {!removed&&payload?<KTButton label={`Usar ${name}`} variant="fantasma" disabled={row.reconciliationNeeded}
          onPress={()=>onSelect(payload.levels.map(level=>({...level})))} />:null}
      </View>;
    })}
  </View>;
}
