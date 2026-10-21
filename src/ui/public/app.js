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
