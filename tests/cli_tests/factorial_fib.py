def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

def fibonacci(limit):
    a = 0
    b = 1
    count = 0
    while count < limit:
        temp = a + b
        a = b
        b = temp
        count = count + 1
    return a

fact5 = factorial(5)
fib7 = fibonacci(7)
print(fact5)
print(fib7)
