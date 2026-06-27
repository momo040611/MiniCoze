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

export type ConditionOperator =
    | 'equals'
    | 'notEquals'
    | 'contains'
    | 'notContains'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'empty'
    | 'notEmpty'

export type ConditionItem = {
    left?: string
    op?: ConditionOperator
    right?: string
}

export type ConditionBranch = {
    port: string
    name?: string
    logic?: 'and' | 'or'
    conditions: ConditionItem[]
}

export type ConditionConfig = {
    branches?: ConditionBranch[]
    defaultPort?: string
    operator?: string
    compareValue?: string
    expression?: string
}

export type LoopConfig = {
    items?: string
    concurrency?: number
    onError?: 'abort' | 'continue'
    blocksJson?: string
    edgesJson?: string
}
