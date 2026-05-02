/**
 * T-EXT-V2-01: Parametric family definitions and expression evaluation.
 * No eval() — uses a hand-written arithmetic parser.
 */

export type ParameterType = 'length' | 'angle' | 'count' | 'string' | 'boolean' | 'material';

export interface FamilyParameter {
  name: string;
  type: ParameterType;
  defaultValue: string | number | boolean;
  constraints?: { min?: number; max?: number };
}

export interface FamilyFormula {
  outputParam: string;
  expression: string;
}

export interface ParametricFamily {
  id: string;
  name: string;
  parameters: FamilyParameter[];
  formulas: FamilyFormula[];
  geometry: string;
}

// ─── Simple arithmetic expression evaluator ───────────────────────────────────
// Supports: +, -, *, / with parentheses and variable references
// No eval() — hand-written recursive descent parser

type TokenType = 'number' | 'ident' | '+' | '-' | '*' | '/' | '(' | ')' | 'EOF';

interface Token {
  type: TokenType;
  value?: string;
}

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(expr[i + 1] ?? ''))) {
      let num = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i++];
      }
      tokens.push({ type: 'number', value: num });
    } else if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) {
        ident += expr[i++];
      }
      tokens.push({ type: 'ident', value: ident });
    } else if (ch === '+') { tokens.push({ type: '+' }); i++; }
    else if (ch === '-') { tokens.push({ type: '-' }); i++; }
    else if (ch === '*') { tokens.push({ type: '*' }); i++; }
    else if (ch === '/') { tokens.push({ type: '/' }); i++; }
    else if (ch === '(') { tokens.push({ type: '(' }); i++; }
    else if (ch === ')') { tokens.push({ type: ')' }); i++; }
    else {
      throw new Error(`Unexpected character '${ch}' in expression`);
    }
  }
  tokens.push({ type: 'EOF' });
  return tokens;
}

class Parser {
  private tokens: Token[];
  private pos = 0;
  private variables: Record<string, number>;

  constructor(tokens: Token[], variables: Record<string, number>) {
    this.tokens = tokens;
    this.variables = variables;
  }

  private peek(): Token { return this.tokens[this.pos]; }
  private consume(): Token { return this.tokens[this.pos++]; }

  parseExpr(): number { return this.parseAddSub(); }

  private parseAddSub(): number {
    let left = this.parseMulDiv();
    while (this.peek().type === '+' || this.peek().type === '-') {
      const op = this.consume().type;
      const right = this.parseMulDiv();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  private parseMulDiv(): number {
    let left = this.parseUnary();
    while (this.peek().type === '*' || this.peek().type === '/') {
      const op = this.consume().type;
      const right = this.parseUnary();
      if (op === '/' && right === 0) throw new Error('Division by zero');
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  private parseUnary(): number {
    if (this.peek().type === '-') {
      this.consume();
      return -this.parsePrimary();
    }
    if (this.peek().type === '+') {
      this.consume();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const tok = this.peek();
    if (tok.type === 'number') {
      this.consume();
      return parseFloat(tok.value!);
    }
    if (tok.type === 'ident') {
      this.consume();
      const varName = tok.value!;
      if (!(varName in this.variables)) {
        throw new Error(`Unknown variable '${varName}'`);
      }
      return this.variables[varName];
    }
    if (tok.type === '(') {
      this.consume();
      const val = this.parseExpr();
      if (this.peek().type !== ')') throw new Error("Expected ')'");
      this.consume();
      return val;
    }
    throw new Error(`Unexpected token '${tok.type}'`);
  }
}

export function evaluateFormula(
  formula: FamilyFormula,
  values: Record<string, number>,
): number {
  const tokens = tokenize(formula.expression);
  const parser = new Parser(tokens, values);
  return parser.parseExpr();
}

export function validateParameterValue(
  param: FamilyParameter,
  value: string | number | boolean,
): boolean {
  if (param.type === 'string' || param.type === 'material') {
    return typeof value === 'string';
  }
  if (param.type === 'boolean') {
    return typeof value === 'boolean';
  }
  // numeric types: length, angle, count
  if (typeof value !== 'number' || !isFinite(value)) return false;
  if (param.constraints) {
    if (param.constraints.min !== undefined && value < param.constraints.min) return false;
    if (param.constraints.max !== undefined && value > param.constraints.max) return false;
  }
  return true;
}

export function resolveFamily(
  family: ParametricFamily,
  overrides: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  // Start with defaults
  const values: Record<string, string | number | boolean> = {};
  for (const param of family.parameters) {
    values[param.name] = param.defaultValue;
  }

  // Apply overrides
  for (const [k, v] of Object.entries(overrides)) {
    values[k] = v;
  }

  // Evaluate formulas
  // Build numeric context for formula evaluation
  const numericValues: Record<string, number> = {};
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === 'number') numericValues[k] = v;
  }

  for (const formula of family.formulas) {
    try {
      const result = evaluateFormula(formula, numericValues);
      values[formula.outputParam] = result;
      numericValues[formula.outputParam] = result;
    } catch {
      // If formula evaluation fails, skip it
    }
  }

  return values;
}
