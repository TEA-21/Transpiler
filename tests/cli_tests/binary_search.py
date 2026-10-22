def binary_search(arr, target, length):
    low = 0
    high = length - 1
    found_idx = 0 - 1
    while low <= high:
        mid = (low + high) / 2
        mid_val = arr[mid]
        if mid_val == target:
            found_idx = mid
            low = high + 1
        else:
            if mid_val < target:
                low = mid + 1
            else:
                high = mid - 1
    return found_idx

numbers = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
target_val = 23
result = binary_search(numbers, target_val, 10)
print(result)
