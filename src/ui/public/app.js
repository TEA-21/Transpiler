// ==========================================================================
// MINI-PYTHON TRANSPILER WORKBENCH CLIENT APPLICATION
// ==========================================================================

const PRESETS = {
  review2: `# Review 2 Evaluation Pipeline: Full End-to-End Demonstration

# 1. Primitive Bindings & Local Static Type Inference
base_limit = 100
system_status = "OPERATIONAL"
strict_mode = True

# 2. Function Declaration with Bidirectional Constraint Propagation
def compute_weighted_average(total_weight, sample_count):
    if sample_count == 0:
        return 0
    return total_weight / sample_count

# 3. Homogeneous Array Constructs, Indexing & While Loop Invariants
samples = [15, 30, 45, 60]
cursor = 0
accumulator = 0

while cursor < 4:
    accumulator = accumulator + samples[cursor]
    cursor = cursor + 1

# 4. Function Call & Bidirectional Unification across Call Sites
final_score = compute_weighted_average(accumulator, cursor)

# 5. Conditionals with Boolean Guards & Print Translation
if final_score >= 35 and strict_mode:
    print("STATUS_PASS")
else:
    print("STATUS_REVISE")`,

  bidirectional: `# Bidirectional Constraint Propagation Demo
def multiply_and_offset(val, factor):
    return (val * factor) + 10

def evaluate_status(score):
    if score >= 50:
        return "Pass"
    else:
        return "Fail"

raw_score = 25
computed = multiply_and_offset(raw_score, 2)
verdict = evaluate_status(computed)
print(verdict)`,

  arrays_loops: `# While Loops, Homogeneous Arrays & Subscript Indexing
numbers = [10, 20, 30, 40, 50]
i = 0
total = 0

while i < 5:
    total = total + numbers[i]
    i = i + 1

average = total / 5
print(average)`,

  occurrence_typing: `# Flow-Sensitive Occurrence Typing & Type Guards (Research Spark)
# The compiler infers union types (number | string) and narrows types inside branches.

def format_data(value):
    if isinstance(value, int):
        return value * 10
    else:
        return value + " [Verified String]"

num_out = format_data(42)
str_out = format_data("compiler_token")

print(num_out)
print(str_out)`,

  comprehensions_slices: `# Flow-Sensitive List Comprehensions & Slice Operations (USP)
# 1. Single loops with filters -> .filter().map()
# 2. Flow-sensitive occurrence typing inside filters narrows (number | string)[] -> number[]
# 3. Array slicing with start, stop, and step ([::-1])
# 4. Negative single indexing -> .at(-1)

raw_items = [10, 20, 30, 40, 50]
sub_items = raw_items[1:4]
reversed_items = raw_items[::-1]
last_elem = raw_items[-1]

def get_mixed(item):
    if isinstance(item, int):
        return item * 10
    else:
        return item

dataset = [get_mixed(1), get_mixed("A"), get_mixed(3)]
only_doubled_ints = [x * 2 for x in dataset if isinstance(x, int)]

print(sub_items)
print(reversed_items)
print(last_elem)
print(only_doubled_ints)`,

  optional_null: `# Nullable Types & None Checking (Optional Pattern)
# Functions returning None or a value infer T | null with branch narrowing.

def find_user_score(user_id):
    if user_id > 100:
        return user_id * 2
    return None

score = find_user_score(150)

if score is not None:
    print("User Score: ")
    print(score + 10)
else:
    print("User Not Found")`,

  module_mode: `# Module Mode (--module): Export Declarations
# Top-level constants and functions are emitted with TypeScript export keywords.

tax_rate = 0.18
api_version = "v2.1"

def calculate_total(subtotal):
    tax = subtotal * tax_rate
    return subtotal + tax`,

  error_unnarrowed: `# [Negative Diagnostic Demo] Unsafe Operation on Un-narrowed Union
# Operating on a variable with multiple types without narrowing throws a compile-time error.

def get_status(code):
    if code == 200:
        return 100
    return "Error"

raw_val = get_status(200)
# Fails because raw_val has type 'number | string' and must be narrowed via isinstance() first!
bad = raw_val + 5`,

  error_arithmetic: `# [Negative Diagnostic Demo] Illegal String Arithmetic
# Arithmetic operations requires numeric operands.
# Mixing strings with subtraction or multiplication throws TypeError.

greeting = "Hello"
invalid_operation = greeting - 5`,

  error_guard: `# [Negative Diagnostic Demo] Non-Boolean Guard Expression
# Guard conditions in conditionals and loops must evaluate to boolean.

threshold = 100
if threshold + 5:
    print("Condition is invalid numeric expression")`,
};

// DOM Elements
const pyInput = document.getElementById('py-input');
const pyGutter = document.getElementById('py-gutter');
const pyLineCount = document.getElementById('py-line-count');
const tsOutput = document.getElementById('ts-output');
const tsGutter = document.getElementById('ts-gutter');
const transpileBtn = document.getElementById('transpile-btn');
const liveToggle = document.getElementById('live-toggle');
const moduleToggle = document.getElementById('module-toggle');
const presetSelect = document.getElementById('preset-select');
const clearBtn = document.getElementById('clear-btn');
const copyBtn = document.getElementById('copy-btn');
const toast = document.getElementById('toast');

const statusIndicator = document.getElementById('status-indicator');
const metricLatency = document.getElementById('metric-latency');
const metricTokens = document.getElementById('metric-tokens');
const metricIndents = document.getElementById('metric-indents');
const metricAst = document.getElementById('metric-ast');

const tokensBody = document.getElementById('tokens-body');
const symbolTableJson = document.getElementById('symbol-table-json');
const symbolTableScoped = document.getElementById('symbol-table-scoped');
const symbolTableUnified = document.getElementById('symbol-table-unified');
const unifiedSymbolsBody = document.getElementById('unified-symbols-body');
const symCountTag = document.getElementById('sym-count-tag');

const decoratedAstJson = document.getElementById('decorated-ast-json');
const rawAstJson = document.getElementById('raw-ast-json');
const decoratedAstTree = document.getElementById('decorated-ast-tree');
const rawAstTree = document.getElementById('raw-ast-tree');
const decoratedAstDiagram = document.getElementById('decorated-ast-diagram');
const rawAstDiagram = document.getElementById('raw-ast-diagram');

const decoratedZoomIn = document.getElementById('decorated-zoom-in');
const decoratedZoomOut = document.getElementById('decorated-zoom-out');
const decoratedZoomReset = document.getElementById('decorated-zoom-reset');
const rawZoomIn = document.getElementById('raw-zoom-in');
const rawZoomOut = document.getElementById('raw-zoom-out');
const rawZoomReset = document.getElementById('raw-zoom-reset');

const decoratedExpandAll = document.getElementById('decorated-expand-all');
const decoratedCollapseAll = document.getElementById('decorated-collapse-all');
const rawExpandAll = document.getElementById('raw-expand-all');
const rawCollapseAll = document.getElementById('raw-collapse-all');

const decoratedDiagramState = { panX: 0, panY: 0, zoom: 1, isDragging: false, startX: 0, startY: 0, svgG: null, bbox: null };
const rawDiagramState = { panX: 0, panY: 0, zoom: 1, isDragging: false, startX: 0, startY: 0, svgG: null, bbox: null };
const diagnosticsContainer = document.getElementById('diagnostics-container');

let debounceTimer = null;

// Update Gutters
function updateGutter(text, gutterEl) {
  const lineCount = Math.max(1, text.split('\n').length);
  const lines = [];
  for (let i = 1; i <= lineCount; i++) {
    lines.push(i);
  }
  gutterEl.textContent = lines.join('\n');
  return lineCount;
}

// Sync Gutters on scroll
pyInput.addEventListener('scroll', () => {
  pyGutter.scrollTop = pyInput.scrollTop;
});

// Transpile API Call
async function executeTranspile() {
  const source = pyInput.value;
  const count = updateGutter(source, pyGutter);
  pyLineCount.textContent = `${count} lines`;

  statusIndicator.className = 'status-pill status-ready';
  statusIndicator.textContent = 'Transpiling...';

  try {
    const res = await fetch('/api/transpile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source,
        moduleMode: moduleToggle ? moduleToggle.checked : false,
      }),
    });

    const data = await res.json();

    if (data.success) {
      statusIndicator.className = 'status-pill status-ready';
      statusIndicator.textContent = 'Ready (Zero Errors)';
      metricLatency.textContent = `Latency: ${data.latencyMs} ms`;
      metricTokens.textContent = `Tokens: ${data.metrics.tokenCount}`;
      metricIndents.textContent = `Indents: ${data.metrics.virtualIndents}i / ${data.metrics.virtualDedents}d`;
      metricAst.textContent = `AST Stmts: ${data.metrics.astStatementCount}`;

      tsOutput.innerHTML = `<code>${escapeHtml(data.tsCode)}</code>`;
      updateGutter(data.tsCode, tsGutter);

      // Render Tokens
      renderTokens(data.tokens);

      // Render Symbol Table (Hierarchical Scoped Tables, Unified Table, and JSON)
      symbolTableJson.textContent = JSON.stringify(data.symbolTable, null, 2);
      renderScopedSymbolTables(data.symbolTable);
      renderUnifiedSymbolTable(data.symbolTable);

      // Render ASTs
      decoratedAstJson.textContent = JSON.stringify(data.decoratedAst, null, 2);
      rawAstJson.textContent = JSON.stringify(data.rawAst, null, 2);

      // Render ASTs (2D Diagrams & Outline Trees)
      renderAstDiagram(data.decoratedAst, decoratedAstDiagram, true, decoratedDiagramState);
      renderAstDiagram(data.rawAst, rawAstDiagram, false, rawDiagramState);
      renderAstTree(data.decoratedAst, decoratedAstTree, true);
      renderAstTree(data.rawAst, rawAstTree, false);

      // Diagnostics Clean
      diagnosticsContainer.innerHTML = `
        <div class="diagnostic-card diagnostic-clean">
          <span class="diagnostic-status-icon">✓</span>
          <div>
            <strong>Compilation Successful (Zero Errors)</strong>
            <p>Static invariant types verified. Valid strictly typed TypeScript generated with zero 'any' keywords.</p>
          </div>
        </div>
      `;
    } else {
      statusIndicator.className = 'status-pill status-error';
      statusIndicator.textContent = 'Type / Syntax Error';
      metricLatency.textContent = `Latency: ${data.latencyMs} ms`;

      tsOutput.innerHTML = `<code style="color: var(--status-red);">/* Compilation Failed: [${data.errorType}] ${escapeHtml(data.message)} */</code>`;
      updateGutter('1', tsGutter);

      if (symbolTableScoped) symbolTableScoped.innerHTML = '<div class="empty-state">Compilation failed. No symbol table available.</div>';
      if (unifiedSymbolsBody) unifiedSymbolsBody.innerHTML = '<tr><td colspan="5" class="empty-state">Compilation failed.</td></tr>';
      if (symCountTag) symCountTag.textContent = '0 Scopes | 0 Symbols';

      if (decoratedAstDiagram) decoratedAstDiagram.innerHTML = '<div class="empty-state">Compilation failed. No AST available.</div>';
      if (rawAstDiagram) rawAstDiagram.innerHTML = '<div class="empty-state">Compilation failed. No AST available.</div>';
      if (decoratedAstTree) decoratedAstTree.innerHTML = '<div class="empty-state">Compilation failed. No AST available.</div>';
      if (rawAstTree) rawAstTree.innerHTML = '<div class="empty-state">Compilation failed. No AST available.</div>';

      diagnosticsContainer.innerHTML = `
        <div class="diagnostic-card diagnostic-error">
          <span class="diagnostic-status-icon">✕</span>
          <div>
            <strong>${escapeHtml(data.errorType)}: ${escapeHtml(data.message)}</strong>
            <br/>
            <span class="diagnostic-coords">Location: Line ${data.line}, Column ${data.column}</span>
          </div>
        </div>
      `;
    }
  } catch (err) {
    statusIndicator.className = 'status-pill status-error';
    statusIndicator.textContent = 'Server Error';
    console.error('Network error during transpilation:', err);
  }
}

function renderTokens(tokens) {
  if (!tokens || tokens.length === 0) {
    tokensBody.innerHTML = '<tr><td colspan="4" class="empty-state">No tokens found.</td></tr>';
    return;
  }

  const rows = tokens.map((t) => {
    const virtualTag = t.isVirtual
      ? `<span class="virtual-tag">VIRTUAL ${escapeHtml(t.type)}</span>`
      : escapeHtml(t.raw || '');
    return `
      <tr>
        <td>${t.line}:${t.column}</td>
        <td><code>${escapeHtml(t.type)}</code></td>
        <td><code>${escapeHtml(String(t.value ?? ''))}</code></td>
        <td>${virtualTag}</td>
      </tr>
    `;
  });

  tokensBody.innerHTML = rows.join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

// Preset selection
presetSelect.addEventListener('change', (e) => {
  const key = e.target.value;
  if (moduleToggle) {
    moduleToggle.checked = (key === 'module_mode');
  }
  if (PRESETS[key]) {
    pyInput.value = PRESETS[key];
    executeTranspile();
  }
});

// Module toggle switch
if (moduleToggle) {
  moduleToggle.addEventListener('change', () => {
    executeTranspile();
  });
}

// Input handling (live transpile debounce)
pyInput.addEventListener('input', () => {
  updateGutter(pyInput.value, pyGutter);
  if (liveToggle.checked) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      executeTranspile();
    }, 280);
  }
});

// Keyboard shortcut (Ctrl+Enter or Cmd+Enter)
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    executeTranspile();
  }
});

// Buttons
transpileBtn.addEventListener('click', () => {
  executeTranspile();
});

clearBtn.addEventListener('click', () => {
  pyInput.value = '';
  executeTranspile();
});

copyBtn.addEventListener('click', () => {
  const code = tsOutput.innerText;
  navigator.clipboard.writeText(code).then(() => {
    showToast('Strict TypeScript copied to clipboard!');
  });
});

// --------------------------------------------------------------------------
// AST Tree Rendering & Editor Synchronization
// --------------------------------------------------------------------------

function jumpToSourceLine(line, col) {
  const text = pyInput.value;
  const lines = text.split('\n');
  if (!line || line < 1 || line > lines.length) return;

  let charIndex = 0;
  for (let i = 0; i < line - 1; i++) {
    charIndex += lines[i].length + 1; // +1 for '\n'
  }
  const lineStart = charIndex;
  const lineEnd = charIndex + lines[line - 1].length;

  pyInput.focus();
  pyInput.setSelectionRange(lineStart, lineEnd);

  // Scroll textarea smoothly to the targeted line
  const lineHeight = 20; // 20px per line in editor
  pyInput.scrollTop = Math.max(0, (line - 3) * lineHeight);
  pyGutter.scrollTop = pyInput.scrollTop;
}

function getNodeSummary(node) {
  if (!node || typeof node !== 'object') return '';
  switch (node.type) {
    case 'Program':
      return `${(node.body || []).length} statements`;
    case 'VariableDeclaration':
      return node.id ? node.id.name : '';
    case 'FunctionDeclaration': {
      const name = node.id ? node.id.name : 'anonymous';
      const params = (node.params || []).map((p) => p.name || 'arg').join(', ');
      return `${name}(${params})`;
    }
    case 'IfStatement':
      return node.alternate ? 'if / else' : 'if';
    case 'WhileStatement':
      return 'while loop';
    case 'BlockStatement':
      return `${(node.body || []).length} statements`;
    case 'ReturnStatement':
      return node.argument ? '' : 'void';
    case 'BinaryExpression':
      return node.operator || '';
    case 'UnaryExpression':
      return node.operator || '';
    case 'Identifier':
      return node.name || '';
    case 'Literal':
      return String(node.value !== undefined ? JSON.stringify(node.value) : (node.raw || ''));
    case 'ArrayExpression':
      return `[${(node.elements || []).length} items]`;
    case 'SubscriptExpression':
      return 'index lookup';
    case 'CallExpression': {
      const fnName = node.callee ? (node.callee.name || 'fn') : 'fn';
      return `${fnName}(...)`;
    }
    case 'ExpressionStatement':
      return '';
    default:
      return '';
  }
}

function getInferredTypeBadge(node, isDecorated) {
  if (!isDecorated || !node) return '';
  if (node.inferredType) {
    return `: ${node.inferredType}`;
  }
  if (node.inferredReturnType) {
    return `-> ${node.inferredReturnType}`;
  }
  return '';
}

function toggleNodeExpansion(expander, childrenBlock) {
  const isCollapsed = childrenBlock.classList.toggle('collapsed');
  expander.classList.toggle('collapsed', isCollapsed);
  expander.textContent = isCollapsed ? '▸' : '▾';
}

function expandAll(container) {
  if (!container) return;
  const childBlocks = container.querySelectorAll('.ast-node-children');
  childBlocks.forEach((el) => el.classList.remove('collapsed'));
  const expanders = container.querySelectorAll('.ast-expander:not(.leaf-expander)');
  expanders.forEach((el) => {
    el.classList.remove('collapsed');
    el.textContent = '▾';
  });
}

function collapseAll(container) {
  if (!container) return;
  // Keep root open, collapse direct children and below
  const childBlocks = container.querySelectorAll('.ast-node-children');
  childBlocks.forEach((el) => el.classList.add('collapsed'));
  const expanders = container.querySelectorAll('.ast-expander:not(.leaf-expander)');
  expanders.forEach((el) => {
    el.classList.add('collapsed');
    el.textContent = '▸';
  });
  // Open root node children so the top-level statements remain accessible
  const rootChildren = container.querySelector('.ast-root-node > .ast-node-children');
  const rootExpander = container.querySelector('.ast-root-node > .ast-node-row > .ast-expander');
  if (rootChildren) {
    rootChildren.classList.remove('collapsed');
  }
  if (rootExpander) {
    rootExpander.classList.remove('collapsed');
    rootExpander.textContent = '▾';
  }
}

function buildAstNodeElement(node, propKey = '', depth = 0, isDecorated = false) {
  if (!node || typeof node !== 'object') {
    const leaf = document.createElement('div');
    leaf.className = 'ast-tree-node';
    leaf.innerHTML = `<span class="ast-prop-key">${escapeHtml(propKey)}:</span> <span class="ast-badge-val">${escapeHtml(String(node))}</span>`;
    return leaf;
  }

  const isAstNode = typeof node.type === 'string';
  const nodeEl = document.createElement('div');
  nodeEl.className = 'ast-tree-node' + (depth === 0 ? ' ast-root-node' : '');

  // Extract children and non-metadata properties
  const childKeys = [];
  const primitiveProps = [];

  for (const [key, val] of Object.entries(node)) {
    if (
      key === 'type' ||
      key === 'loc' ||
      key === 'raw' ||
      key === 'inferredType' ||
      key === 'inferredReturnType' ||
      key === 'inferredParamTypes'
    ) {
      continue;
    }
    if (val && typeof val === 'object') {
      if (Array.isArray(val)) {
        if (val.length > 0) {
          childKeys.push({ key, val, isArray: true });
        }
      } else if (typeof val.type === 'string') {
        childKeys.push({ key, val, isArray: false });
      }
    } else if (val !== undefined && key !== 'operator' && key !== 'name' && key !== 'value') {
      primitiveProps.push({ key, val });
    }
  }

  const hasChildren = childKeys.length > 0 || primitiveProps.length > 0;
  // Auto-expand top 2 levels by default (depth 0 Program, depth 1 Statements)
  const initiallyExpanded = depth <= 1;

  // Header row
  const row = document.createElement('div');
  row.className = 'ast-node-row';

  // Expander arrow
  const expander = document.createElement('span');
  expander.className =
    'ast-expander' + (!hasChildren ? ' leaf-expander' : (initiallyExpanded ? '' : ' collapsed'));
  expander.textContent = hasChildren ? (initiallyExpanded ? '▾' : '▸') : '•';
  row.appendChild(expander);

  // Property label if this is a named child property (e.g. "init:", "test:", "left:")
  if (propKey && !/^\d+$/.test(propKey)) {
    const propSpan = document.createElement('span');
    propSpan.className = 'ast-prop-key';
    propSpan.textContent = `${propKey}:`;
    row.appendChild(propSpan);
  }

  // Node type badge
  if (isAstNode) {
    const typeSpan = document.createElement('span');
    typeSpan.className = 'ast-badge-type';
    typeSpan.textContent = node.type;
    row.appendChild(typeSpan);
  }

  // Summary / value
  const summary = getNodeSummary(node);
  if (summary) {
    const summarySpan = document.createElement('span');
    summarySpan.className =
      node.type === 'BinaryExpression' || node.type === 'UnaryExpression'
        ? 'ast-badge-op'
        : 'ast-badge-val';
    summarySpan.textContent = summary;
    row.appendChild(summarySpan);
  }

  // Inferred Type Badge (if decorated)
  const inferred = getInferredTypeBadge(node, isDecorated);
  if (inferred) {
    const inferredSpan = document.createElement('span');
    inferredSpan.className = 'ast-badge-inferred';
    inferredSpan.textContent = inferred;
    row.appendChild(inferredSpan);
  }

  // Location badge
  if (node.loc && node.loc.start) {
    const locSpan = document.createElement('span');
    locSpan.className = 'ast-badge-loc';
    locSpan.textContent = `L${node.loc.start.line}:C${node.loc.start.column}`;
    row.appendChild(locSpan);
  }

  nodeEl.appendChild(row);

  // Children container
  if (hasChildren) {
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'ast-node-children' + (initiallyExpanded ? '' : ' collapsed');

    // Expander arrow click
    expander.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNodeExpansion(expander, childrenContainer);
    });

    // Primitive extra properties
    primitiveProps.forEach(({ key, val }) => {
      const propRow = document.createElement('div');
      propRow.className = 'ast-tree-node';
      propRow.innerHTML = `<span class="ast-prop-key">${escapeHtml(key)}:</span> <span class="ast-badge-val">${escapeHtml(String(val))}</span>`;
      childrenContainer.appendChild(propRow);
    });

    // Child AST nodes and arrays
    childKeys.forEach(({ key, val, isArray }) => {
      if (isArray) {
        if (val.length === 1 && typeof val[0].type === 'string') {
          childrenContainer.appendChild(
            buildAstNodeElement(val[0], `${key}[0]`, depth + 1, isDecorated)
          );
        } else {
          const groupEl = document.createElement('div');
          groupEl.className = 'ast-tree-node';
          const groupRow = document.createElement('div');
          groupRow.className = 'ast-node-row';
          const groupExpander = document.createElement('span');
          const groupExpanded = depth + 1 <= 1;
          groupExpander.className = 'ast-expander' + (groupExpanded ? '' : ' collapsed');
          groupExpander.textContent = groupExpanded ? '▾' : '▸';
          groupRow.appendChild(groupExpander);

          const groupLabel = document.createElement('span');
          groupLabel.className = 'ast-prop-key';
          groupLabel.textContent = `${key}: [${val.length}]`;
          groupRow.appendChild(groupLabel);
          groupEl.appendChild(groupRow);

          const groupChildren = document.createElement('div');
          groupChildren.className = 'ast-node-children' + (groupExpanded ? '' : ' collapsed');

          groupExpander.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleNodeExpansion(groupExpander, groupChildren);
          });
          groupRow.addEventListener('click', (e) => {
            if (e.target !== groupExpander) {
              toggleNodeExpansion(groupExpander, groupChildren);
            }
          });

          val.forEach((item, idx) => {
            groupChildren.appendChild(buildAstNodeElement(item, `[${idx}]`, depth + 2, isDecorated));
          });
          groupEl.appendChild(groupChildren);
          childrenContainer.appendChild(groupEl);
        }
      } else {
        childrenContainer.appendChild(buildAstNodeElement(val, key, depth + 1, isDecorated));
      }
    });

    nodeEl.appendChild(childrenContainer);

    // Row click: toggle expansion AND jump to line
    row.addEventListener('click', (e) => {
      if (e.target !== expander) {
        toggleNodeExpansion(expander, childrenContainer);
      }
      document
        .querySelectorAll('.ast-node-row.active-selection')
        .forEach((el) => el.classList.remove('active-selection'));
      row.classList.add('active-selection');

      if (node.loc && node.loc.start) {
        jumpToSourceLine(node.loc.start.line, node.loc.start.column);
      }
    });
  } else {
    // Leaf node row click: highlight and jump to line
    row.addEventListener('click', () => {
      document
        .querySelectorAll('.ast-node-row.active-selection')
        .forEach((el) => el.classList.remove('active-selection'));
      row.classList.add('active-selection');

      if (node.loc && node.loc.start) {
        jumpToSourceLine(node.loc.start.line, node.loc.start.column);
      }
    });
  }

  return nodeEl;
}

function renderAstTree(ast, container, isDecorated) {
  if (!container) return;
  container.innerHTML = '';

  if (!ast) {
    container.innerHTML = `<div class="empty-state">No ${isDecorated ? 'decorated' : 'raw'} AST generated yet.</div>`;
    return;
  }

  const rootEl = buildAstNodeElement(ast, '', 0, isDecorated);
  container.appendChild(rootEl);
}

// --------------------------------------------------------------------------
// 2D Graphical AST Tree Diagram (Node-Link Visualizer)
// --------------------------------------------------------------------------

const DIAGRAM_NODE_W = 104;
const DIAGRAM_NODE_H = 46;
const DIAGRAM_H_GAP = 22;
const DIAGRAM_V_GAP = 52;
const DIAGRAM_PAD = 40;

function astToDiagramNode(node, edgeLabel = '', isDecorated = false) {
  if (!node || typeof node !== 'object') {
    return {
      category: 'constant',
      title: 'value',
      subtitle: String(node),
      edgeLabel,
      children: [],
    };
  }

  const loc = node.loc && node.loc.start ? node.loc.start : null;
  const inferredType = isDecorated && node.inferredType ? `: ${node.inferredType}` : '';
  const inferredRet = isDecorated && node.inferredReturnType ? `-> ${node.inferredReturnType}` : '';

  switch (node.type) {
    case 'Program': {
      const children = (node.body || []).map((stmt, idx) =>
        astToDiagramNode(stmt, node.body.length > 1 ? `stmt ${idx + 1}` : '', isDecorated)
      );
      return {
        category: 'statement',
        title: 'statement sequence',
        subtitle: `${children.length} statements`,
        edgeLabel,
        loc,
        children,
      };
    }

    case 'VariableDeclaration': {
      const children = [];
      if (node.id) {
        children.push(astToDiagramNode(node.id, 'target', isDecorated));
      }
      if (node.init) {
        children.push(astToDiagramNode(node.init, 'value', isDecorated));
      }
      return {
        category: 'statement',
        title: 'assign',
        subtitle: inferredType || (node.id ? `var ${node.id.name}` : ''),
        edgeLabel,
        loc,
        children,
      };
    }

    case 'FunctionDeclaration': {
      const children = [];
      if (node.params) {
        node.params.forEach((param, i) => {
          children.push(astToDiagramNode(param, `param ${i + 1}`, isDecorated));
        });
      }
      if (node.body) {
        children.push(astToDiagramNode(node.body, 'body', isDecorated));
      }
      return {
        category: 'statement',
        title: 'function',
        subtitle: `${node.id ? node.id.name : 'fn'}()${inferredRet}`,
        edgeLabel,
        loc,
        children,
      };
    }

    case 'WhileStatement': {
      const children = [];
      if (node.test) {
        children.push(astToDiagramNode(node.test, 'condition', isDecorated));
      }
      if (node.body) {
        children.push(astToDiagramNode(node.body, 'body', isDecorated));
      }
      return {
        category: 'statement',
        title: 'while',
        subtitle: 'loop',
        edgeLabel,
        loc,
        children,
      };
    }

    case 'IfStatement': {
      const children = [];
      if (node.test) {
        children.push(astToDiagramNode(node.test, 'condition', isDecorated));
      }
      if (node.consequent) {
        children.push(astToDiagramNode(node.consequent, 'if-body', isDecorated));
      }
      if (node.alternate) {
        children.push(astToDiagramNode(node.alternate, 'else-body', isDecorated));
      }
      return {
        category: 'statement',
        title: 'branch',
        subtitle: 'if / else',
        edgeLabel,
        loc,
        children,
      };
    }

    case 'BlockStatement': {
      const stmts = node.body || [];
      if (stmts.length === 1) {
        return astToDiagramNode(stmts[0], edgeLabel, isDecorated);
      }
      return {
        category: 'statement',
        title: 'statement sequence',
        subtitle: `${stmts.length} stmts`,
        edgeLabel,
        loc,
        children: stmts.map((s, idx) => astToDiagramNode(s, `stmt ${idx + 1}`, isDecorated)),
      };
    }

    case 'ReturnStatement': {
      const children = [];
      if (node.argument) {
        children.push(astToDiagramNode(node.argument, 'value', isDecorated));
      }
      return {
        category: 'statement',
        title: 'return',
        subtitle: inferredType || (node.argument ? '' : 'void'),
        edgeLabel,
        loc,
        children,
      };
    }

    case 'ExpressionStatement': {
      return astToDiagramNode(node.expression, edgeLabel, isDecorated);
    }

    case 'BinaryExpression': {
      const isCompare = ['==', '!=', '<', '<=', '>', '>='].includes(node.operator);
      const isLogical = ['and', 'or'].includes(node.operator);
      const category = isCompare ? 'statement' : (isLogical ? 'statement' : 'operation');
      const title = isCompare ? 'compare' : (isLogical ? 'logical op' : 'bin op');

      const children = [];
      if (node.left) {
        children.push(astToDiagramNode(node.left, 'left', isDecorated));
      }
      if (node.right) {
        children.push(astToDiagramNode(node.right, 'right', isDecorated));
      }
      return {
        category,
        title,
        subtitle: `op: ${node.operator}${inferredType ? ' ' + inferredType : ''}`,
        edgeLabel,
        loc,
        children,
      };
    }

    case 'UnaryExpression': {
      const children = [];
      if (node.argument) {
        children.push(astToDiagramNode(node.argument, 'operand', isDecorated));
      }
      return {
        category: 'operation',
        title: 'unary op',
        subtitle: `op: ${node.operator}`,
        edgeLabel,
        loc,
        children,
      };
    }

    case 'Identifier': {
      return {
        category: 'variable',
        title: 'variable',
        subtitle: `name: ${node.name}${inferredType ? ' ' + inferredType : ''}`,
        edgeLabel,
        loc,
        children: [],
      };
    }

    case 'Literal':
    case 'NumericLiteral':
    case 'StringLiteral':
    case 'BooleanLiteral': {
      let valStr = String(node.value !== undefined ? JSON.stringify(node.value) : (node.raw || ''));
      if (valStr.length > 12) valStr = valStr.substring(0, 10) + '...';
      return {
        category: 'constant',
        title: 'constant',
        subtitle: `value: ${valStr}`,
        edgeLabel,
        loc,
        children: [],
      };
    }

    case 'CallExpression': {
      const fnName = node.callee ? (node.callee.name || 'fn') : 'fn';
      const children = [];
      if (node.arguments) {
        node.arguments.forEach((arg, i) => {
          children.push(astToDiagramNode(arg, `arg ${i + 1}`, isDecorated));
        });
      }
      return {
        category: 'operation',
        title: 'call',
        subtitle: `${fnName}()${inferredType ? ' ' + inferredType : ''}`,
        edgeLabel,
        loc,
        children,
      };
    }

    case 'ArrayLiteral':
    case 'ArrayExpression': {
      const children = (node.elements || []).map((el, i) =>
        astToDiagramNode(el, `[${i}]`, isDecorated)
      );
      return {
        category: 'constant',
        title: 'array',
        subtitle: `[${children.length} items]`,
        edgeLabel,
        loc,
        children,
      };
    }

    case 'IndexExpression':
    case 'SubscriptExpression': {
      const children = [];
      if (node.object) {
        children.push(astToDiagramNode(node.object, 'target', isDecorated));
      }
      if (node.index) {
        children.push(astToDiagramNode(node.index, 'index', isDecorated));
      }
      return {
        category: 'operation',
        title: 'subscript',
        subtitle: `index lookup${inferredType ? ' ' + inferredType : ''}`,
        edgeLabel,
        loc,
        children,
      };
    }

    case 'SliceExpression': {
      const children = [];
      if (node.object) {
        children.push(astToDiagramNode(node.object, 'target', isDecorated));
      }
      if (node.start) {
        children.push(astToDiagramNode(node.start, 'start', isDecorated));
      }
      if (node.stop) {
        children.push(astToDiagramNode(node.stop, 'stop', isDecorated));
      }
      if (node.step) {
        children.push(astToDiagramNode(node.step, 'step', isDecorated));
      }
      return {
        category: 'operation',
        title: 'slice',
        subtitle: `slice${inferredType ? ' ' + inferredType : ''}`,
        edgeLabel,
        loc,
        children,
      };
    }

    case 'ListComprehension': {
      const children = [];
      if (node.element) {
        children.push(astToDiagramNode(node.element, 'element', isDecorated));
      }
      if (node.clauses) {
        node.clauses.forEach((c, idx) => {
          if (c.target) children.push(astToDiagramNode(c.target, `var ${idx + 1}`, isDecorated));
          if (c.iter) children.push(astToDiagramNode(c.iter, `in ${idx + 1}`, isDecorated));
          if (c.ifs) {
            c.ifs.forEach((cond, ci) => {
              children.push(astToDiagramNode(cond, `if ${ci + 1}`, isDecorated));
            });
          }
        });
      }
      return {
        category: 'operation',
        title: 'comprehension',
        subtitle: `list comp${inferredType ? ' ' + inferredType : ''}`,
        edgeLabel,
        loc,
        children,
      };
    }

    default: {
      return {
        category: 'statement',
        title: String(node.type || 'Node'),
        subtitle: '',
        edgeLabel,
        loc,
        children: [],
      };
    }
  }
}

function computeDiagramSubtreeWidth(node) {
  node.width = DIAGRAM_NODE_W;
  node.height = DIAGRAM_NODE_H;

  if (!node.children || node.children.length === 0) {
    node.subtreeWidth = DIAGRAM_NODE_W;
    return DIAGRAM_NODE_W;
  }

  let childrenWidth = 0;
  for (let i = 0; i < node.children.length; i++) {
    const childWidth = computeDiagramSubtreeWidth(node.children[i]);
    childrenWidth += childWidth;
    if (i > 0) childrenWidth += DIAGRAM_H_GAP;
  }

  node.subtreeWidth = Math.max(DIAGRAM_NODE_W, childrenWidth);
  return node.subtreeWidth;
}

function assignDiagramPositions(node, leftX, topY) {
  node.y = topY;

  if (!node.children || node.children.length === 0) {
    node.x = leftX + (node.subtreeWidth - DIAGRAM_NODE_W) / 2;
    return;
  }

  let totalChildWidth = 0;
  for (let i = 0; i < node.children.length; i++) {
    totalChildWidth += node.children[i].subtreeWidth;
    if (i > 0) totalChildWidth += DIAGRAM_H_GAP;
  }

  let currentX = leftX + (node.subtreeWidth - totalChildWidth) / 2;
  const nextY = topY + DIAGRAM_NODE_H + DIAGRAM_V_GAP;

  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    assignDiagramPositions(child, currentX, nextY);
    currentX += child.subtreeWidth + DIAGRAM_H_GAP;
  }

  const firstChild = node.children[0];
  const lastChild = node.children[node.children.length - 1];
  node.x = (firstChild.x + lastChild.x) / 2;
}

function collectDiagramElements(node, nodesList, edgesList) {
  nodesList.push(node);
  if (node.children) {
    for (const child of node.children) {
      edgesList.push({
        parent: node,
        child: child,
        label: child.edgeLabel || '',
      });
      collectDiagramElements(child, nodesList, edgesList);
    }
  }
}

function renderAstDiagram(ast, container, isDecorated, state) {
  if (!container) return;
  container.innerHTML = '';

  if (!ast) {
    container.innerHTML = `<div class="empty-state">No ${isDecorated ? 'decorated' : 'raw'} AST generated yet.</div>`;
    return;
  }

  const rootDiagram = astToDiagramNode(ast, '', isDecorated);
  computeDiagramSubtreeWidth(rootDiagram);
  assignDiagramPositions(rootDiagram, DIAGRAM_PAD, DIAGRAM_PAD);

  const nodes = [];
  const edges = [];
  collectDiagramElements(rootDiagram, nodes, edges);

  const totalWidth = rootDiagram.subtreeWidth + DIAGRAM_PAD * 2;
  let maxDepthY = 0;
  for (const n of nodes) {
    if (n.y > maxDepthY) maxDepthY = n.y;
  }
  const totalHeight = maxDepthY + DIAGRAM_NODE_H + DIAGRAM_PAD * 2;

  state.bbox = { width: totalWidth, height: totalHeight };

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'ast-diagram-svg');

  const viewportG = document.createElementNS(svgNS, 'g');
  viewportG.setAttribute('class', 'ast-diagram-viewport-g');
  svg.appendChild(viewportG);
  state.svgG = viewportG;

  // Render edges
  const edgesG = document.createElementNS(svgNS, 'g');
  edgesG.setAttribute('class', 'ast-edges-group');
  for (const edge of edges) {
    const px = edge.parent.x + DIAGRAM_NODE_W / 2;
    const py = edge.parent.y + DIAGRAM_NODE_H;
    const cx = edge.child.x + DIAGRAM_NODE_W / 2;
    const cy = edge.child.y;

    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('class', 'ast-diagram-edge');
    line.setAttribute('x1', String(px));
    line.setAttribute('y1', String(py));
    line.setAttribute('x2', String(cx));
    line.setAttribute('y2', String(cy));
    edgesG.appendChild(line);

    if (edge.label) {
      const midX = (px + cx) / 2;
      const midY = (py + cy) / 2;
      const labelW = Math.max(34, edge.label.length * 6.5 + 10);
      const labelH = 16;

      const labelG = document.createElementNS(svgNS, 'g');
      labelG.setAttribute('class', 'ast-edge-label-group');

      const bg = document.createElementNS(svgNS, 'rect');
      bg.setAttribute('class', 'ast-edge-label-bg');
      bg.setAttribute('x', String(midX - labelW / 2));
      bg.setAttribute('y', String(midY - labelH / 2));
      bg.setAttribute('width', String(labelW));
      bg.setAttribute('height', String(labelH));

      const text = document.createElementNS(svgNS, 'text');
      text.setAttribute('class', 'ast-edge-label-text');
      text.setAttribute('x', String(midX));
      text.setAttribute('y', String(midY + 3));
      text.textContent = edge.label;

      labelG.appendChild(bg);
      labelG.appendChild(text);
      edgesG.appendChild(labelG);
    }
  }
  viewportG.appendChild(edgesG);

  // Render nodes
  const nodesG = document.createElementNS(svgNS, 'g');
  nodesG.setAttribute('class', 'ast-nodes-group');
  for (const n of nodes) {
    const nodeG = document.createElementNS(svgNS, 'g');
    nodeG.setAttribute('class', `ast-diagram-node node-${n.category}`);
    nodeG.setAttribute('transform', `translate(${n.x}, ${n.y})`);

    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('class', 'ast-node-box');
    rect.setAttribute('width', String(DIAGRAM_NODE_W));
    rect.setAttribute('height', String(DIAGRAM_NODE_H));
    nodeG.appendChild(rect);

    const title = document.createElementNS(svgNS, 'text');
    title.setAttribute('class', 'ast-node-text-title');
    title.setAttribute('x', String(DIAGRAM_NODE_W / 2));
    title.setAttribute('y', n.subtitle ? '17' : '24');
    title.textContent = n.title;
    nodeG.appendChild(title);

    if (n.subtitle) {
      const sub = document.createElementNS(svgNS, 'text');
      sub.setAttribute('class', 'ast-node-text-sub');
      sub.setAttribute('x', String(DIAGRAM_NODE_W / 2));
      sub.setAttribute('y', '32');
      sub.textContent = n.subtitle;
      nodeG.appendChild(sub);
    }

    // Node click to jump to line in Python editor
    nodeG.addEventListener('click', (e) => {
      e.stopPropagation();
      document
        .querySelectorAll('.ast-diagram-node.active-selection')
        .forEach((el) => el.classList.remove('active-selection'));
      nodeG.classList.add('active-selection');

      if (n.loc) {
        jumpToSourceLine(n.loc.line, n.loc.column);
      }
    });

    nodesG.appendChild(nodeG);
  }
  viewportG.appendChild(nodesG);

  container.appendChild(svg);

  // Auto-fit initial zoom & center
  fitDiagramToViewport(container, state);
  applyDiagramTransform(state);

  // Bind Pan & Zoom handlers
  setupDiagramInteractions(container, state);
}

function fitDiagramToViewport(container, state) {
  if (!state || !state.bbox) return;
  const cw = container.clientWidth || 800;
  const ch = container.clientHeight || 280;

  const scaleX = (cw - 40) / state.bbox.width;
  const scaleY = (ch - 40) / state.bbox.height;
  state.zoom = Math.min(1.0, Math.max(0.2, Math.min(scaleX, scaleY)));

  state.panX = Math.max(20, (cw - state.bbox.width * state.zoom) / 2);
  state.panY = 20;
}

function applyDiagramTransform(state) {
  if (state && state.svgG) {
    state.svgG.setAttribute(
      'transform',
      `translate(${state.panX}, ${state.panY}) scale(${state.zoom})`
    );
  }
}

function zoomDiagram(state, delta) {
  if (!state) return;
  const newZoom = Math.min(2.5, Math.max(0.15, state.zoom * delta));
  state.zoom = newZoom;
  applyDiagramTransform(state);
}

function setupDiagramInteractions(container, state) {
  if (container._hasInteractions) return;
  container._hasInteractions = true;

  container.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    state.isDragging = true;
    state.startX = e.clientX - state.panX;
    state.startY = e.clientY - state.panY;
  });

  window.addEventListener('mousemove', (e) => {
    if (!state.isDragging) return;
    state.panX = e.clientX - state.startX;
    state.panY = e.clientY - state.startY;
    applyDiagramTransform(state);
  });

  window.addEventListener('mouseup', () => {
    state.isDragging = false;
  });

  container.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      const newZoom = Math.min(2.5, Math.max(0.15, state.zoom * factor));

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      state.panX = mouseX - (mouseX - state.panX) * (newZoom / state.zoom);
      state.panY = mouseY - (mouseY - state.panY) * (newZoom / state.zoom);
      state.zoom = newZoom;

      applyDiagramTransform(state);
    },
    { passive: false }
  );
}

// --------------------------------------------------------------------------
// AST Toolbar Handlers & View Toggles (Diagram / Tree / JSON)
// --------------------------------------------------------------------------
document.querySelectorAll('.btn-tool-toggle').forEach((btn) => {
  btn.addEventListener('click', () => {
    const paneId = btn.getAttribute('data-pane');
    const view = btn.getAttribute('data-view');
    const pane = document.getElementById(paneId);
    if (!pane) return;

    pane.querySelectorAll('.btn-tool-toggle').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    // Handle Tab 2: Symbol Table toggles
    if (paneId === 'tab-symbol-table') {
      const scopedEl = document.getElementById('symbol-table-scoped');
      const unifiedEl = document.getElementById('symbol-table-unified');
      const jsonEl = document.getElementById('symbol-table-json');

      if (view === 'scoped') {
        if (scopedEl) scopedEl.style.display = 'flex';
        if (unifiedEl) unifiedEl.style.display = 'none';
        if (jsonEl) jsonEl.style.display = 'none';
      } else if (view === 'unified') {
        if (scopedEl) scopedEl.style.display = 'none';
        if (unifiedEl) unifiedEl.style.display = 'block';
        if (jsonEl) jsonEl.style.display = 'none';
      } else {
        if (scopedEl) scopedEl.style.display = 'none';
        if (unifiedEl) unifiedEl.style.display = 'none';
        if (jsonEl) jsonEl.style.display = 'block';
      }
      return;
    }

    // Handle AST Tabs (Decorated & Raw)
    const diagramEl = pane.querySelector('.ast-diagram-viewport');
    const treeEl = pane.querySelector('.ast-tree-view');
    const jsonEl = pane.querySelector('.json-viewer');
    const isDecorated = paneId.includes('decorated');
    const diagramActionsEl = document.getElementById(isDecorated ? 'decorated-diagram-actions' : 'raw-diagram-actions');
    const treeActionsEl = document.getElementById(isDecorated ? 'decorated-tree-actions' : 'raw-tree-actions');

    if (view === 'diagram') {
      if (diagramEl) diagramEl.style.display = 'block';
      if (treeEl) treeEl.style.display = 'none';
      if (jsonEl) jsonEl.style.display = 'none';
      if (diagramActionsEl) diagramActionsEl.style.display = 'flex';
      if (treeActionsEl) treeActionsEl.style.display = 'none';

      const state = isDecorated ? decoratedDiagramState : rawDiagramState;
      const container = isDecorated ? decoratedAstDiagram : rawAstDiagram;
      fitDiagramToViewport(container, state);
      applyDiagramTransform(state);
    } else if (view === 'tree') {
      if (diagramEl) diagramEl.style.display = 'none';
      if (treeEl) treeEl.style.display = 'block';
      if (jsonEl) jsonEl.style.display = 'none';
      if (diagramActionsEl) diagramActionsEl.style.display = 'none';
      if (treeActionsEl) treeActionsEl.style.display = 'flex';
    } else {
      if (diagramEl) diagramEl.style.display = 'none';
      if (treeEl) treeEl.style.display = 'none';
      if (jsonEl) jsonEl.style.display = 'block';
      if (diagramActionsEl) diagramActionsEl.style.display = 'none';
      if (treeActionsEl) treeActionsEl.style.display = 'none';
    }
  });
});

// --------------------------------------------------------------------------
// Scoped Symbol Table Renderer (Hierarchical Tree of Tables)
// --------------------------------------------------------------------------

function formatScopeTypeBadge(type) {
  switch (type) {
    case 'global':
      return '<span class="scope-badge badge-global">Global Scope</span>';
    case 'function':
      return '<span class="scope-badge badge-function">Procedure / Function Scope</span>';
    case 'loop':
      return '<span class="scope-badge badge-loop">Loop Scope</span>';
    case 'block':
      return '<span class="scope-badge badge-block">Inner Block Scope</span>';
    default:
      return `<span class="scope-badge">${escapeHtml(type)}</span>`;
  }
}

function formatKindBadge(kind, scopeType) {
  switch (kind) {
    case 'function':
      return '<span class="sym-kind">Procedure</span>';
    case 'parameter':
      return '<span class="sym-kind">Procedure Parameter</span>';
    case 'variable':
      if (scopeType === 'global') return '<span class="sym-kind">Global Variable</span>';
      if (scopeType === 'block') return '<span class="sym-kind">Inner Variable</span>';
      return '<span class="sym-kind">Local Variable</span>';
    default:
      return `<span class="sym-kind">${escapeHtml(kind)}</span>`;
  }
}

function buildScopeCardElement(scope) {
  const card = document.createElement('div');
  card.className = 'scope-card';
  card.setAttribute('data-scope-type', scope.scopeType || 'block');

  const symbolEntries = Object.entries(scope.symbols || {});
  const numSymbols = symbolEntries.length;

  const header = document.createElement('div');
  header.className = 'scope-header';
  header.innerHTML = `
    <div class="scope-title">
      ${formatScopeTypeBadge(scope.scopeType)}
      <span class="scope-name">${escapeHtml(scope.scopeName)}</span>
    </div>
    <span class="scope-sym-count">${numSymbols} local symbol${numSymbols === 1 ? '' : 's'}</span>
  `;
  card.appendChild(header);

  // Green header table - matching reference diagram
  const table = document.createElement('table');
  table.className = 'scope-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th style="width: 170px;">Symbol</th>
        <th style="width: 220px;">Type</th>
        <th style="width: 200px;">Scope / Kind</th>
        <th>Mutability Invariant</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement('tbody');
  if (symbolEntries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="scope-empty-row">No local symbols declared in this block (inherits from parent scope)</td></tr>`;
  } else {
    for (const [name, sym] of symbolEntries) {
      const tr = document.createElement('tr');
      const mutBadge = sym.isMutable
        ? '<span class="sym-mut-mut">Mutable (Reassigned)</span>'
        : '<span class="sym-mut-const">Static Invariant (Const)</span>';

      tr.innerHTML = `
        <td><code class="sym-name">${escapeHtml(name)}</code></td>
        <td><span class="sym-type">${escapeHtml(sym.type)}</span></td>
        <td>${formatKindBadge(sym.kind, scope.scopeType)}</td>
        <td>${mutBadge}</td>
      `;
      tbody.appendChild(tr);
    }
  }
  table.appendChild(tbody);
  card.appendChild(table);

  // If child scopes exist, render branch connector and child cards
  if (scope.children && scope.children.length > 0) {
    const branch = document.createElement('div');
    branch.className = 'scope-children-branch';
    for (const childScope of scope.children) {
      branch.appendChild(buildScopeCardElement(childScope));
    }
    card.appendChild(branch);
  }

  return card;
}

function countTotalScopesAndSymbols(scope) {
  let scopes = 1;
  let symbols = Object.keys(scope.symbols || {}).length;
  if (scope.children) {
    for (const c of scope.children) {
      const res = countTotalScopesAndSymbols(c);
      scopes += res.scopes;
      symbols += res.symbols;
    }
  }
  return { scopes, symbols };
}

function renderScopedSymbolTables(rootScope) {
  if (!symbolTableScoped) return;
  symbolTableScoped.innerHTML = '';

  if (!rootScope) {
    symbolTableScoped.innerHTML = '<div class="empty-state">No symbol table generated yet.</div>';
    if (symCountTag) symCountTag.textContent = '0 Scopes | 0 Symbols';
    return;
  }

  const { scopes, symbols } = countTotalScopesAndSymbols(rootScope);
  if (symCountTag) {
    symCountTag.textContent = `${scopes} Scope${scopes === 1 ? '' : 's'} | ${symbols} Symbol${symbols === 1 ? '' : 's'}`;
  }

  const rootCard = buildScopeCardElement(rootScope);
  symbolTableScoped.appendChild(rootCard);
}

function renderUnifiedSymbolTable(rootScope) {
  if (!unifiedSymbolsBody) return;
  unifiedSymbolsBody.innerHTML = '';

  if (!rootScope) {
    unifiedSymbolsBody.innerHTML = '<tr><td colspan="5" class="empty-state">No symbols generated yet.</td></tr>';
    return;
  }

  const allRows = [];
  function collectSymbols(scope, path) {
    const currentPath = path ? `${path} > ${scope.scopeName}` : scope.scopeName;
    for (const [name, sym] of Object.entries(scope.symbols || {})) {
      allRows.push({
        name,
        type: sym.type,
        kind: sym.kind,
        scopeType: scope.scopeType,
        path: currentPath,
        isMutable: sym.isMutable,
      });
    }
    if (scope.children) {
      for (const child of scope.children) {
        collectSymbols(child, currentPath);
      }
    }
  }

  collectSymbols(rootScope, '');

  if (allRows.length === 0) {
    unifiedSymbolsBody.innerHTML = '<tr><td colspan="5" class="empty-state">No symbols found.</td></tr>';
    return;
  }

  const rowsHtml = allRows.map((item) => {
    const mutBadge = item.isMutable
      ? '<span class="sym-mut-mut">Mutable</span>'
      : '<span class="sym-mut-const">Static Invariant</span>';
    return `
      <tr>
        <td><code class="sym-name">${escapeHtml(item.name)}</code></td>
        <td><span class="sym-type">${escapeHtml(item.type)}</span></td>
        <td>${formatKindBadge(item.kind, item.scopeType)}</td>
        <td><code>${escapeHtml(item.path)}</code></td>
        <td>${mutBadge}</td>
      </tr>
    `;
  });

  unifiedSymbolsBody.innerHTML = rowsHtml.join('');
}

if (decoratedZoomIn) {
  decoratedZoomIn.addEventListener('click', () => zoomDiagram(decoratedDiagramState, 1.25));
}
if (decoratedZoomOut) {
  decoratedZoomOut.addEventListener('click', () => zoomDiagram(decoratedDiagramState, 0.8));
}
if (decoratedZoomReset) {
  decoratedZoomReset.addEventListener('click', () => {
    fitDiagramToViewport(decoratedAstDiagram, decoratedDiagramState);
    applyDiagramTransform(decoratedDiagramState);
  });
}

if (rawZoomIn) {
  rawZoomIn.addEventListener('click', () => zoomDiagram(rawDiagramState, 1.25));
}
if (rawZoomOut) {
  rawZoomOut.addEventListener('click', () => zoomDiagram(rawDiagramState, 0.8));
}
if (rawZoomReset) {
  rawZoomReset.addEventListener('click', () => {
    fitDiagramToViewport(rawAstDiagram, rawDiagramState);
    applyDiagramTransform(rawDiagramState);
  });
}

if (decoratedExpandAll) {
  decoratedExpandAll.addEventListener('click', () => expandAll(decoratedAstTree));
}
if (decoratedCollapseAll) {
  decoratedCollapseAll.addEventListener('click', () => collapseAll(decoratedAstTree));
}
if (rawExpandAll) {
  rawExpandAll.addEventListener('click', () => expandAll(rawAstTree));
}
if (rawCollapseAll) {
  rawCollapseAll.addEventListener('click', () => collapseAll(rawAstTree));
}

// Inspector Tabs
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-tab');
    tabButtons.forEach((b) => b.classList.remove('active'));
    tabPanes.forEach((p) => p.classList.remove('active'));

    btn.classList.add('active');
    const pane = document.getElementById(`tab-${target}`);
    if (pane) {
      pane.classList.add('active');
    }
  });
});

// Initial boot
window.addEventListener('DOMContentLoaded', () => {
  pyInput.value = PRESETS.review2;
  executeTranspile();
});
