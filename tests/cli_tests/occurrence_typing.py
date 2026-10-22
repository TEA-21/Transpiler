def format_payload(item):
    if isinstance(item, int):
        return item * 10
    else:
        return item

val_int = format_payload(42)
val_str = format_payload("SAMPLE_TOKEN")
print(val_int)
print(val_str)
