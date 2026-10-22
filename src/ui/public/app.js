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

  error_reassign: `# [Negative Diagnostic Demo] Conflicting Static Type Reassignment
# Variables maintain static invariant types.
# Reassignment to a different type is rejected at compile time.

count = 10
count = count + 1
count = "This String Assignment Will Fail Compile-Time Type Safety"`,

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
const decoratedAstJson = document.getElementById('decorated-ast-json');
const rawAstJson = document.getElementById('raw-ast-json');
const decoratedAstTree = document.getElementById('decorated-ast-tree');
const rawAstTree = document.getElementById('raw-ast-tree');
const decoratedExpandAll = document.getElementById('decorated-expand-all');
const decoratedCollapseAll = document.getElementById('decorated-collapse-all');
const rawExpandAll = document.getElementById('raw-expand-all');
const rawCollapseAll = document.getElementById('raw-collapse-all');
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
      body: JSON.stringify({ source }),
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

      // Render Symbol Table
      symbolTableJson.textContent = JSON.stringify(data.symbolTable, null, 2);

      // Render ASTs
      decoratedAstJson.textContent = JSON.stringify(data.decoratedAst, null, 2);
      rawAstJson.textContent = JSON.stringify(data.rawAst, null, 2);

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
  if (PRESETS[key]) {
    pyInput.value = PRESETS[key];
    executeTranspile();
  }
});

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
// AST Toolbar Handlers & View Toggles
// --------------------------------------------------------------------------
document.querySelectorAll('.btn-tool-toggle').forEach((btn) => {
  btn.addEventListener('click', () => {
    const paneId = btn.getAttribute('data-pane');
    const view = btn.getAttribute('data-view');
    const pane = document.getElementById(paneId);
    if (!pane) return;

    pane.querySelectorAll('.btn-tool-toggle').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    const treeEl = pane.querySelector('.ast-tree-view');
    const jsonEl = pane.querySelector('.json-viewer');
    const actionsEl = pane.querySelector('.ast-actions');

    if (view === 'tree') {
      if (treeEl) treeEl.style.display = 'block';
      if (jsonEl) jsonEl.style.display = 'none';
      if (actionsEl) actionsEl.style.display = 'flex';
    } else {
      if (treeEl) treeEl.style.display = 'none';
      if (jsonEl) jsonEl.style.display = 'block';
      if (actionsEl) actionsEl.style.display = 'none';
    }
  });
});

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
