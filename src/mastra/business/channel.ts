// Canal por onde uma empresa fala com o cliente (Zendesk/WhatsApp hoje, outro amanhã). O
// `Business` só conhece esta interface — nenhuma regra de negócio (horário, aviso de handoff)
// deve vazar pra dentro de um canal, e nenhum detalhe de canal (switchboard, appId) deve vazar
// pra dentro do `Business`.
export interface Channel {
  // Identificador que liga um evento recebido (ex.: `appId` do webhook do Zendesk) a esta
  // empresa. `undefined` quando a env var correspondente ainda não foi configurada — o registry
  // simplesmente nunca casa esse canal com nenhum evento até que ela exista.
  readonly appId: string | undefined;
  sendMessage(conversationId: string, text: string): Promise<void>;
  connectHuman(conversationId: string): Promise<void>;
}
