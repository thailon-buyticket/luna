import type { GuardrailAction } from '../../agents/luna/luna-agent';

// Um handler por ação possível do guardrail — GuardrailDecision({ onReply, onConnectHuman,
// onReplyAndConnect }) devolve um matcher que resolve pra ação recebida, sem branch/if solto.
export function GuardrailDecision<T>(handlers: {
  onReply: () => T;
  onConnectHuman: () => T;
  onReplyAndConnect: () => T;
}): (action: GuardrailAction) => T {
  return (action) => {
    switch (action) {
      case 'reply':
        return handlers.onReply();
      case 'connect_human':
        return handlers.onConnectHuman();
      case 'reply_and_connect_human':
        return handlers.onReplyAndConnect();
    }
  };
}
