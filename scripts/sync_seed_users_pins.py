import json
import hashlib
import bcrypt

def hash_pin(pin: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pin.encode("utf-8"), salt).decode("utf-8")

def compute_pin_index(pin: str) -> str:
    return hashlib.sha256(pin.encode("utf-8")).hexdigest()

def main():
    with open('scripts/pins_table.json', 'r', encoding='utf-8') as f:
        pins_table = json.load(f)

    with open('backend/data/seeds/core_seed.json', 'r', encoding='utf-8') as f:
        core_seed = json.load(f)

    users_list = core_seed['collections']['users']
    users_by_email = {u.get('email'): u for u in users_list if u.get('email')}
    
    updated_count = 0
    created_count = 0

    for item in pins_table:
        email = item.get('email')
        login_pin = str(item.get('login_pin'))
        att_pin = str(item.get('attendance_pin'))
        name = item.get('name')
        role = item.get('role')
        branch = item.get('branch', 'branch_main')
        if branch == "Todas / Central":
            branch = "branch_main"

        user = users_by_email.get(email)
        if user:
            user['is_active'] = True
            user['is_pin_user'] = True
            user['failed_pin_attempts'] = 0
            user['pin_lockout_until'] = None
            user['kiosk_pin_plain'] = att_pin
            user['attendance_pin_hash'] = hash_pin(att_pin)
            user['attendance_pin_index'] = compute_pin_index(att_pin)
            user['login_pin_hash'] = hash_pin(login_pin)
            user['login_pin_index'] = compute_pin_index(login_pin)
            user['pin_hash'] = user['attendance_pin_hash']
            user['pin_index'] = user['attendance_pin_index']
            user['role'] = role
            updated_count += 1
        else:
            new_u = {
                "user_id": f"user_seed_{compute_pin_index(email)[:10]}",
                "email": email,
                "name": name,
                "role": role,
                "branch_id": branch,
                "is_active": True,
                "is_pin_user": True,
                "kiosk_pin_plain": att_pin,
                "attendance_pin_hash": hash_pin(att_pin),
                "attendance_pin_index": compute_pin_index(att_pin),
                "login_pin_hash": hash_pin(login_pin),
                "login_pin_index": compute_pin_index(login_pin),
                "pin_hash": hash_pin(att_pin),
                "pin_index": compute_pin_index(att_pin),
                "failed_pin_attempts": 0,
                "pin_lockout_until": None,
                "created_at": "2026-04-06T17:24:58.828593+00:00"
            }
            users_list.append(new_u)
            users_by_email[email] = new_u
            created_count += 1

    with open('backend/data/seeds/core_seed.json', 'w', encoding='utf-8') as f:
        json.dump(core_seed, f, indent=2, ensure_ascii=False)

    print(f"Updated {updated_count} existing seed users, created {created_count} seed users.")
    print(f"Total users in core_seed.json: {len(users_list)}")

if __name__ == '__main__':
    main()
