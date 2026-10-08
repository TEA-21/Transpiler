# demo.py - Mini-Python Transpiler Review 1 Demonstration

# 1. Primitive Bindings
threshold = 100
status = "Approved"

# 2. Function with Bidirectional Constraint Propagation
def process_average(total, count):
    if count == 0:
        return 0
    return total / count

# 3. Homogeneous Arrays & While Loop Tracking
scores = [45, 60, 85]
index = 0
sum_val = 0

while index < 3:
    sum_val = sum_val + scores[index]
    index = index + 1

# 4. Conditionals & Semantic Type Inference
if sum_val > threshold:
    print(status)
else:
    print("Rejected")