// Spinifex - Raster Algebra
// Expression-based raster calculations
// Supports both WebGL (display-time) and full raster calculator

import { termPrint } from '../ui/terminal.js';
import { createWebGLRasterLayer, RENDER_MODES, COLOR_RAMPS } from './webgl-raster.js';

/**
 * Parse a user-friendly expression into OpenLayers style expression
 * Supports: b1, b2, b3... for bands, arithmetic operators, functions
 *
 * Examples:
 *   "b1"                         -> ['band', 1]
 *   "b4 - b3"                    -> ['-', ['band', 4], ['band', 3]]
 *   "(b4 - b3) / (b4 + b3)"      -> ['/', ['-', ...], ['+', ...]]
 *   "sqrt(b1)"                   -> ['^', ['band', 1], 0.5]
 *   "b1 > 100 ? 1 : 0"           -> ['case', ['>', ['band', 1], 100], 1, 0]
 */
export function parseExpression(expr) {
  // Tokenize
  const tokens = tokenize(expr);

  // Parse into AST
  const ast = parseTokens(tokens);

  // Convert to OpenLayers expression
  return astToOLExpr(ast);
}

/**
 * Tokenize expression string
 */
function tokenize(expr) {
  const tokens = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Numbers (must start with digit, or . followed by digit)
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(expr[i + 1]))) {
      let num = '';
      while (i < expr.length && /[0-9.eE]/.test(expr[i])) {
        // Handle +/- only after e/E
        if ((expr[i] === '+' || expr[i] === '-') && !/[eE]/.test(expr[i - 1])) break;
        num += expr[i++];
      }
      tokens.push({ type: 'number', value: parseFloat(num) });
      continue;
    }

    // Band references (b1, b2, etc.) or identifiers
    if (/[a-zA-Z_]/.test(ch)) {
      let id = '';
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        id += expr[i++];
      }

      // Check for band reference
      if (/^b\d+$/i.test(id)) {
        tokens.push({ type: 'band', value: parseInt(id.slice(1)) });
      } else {
        tokens.push({ type: 'identifier', value: id.toLowerCase() });
      }
      continue;
    }

    // Operators
    if ('+-*/^%'.includes(ch)) {
      tokens.push({ type: 'operator', value: ch });
      i++;
      continue;
    }

    // Comparison operators
    if (ch === '>' || ch === '<' || ch === '=' || ch === '!') {
      let op = ch;
      i++;
      if (expr[i] === '=') {
        op += '=';
        i++;
      }
      tokens.push({ type: 'comparison', value: op });
      continue;
    }

    // Ternary
    if (ch === '?') {
      tokens.push({ type: 'ternary', value: '?' });
      i++;
      continue;
    }
    if (ch === ':') {
      tokens.push({ type: 'colon', value: ':' });
      i++;
      continue;
    }

    // Parentheses, comma, and dot
    if ('(),.'.includes(ch)) {
      tokens.push({ type: ch, value: ch });
      i++;
      continue;
    }

    // Unknown - skip
    i++;
  }

  return tokens;
}

/**
 * Parse tokens into AST using recursive descent
 */
function parseTokens(tokens) {
  let pos = 0;

  function peek() {
    return tokens[pos];
  }

  function consume() {
    return tokens[pos++];
  }

  function parseExpression() {
    return parseTernary();
  }

  function parseTernary() {
    let condition = parseComparison();

    if (peek()?.type === 'ternary') {
      consume(); // ?
      const thenExpr = parseExpression();
      if (peek()?.type !== 'colon') throw new Error('Expected : in ternary');
      consume(); // :
      const elseExpr = parseExpression();
      return { type: 'ternary', condition, then: thenExpr, else: elseExpr };
    }

    return condition;
  }

  function parseComparison() {
    let left = parseAddSub();

    while (peek()?.type === 'comparison') {
      const op = consume().value;
      const right = parseAddSub();
      left = { type: 'comparison', op, left, right };
    }

    return left;
  }

  function parseAddSub() {
    let left = parseMulDiv();

    while (peek()?.type === 'operator' && '+-'.includes(peek().value)) {
      const op = consume().value;
      const right = parseMulDiv();
      left = { type: 'binary', op, left, right };
    }

    return left;
  }

  function parseMulDiv() {
    let left = parsePower();

    while (peek()?.type === 'operator' && '*/%'.includes(peek().value)) {
      const op = consume().value;
      const right = parsePower();
      left = { type: 'binary', op, left, right };
    }

    return left;
  }

  function parsePower() {
    let left = parseUnary();

    if (peek()?.type === 'operator' && peek().value === '^') {
      consume();
      const right = parsePower(); // Right associative
      left = { type: 'binary', op: '^', left, right };
    }

    return left;
  }

  function parseUnary() {
    if (peek()?.type === 'operator' && peek().value === '-') {
      consume();
      const arg = parseUnary();
      return { type: 'unary', op: '-', arg };
    }
    return parseAtom();
  }

  function parseAtom() {
    const token = peek();

    if (!token) throw new Error('Unexpected end of expression');

    // Number
    if (token.type === 'number') {
      consume();
      return { type: 'number', value: token.value };
    }

    // Band reference
    if (token.type === 'band') {
      consume();
      return { type: 'band', value: token.value };
    }

    // Function call or constant
    if (token.type === 'identifier') {
      consume();

      // Check for function call
      if (peek()?.type === '(') {
        consume(); // (
        const args = [];

        if (peek()?.type !== ')') {
          args.push(parseExpression());
          while (peek()?.type === ',') {
            consume();
            args.push(parseExpression());
          }
        }

        if (peek()?.type !== ')') throw new Error('Expected )');
        consume(); // )

        return { type: 'function', name: token.value, args };
      }

      // Constants
      if (token.value === 'pi') return { type: 'number', value: Math.PI };
      if (token.value === 'e') return { type: 'number', value: Math.E };

      // Check for member access (a.b4)
      if (peek()?.type === '.') {
        consume(); // .
        const member = peek();
        if (member?.type === 'band') {
          consume();
          return { type: 'member', object: token.value, band: member.value };
        } else if (member?.type === 'identifier') {
          consume();
          return { type: 'member', object: token.value, property: member.value };
        }
        throw new Error('Expected band or property after .');
      }

      // Variable reference (for calc())
      return { type: 'variable', name: token.value };
    }

    // Parenthesized expression
    if (token.type === '(') {
      consume();
      const expr = parseExpression();
      if (peek()?.type !== ')') throw new Error('Expected )');
      consume();
      return expr;
    }

    throw new Error(`Unexpected token: ${JSON.stringify(token)}`);
  }

  const result = parseExpression();

  if (pos < tokens.length) {
    throw new Error(`Unexpected token after expression: ${JSON.stringify(tokens[pos])}`);
  }

  return result;
}

/**
 * Convert AST to OpenLayers style expression
 */
function astToOLExpr(ast) {
  switch (ast.type) {
    case 'number':
      return ast.value;

    case 'band':
      return ['band', ast.value];

    case 'variable':
      // For multi-raster calc, we'll handle this differently
      return ['var', ast.name];

    case 'member':
      // Member access like a.b4 - for WebGL, treat as band reference
      // (WebGL expressions work on single source)
      if (ast.band) {
        return ['band', ast.band];
      }
      throw new Error(`Cannot use member access ${ast.object}.${ast.property} in WebGL expression`);

    case 'unary':
      if (ast.op === '-') {
        return ['*', -1, astToOLExpr(ast.arg)];
      }
      throw new Error(`Unknown unary operator: ${ast.op}`);

    case 'binary': {
      const left = astToOLExpr(ast.left);
      const right = astToOLExpr(ast.right);

      switch (ast.op) {
        case '+': return ['+', left, right];
        case '-': return ['-', left, right];
        case '*': return ['*', left, right];
        case '/': return ['/', left, right];
        case '%': return ['%', left, right];
        case '^': return ['^', left, right];
        default: throw new Error(`Unknown operator: ${ast.op}`);
      }
    }

    case 'comparison': {
      const left = astToOLExpr(ast.left);
      const right = astToOLExpr(ast.right);

      switch (ast.op) {
        case '>': return ['>', left, right];
        case '<': return ['<', left, right];
        case '>=': return ['>=', left, right];
        case '<=': return ['<=', left, right];
        case '==': return ['==', left, right];
        case '!=': return ['!=', left, right];
        default: throw new Error(`Unknown comparison: ${ast.op}`);
      }
    }

    case 'ternary':
      return [
        'case',
        astToOLExpr(ast.condition),
        astToOLExpr(ast.then),
        astToOLExpr(ast.else)
      ];

    case 'function': {
      const args = ast.args.map(astToOLExpr);

      switch (ast.name) {
        case 'abs': return ['abs', args[0]];
        case 'floor': return ['floor', args[0]];
        case 'ceil': return ['ceil', args[0]];
        case 'round': return ['round', args[0]];
        case 'sin': return ['sin', args[0]];
        case 'cos': return ['cos', args[0]];
        case 'tan': return ['tan', args[0]];
        case 'asin': return ['asin', args[0]];
        case 'acos': return ['acos', args[0]];
        case 'atan':
          return args.length === 2
            ? ['atan', args[0], args[1]]
            : ['atan', args[0], 1];
        case 'sqrt': return ['^', args[0], 0.5];
        case 'pow': return ['^', args[0], args[1]];
        case 'exp': return ['^', Math.E, args[0]];
        case 'log': return ['log', args[0]]; // Natural log
        case 'log10': return ['/', ['log', args[0]], Math.LN10];
        case 'min': return ['min', args[0], args[1]];
        case 'max': return ['max', args[0], args[1]];
        case 'clamp': return ['clamp', args[0], args[1], args[2]];

        // Raster-specific
        case 'ndvi': {
          // NDVI with default bands (NIR=b4, Red=b3)
          // Includes division-by-zero guard: returns 0 if denominator is 0
          const nir = ['band', args[0] || 4];
          const red = ['band', args[1] || 3];
          const diff = ['-', nir, red];
          const sum = ['+', nir, red];
          return ['case',
            ['==', sum, 0], 0,  // Guard: return 0 if NIR+Red=0
            ['/', diff, sum]
          ];
        }

        default:
          throw new Error(`Unknown function: ${ast.name}`);
      }
    }

    default:
      throw new Error(`Unknown AST node type: ${ast.type}`);
  }
}

/**
 * Build a color expression from a value expression
 * Maps the expression result to a color ramp
 */
export function buildExpressionStyle(expr, options = {}) {
  const olExpr = typeof expr === 'string' ? parseExpression(expr) : expr;
  const nodata = options.nodata ?? -32768;
  const min = options.min ?? 0;
  const max = options.max ?? 1;
  const colorRamp = options.colorRamp || 'viridis';

  // Get color ramp
  const ramp = COLOR_RAMPS[colorRamp] || COLOR_RAMPS.viridis;

  // Build interpolation from expression result
  const colorExpr = ['interpolate', ['linear'], olExpr];

  for (let i = 0; i < ramp.stops.length; i++) {
    const value = min + ramp.stops[i] * (max - min);
    const color = ramp.colors[i];
    colorExpr.push(value);
    colorExpr.push([color[0], color[1], color[2], 255]);
  }

  return {
    variables: { nodata },
    color: [
      'case',
      ['==', ['band', 1], ['var', 'nodata']],
      [0, 0, 0, 0],
      colorExpr
    ]
  };
}

/**
 * Evaluate an expression on raster data (for calc())
 * @param {string} expr - Expression like "(a.b4 - a.b3) / (a.b4 + a.b3)"
 * @param {Object} inputs - Map of variable names to raster layers
 * @param {Object} options - {name, colorRamp, min, max}
 */
export async function calc(expr, inputs, options = {}) {
  termPrint(`Calculating: ${expr}`, 'dim');

  // Parse expression
  const ast = parseTokens(tokenize(expr));

  // Get dimensions from first input
  const inputNames = Object.keys(inputs);
  if (inputNames.length === 0) {
    throw new Error('No input rasters provided');
  }

  const firstInput = inputs[inputNames[0]];
  const { width, height, extent } = firstInput._metadata;
  const nodata = firstInput._metadata.nodata ?? -32768;

  // Verify all inputs have same dimensions
  for (const name of inputNames) {
    const layer = inputs[name];
    if (layer._metadata.width !== width || layer._metadata.height !== height) {
      throw new Error(`Raster dimensions must match. ${name} has different size.`);
    }
  }

  // Get band data for each input
  const inputData = {};
  for (const name of inputNames) {
    const layer = inputs[name];
    const data = layer._data;

    // Normalize to array of bands
    inputData[name] = Array.isArray(data) && ArrayBuffer.isView(data[0])
      ? data
      : [data];
  }

  // Create output array
  const result = new Float32Array(width * height);

  // Evaluate expression for each pixel
  for (let i = 0; i < width * height; i++) {
    try {
      const value = evaluateAST(ast, inputData, i, nodata);
      result[i] = isFinite(value) ? value : nodata;
    } catch (e) {
      result[i] = nodata;
    }
  }

  // Calculate statistics
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < result.length; i++) {
    const val = result[i];
    if (val !== nodata && isFinite(val)) {
      if (val < min) min = val;
      if (val > max) max = val;
    }
  }

  // Create new layer
  const name = options.name || `calc_${Date.now()}`;
  const colorRamp = options.colorRamp || 'viridis';

  const layer = createWebGLRasterLayer(result, {
    width,
    height,
    extent,
    min: options.min ?? min,
    max: options.max ?? max,
    nodata
  }, name, {
    colorRamp,
    mode: RENDER_MODES.SINGLEBAND,
    nodata
  });

  termPrint(`Created: ${name} (${min.toFixed(2)} to ${max.toFixed(2)})`, 'green');

  return layer;
}

/**
 * Evaluate AST at a pixel index
 */
function evaluateAST(ast, inputData, pixelIndex, nodata) {
  switch (ast.type) {
    case 'number':
      return ast.value;

    case 'band':
      // For single-raster expressions (shouldn't happen in calc)
      throw new Error('Use variable.band syntax in calc()');

    case 'variable': {
      // Variable access like "a" - assume band 1
      const name = ast.name;
      const data = inputData[name];
      if (!data) throw new Error(`Unknown variable: ${name}`);
      const value = data[0][pixelIndex];
      if (value === nodata) return nodata;
      return value;
    }

    case 'member': {
      // Member access like a.b4
      const varName = ast.object;
      const bandNum = ast.band - 1; // Convert to 0-based
      const data = inputData[varName];
      if (!data) throw new Error(`Unknown variable: ${varName}`);
      const value = data[bandNum]?.[pixelIndex];
      if (value === undefined || value === nodata) return nodata;
      return value;
    }

    case 'unary':
      if (ast.op === '-') {
        const val = evaluateAST(ast.arg, inputData, pixelIndex, nodata);
        return val === nodata ? nodata : -val;
      }
      throw new Error(`Unknown unary op: ${ast.op}`);

    case 'binary': {
      const left = evaluateAST(ast.left, inputData, pixelIndex, nodata);
      const right = evaluateAST(ast.right, inputData, pixelIndex, nodata);

      if (left === nodata || right === nodata) return nodata;

      switch (ast.op) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return right !== 0 ? left / right : nodata;
        case '%': return right !== 0 ? left % right : nodata;
        case '^': return Math.pow(left, right);
        default: throw new Error(`Unknown op: ${ast.op}`);
      }
    }

    case 'comparison': {
      const left = evaluateAST(ast.left, inputData, pixelIndex, nodata);
      const right = evaluateAST(ast.right, inputData, pixelIndex, nodata);

      if (left === nodata || right === nodata) return nodata;

      switch (ast.op) {
        case '>': return left > right ? 1 : 0;
        case '<': return left < right ? 1 : 0;
        case '>=': return left >= right ? 1 : 0;
        case '<=': return left <= right ? 1 : 0;
        case '==': return left === right ? 1 : 0;
        case '!=': return left !== right ? 1 : 0;
        default: throw new Error(`Unknown comparison: ${ast.op}`);
      }
    }

    case 'ternary': {
      const cond = evaluateAST(ast.condition, inputData, pixelIndex, nodata);
      if (cond === nodata) return nodata;
      return cond ?
        evaluateAST(ast.then, inputData, pixelIndex, nodata) :
        evaluateAST(ast.else, inputData, pixelIndex, nodata);
    }

    case 'function': {
      const args = ast.args.map(a => evaluateAST(a, inputData, pixelIndex, nodata));

      if (args.some(a => a === nodata)) return nodata;

      switch (ast.name) {
        case 'abs': return Math.abs(args[0]);
        case 'floor': return Math.floor(args[0]);
        case 'ceil': return Math.ceil(args[0]);
        case 'round': return Math.round(args[0]);
        case 'sin': return Math.sin(args[0]);
        case 'cos': return Math.cos(args[0]);
        case 'tan': return Math.tan(args[0]);
        case 'asin': return Math.asin(args[0]);
        case 'acos': return Math.acos(args[0]);
        case 'atan': return args.length === 2 ? Math.atan2(args[0], args[1]) : Math.atan(args[0]);
        case 'sqrt': return args[0] >= 0 ? Math.sqrt(args[0]) : nodata;
        case 'pow': return Math.pow(args[0], args[1]);
        case 'exp': return Math.exp(args[0]);
        case 'log': return args[0] > 0 ? Math.log(args[0]) : nodata;
        case 'log10': return args[0] > 0 ? Math.log10(args[0]) : nodata;
        case 'min': return Math.min(args[0], args[1]);
        case 'max': return Math.max(args[0], args[1]);
        case 'clamp': return Math.max(args[1], Math.min(args[2], args[0]));
        default: throw new Error(`Unknown function: ${ast.name}`);
      }
    }

    default:
      throw new Error(`Unknown AST type: ${ast.type}`);
  }
}

/**
 * Common raster operations as shortcuts
 */
export const rasterOps = {
  /**
   * NDVI (Normalized Difference Vegetation Index)
   * @param {Object} layer - Multi-band raster
   * @param {number} nirBand - NIR band number (default 4)
   * @param {number} redBand - Red band number (default 3)
   */
  ndvi: async (layer, nirBand = 4, redBand = 3, options = {}) => {
    const nir = nirBand;
    const red = redBand;

    // Create single-input wrapper
    const expr = `(a.b${nir} - a.b${red}) / (a.b${nir} + a.b${red})`;

    return calc(expr, { a: layer }, {
      name: options.name || `ndvi_${layer.name}`,
      colorRamp: options.colorRamp || 'ndvi',
      min: -1,
      max: 1
    });
  },

  /**
   * NDWI (Normalized Difference Water Index)
   */
  ndwi: async (layer, greenBand = 2, nirBand = 4, options = {}) => {
    const expr = `(a.b${greenBand} - a.b${nirBand}) / (a.b${greenBand} + a.b${nirBand})`;

    return calc(expr, { a: layer }, {
      name: options.name || `ndwi_${layer.name}`,
      colorRamp: options.colorRamp || 'bluered',
      min: -1,
      max: 1
    });
  },

  /**
   * Difference between two rasters
   */
  difference: async (layer1, layer2, options = {}) => {
    return calc('a - b', { a: layer1, b: layer2 }, {
      name: options.name || `diff_${layer1.name}_${layer2.name}`,
      colorRamp: options.colorRamp || 'bluered'
    });
  },

  /**
   * Ratio of two bands
   */
  ratio: async (layer, band1, band2, options = {}) => {
    const expr = `a.b${band1} / a.b${band2}`;
    return calc(expr, { a: layer }, {
      name: options.name || `ratio_b${band1}_b${band2}`,
      colorRamp: options.colorRamp || 'viridis'
    });
  },

  /**
   * Threshold/classify raster
   */
  threshold: async (layer, value, options = {}) => {
    const expr = `a > ${value} ? 1 : 0`;
    return calc(expr, { a: layer }, {
      name: options.name || `threshold_${value}`,
      colorRamp: 'grayscale',
      min: 0,
      max: 1
    });
  }
};
