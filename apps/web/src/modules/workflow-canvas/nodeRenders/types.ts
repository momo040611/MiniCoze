export type NodeMeta = {
    title: string
    subTitle?: string
    description?: string
    icon?: string
    mainColor?: string
}

export type VariableInfo = {
    label: string
    type: string
    name: string
}

export type LLMConfig = {
    systemPrompt?: string
    model?: string
    prompt?: string
    plugin?: string
}

export type EndConfig = {
    outputKey?: string
    outputMode?: string
}
