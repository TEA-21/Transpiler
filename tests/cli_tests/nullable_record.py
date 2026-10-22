def find_user(user_id):
    if user_id <= 0:
        return None
    return "User_Record"

current_user = find_user(101)
if current_user is not None:
    print(current_user)
else:
    print("ANONYMOUS")

missing_user = find_user(0)
if missing_user is None:
    print("NO_RECORD")
