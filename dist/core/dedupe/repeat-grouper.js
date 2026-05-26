"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRepeatSignature = createRepeatSignature;
exports.createRepeatGroup = createRepeatGroup;
exports.addRepeatGroupLine = addRepeatGroupLine;
exports.renderRepeatGroup = renderRepeatGroup;
const constants_js_1 = require("../constants.js");
const STANDALONE_REPEAT_VALUE_PATTERN = /^\d+(?:[.:,-]\d+)*$/u;
const STANDALONE_REPEAT_LABELS = new Set([
    'child',
    'pid',
    'slot',
    'state',
]);
function createRepeatSignature(line) {
    const tokens = tokenizeRepeatLine(line);
    return tokens
        .map((token, index) => {
        const tokenValue = splitRepeatToken(token, tokens[index - 1]);
        return tokenValue === undefined
            ? token
            : `${tokenValue.prefix}[VALUE]`;
    })
        .join(' ');
}
function createRepeatGroup(line) {
    return {
        firstLine: line,
        firstTokens: tokenizeRepeatLine(line),
        signature: createRepeatSignature(line),
        deltas: new Map(),
        count: 1,
    };
}
function addRepeatGroupLine(group, line) {
    const tokens = tokenizeRepeatLine(line);
    for (const [index, firstToken] of group.firstTokens.entries()) {
        const firstValue = splitRepeatToken(firstToken, group.firstTokens[index - 1]);
        const nextValue = splitRepeatToken(tokens[index], tokens[index - 1]);
        if (firstValue === undefined ||
            nextValue === undefined ||
            firstValue.prefix !== nextValue.prefix ||
            firstValue.value === nextValue.value) {
            continue;
        }
        const delta = group.deltas.get(index) ?? {
            prefix: firstValue.prefix,
            values: [firstValue.value],
            hasMoreValues: false,
        };
        if (!group.deltas.has(index)) {
            group.deltas.set(index, delta);
        }
        if (delta.values.includes(nextValue.value)) {
            continue;
        }
        if (delta.values.length < constants_js_1.MAX_REPEAT_DELTA_VALUES) {
            delta.values.push(nextValue.value);
        }
        else {
            delta.hasMoreValues = true;
        }
    }
    group.count += 1;
}
function renderRepeatGroup(group) {
    if (group.deltas.size === 0) {
        return group.firstLine;
    }
    const tokens = [...group.firstTokens];
    for (const [index, delta] of group.deltas) {
        const values = delta.hasMoreValues
            ? [...delta.values, '…']
            : delta.values;
        tokens[index] = `${delta.prefix}[${values.join(' | ')}]`;
    }
    return tokens.join(' ');
}
function tokenizeRepeatLine(line) {
    return line.trim().split(/\s+/u);
}
function splitRepeatToken(token, previousToken) {
    const separator = token.indexOf('=');
    if (separator > 0 && separator < token.length - 1) {
        return {
            prefix: token.slice(0, separator + 1),
            value: token.slice(separator + 1),
        };
    }
    if (previousToken !== undefined &&
        STANDALONE_REPEAT_LABELS.has(previousToken.toLowerCase()) &&
        STANDALONE_REPEAT_VALUE_PATTERN.test(token)) {
        return {
            prefix: '',
            value: token,
        };
    }
    return undefined;
}
