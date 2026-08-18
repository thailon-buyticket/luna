// Textos fixos usados em mais de um lugar, organizados por categoria — em vez de constantes
// soltas espalhadas pelos arquivos que as usam.
export const predefinedMessage = {
  business: {
    high_volume:
      'Atenção: devido ao alto volume de solicitações neste momento, nosso tempo de resposta pode ser maior do que o normal. Contamos com sua compreensão e não se preocupe: garantimos que vamos responder você assim que possível.',
    outside_hours:
      'Como sua solicitação precisa do suporte do nosso time, peço que aguarde o início do horário de atendimento. Estaremos de volta a partir das 10h para dar continuidade ao seu caso, combinado?',
  },
  media: {
    video_unsupported:
      '[Cliente enviou um vídeo. Diga que ainda não conseguimos abrir vídeos e peça uma descrição em texto ou uma foto/print do problema.]',
    sticker_unsupported: '[Cliente enviou uma figurinha ou emoji]',
    file_placeholder: 'usuário enviou um arquivo',
  },
} as const;
