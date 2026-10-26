# USP Demo: Flow-Sensitive List Comprehensions & Slice Operations
nums = [10, 20, 30, 40, 50]

# 1. Array slicing with start, stop, and step
first_three = nums[:3]
middle = nums[1:4]
from_two = nums[2:]
reversed_nums = nums[::-1]
last_item = nums[-1]

print(first_three)
print(middle)
print(from_two)
print(reversed_nums)
print(last_item)

# 2. Flow-sensitive occurrence typing in comprehension filters
def format_data(item):
    if isinstance(item, int):
        return item * 10
    else:
        return item

dataset = [format_data(1), format_data("sample_token"), format_data(5)]
only_doubled_ints = [x * 2 for x in dataset if isinstance(x, int)]

print(only_doubled_ints)

# 3. Nested multi-loop comprehension (flatMap)
matrix = [[1, 2], [3, 4]]
flat_cells = [cell * 2 for row in matrix for cell in row]

print(flat_cells)
