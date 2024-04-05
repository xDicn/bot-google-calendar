import { BotStateStandAlone } from "@builderbot/bot/dist/types";

export type History = { role: 'user' | 'assistant', content: string };

const handleHistory = async (inside: History, _state: BotStateStandAlone) => {
    const history = _state.get<History[]>('history') ?? [];
    
    // Agregar el último mensaje del cliente al historial si el último mensaje fue del cliente
    if (inside.role === 'user') {
        const lastMessage = history.length > 0 ? history[history.length - 1] : null;
        if (!lastMessage || lastMessage.role !== 'user') {
            history.push(inside);
        } else {
            // Reemplazar el último mensaje del cliente si ya existe uno en el historial
            history[history.length - 1] = inside;
        }
    } else {
        history.push(inside);
    }

    await _state.update({ history });
};

const getHistory = (_state: BotStateStandAlone, k = 15) => {
    const history = _state.get<History[]>('history') ?? [];
    const limitHistory = history.slice(-k);
    return limitHistory;
};

const getHistoryParse = (_state: BotStateStandAlone, k = 15): string => {
    const history = _state.get<History[]>('history') ?? [];
    const limitHistory = history.slice(-k);
    return limitHistory.reduce((prev, current) => {
        const msg = current.role === 'user' ? `Customer: "${current.content}"` : `\nSeller: "${current.content}"\n`;
        prev += msg;
        return prev;
    }, ``);
};

const clearHistory = async (_state: BotStateStandAlone) => {
    _state.clear();
};

export { handleHistory, getHistory, getHistoryParse, clearHistory };