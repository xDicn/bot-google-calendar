import { addKeyword, EVENTS } from "@builderbot/bot";
import { BotContext, BotMethods } from "@builderbot/bot/dist/types";
import { flowSeller } from "../flows/seller.flow"
import { welcomeFlow } from "../flows/welcome.flow"
import AIClass from "../services/ai";
import { getHistoryParse, handleHistory } from "../utils/handleHistory";
import { generateTimer } from "../utils/generateTimer";
import { getCurrentCalendar } from "../services/calendar";
import { getFullCurrentDate } from "src/utils/currentDate";
import { flowConfirm } from "./confirm.flow";
import { addMinutes, isWithinInterval, format, parse } from "date-fns";
import { fromCallback } from "cypress/types/bluebird";
import conversationalLayer from "src/layers/conversational.layer";

import mainLayer from "src/layers/main.layer";

const DURATION_MEET = parseInt(process.env.DURATION_MEET) || 45; // Validación de datos de entrada
const PROMPT_DISCRIMINATOR = `
Eres un asistente de inteligencia artificial. Tu propósito es determinar si el cliente está interesado en agendar una cita.
### Historial de Conversación (Vendedor/Cliente) ###
{HISTORY}
### Intenciones del Usuario ###

**CONFIRMAR**: Selecciona esta acción si el cliente parece tener un interés SOLAMENTE en agendar la cita. Ejemplo: "Si", "me parece bien", "ok", etc.
**CANCELAR**: Selecciona esta acción si el cliente NO muestra un interés de agendar la cita. "No", "no me interesa", "no quiero esa hora", "tiene otra hora disponible?"
**INVALIDO**: Selecciona esta acción si el cliente responde algo que no esté relacionado con las otras acciones.

### Instrucciones ###

Por favor, clasifica la siguiente conversación según la intención del usuario.
Si habla de precios, servicios y ubicación se considera como INVALIDO.
`;

const PROMPT_FILTER_DATE = `
### Contexto
Eres un asistente de inteligencia artificial. Tu propósito es determinar la fecha y hora que el cliente quiere, en el formato yyyy/MM/dd HH:mm:ss.

### Fecha y Hora Actual:
{CURRENT_DAY}

### Registro de Conversación:
{HISTORY}

Asistente: "{respuesta en formato (yyyy/MM/dd HH:mm:ss)}"
`;

const generatePromptFilter = (history: string) => {
    const nowDate = getFullCurrentDate();
    const mainPrompt = PROMPT_FILTER_DATE
        .replace('{HISTORY}', history)
        .replace('{CURRENT_DAY}', nowDate);

    return mainPrompt;
}

const handleFlowErrors = (message: string, flowDynamic: Function, state: any, endFlow: Function) => {
    flowDynamic(message);
    handleHistory({ content: message, role: 'assistant' }, state);
    endFlow();
}

const flowSchedule = addKeyword(EVENTS.ACTION)
.addAction(async (ctx, { extensions, state, flowDynamic, endFlow }) => {
    try {
        await flowDynamic('Dame un momento para consultar la agenda...');
        const ai = extensions.ai as AIClass;
        const history = getHistoryParse(state);
        const list = await getCurrentCalendar()

        const listParse = list.map((d) => parse(d, 'yyyy/MM/dd HH:mm:ss', new Date()))
            .map((fromDate) => ({ fromDate, toDate: addMinutes(fromDate, DURATION_MEET) }));

        const promptFilter = generatePromptFilter(history);

        const { date } = await ai.desiredDateFn([
            {
                role: 'system',
                content: promptFilter
            }
        ]);

        const desiredDate = parse(date, 'yyyy/MM/dd HH:mm:ss', new Date());
        console.log({ date })
        const isDateAvailable = listParse.every(({ fromDate, toDate }) => !isWithinInterval(desiredDate, { start: fromDate, end: toDate }));

        if (!isDateAvailable) {
            const errorMessage = 'Lo siento, esa hora ya está reservada. ¿Alguna otra fecha y hora?';
            return handleFlowErrors(errorMessage, flowDynamic, state, endFlow);
        }

        const formattedDateFrom = format(desiredDate, 'hh:mm a');
        const formattedDateTo = format(addMinutes(desiredDate, DURATION_MEET), 'hh:mm a');
        const message = `¡Perfecto! Tenemos disponibilidad de ${formattedDateFrom} a ${formattedDateTo} el día ${format(desiredDate, 'dd/MM/yyyy')}. ¿Confirmo tu reserva?`;
        await handleHistory({ content: message, role: 'assistant' }, state);
        await state.update({ desiredDate })

        const chunks = message.split(/(?<!\d)\.\s+/g);
        for (const chunk of chunks) {
            await flowDynamic([{ body: chunk.trim(), delay: generateTimer(150, 250) }]);
        }
    } catch (error) {
        console.error('Error en flowSchedule:', error);
        const errorMessage = 'Se produjo un error al procesar tu solicitud. Por favor, inténtalo de nuevo más tarde.';
        handleFlowErrors(errorMessage, flowDynamic, state, endFlow);
    }

    //Ajustar este add para que chatgpt analice la respuesta (investigar a)
})
.addAction({ capture: true }, async ({body},{gotoFlow, flowDynamic, state, extensions, fallBack}) => {
    await handleHistory({ content: body, role: 'user' }, state);
    const ai = extensions.ai as AIClass
    const history = getHistoryParse(state)
    const prompt = PROMPT_DISCRIMINATOR


    console.log(prompt.replace('{HISTORY}', history))

    const { prediction } = await ai.determineConfirmFn([
        {
            role: 'system',
            content: prompt.replace('{HISTORY}', history)
        }
    ], 'gpt-3.5-turbo-0125')


    console.log({ prediction })
    

    if (prediction.includes('CONFIRMAR')) return gotoFlow(flowConfirm)
    
    
    if (prediction.includes('CANCELAR')) {
        return gotoFlow(welcomeFlow)
    }
   
})

export { flowSchedule }
