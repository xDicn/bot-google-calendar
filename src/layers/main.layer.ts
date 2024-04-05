import { BotContext, BotMethods } from "@builderbot/bot/dist/types"
import { getHistoryParse } from "../utils/handleHistory"
import AIClass from "../services/ai"
import { flowSeller } from "../flows/seller.flow"
import { flowSchedule } from "../flows/schedule.flow"

const PROMPT_DISCRIMINATOR = `### Historial de Conversación (Vendedor/Cliente) ###
{HISTORY}

### Intenciones del Usuario ###

**HABLAR**: Selecciona esta acción si el cliente parece querer hacer una pregunta o necesita más información que NO tenga que ver con una cita.
**PROGRAMAR**: Selecciona esta acción si el cliente muestra intención de programar una cita. Ejemplo:"cual es la fecha mas cercana en la que tienen disponibilidad?"

### Instrucciones ###

Por favor, clasifica la siguiente conversación según la intención del usuario.
La prioridad es la siguiente: Hablar>Programar
`

export default async (_: BotContext, { state, gotoFlow, extensions }: BotMethods) => {
    const ai = extensions.ai as AIClass
    const history = getHistoryParse(state)
    const prompt = PROMPT_DISCRIMINATOR


    console.log(prompt.replace('{HISTORY}', history))

    const { prediction } = await ai.determineChatFn([
        {
            role: 'system',
            content: prompt.replace('{HISTORY}', history)
        }
    ], 'gpt-3.5-turbo')


    console.log({ prediction })

    if (prediction.includes('HABLAR')) return gotoFlow(flowSeller)
    if (prediction.includes('PROGRAMAR')) return gotoFlow(flowSchedule)
}