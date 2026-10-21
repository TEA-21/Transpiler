# demo_review2.py - Mini-Python Transpiler Review 2 Evaluation Pipeline

# 1. Primitive Bindings & Local Static Type Inference
base_limit = 100
system_status = "OPERATIONAL"
strict_mode = True

# 2. Function Declaration with Bidirectional Constraint Propagation
def compute_weighted_average(total_weight, sample_count):
    if sample_count == 0:
        return 0
    return total_weight / sample_count

# 3. Homogeneous Array Constructs, Indexing & While Loop Static Invariants
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
    print("STATUS_REVISE")
