import { useState } from 'react';
import { View, Pressable, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '@/constants/tokens';
import type { BlindLevel } from '@/types';
import { confirmarAcao } from '@/lib/confirmar';
import { presetPayloadSchema, type PresetPayload } from '@/lib/sync-preset-model';
import type { PresetLibrary } from '@/lib/sync-preset-session';
import type { PresetResolutionRequest } from '@/lib/sync-outbox';
import type { PresetSyncValue } from './PresetSync.web';
import { usePresetSync } from './PresetSync';
import { KTText } from './ui/Text';
import { KTButton } from './ui/Button';

export function PresetAccountLibrary({onSelect,onError}:{onSelect:(levels:BlindLevel[])=>void;onError:(message:string)=>void}) {
  const sync=usePresetSync();
  if(!sync)return null;
  const {state}=sync;
  const rows=state.library.filter(row=>!row.confirmed?.deleted || row.pending.length || row.archived.length);
  return <View style={{marginTop:24,gap:12}}>
    <View style={{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:12}}>
      <KTText papel="rotulo" color={Colors.text1}>Estruturas da conta</KTText>
      <KTButton label="Atualizar estruturas" variant="fantasma" disabled={state.phase==='syncing'}
        onPress={()=>{void sync.refresh();}} icone={<Ionicons name="refresh-outline" size={18} color={Colors.gold200}/>} />
    </View>
    {state.phase==='idle'||state.phase==='syncing'?<View style={{flexDirection:'row',alignItems:'center',gap:8}}><ActivityIndicator color={Colors.gold200}/><KTText papel="apoio" color={Colors.text1}>Atualizando biblioteca…</KTText></View>:null}
    {state.error?<KTText accessibilityLiveRegion="polite" color={Colors.danger}>{state.error==='local_storage'?'Não foi possível acessar a biblioteca local.':'Não foi possível atualizar a conta. As alterações pendentes continuam salvas.'}</KTText>:null}
    {!rows.length&&state.phase==='ready'?<KTText papel="apoio" color={Colors.text1}>Nenhuma estrutura salva na conta.</KTText>:null}
    {rows.map(row=><PresetAccountRow key={row.id} row={row} sync={sync} onSelect={onSelect} onError={onError}/>)}
  </View>;
}

function PresetAccountRow({row,sync,onSelect,onError}:{row:PresetLibrary[number];sync:PresetSyncValue;
  onSelect:(levels:BlindLevel[])=>void;onError:(message:string)=>void}) {
      const [review,setReview]=useState(false);
      const [history,setHistory]=useState(false);
      const [copyName,setCopyName]=useState('');
      const [busy,setBusy]=useState(false);
      const [error,setError]=useState<string|null>(null);
      const [notice,setNotice]=useState<string|null>(null);
      const lastSave=[...row.pending].reverse().find(entry=>entry.operation.kind==='preset.save');
      const intention=presetPayloadSchema.safeParse(lastSave?.operation.payload);
      const archivedSave=[...row.archived].reverse().find(entry=>entry.operation.kind==='preset.save');
      const archivedPayload=presetPayloadSchema.safeParse(archivedSave?.operation.payload);
      const payload=row.projected?.payload??row.confirmed?.payload??(intention.success?intention.data:archivedPayload.success?archivedPayload.data:null);
      const name=payload?.name??'Estrutura aguardando recuperação';
      const removed=!!row.projected?.deleted;
      const issue=row.pending.find(entry=>entry.issue)?.issue;
      const status=row.reconciliationNeeded?'Precisa de revisão':removed?(row.pending.length?'Exclusão pendente':'Removida da biblioteca'):row.pending.length?'Alteração pendente':row.confirmed?'Confirmada na conta':'Alteração arquivada';
      const definitive=!!row.pending.length&&['conflict','rejected'].includes(row.pending[0].status)
        &&row.pending.every(entry=>['queued','conflict','rejected'].includes(entry.status));
      const canResolve=definitive&&sync.available&&sync.state.phase==='ready'&&!busy;
      const copySource=intention.success?intention.data:row.confirmed?.payload;
      const copyValid=!!copySource&&presetPayloadSchema.safeParse({...copySource,name:copyName}).success;
      const resolve=(decision:PresetResolutionRequest['decision'])=>{
        const request={expectedBase:row.confirmed,pendingOperationIds:row.pending.map(entry=>entry.operation.id),decision};
        confirmarAcao(decision.kind==='save_copy'
          ?'Salvar a alteração como uma nova estrutura? A versão da conta não será alterada e o histórico será preservado.'
          :'Manter a versão da conta? Estas alterações deixarão de ser enviadas, mas continuarão no histórico.',()=>{
          setBusy(true);setError(null);setNotice(null);
          void sync.resolve(row.id,request).then(()=>{
            setReview(false);setNotice(decision.kind==='save_copy'?'Cópia registrada. Acompanhe o envio na biblioteca.':'Versão da conta mantida. Decisão registrada no histórico.');
          }).catch(cause=>{setError(cause instanceof Error?cause.message:'Não foi possível registrar a decisão. Atualize a biblioteca e tente novamente.');})
            .finally(()=>setBusy(false));
        });
      };
      return <View style={{borderBottomWidth:1,borderBottomColor:Colors.border,paddingVertical:12,gap:8}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
          <View style={{flex:1,minWidth:0,gap:4}}><KTText papel="corpoForte">{name}</KTText><KTText papel="apoio" color={row.reconciliationNeeded?Colors.danger:Colors.text1}>{status}</KTText></View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Excluir da conta: ${name}`}
            disabled={!sync.available||removed||row.reconciliationNeeded||!row.confirmed&&!row.pending.length||busy}
            onPress={()=>confirmarAcao(`Excluir ${name} da conta? Mesas que já usam esta estrutura não serão alteradas.`,()=>{
              void sync.remove(row.id).catch(()=>onError('Não foi possível registrar a exclusão. A estrutura foi preservada.'));
            })} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',opacity:removed||row.reconciliationNeeded?0.4:1}}>
            <Ionicons name="trash-outline" size={18} color={Colors.danger}/>
          </Pressable>
        </View>
        {issue?<KTText papel="apoio" color={Colors.danger}>{issue.message}</KTText>:null}
        {!removed&&payload&&(row.confirmed||row.pending.length)?<KTButton label={`Usar ${name}`} variant="fantasma" disabled={row.reconciliationNeeded||busy}
          onPress={()=>onSelect(payload.levels.map(level=>({...level})))} />:null}
        {row.reconciliationNeeded?<KTButton label={review?'Fechar revisão':'Revisar alteração'} variant="fantasma" disabled={busy}
          onPress={()=>{setReview(!review);if(!review){setCopyName(`${copySource?.name??'Estrutura'} (cópia)`);setError(null);}}} />:null}
        {review&&row.reconciliationNeeded?<View style={{gap:12,paddingVertical:8}}>
          <PayloadDetails title="Versão da conta" payload={row.confirmed?.payload??null}
            status={row.confirmed?.deleted?'Removida da conta':row.confirmed?`Revisão ${row.confirmed.revision}`:'Sem versão confirmada neste aparelho'}/>
          <PayloadDetails title="Alteração pendente" payload={intention.success?intention.data:null}
            status={row.pending.at(-1)?.operation.kind==='preset.remove'?'Pedido de exclusão':`${row.pending.length} alteração(ões) nesta cadeia`}/>
          {!definitive?<KTText papel="apoio" color={Colors.warn}>A resposta do servidor ainda é incerta. Atualize a biblioteca antes de decidir.</KTText>:null}
          {definitive&&sync.state.phase!=='ready'?<KTText papel="apoio" color={Colors.warn}>Atualize a biblioteca para revisar a versão da conta.</KTText>:null}
          <KTButton label="Manter versão da conta" variant="fantasma" disabled={!canResolve} onPress={()=>resolve({kind:'keep_remote'})}/>
          {copySource?<View style={{gap:8}}>
            <KTText papel="apoio" color={Colors.text1}>Nome da nova estrutura</KTText>
            <TextInput accessibilityLabel="Nome da cópia" value={copyName} onChangeText={setCopyName} editable={!busy}
              maxLength={240} style={{minHeight:48,padding:12,color:Colors.text0,backgroundColor:Colors.bg1,
                borderWidth:1,borderColor:Colors.borderStrong,borderRadius:Radius.xs,fontFamily:Fonts.ui,fontSize:16}}/>
            {!copyValid?<KTText papel="apoio" color={Colors.danger}>Use um nome de 1 a 120 caracteres.</KTText>:null}
            <KTButton label="Salvar como nova estrutura" disabled={!canResolve||!copyValid} onPress={()=>resolve({kind:'save_copy',name:copyName})}/>
          </View>:null}
        </View>:null}
        {busy?<ActivityIndicator accessibilityLabel="Registrando decisão" color={Colors.gold200}/>:null}
        {error?<KTText accessibilityLiveRegion="polite" color={Colors.danger}>{error}</KTText>:null}
        {notice?<KTText accessibilityLiveRegion="polite" color={Colors.ok}>{notice}</KTText>:null}
        {row.archived.length?<KTButton label={history?'Fechar histórico':'Ver histórico de decisões'} variant="fantasma" onPress={()=>setHistory(!history)}/>:null}
        {history?row.archived.map(entry=>{
          const attempted=presetPayloadSchema.safeParse(entry.operation.payload);
          const copy=sync.state.library.find(item=>item.id===entry.resolution?.copiedTo);
          const copyLabel=copy?.projected?.payload?.name??copy?.confirmed?.payload?.name;
          return <View key={entry.operation.id} style={{gap:6,paddingVertical:8}}>
            <KTText papel="corpoForte">{entry.resolution?.kind==='save_copy'?'Preservada como cópia':'Versão da conta mantida'}</KTText>
            <KTText papel="apoio" color={Colors.text1}>{entry.resolution?new Date(entry.resolution.createdAt).toLocaleString('pt-BR'):''}</KTText>
            {copyLabel?<KTText papel="apoio" color={Colors.text1}>Cópia: {copyLabel}</KTText>:null}
            <PayloadDetails title={entry.operation.kind==='preset.remove'?'Pedido de exclusão arquivado':'Estrutura arquivada'} payload={attempted.success?attempted.data:null}/>
            {entry.issue?<KTText papel="apoio" color={Colors.text1}>{entry.issue.message}</KTText>:null}
          </View>;
        }):null}
      </View>;
}

function PayloadDetails({title,payload,status}:{title:string;payload:PresetPayload|null;status?:string}) {
  const [expanded,setExpanded]=useState(false);
  return <View style={{gap:4}}>
    <KTText papel="corpoForte">{title}</KTText>
    {status?<KTText papel="apoio" color={Colors.text1}>{status}</KTText>:null}
    {payload?<>
      <KTText color={Colors.text1}>{payload.name} · {payload.levels.filter(level=>!level.isBreak).length} níveis · {payload.levels.filter(level=>level.isBreak).length} intervalos</KTText>
      <KTButton label={expanded?`Ocultar níveis: ${title}`:`Ver níveis: ${title}`} variant="fantasma" onPress={()=>setExpanded(!expanded)}/>
      {expanded?payload.levels.map((level,index)=><KTText key={index} papel="apoio" color={Colors.text1}>
        {level.isBreak?`Intervalo · ${level.durationMinutes} min`:`Nível ${level.level} · ${level.smallBlind}/${level.bigBlind} · ante ${level.ante} · ${level.durationMinutes} min`}
      </KTText>):null}
    </>:null}
  </View>;
}
