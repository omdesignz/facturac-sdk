import { readFileSync, writeFileSync } from 'node:fs';
import { format, resolveConfig } from 'prettier';

const contracts = {
    Read: 'openapi-external-read-v1.json',
    Billing: 'openapi-external-billing-v2.json',
    Agt: 'openapi-external-qualified-agt-v2.json',
    Customer: 'openapi-external-customer-create-v1.json',
    Service: 'openapi-external-catalogue-service-create-v1.json',
    DocumentIssue: 'openapi-external-document-issue-v1.json',
};

function type(schema) {
    if (schema === false) {
        return 'never';
    }

    if (schema === true) {
        return 'unknown';
    }

    if (schema.$ref) {
        return schema.$ref.split('/').at(-1);
    }

    if ('const' in schema) {
        return JSON.stringify(schema.const);
    }

    if (schema.enum) {
        return schema.enum.map((value) => JSON.stringify(value)).join(' | ');
    }

    for (const key of ['allOf', 'oneOf', 'anyOf']) {
        if (schema[key]) {
            return schema[key]
                .map((part) => `(${type(part)})`)
                .join(key === 'allOf' ? ' & ' : ' | ');
        }
    }

    if (Array.isArray(schema.type)) {
        return schema.type
            .map((value) => type({ ...schema, type: value }))
            .join(' | ');
    }

    if (schema.type === 'array') {
        if (schema.prefixItems) {
            return `[${schema.prefixItems.map(type).join(', ')}]`;
        }

        return `Array<${type(schema.items ?? true)}>`;
    }

    if (schema.type === 'object' || schema.properties) {
        const fields = Object.entries(schema.properties ?? {}).map(
            ([name, value]) =>
                `${JSON.stringify(name)}${schema.required?.includes(name) ? '' : '?'}: ${type(value)};`,
        );

        if (
            schema.additionalProperties &&
            schema.additionalProperties !== false
        ) {
            fields.push(`[key: string]: ${type(schema.additionalProperties)};`);
        }

        return fields.length
            ? `{ ${fields.join(' ')} }`
            : 'Record<string, never>';
    }

    return (
        {
            string: 'string',
            integer: 'number',
            number: 'number',
            boolean: 'boolean',
            null: 'null',
        }[schema.type] ?? 'unknown'
    );
}

let output =
    '// Generated from the external OpenAPI contracts by generate.mjs. Do not edit.\n/* eslint-disable @typescript-eslint/no-namespace -- Type-only OpenAPI schema groups. */\n';

for (const [name, file] of Object.entries(contracts)) {
    const contract = JSON.parse(
        readFileSync(new URL(`./openapi/${file}`, import.meta.url), 'utf8'),
    );
    output += `export namespace ${name} {\n`;

    for (const [schema, definition] of Object.entries(
        contract.components.schemas,
    )) {
        output += `export type ${schema} = ${type(definition)};\n`;
    }

    for (const item of Object.values(contract.paths)) {
        for (const [method, operation] of Object.entries(item)) {
            if (!['get', 'post'].includes(method)) {
                continue;
            }

            const query = [
                ...(item.parameters ?? []),
                ...(operation.parameters ?? []),
            ].filter((parameter) => parameter.in === 'query');
            output += `export type ${operation.operationId}Query = ${type({ type: 'object', properties: Object.fromEntries(query.map((parameter) => [parameter.name, parameter.schema])), required: query.filter((parameter) => parameter.required).map((parameter) => parameter.name) })};\n`;
            const response =
                operation.responses['200'] ?? operation.responses['201'];
            output += `export type ${operation.operationId}Response = ${type(response.content['application/json'].schema)};\n`;
        }
    }

    output += '}\n';
}

writeFileSync(
    new URL('src/contracts.ts', import.meta.url),
    await format(output, {
        ...(await resolveConfig(
            new URL('.prettierrc.json', import.meta.url).pathname,
        )),
        parser: 'typescript',
    }),
);
