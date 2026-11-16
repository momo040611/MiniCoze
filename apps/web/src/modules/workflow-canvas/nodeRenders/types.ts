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
    /** 单值输出映射引用，如 {{code_1.result}} */
    resultExpression?: string
    /** 多字段输出映射，JSON 字符串：{ "字段名": "{{引用}}" } */
    outputFieldsJson?: string
}

export type CodeConfig = {
    /** 函数体代码，内部 return 一个对象作为节点输出；可访问 input（=params 解析结果） */
    code?: string
    /** 入参映射，JSON 字符串：{ "参数名": "{{引用}}" } */
    paramsJson?: string
}

export type HttpConfig = {
    url?: string
    method?: string
    /** 请求头，JSON 字符串：{ "Header": "值，支持 {{引用}}" } */
    headersJson?: string
    /** 请求体文本（POST/PUT/PATCH），支持 {{引用}} */
    body?: string
    timeout?: number
}

export type VariableConfig = {
    operation?: 'set' | 'get'
    scope?: 'session' | 'global'
    name?: string
    value?: string
}

